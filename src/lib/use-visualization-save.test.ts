/**
 * Tests for use-visualization-save.ts
 *
 * Tests the three public exports:
 *   - createSaveHandler: manages save lifecycle (fetch, state mutation, cleanup)
 *   - loadConfigFromUrl:  resolves config from URLSearchParams (configId or config param)
 *   - createInitialSaveState: factory for the initial SaveState shape
 *
 * Mocking strategy
 * ----------------
 * $app/paths           – registered in test-setup.ts preload as `base = ''`, and
 *                        also overridden here for belt-and-suspenders clarity.
 * $lib/saved-config-loader – mocked so loadConfigFromUrl does not make real network
 *                        calls; the mock returns a pre-built success result by default.
 * $lib/chaos-validation – NOT mocked at the module level to avoid polluting other
 *                        test files that directly test the real implementation. The
 *                        stability warning test passes actual out-of-range values and
 *                        relies on the real checkParameterStability function.
 *
 * Note: mock.module() calls are auto-hoisted by Bun before any import statements.
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// ── Auto-hoisted mocks ──────────────────────────────────────────────────────

mock.module('$app/paths', () => ({ base: '' }));

// Mock the entire saved-config-loader so that:
//   • loadSavedConfigParameters returns a success result for the configId path.
//   • parseConfigParam returns a success result for the inline config path.
// Individual tests can override these at the call-site level if needed.
mock.module('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: mock(async () => ({
		ok: true,
		parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
		source: 'api'
	})),
	parseConfigParam: mock(() => ({
		ok: true,
		parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
	}))
}));

// ── Imports after mocks ─────────────────────────────────────────────────────

import {
	createSaveHandler,
	loadConfigFromUrl,
	createInitialSaveState
} from './use-visualization-save';
import type { SaveState } from './use-visualization-save';
import type { ChaosMapParameters } from '$lib/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a SaveState with sensible defaults, optionally overriding fields. */
function makeState(overrides?: Partial<SaveState>): SaveState {
	return { ...createInitialSaveState(), ...overrides };
}

const defaultParams: ChaosMapParameters = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
const getParams = () => defaultParams;

/**
 * Construct a minimal fetch mock whose response satisfies the subset of the
 * Response interface used by createSaveHandler.
 */
function makeFetch(response: {
	ok: boolean;
	status?: number;
	json?: () => Promise<unknown>;
}): typeof fetch {
	return mock(async () => ({
		ok: response.ok,
		status: response.status ?? (response.ok ? 200 : 400),
		json: response.json ?? (async () => ({ error: 'failed' }))
	})) as unknown as typeof fetch;
}

// ── createSaveHandler ────────────────────────────────────────────────────────

describe('createSaveHandler', () => {
	// Keep a reference to the original globalThis.fetch so each test can
	// restore it after patching.
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	// ── success flow ──────────────────────────────────────────────────────────

	describe('success flow', () => {
		test('sets saveSuccess and closes dialog on success', async () => {
			const state = makeState({ showSaveDialog: true });
			globalThis.fetch = makeFetch({ ok: true });

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(state.saveSuccess).toBe(true);
			expect(state.showSaveDialog).toBe(false);
			expect(state.saveError).toBeNull();

			cleanup();
		});

		test('resets isSaving to false after success', async () => {
			const state = makeState();
			globalThis.fetch = makeFetch({ ok: true });

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(state.isSaving).toBe(false);

			cleanup();
		});

		test('calls fetch with correct POST body', async () => {
			const state = makeState();
			const fetchMock = makeFetch({ ok: true });
			globalThis.fetch = fetchMock;

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			// fetchMock is a bun mock; cast to access .mock
			const calls = (fetchMock as unknown as ReturnType<typeof mock>).mock.calls;
			expect(calls).toHaveLength(1);

			const [url, init] = calls[0] as [string, RequestInit];
			expect(url).toBe('/api/save-config');
			expect(init.method).toBe('POST');

			const body = JSON.parse(init.body as string) as {
				name: string;
				mapType: string;
				parameters: unknown;
			};
			expect(body.name).toBe('My Config');
			expect(body.mapType).toBe('lorenz');
			expect(body.parameters).toEqual(defaultParams);

			cleanup();
		});
	});

	// ── error flow ────────────────────────────────────────────────────────────

	describe('error flow', () => {
		test('sets saveError on HTTP error response', async () => {
			const state = makeState();
			globalThis.fetch = makeFetch({
				ok: false,
				json: async () => ({ error: 'Server error occurred' })
			});

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(state.saveError).toBe('Server error occurred');
			expect(state.saveSuccess).toBe(false);
			expect(state.isSaving).toBe(false);

			cleanup();
		});

		test('falls back to generic message when error response has no .error field', async () => {
			const state = makeState();
			globalThis.fetch = makeFetch({
				ok: false,
				json: async () => ({})
			});

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(state.saveError).toBe('Failed to save configuration');
			expect(state.isSaving).toBe(false);

			cleanup();
		});

		test('sets saveError on network error', async () => {
			const state = makeState();
			globalThis.fetch = mock(async () => {
				throw new Error('Network failure');
			}) as unknown as typeof fetch;

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(state.saveError).toBe('Network failure');
			expect(state.isSaving).toBe(false);

			cleanup();
		});

		test('sets generic saveError when thrown value is not an Error instance', async () => {
			const state = makeState();
			globalThis.fetch = mock(async () => {
				throw 'string thrown';
			}) as unknown as typeof fetch;

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(state.saveError).toBe('Failed to save configuration');
			expect(state.isSaving).toBe(false);

			cleanup();
		});
	});

	// ── concurrency guard ─────────────────────────────────────────────────────

	describe('concurrency guard', () => {
		test('does not start a second save while isSaving is true', async () => {
			// Simulate an in-progress save by pre-setting isSaving.
			const state = makeState({ isSaving: true });
			let fetchCallCount = 0;
			globalThis.fetch = mock(async () => {
				fetchCallCount++;
				return { ok: true, json: async () => ({}) };
			}) as unknown as typeof fetch;

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(fetchCallCount).toBe(0);

			cleanup();
		});
	});

	// ── cleanup ───────────────────────────────────────────────────────────────

	describe('cleanup', () => {
		test('cleanup does not throw when called with no in-flight request', () => {
			const state = makeState();
			const { cleanup } = createSaveHandler('lorenz', state, getParams);
			expect(() => cleanup()).not.toThrow();
		});

		test('cleanup cancels pending timeout so saveSuccess is not cleared prematurely', async () => {
			const state = makeState();
			globalThis.fetch = makeFetch({ ok: true });

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			// At this point saveSuccess is true and a timeout is scheduled.
			expect(state.saveSuccess).toBe(true);

			// cleanup() should cancel the timeout — saveSuccess stays true after cleanup.
			cleanup();
			expect(state.saveSuccess).toBe(true);
		});
	});
});

// ── loadConfigFromUrl ────────────────────────────────────────────────────────

describe('loadConfigFromUrl', () => {
	test('returns {ok:"none"} when no url params provided', async () => {
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams()
		});
		expect(result.ok).toBe('none');
	});

	test('returns {ok:"none"} when signal is already aborted (configId path)', async () => {
		// The signal-aborted check in the configId branch happens AFTER
		// loadSavedConfigParameters resolves, so we verify the guard works
		// when the controller is aborted before calling loadConfigFromUrl.
		// Because loadSavedConfigParameters is mocked to resolve immediately,
		// the abort is detected on the post-await signal check.
		const controller = new AbortController();
		controller.abort();
		const params = new URLSearchParams({ configId: 'some-id' });

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params,
			signal: controller.signal
		});

		expect(result.ok).toBe('none');
	});

	test('returns parameters from saved config via configId param', async () => {
		const params = new URLSearchParams({ configId: 'abc-123' });

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params
		});

		expect(result.ok).toBe(true);
		if (result.ok === true) {
			expect(result.parameters).toMatchObject({
				type: 'lorenz',
				sigma: 10,
				rho: 28,
				beta: 2.667
			});
			expect(result.stabilityWarnings).toEqual([]);
		}
	});

	test('returns parameters from config inline JSON param', async () => {
		// The inline `config` param path calls parseConfigParam (mocked above).
		const encoded = encodeURIComponent(
			JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
		);
		const params = new URLSearchParams({ config: encoded });

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params
		});

		expect(result.ok).toBe(true);
		if (result.ok === true) {
			expect(result.parameters).toMatchObject({ sigma: 10, rho: 28, beta: 2.667 });
			expect(result.stabilityWarnings).toEqual([]);
		}
	});

	test('returns {ok:false} when loadSavedConfigParameters reports an error', async () => {
		// Temporarily override the module-level mock.
		// Because mock.mock.implementation is always undefined in Bun 1.3.9,
		// we explicitly restore the default after the assertion.
		const { loadSavedConfigParameters } = await import('$lib/saved-config-loader');
		const mockFn = loadSavedConfigParameters as ReturnType<typeof mock>;

		mockFn.mockImplementation(async () => ({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		}));

		const params = new URLSearchParams({ configId: 'missing-id' });
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params
		});

		expect(result.ok).toBe(false);
		if (result.ok === false) {
			expect(result.errors).toContain('Configuration not found');
		}

		// Restore the default success implementation so later tests still pass.
		mockFn.mockImplementation(async () => ({
			ok: true,
			parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			source: 'api'
		}));
	});

	test('returns {ok:false} when parseConfigParam reports an error', async () => {
		const { parseConfigParam } = await import('$lib/saved-config-loader');
		const mockFn = parseConfigParam as ReturnType<typeof mock>;

		mockFn.mockImplementation(() => ({
			ok: false,
			error: 'Invalid parameters',
			errors: ['sigma is required'],
			logMessage: 'Invalid config:',
			logDetails: {}
		}));

		const params = new URLSearchParams({ config: encodeURIComponent('{}') });
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params
		});

		expect(result.ok).toBe(false);
		if (result.ok === false) {
			expect(result.errors).toContain('sigma is required');
		}

		// Restore the default success implementation so later tests still pass.
		mockFn.mockImplementation(() => ({
			ok: true,
			parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
		}));
	});

	test('includes stability warnings when parameters are out of stable range', async () => {
		// Use actual out-of-range parameters for lorenz (sigma > 50) so the real
		// checkParameterStability produces warnings. This avoids mocking
		// $lib/chaos-validation at module level, which would pollute other test
		// files in the same Bun test process.
		const { loadSavedConfigParameters } = await import('$lib/saved-config-loader');
		const mockFn = loadSavedConfigParameters as ReturnType<typeof mock>;

		// Return sigma=100, which exceeds the stable range of 0-50.
		mockFn.mockImplementation(async () => ({
			ok: true,
			parameters: { type: 'lorenz', sigma: 100, rho: 28, beta: 2.667 },
			source: 'api'
		}));

		const params = new URLSearchParams({ configId: 'out-of-range-id' });

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params
		});

		expect(result.ok).toBe(true);
		if (result.ok === true) {
			// The real checkParameterStability should detect sigma=100 is out of range.
			expect(result.stabilityWarnings.length).toBeGreaterThan(0);
		}

		// Restore the default success implementation.
		mockFn.mockImplementation(async () => ({
			ok: true,
			parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			source: 'api'
		}));
	});
});

// ── createInitialSaveState ───────────────────────────────────────────────────

describe('createInitialSaveState', () => {
	test('returns correct initial state shape', () => {
		const state = createInitialSaveState();
		expect(state.showSaveDialog).toBe(false);
		expect(state.isSaving).toBe(false);
		expect(state.saveSuccess).toBe(false);
		expect(state.saveError).toBeNull();
		expect(state.configErrors).toEqual([]);
		expect(state.showConfigError).toBe(false);
		expect(state.stabilityWarnings).toEqual([]);
		expect(state.showStabilityWarning).toBe(false);
	});

	test('returns a fresh object on each call (no shared reference)', () => {
		const a = createInitialSaveState();
		const b = createInitialSaveState();
		a.configErrors.push('mutate');
		expect(b.configErrors).toEqual([]);
	});
});
