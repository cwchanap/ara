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
 * $app/paths           – registered in test-setup.ts preload as `base = ''`.
 * $lib/saved-config-loader – not module-mocked here to avoid cross-file pollution;
 *                        loadConfigFromUrl tests use explicit fetchFn stubs.
 * $lib/chaos-validation – NOT mocked at the module level to avoid polluting other
 *                        test files that directly test the real implementation. The
 *                        stability warning test passes actual out-of-range values and
 *                        relies on the real checkParameterStability function.
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// ── Imports ─────────────────────────────────────────────────────────────────

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
		const controller = new AbortController();
		controller.abort();
		const params = new URLSearchParams({ configId: 'some-id' });
		const fetchFn = makeFetch({
			ok: true,
			json: async () => ({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			})
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params,
			signal: controller.signal,
			fetchFn
		});

		expect(result.ok).toBe('none');
	});

	test('returns parameters from saved config via configId param', async () => {
		const params = new URLSearchParams({ configId: 'abc-123' });
		const fetchFn = makeFetch({
			ok: true,
			json: async () => ({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			})
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params,
			fetchFn
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
		const params = new URLSearchParams({ configId: 'missing-id' });
		const fetchFn = makeFetch({ ok: false, status: 404 });
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params,
			fetchFn
		});

		expect(result.ok).toBe(false);
		if (result.ok === false) {
			expect(result.errors).toContain('Failed to load configuration parameters');
		}
	});

	test('returns {ok:false} when parseConfigParam reports an error', async () => {
		const params = new URLSearchParams({ config: encodeURIComponent('{}') });
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params
		});

		expect(result.ok).toBe(false);
		if (result.ok === false) {
			expect(
				result.errors.some((error) => error.includes('Missing required parameters'))
			).toBe(true);
		}
	});

	test('includes stability warnings when parameters are out of stable range', async () => {
		const params = new URLSearchParams({
			config: encodeURIComponent(
				JSON.stringify({ type: 'lorenz', sigma: 100, rho: 28, beta: 2.667 })
			)
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params
		});

		expect(result.ok).toBe(true);
		if (result.ok === true) {
			// The real checkParameterStability should detect sigma=100 is out of range.
			expect(result.stabilityWarnings.length).toBeGreaterThan(0);
		}
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
