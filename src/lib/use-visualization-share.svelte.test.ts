import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/paths', () => ({ base: '' }));

import { createInitialShareState, createShareHandler } from './use-visualization-share';
import type { ShareState } from './use-visualization-share';
import type { ChaosMapType } from '$lib/types';

describe('createInitialShareState', () => {
	it('returns correct initial state', () => {
		const state = createInitialShareState();
		expect(state).toEqual({
			showShareDialog: false,
			isSharing: false,
			shareError: null
		});
	});

	// Merged from bun use-visualization-share.test.ts
	it('returns a new independent object on each call', () => {
		const a = createInitialShareState();
		const b = createInitialShareState();
		a.isSharing = true;
		expect(b.isSharing).toBe(false);
	});
});

describe('createShareHandler', () => {
	let state: ShareState;
	const getParameters = () => ({ type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.6667 });

	beforeEach(() => {
		state = createInitialShareState();
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('share - successful', () => {
		it('returns share URL and expiresAt on success', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(
					JSON.stringify({ shareUrl: '/s/abc123', expiresAt: '2026-06-01T00:00:00Z' }),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				)
			);

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			const result = await share();

			expect(result).toEqual({
				shareUrl: '/s/abc123',
				expiresAt: '2026-06-01T00:00:00Z'
			});
			expect(state.isSharing).toBe(false);
			expect(state.shareError).toBeNull();
		});

		it('sends POST request with correct body', async () => {
			const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({ shareUrl: '/s/x', expiresAt: '2026-01-01' }), {
					status: 200
				})
			);

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			await share();

			expect(fetchSpy).toHaveBeenCalledWith('/api/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: expect.any(AbortSignal),
				body: JSON.stringify({ mapType: 'lorenz', parameters: getParameters() })
			});
		});

		it('resets isSharing in finally block on success', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({ shareUrl: '/s/x', expiresAt: '2026-01-01' }), {
					status: 200
				})
			);

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			expect(state.isSharing).toBe(false);
			await share();
			expect(state.isSharing).toBe(false);
		});
	});

	describe('share - HTTP error', () => {
		it('throws with error message from response on HTTP error', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
			);

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			await expect(share()).rejects.toThrow('Server error');
			expect(state.isSharing).toBe(false);
			expect(state.shareError).toBe('Server error');
		});

		it('throws default message when error field is empty', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({ error: '' }), { status: 500 })
			);

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			await expect(share()).rejects.toThrow('Failed to create share link');
			expect(state.shareError).toBe('Failed to create share link');
		});

		it('handles unparseable error response body', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response('not json', { status: 500 })
			);

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			await expect(share()).rejects.toThrow('Failed to share');
			expect(state.shareError).toBe('Failed to share');
		});

		it('resets isSharing in finally block on HTTP error', async () => {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({ error: 'fail' }), { status: 500 })
			);

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			await expect(share()).rejects.toThrow();
			expect(state.isSharing).toBe(false);
		});
	});

	describe('share - network error', () => {
		it('re-throws network errors and sets shareError', async () => {
			vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			await expect(share()).rejects.toThrow('Network failure');
			expect(state.shareError).toBe('Network failure');
			expect(state.isSharing).toBe(false);
		});

		it('handles non-Error thrown values', async () => {
			vi.spyOn(globalThis, 'fetch').mockRejectedValue('string error');

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			await expect(share()).rejects.toBe('string error');
			expect(state.shareError).toBe('Failed to create share link');
			expect(state.isSharing).toBe(false);
		});
	});

	describe('share - AbortError', () => {
		it('returns null on AbortError without setting shareError', async () => {
			const abortError = new Error('The operation was aborted.');
			abortError.name = 'AbortError';
			vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortError);

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			const result = await share();

			expect(result).toBeNull();
			expect(state.shareError).toBeNull();
			expect(state.isSharing).toBe(false);
		});
	});

	describe('share - concurrent prevention', () => {
		it('returns null when isSharing is already true', async () => {
			state.isSharing = true;

			const fetchSpy = vi.spyOn(globalThis, 'fetch');

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			const result = await share();

			expect(result).toBeNull();
			expect(fetchSpy).not.toHaveBeenCalled();
		});
	});

	describe('share - clears error before request', () => {
		it('clears previous shareError', async () => {
			vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('first fail'));

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			await expect(share()).rejects.toThrow('first fail');
			expect(state.shareError).toBe('first fail');

			vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({ shareUrl: '/s/x', expiresAt: '2026-01-01' }), {
					status: 200
				})
			);

			const result = await share();
			expect(result).toEqual({ shareUrl: '/s/x', expiresAt: '2026-01-01' });
			expect(state.shareError).toBeNull();
		});
	});

	describe('cleanup', () => {
		it('does nothing when no abortController exists', () => {
			const { cleanup } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);
			expect(() => cleanup()).not.toThrow();
		});

		it('aborts and clears the abortController', async () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let resolveFetch: (value: any) => void;
			const pendingPromise = new Promise<Response>((resolve) => {
				resolveFetch = resolve;
			});

			const fetchSpy = vi
				.spyOn(globalThis, 'fetch')
				.mockImplementationOnce(() => pendingPromise as Promise<Response>);

			const { share, cleanup } = createShareHandler(
				'lorenz' as ChaosMapType,
				state,
				getParameters
			);

			const sharePromise = share();

			// Verify fetch was called with an AbortSignal
			const fetchCall = fetchSpy.mock.calls[0];
			expect(fetchCall).toBeDefined();
			const fetchOptions = fetchCall![1];
			expect(fetchOptions).toBeDefined();
			const fetchSignal = fetchOptions!.signal as AbortSignal;
			expect(fetchSignal.aborted).toBe(false);

			cleanup();

			// Verify the signal was aborted after cleanup
			expect(fetchSignal.aborted).toBe(true);

			resolveFetch!(
				new Response(JSON.stringify({ shareUrl: '/s/x', expiresAt: '2026-01-01' }), {
					status: 200
				})
			);

			await sharePromise;
		});
	});

	// ── Merged from bun use-visualization-share.test.ts ───────────────────────
	describe('share - sequential re-use (merged)', () => {
		it('allows share again after a previous share completes', async () => {
			// Return a fresh Response per call — a Response body can only be read once.
			vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
				Promise.resolve(
					new Response(JSON.stringify({ shareUrl: '/s/x', expiresAt: '2026-01-01' }), {
						status: 200
					})
				)
			);

			const { share } = createShareHandler('lorenz' as ChaosMapType, state, getParameters);

			const result1 = await share();
			expect(result1).not.toBeNull();
			// isSharing is reset in finally — a second call must proceed
			expect(state.isSharing).toBe(false);

			const result2 = await share();
			expect(result2).not.toBeNull();
		});
	});

	describe('different map types (merged)', () => {
		it('passes mapType correctly in request body for rossler', async () => {
			const rosslerParams = { type: 'rossler' as const, a: 0.2, b: 0.2, c: 5.7 };
			const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
				new Response(JSON.stringify({ shareUrl: '/s/r', expiresAt: '2026-01-01' }), {
					status: 200
				})
			);

			const { share } = createShareHandler(
				'rossler' as ChaosMapType,
				state,
				() => rosslerParams
			);
			await share();

			const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
			expect(body.mapType).toBe('rossler');
			expect(body.parameters).toEqual(rosslerParams);
		});
	});
});
