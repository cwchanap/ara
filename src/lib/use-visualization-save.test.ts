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

		test('auto-clears saveSuccess when success timeout callback runs', async () => {
			const state = makeState();
			globalThis.fetch = makeFetch({ ok: true });

			let capturedCallback: (() => void) | null = null;
			const originalSetTimeout = globalThis.setTimeout;
			const originalClearTimeout = globalThis.clearTimeout;
			globalThis.setTimeout = ((cb: TimerHandler) => {
				if (typeof cb === 'function') capturedCallback = cb as () => void;
				return 1 as unknown as ReturnType<typeof setTimeout>;
			}) as unknown as typeof setTimeout;
			globalThis.clearTimeout = ((timeoutId: ReturnType<typeof setTimeout>) => {
				void timeoutId;
			}) as unknown as typeof clearTimeout;

			try {
				const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
				await save('My Config');

				// Timeout is pending — saveSuccess should still be true at this point.
				expect(state.saveSuccess).toBe(true);
				expect(state.showSaveDialog).toBe(false);
				expect(capturedCallback).not.toBeNull();

				// Simulate the timeout firing; now the flag should be cleared.
				capturedCallback!();
				expect(state.saveSuccess).toBe(false);

				cleanup();
			} finally {
				globalThis.setTimeout = originalSetTimeout;
				globalThis.clearTimeout = originalClearTimeout;
			}
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

		test('auto-clears saveError when error timeout callback runs', async () => {
			const state = makeState();
			globalThis.fetch = makeFetch({
				ok: false,
				json: async () => ({ error: 'Server error occurred' })
			});

			let capturedCallback: (() => void) | null = null;
			const originalSetTimeout = globalThis.setTimeout;
			const originalClearTimeout = globalThis.clearTimeout;
			globalThis.setTimeout = ((cb: TimerHandler) => {
				if (typeof cb === 'function') capturedCallback = cb as () => void;
				return 1 as unknown as ReturnType<typeof setTimeout>;
			}) as unknown as typeof setTimeout;
			globalThis.clearTimeout = ((timeoutId: ReturnType<typeof setTimeout>) => {
				void timeoutId;
			}) as unknown as typeof clearTimeout;

			try {
				const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
				await save('My Config');

				// Timeout is pending — saveError should still be set at this point.
				expect(state.saveError).toBe('Server error occurred');
				expect(state.isSaving).toBe(false);
				expect(capturedCallback).not.toBeNull();

				// Simulate the timeout firing; now the error should be cleared.
				capturedCallback!();
				expect(state.saveError).toBeNull();

				cleanup();
			} finally {
				globalThis.setTimeout = originalSetTimeout;
				globalThis.clearTimeout = originalClearTimeout;
			}
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

		test('does not set saveError when fetch throws AbortError', async () => {
			const state = makeState();
			globalThis.fetch = mock(async () => {
				const error = new Error('aborted');
				error.name = 'AbortError';
				throw error;
			}) as unknown as typeof fetch;

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(state.saveError).toBeNull();
			expect(state.saveSuccess).toBe(false);
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

		test('aborts in-flight request when save() is called with abortController still set', async () => {
			const state = makeState();

			let capturedSignal: AbortSignal | null = null;

			// First fetch: hangs until aborted
			globalThis.fetch = mock(
				(_url: RequestInfo | URL, init?: RequestInit) =>
					new Promise<Response>((_, reject) => {
						capturedSignal = (init?.signal as AbortSignal) ?? null;
						capturedSignal?.addEventListener('abort', () => {
							const err = new Error('Aborted');
							err.name = 'AbortError';
							reject(err);
						});
					})
			) as unknown as typeof fetch;

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);

			// Start first save — hangs waiting for fetch
			const firstSavePromise = save('First');
			expect(state.isSaving).toBe(true);

			// Manually reset isSaving to bypass the concurrency guard, then start second save.
			// At this point abortController != null (set by first save), so line 86 runs.
			state.isSaving = false;
			globalThis.fetch = makeFetch({ ok: true });
			await save('Second');

			// First save's abort signal should have fired
			expect(capturedSignal!.aborted).toBe(true);

			// Allow first save to settle after abort
			await firstSavePromise;
			cleanup();
		});

		test('cleanup aborts an in-flight request via AbortController', async () => {
			const state = makeState();

			// Fetch that respects the AbortSignal — rejects when signal fires
			globalThis.fetch = mock(
				(_url: RequestInfo | URL, init?: RequestInit) =>
					new Promise<Response>((_, reject) => {
						const signal = init?.signal;
						if (signal) {
							signal.addEventListener('abort', () => {
								const err = new Error('aborted');
								err.name = 'AbortError';
								reject(err);
							});
						}
					})
			) as unknown as typeof fetch;

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);

			// Start the save but don't await — fetch is still pending
			const savePromise = save('My Config');
			expect(state.isSaving).toBe(true);

			// cleanup() should abort the in-flight request (exercises lines 151-152)
			cleanup();

			// Wait for the aborted save to settle
			await savePromise;

			expect(state.isSaving).toBe(false);
			// AbortError is silently swallowed — no saveError set
			expect(state.saveError).toBeNull();
		});
	});

	// ── timeout-clearing on second save ──────────────────────────────────────

	describe('pending timeout cleared on subsequent save', () => {
		test('second save clears the success timeout from the first save', async () => {
			const state = makeState();
			globalThis.fetch = makeFetch({ ok: true });

			// Stub setTimeout/clearTimeout to capture timer IDs and assert cleanup.
			const originalSetTimeout = globalThis.setTimeout;
			const originalClearTimeout = globalThis.clearTimeout;
			let nextTimerId = 100;
			const scheduledTimers: number[] = [];
			const clearedTimers: number[] = [];
			globalThis.setTimeout = (() => {
				const id = nextTimerId++;
				scheduledTimers.push(id);
				return id as unknown as ReturnType<typeof setTimeout>;
			}) as unknown as typeof setTimeout;
			globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
				clearedTimers.push(id as unknown as number);
			}) as unknown as typeof clearTimeout;

			try {
				const { save, cleanup } = createSaveHandler('lorenz', state, getParams);

				// First save sets saveSuccess=true and schedules a timeout
				await save('First Save');
				expect(state.saveSuccess).toBe(true);
				expect(scheduledTimers).toHaveLength(1);
				const firstTimerId = scheduledTimers[0];

				// Second save should clear the first timer (exercises lines 92-93)
				// and then also succeed
				await save('Second Save');
				expect(clearedTimers).toContain(firstTimerId);
				expect(state.saveSuccess).toBe(true);

				cleanup();
			} finally {
				globalThis.setTimeout = originalSetTimeout;
				globalThis.clearTimeout = originalClearTimeout;
			}
		});

		test('catch-block timeout callback clears saveError (network throw path)', async () => {
			const state = makeState();
			globalThis.fetch = mock(async () => {
				throw new Error('Network failure');
			}) as unknown as typeof fetch;

			let capturedCallback: (() => void) | null = null;
			const originalSetTimeout = globalThis.setTimeout;
			const originalClearTimeout = globalThis.clearTimeout;
			globalThis.setTimeout = ((cb: TimerHandler) => {
				if (typeof cb === 'function') capturedCallback = cb as () => void;
				return 1 as unknown as ReturnType<typeof setTimeout>;
			}) as unknown as typeof setTimeout;
			globalThis.clearTimeout = (() => {}) as unknown as typeof clearTimeout;

			try {
				const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
				await save('My Config');

				// Catch block should have set saveError and scheduled a timeout
				expect(state.saveError).toBe('Network failure');
				expect(capturedCallback).not.toBeNull();

				// Simulate the catch-block timeout firing (exercises lines 135-136)
				capturedCallback!();
				expect(state.saveError).toBeNull();

				cleanup();
			} finally {
				globalThis.setTimeout = originalSetTimeout;
				globalThis.clearTimeout = originalClearTimeout;
			}
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

	test('returns {ok:false} when fetchFn throws AbortError during configId load', async () => {
		const params = new URLSearchParams({ configId: 'abc-123' });
		const fetchFn = mock(async () => {
			const error = new Error('aborted');
			error.name = 'AbortError';
			throw error;
		}) as unknown as typeof fetch;

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params,
			fetchFn
		});

		expect(result.ok).toBe(false);
	});

	test('returns {ok:false} when fetchFn throws non-abort error during configId load', async () => {
		const params = new URLSearchParams({ configId: 'abc-123' });
		const fetchFn = mock(async () => {
			throw new Error('network down');
		}) as unknown as typeof fetch;

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params,
			fetchFn
		});

		expect(result.ok).toBe(false);
		if (result.ok === false) {
			expect(result.errors).toEqual(['Failed to load configuration parameters']);
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
