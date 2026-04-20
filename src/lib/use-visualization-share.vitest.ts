import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createInitialShareState, createShareHandler } from './use-visualization-share';
import type { ShareState } from './use-visualization-share';

vi.mock('$app/paths', () => ({ base: '' }));

function makeState(overrides: Partial<ShareState> = {}): ShareState {
	return { ...createInitialShareState(), ...overrides };
}

function makeParams() {
	return { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
}

describe('createInitialShareState', () => {
	it('returns correct initial values', () => {
		const state = createInitialShareState();
		expect(state.showShareDialog).toBe(false);
		expect(state.isSharing).toBe(false);
		expect(state.shareError).toBeNull();
	});
});

describe('createShareHandler', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('returns share and cleanup functions', () => {
		const state = makeState();
		const { share, cleanup } = createShareHandler('lorenz', state, makeParams);
		expect(typeof share).toBe('function');
		expect(typeof cleanup).toBe('function');
	});

	it('shares successfully and returns shareUrl/expiresAt', async () => {
		const state = makeState();
		const responseData = { shareUrl: 'http://localhost/s/ABCD', expiresAt: '2026-05-01' };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => responseData
			})
		);

		const { share } = createShareHandler('lorenz', state, makeParams);
		const result = await share();

		expect(result).toEqual(responseData);
		expect(state.isSharing).toBe(false);
		expect(state.shareError).toBeNull();
	});

	it('sets shareError on non-ok response', async () => {
		const state = makeState();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				json: async () => ({ error: 'Rate limit exceeded' })
			})
		);

		const { share } = createShareHandler('lorenz', state, makeParams);
		await expect(share()).rejects.toThrow('Rate limit exceeded');
		expect(state.shareError).toBe('Rate limit exceeded');
		expect(state.isSharing).toBe(false);
	});

	it('uses fallback error when response json fails', async () => {
		const state = makeState();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				json: async () => {
					throw new Error('bad json');
				}
			})
		);

		const { share } = createShareHandler('lorenz', state, makeParams);
		await expect(share()).rejects.toThrow('Failed to share');
		expect(state.shareError).toBe('Failed to share');
	});

	it('sets shareError on network error', async () => {
		const state = makeState();
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

		const { share } = createShareHandler('lorenz', state, makeParams);
		await expect(share()).rejects.toThrow('Network error');
		expect(state.shareError).toBe('Network error');
		expect(state.isSharing).toBe(false);
	});

	it('returns null and does not set error on AbortError', async () => {
		const state = makeState();
		const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' });
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

		const { share } = createShareHandler('lorenz', state, makeParams);
		const result = await share();
		expect(result).toBeNull();
		expect(state.shareError).toBeNull();
		expect(state.isSharing).toBe(false);
	});

	it('prevents concurrent shares (isSharing guard)', async () => {
		const state = makeState({ isSharing: true });
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

		const { share } = createShareHandler('lorenz', state, makeParams);
		const result = await share();
		expect(result).toBeNull();
		expect(vi.mocked(fetch)).not.toHaveBeenCalled();
	});

	it('sends correct request body', async () => {
		const state = makeState();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ shareUrl: 'http://x', expiresAt: '2026-01-01' })
		});
		vi.stubGlobal('fetch', fetchMock);

		const { share } = createShareHandler('lorenz', state, makeParams);
		await share();

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/share');
		expect(options.method).toBe('POST');
		const body = JSON.parse(options.body);
		expect(body.mapType).toBe('lorenz');
		expect(body.parameters.type).toBe('lorenz');
	});

	it('cleanup aborts in-flight request', () => {
		const state = makeState();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockReturnValue(
				new Promise(() => {
					/* never resolves */
				})
			)
		);

		const { share, cleanup } = createShareHandler('lorenz', state, makeParams);
		share(); // start but don't await
		cleanup();
		// AbortController.abort() is called internally; just ensure no throw
	});

	it('cleanup is safe when no request is in-flight', () => {
		const state = makeState();
		const { cleanup } = createShareHandler('lorenz', state, makeParams);
		expect(() => cleanup()).not.toThrow();
	});
});
