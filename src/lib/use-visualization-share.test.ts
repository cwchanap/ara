/**
 * Unit tests for use-visualization-share.ts
 *
 * Tests createShareHandler and createInitialShareState in isolation by
 * swapping globalThis.fetch with mock implementations.
 */

import { describe, test, expect, mock } from 'bun:test';

import { createShareHandler, createInitialShareState } from './use-visualization-share';
import type { ShareState } from './use-visualization-share';
import type { ChaosMapParameters } from '$lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultParams: ChaosMapParameters = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
const getParams = () => defaultParams;

function makeState(overrides?: Partial<ShareState>): ShareState {
	return { ...createInitialShareState(), ...overrides };
}

/**
 * Returns a fetch stub that resolves to a Response-like object.
 * The ok flag drives whether the HTTP layer reports success or failure.
 */
function makeFetch(response: { ok: boolean; json?: () => Promise<unknown> }): typeof fetch {
	return mock(async () => ({
		ok: response.ok,
		status: response.ok ? 200 : 400,
		json: response.json ?? (async () => ({ error: 'failed' }))
	})) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createInitialShareState', () => {
	test('returns correct initial state', () => {
		const state = createInitialShareState();
		expect(state.showShareDialog).toBe(false);
		expect(state.isSharing).toBe(false);
		expect(state.shareError).toBeNull();
	});

	test('each call returns a new independent object', () => {
		const a = createInitialShareState();
		const b = createInitialShareState();
		a.isSharing = true;
		expect(b.isSharing).toBe(false);
	});
});

describe('createShareHandler', () => {
	describe('success flow', () => {
		test('returns shareUrl and expiresAt on success', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			globalThis.fetch = makeFetch({
				ok: true,
				json: async () => ({
					shareUrl: 'https://example.com/s/abc123',
					expiresAt: '2026-03-01T00:00:00Z'
				})
			});

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);
			const result = await share();

			expect(result).toEqual({
				shareUrl: 'https://example.com/s/abc123',
				expiresAt: '2026-03-01T00:00:00Z'
			});
			// isSharing must be reset to false after success
			expect(state.isSharing).toBe(false);
			// No error on success
			expect(state.shareError).toBeNull();

			cleanup();
			globalThis.fetch = globalFetch;
		});

		test('calls fetch with correct method, headers, and body', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;

			let capturedInit: RequestInit | undefined;
			globalThis.fetch = mock(async (_input: string, init?: RequestInit) => {
				capturedInit = init;
				return {
					ok: true,
					status: 200,
					json: async () => ({
						shareUrl: 'https://example.com/s/xyz',
						expiresAt: '2026-04-01T00:00:00Z'
					})
				};
			}) as unknown as typeof fetch;

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);
			await share();

			expect(capturedInit?.method).toBe('POST');
			expect((capturedInit?.headers as Record<string, string>)?.['Content-Type']).toBe(
				'application/json'
			);

			const parsedBody = JSON.parse(capturedInit?.body as string);
			expect(parsedBody.mapType).toBe('lorenz');
			expect(parsedBody.parameters).toEqual(defaultParams);

			cleanup();
			globalThis.fetch = globalFetch;
		});

		test('uses base path prefix in fetch URL', async () => {
			// The test-setup preload stubs $app/paths with base = ''
			// so the URL should be '/api/share'.
			const state = makeState();
			const globalFetch = globalThis.fetch;

			let capturedUrl: string | undefined;
			globalThis.fetch = mock(async (input: string) => {
				capturedUrl = input;
				return {
					ok: true,
					status: 200,
					json: async () => ({
						shareUrl: 'https://example.com/s/xyz',
						expiresAt: '2026-04-01T00:00:00Z'
					})
				};
			}) as unknown as typeof fetch;

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);
			await share();

			expect(capturedUrl).toBe('/api/share');

			cleanup();
			globalThis.fetch = globalFetch;
		});
	});

	describe('error flow', () => {
		test('sets shareError and re-throws on HTTP error', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			globalThis.fetch = makeFetch({
				ok: false,
				json: async () => ({ error: 'Rate limit exceeded' })
			});

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);

			await expect(share()).rejects.toThrow('Rate limit exceeded');
			expect(state.shareError).toBe('Rate limit exceeded');
			// isSharing must be reset to false even after an error
			expect(state.isSharing).toBe(false);

			cleanup();
			globalThis.fetch = globalFetch;
		});

		test('falls back to generic message when error body has no error field', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			globalThis.fetch = makeFetch({
				ok: false,
				json: async () => ({})
			});

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);

			await expect(share()).rejects.toThrow('Failed to create share link');
			expect(state.shareError).toBe('Failed to create share link');

			cleanup();
			globalThis.fetch = globalFetch;
		});

		test('falls back to generic message when JSON parsing fails', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			globalThis.fetch = mock(async () => ({
				ok: false,
				status: 500,
				json: async () => {
					throw new Error('invalid json');
				}
			})) as unknown as typeof fetch;

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);

			await expect(share()).rejects.toThrow('Failed to share');
			expect(state.shareError).toBe('Failed to share');

			cleanup();
			globalThis.fetch = globalFetch;
		});

		test('returns null on AbortError without setting shareError', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			const abortError = new DOMException('Aborted', 'AbortError');
			globalThis.fetch = mock(async () => {
				throw abortError;
			}) as unknown as typeof fetch;

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);
			const result = await share();

			// AbortError is swallowed — no re-throw
			expect(result).toBeNull();
			expect(state.shareError).toBeNull();
			expect(state.isSharing).toBe(false);

			cleanup();
			globalThis.fetch = globalFetch;
		});
	});

	describe('concurrency guard', () => {
		test('does not start a new share while isSharing is true', async () => {
			const state = makeState({ isSharing: true });
			let fetchCallCount = 0;
			const globalFetch = globalThis.fetch;
			globalThis.fetch = mock(async () => {
				fetchCallCount++;
				return { ok: true, json: async () => ({}) };
			}) as unknown as typeof fetch;

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);
			const result = await share();

			expect(fetchCallCount).toBe(0);
			expect(result).toBeNull();

			cleanup();
			globalThis.fetch = globalFetch;
		});

		test('allows share again after a previous share completes', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			globalThis.fetch = makeFetch({
				ok: true,
				json: async () => ({
					shareUrl: 'https://example.com/s/first',
					expiresAt: '2026-03-01T00:00:00Z'
				})
			});

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);

			const result1 = await share();
			expect(result1).not.toBeNull();
			// isSharing is reset in finally — a second call must proceed
			expect(state.isSharing).toBe(false);

			const result2 = await share();
			expect(result2).not.toBeNull();

			cleanup();
			globalThis.fetch = globalFetch;
		});
	});

	describe('cleanup', () => {
		test('cleanup does not throw when no in-flight request', () => {
			const state = makeState();
			const { cleanup } = createShareHandler('lorenz', state, getParams);
			expect(() => cleanup()).not.toThrow();
		});

		test('cleanup called during in-flight request causes AbortError (no shareError set)', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;

			let resolveFetch!: () => void;
			// fetch hangs until we manually resolve it
			const hangingFetch = mock(
				() =>
					new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>(
						(resolve) => {
							resolveFetch = () =>
								resolve({
									ok: true,
									status: 200,
									json: async () => ({ shareUrl: '', expiresAt: '' })
								});
						}
					)
			) as unknown as typeof fetch;
			globalThis.fetch = hangingFetch;

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);

			// Start share but do NOT await yet
			const sharePromise = share();

			// Abort via cleanup — this aborts the AbortController signal
			cleanup();

			// Now let fetch resolve (simulating network completing after abort was signalled)
			resolveFetch();

			// The share function should resolve to null due to abort handling,
			// OR reject — either way shareError must remain null
			await sharePromise.catch(() => null);
			expect(state.shareError).toBeNull();

			globalThis.fetch = globalFetch;
		});
	});

	describe('different map types', () => {
		test('passes mapType correctly in request body for rossler', async () => {
			const rosslerParams: ChaosMapParameters = { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 };
			const state = makeState();
			const globalFetch = globalThis.fetch;

			let parsedBody: { mapType?: string; parameters?: ChaosMapParameters } = {};
			globalThis.fetch = mock(async (_input: string, init?: RequestInit) => {
				parsedBody = JSON.parse(init?.body as string);
				return {
					ok: true,
					status: 200,
					json: async () => ({
						shareUrl: 'https://example.com/s/r',
						expiresAt: '2026-03-01T00:00:00Z'
					})
				};
			}) as unknown as typeof fetch;

			const { share, cleanup } = createShareHandler('rossler', state, () => rosslerParams);
			await share();

			expect(parsedBody.mapType).toBe('rossler');
			expect(parsedBody.parameters).toEqual(rosslerParams);

			cleanup();
			globalThis.fetch = globalFetch;
		});
	});
});
