import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/paths', () => ({ base: '' }));

vi.mock('$lib/constants', () => ({
	TOAST_SUCCESS_DURATION_MS: 3000,
	TOAST_ERROR_DURATION_MS: 5000
}));

vi.mock('$lib/chaos-validation', () => ({
	checkParameterStability: vi.fn(() => ({ isStable: true, warnings: [] }))
}));

vi.mock('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: vi.fn(),
	parseConfigParam: vi.fn()
}));

import {
	createInitialSaveState,
	createSaveHandler,
	loadConfigFromUrl
} from './use-visualization-save';
import { checkParameterStability } from '$lib/chaos-validation';
import { loadSavedConfigParameters, parseConfigParam } from '$lib/saved-config-loader';

describe('createInitialSaveState', () => {
	it('returns correct initial state', () => {
		const state = createInitialSaveState();
		expect(state).toEqual({
			showSaveDialog: false,
			isSaving: false,
			saveSuccess: false,
			saveError: null,
			configErrors: [],
			showConfigError: false,
			stabilityWarnings: [],
			showStabilityWarning: false
		});
	});
});

describe('createSaveHandler', () => {
	let state: ReturnType<typeof createInitialSaveState>;

	beforeEach(() => {
		state = createInitialSaveState();
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('saves successfully', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
		vi.stubGlobal('fetch', mockFetch);

		const handler = createSaveHandler('lorenz', state, () => ({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		}));
		await handler.save('my config');

		expect(mockFetch).toHaveBeenCalledWith('/api/save-config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			signal: expect.any(AbortSignal),
			body: JSON.stringify({
				name: 'my config',
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			})
		});
		expect(state.saveSuccess).toBe(true);
		expect(state.showSaveDialog).toBe(false);
		expect(state.isSaving).toBe(false);
		expect(state.saveError).toBeNull();
	});

	it('handles HTTP error response', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			statusText: 'Unauthorized',
			json: () => Promise.resolve({ error: 'Not authenticated' })
		});
		vi.stubGlobal('fetch', mockFetch);

		const handler = createSaveHandler('lorenz', state, () => ({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		}));
		await handler.save('test');

		expect(state.saveError).toBe('Not authenticated');
		expect(state.saveSuccess).toBe(false);
		expect(state.isSaving).toBe(false);
	});

	it('handles HTTP error with fallback message', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			json: () => Promise.reject(new Error('invalid json'))
		});
		vi.stubGlobal('fetch', mockFetch);

		const handler = createSaveHandler('lorenz', state, () => ({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		}));
		await handler.save('test');

		expect(state.saveError).toBe('Failed to save');
	});

	it('handles network error', async () => {
		const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
		vi.stubGlobal('fetch', mockFetch);

		const handler = createSaveHandler('lorenz', state, () => ({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		}));
		await handler.save('test');

		expect(state.saveError).toBe('Network failure');
		expect(state.isSaving).toBe(false);
	});

	it('silently handles AbortError', async () => {
		const abortError = new Error('The operation was aborted.');
		abortError.name = 'AbortError';
		const mockFetch = vi.fn().mockRejectedValue(abortError);
		vi.stubGlobal('fetch', mockFetch);

		const handler = createSaveHandler('lorenz', state, () => ({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		}));
		await handler.save('test');

		expect(state.saveError).toBeNull();
		expect(state.isSaving).toBe(false);
	});

	it('prevents concurrent saves', async () => {
		const _resolveFirst: ((value: unknown) => void) | undefined = undefined;
		void _resolveFirst;
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
		vi.stubGlobal('fetch', mockFetch);

		const handler = createSaveHandler('lorenz', state, () => ({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		}));

		state.isSaving = true;
		await handler.save('blocked');

		expect(mockFetch).not.toHaveBeenCalled();
		state.isSaving = false;
	});

	it('clears success after timeout', async () => {
		vi.useFakeTimers();
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
		vi.stubGlobal('fetch', mockFetch);

		const handler = createSaveHandler('lorenz', state, () => ({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		}));
		await handler.save('test');

		expect(state.saveSuccess).toBe(true);
		vi.advanceTimersByTime(3000);
		expect(state.saveSuccess).toBe(false);
	});

	it('clears error after timeout', async () => {
		vi.useFakeTimers();
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			json: () => Promise.resolve({ error: 'fail' })
		});
		vi.stubGlobal('fetch', mockFetch);

		const handler = createSaveHandler('lorenz', state, () => ({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		}));
		await handler.save('test');

		expect(state.saveError).toBe('fail');
		vi.advanceTimersByTime(5000);
		expect(state.saveError).toBeNull();
	});

	it('cleanup clears timeout and aborts controller', async () => {
		vi.useFakeTimers();
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
		vi.stubGlobal('fetch', mockFetch);

		const handler = createSaveHandler('lorenz', state, () => ({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		}));
		await handler.save('test');

		expect(state.saveSuccess).toBe(true);
		handler.cleanup();
		vi.advanceTimersByTime(3000);
		expect(state.saveSuccess).toBe(true);
	});

	it('handles non-Error thrown values', async () => {
		const mockFetch = vi.fn().mockRejectedValue('string error');
		vi.stubGlobal('fetch', mockFetch);

		const handler = createSaveHandler('lorenz', state, () => ({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		}));
		await handler.save('test');

		expect(state.saveError).toBe('Failed to save configuration');
	});

	it('cleanup aborts in-flight request', async () => {
		let resolveSave: (value: unknown) => void;
		const savePromise = new Promise((resolve) => {
			resolveSave = resolve;
		});
		const mockFetch = vi.fn().mockReturnValue(savePromise);
		vi.stubGlobal('fetch', mockFetch);

		const handler = createSaveHandler('lorenz', state, () => ({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		}));

		const save1 = handler.save('first');
		handler.cleanup();
		resolveSave!({ ok: true, json: () => Promise.resolve({}) });
		await save1;

		expect(state.isSaving).toBe(false);
	});
});

describe('loadConfigFromUrl', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it('returns none when no params present', async () => {
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams()
		});
		expect(result).toEqual({ ok: 'none' });
	});

	it('loads config from config param with valid JSON', async () => {
		const params = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		vi.mocked(parseConfigParam).mockReturnValue({
			ok: true,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			parameters: params as any
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('config=encoded')
		});

		expect(result).toEqual({
			ok: true,
			parameters: params,
			stabilityWarnings: []
		});
	});

	it('handles config param with invalid JSON', async () => {
		vi.mocked(parseConfigParam).mockReturnValue({
			ok: false,
			error: 'parse error',
			errors: ['Failed to parse configuration parameters'],
			logMessage: 'Invalid config parameter:',
			logDetails: {}
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('config=bad')
		});

		expect(result).toEqual({
			ok: false,
			errors: ['Failed to parse configuration parameters']
		});
	});

	it('handles config param throwing exception', async () => {
		vi.mocked(parseConfigParam).mockImplementation(() => {
			throw new Error('unexpected');
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('config=bad')
		});

		expect(result).toEqual({
			ok: false,
			errors: ['Failed to parse configuration parameters']
		});
	});

	it('loads config from configId param with successful API', async () => {
		const params = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		vi.mocked(loadSavedConfigParameters).mockResolvedValue({
			ok: true,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			parameters: params as any,
			source: 'api'
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=abc123')
		});

		expect(result).toEqual({
			ok: true,
			parameters: params,
			stabilityWarnings: []
		});
	});

	it('handles configId param with API error', async () => {
		vi.mocked(loadSavedConfigParameters).mockResolvedValue({
			ok: false,
			error: 'not found',
			errors: ['Configuration not found']
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=missing')
		});

		expect(result).toEqual({
			ok: false,
			errors: ['Configuration not found']
		});
	});

	it('handles configId param with network error', async () => {
		vi.mocked(loadSavedConfigParameters).mockRejectedValue(new Error('network fail'));

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=abc')
		});

		expect(result).toEqual({
			ok: false,
			errors: ['Failed to load configuration parameters']
		});
	});

	it('returns none when signal aborted after configId load', async () => {
		const params = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		vi.mocked(loadSavedConfigParameters).mockResolvedValue({
			ok: true,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			parameters: params as any,
			source: 'api'
		});

		const controller = new AbortController();
		controller.abort();

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=abc'),
			signal: controller.signal
		});

		expect(result).toEqual({ ok: 'none' });
	});

	it('returns none when configId load throws AbortError', async () => {
		vi.mocked(loadSavedConfigParameters).mockRejectedValue(
			new DOMException('Aborted', 'AbortError')
		);

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=abc')
		});

		expect(result).toEqual({ ok: 'none' });
	});

	it('returns none when configId load throws Error with AbortError name', async () => {
		const abortErr = new Error('Aborted');
		abortErr.name = 'AbortError';
		vi.mocked(loadSavedConfigParameters).mockRejectedValue(abortErr);

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=abc')
		});

		expect(result).toEqual({ ok: 'none' });
	});

	it('includes stability warnings when parameters are unstable', async () => {
		const params = { type: 'lorenz', sigma: 100, rho: 28, beta: 2.667 };
		vi.mocked(parseConfigParam).mockReturnValue({
			ok: true,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			parameters: params as any
		});
		vi.mocked(checkParameterStability).mockReturnValue({
			isStable: false,
			warnings: ['sigma (100) is outside stable range [0, 50]']
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('config=encoded')
		});

		expect(result).toEqual({
			ok: true,
			parameters: params,
			stabilityWarnings: ['sigma (100) is outside stable range [0, 50]']
		});
	});

	it('includes stability warnings for configId when parameters are unstable', async () => {
		const params = { type: 'lorenz', sigma: 100, rho: 28, beta: 2.667 };
		vi.mocked(loadSavedConfigParameters).mockResolvedValue({
			ok: true,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			parameters: params as any,
			source: 'api'
		});
		vi.mocked(checkParameterStability).mockReturnValue({
			isStable: false,
			warnings: ['sigma (100) is outside stable range [0, 50]']
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=abc123')
		});

		expect(result).toEqual({
			ok: true,
			parameters: params,
			stabilityWarnings: ['sigma (100) is outside stable range [0, 50]']
		});
	});

	it('prefers configId over config param', async () => {
		const configIdParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		vi.mocked(loadSavedConfigParameters).mockResolvedValue({
			ok: true,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			parameters: configIdParams as any,
			source: 'api'
		});
		vi.mocked(checkParameterStability).mockReturnValue({ isStable: true, warnings: [] });

		const searchParams = new URLSearchParams('configId=abc&config=encoded');
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams
		});

		expect(result).toEqual({
			ok: true,
			parameters: configIdParams,
			stabilityWarnings: []
		});
		expect(parseConfigParam).not.toHaveBeenCalled();
	});

	it('uses custom fetchFn for configId', async () => {
		const customFetch = vi.fn();
		const params = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		vi.mocked(loadSavedConfigParameters).mockResolvedValue({
			ok: true,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			parameters: params as any,
			source: 'api'
		});

		await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=abc'),
			fetchFn: customFetch as unknown as typeof fetch
		});

		expect(loadSavedConfigParameters).toHaveBeenCalledWith(
			expect.objectContaining({ fetchFn: customFetch })
		);
	});
});
