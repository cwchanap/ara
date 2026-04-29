import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
	createInitialSaveState,
	createSaveHandler,
	loadConfigFromUrl
} from './use-visualization-save';
import type { SaveState } from './use-visualization-save';

vi.mock('$app/paths', () => ({ base: '' }));

vi.mock('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: vi.fn(),
	parseConfigParam: vi.fn()
}));

vi.mock('$lib/chaos-validation', () => ({
	checkParameterStability: vi.fn().mockReturnValue({ isStable: true, warnings: [] })
}));

function makeState(overrides: Partial<SaveState> = {}): SaveState {
	return { ...createInitialSaveState(), ...overrides };
}

function makeParams() {
	return { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
}

describe('createInitialSaveState', () => {
	it('returns correct initial values', () => {
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
});

describe('createSaveHandler', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.resetAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('returns save and cleanup functions', () => {
		const state = makeState();
		const { save, cleanup } = createSaveHandler('lorenz', state, makeParams);
		expect(typeof save).toBe('function');
		expect(typeof cleanup).toBe('function');
	});

	it('saves successfully and sets saveSuccess', async () => {
		const state = makeState();
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

		const { save } = createSaveHandler('lorenz', state, makeParams);
		await save('My Config');

		expect(state.saveSuccess).toBe(true);
		expect(state.showSaveDialog).toBe(false);
		expect(state.isSaving).toBe(false);
	});

	it('clears saveSuccess after TOAST_SUCCESS_DURATION_MS', async () => {
		const state = makeState();
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

		const { save } = createSaveHandler('lorenz', state, makeParams);
		await save('My Config');
		expect(state.saveSuccess).toBe(true);

		vi.runAllTimers();
		expect(state.saveSuccess).toBe(false);
	});

	it('sets saveError on non-ok response', async () => {
		const state = makeState();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				json: async () => ({ error: 'Unauthorized' })
			})
		);

		const { save } = createSaveHandler('lorenz', state, makeParams);
		await save('Config');

		expect(state.saveError).toBe('Unauthorized');
		expect(state.saveSuccess).toBe(false);
		expect(state.isSaving).toBe(false);
	});

	it('uses fallback error message when response json fails', async () => {
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

		const { save } = createSaveHandler('lorenz', state, makeParams);
		await save('Config');

		expect(state.saveError).toBe('Failed to save');
	});

	it('clears saveError after TOAST_ERROR_DURATION_MS', async () => {
		const state = makeState();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				json: async () => ({ error: 'Unauthorized' })
			})
		);

		const { save } = createSaveHandler('lorenz', state, makeParams);
		await save('Config');
		expect(state.saveError).toBe('Unauthorized');

		vi.runAllTimers();
		expect(state.saveError).toBeNull();
	});

	it('sets saveError on network error', async () => {
		const state = makeState();
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

		const { save } = createSaveHandler('lorenz', state, makeParams);
		await save('Config');

		expect(state.saveError).toBe('Network failure');
		expect(state.isSaving).toBe(false);
	});

	it('does not set error on AbortError', async () => {
		const state = makeState();
		const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' });
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

		const { save } = createSaveHandler('lorenz', state, makeParams);
		await save('Config');

		expect(state.saveError).toBeNull();
		expect(state.isSaving).toBe(false);
	});

	it('prevents concurrent saves (isSaving guard)', async () => {
		const state = makeState({ isSaving: true });
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const { save } = createSaveHandler('lorenz', state, makeParams);
		await save('Config');

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('sends correct request to API', async () => {
		const state = makeState();
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		vi.stubGlobal('fetch', fetchMock);

		const { save } = createSaveHandler('lorenz', state, makeParams);
		await save('Test Config');

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/save-config');
		expect(options.method).toBe('POST');
		const body = JSON.parse(options.body);
		expect(body.name).toBe('Test Config');
		expect(body.mapType).toBe('lorenz');
	});

	it('cleanup clears pending timeout', async () => {
		const state = makeState();
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

		const { save, cleanup } = createSaveHandler('lorenz', state, makeParams);
		await save('Config');
		expect(state.saveSuccess).toBe(true);

		cleanup(); // clears the success timeout
		vi.runAllTimers();
		// saveSuccess should still be true since the timeout was cleared
		expect(state.saveSuccess).toBe(true);
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

		const { save, cleanup } = createSaveHandler('lorenz', state, makeParams);
		save('Config'); // start but don't await
		cleanup(); // should not throw
	});

	it('cleanup is safe when nothing is pending', () => {
		const state = makeState();
		const { cleanup } = createSaveHandler('lorenz', state, makeParams);
		expect(() => cleanup()).not.toThrow();
	});

	it('clears previous saveSuccess before new save', async () => {
		const state = makeState({ saveSuccess: true });
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

		const { save } = createSaveHandler('lorenz', state, makeParams);
		// saveSuccess should be cleared at start of save
		const promise = save('Config');
		expect(state.saveSuccess).toBe(false);
		await promise;
	});

	it('clears pending toast timeout when a new save starts', async () => {
		const state = makeState();
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

		const { save } = createSaveHandler('lorenz', state, makeParams);
		// First save sets a success toast timeout
		await save('Config 1');
		expect(state.saveSuccess).toBe(true);

		// Second save starts before the toast timeout fires; must clear timeoutId (lines 92-93)
		await save('Config 2');
		// After second save completes, state should reflect the second save's success
		expect(state.saveSuccess).toBe(true);
		// Advance past the toast duration to verify cleanup works
		vi.runAllTimers();
		expect(state.saveSuccess).toBe(false);
	});
});

describe('loadConfigFromUrl', () => {
	let loadSavedConfigParametersMock: ReturnType<typeof vi.fn>;
	let parseConfigParamMock: ReturnType<typeof vi.fn>;
	let checkParameterStabilityMock: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.resetAllMocks();
		const savedConfigLoader = await import('$lib/saved-config-loader');
		const chaosValidation = await import('$lib/chaos-validation');
		loadSavedConfigParametersMock = vi.mocked(savedConfigLoader.loadSavedConfigParameters);
		parseConfigParamMock = vi.mocked(savedConfigLoader.parseConfigParam);
		checkParameterStabilityMock = vi.mocked(chaosValidation.checkParameterStability);
		checkParameterStabilityMock.mockReturnValue({ isStable: true, warnings: [] });
	});

	it('returns ok:none when no configId or config param', async () => {
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams()
		});
		expect(result).toEqual({ ok: 'none' });
	});

	it('loads from configId successfully', async () => {
		const params = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
		loadSavedConfigParametersMock.mockResolvedValue({
			ok: true,
			parameters: params,
			errors: []
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=abc123')
		});

		expect(result).toEqual({ ok: true, parameters: params, stabilityWarnings: [] });
	});

	it('returns errors when configId load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValue({
			ok: false,
			errors: ['Not found'],
			parameters: undefined
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=bad-id')
		});

		expect(result).toEqual({ ok: false, errors: ['Not found'] });
	});

	it('returns ok:none when signal is aborted after configId load', async () => {
		const params = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
		loadSavedConfigParametersMock.mockResolvedValue({
			ok: true,
			parameters: params,
			errors: []
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

	it('returns ok:none when AbortError thrown during configId load', async () => {
		const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' });
		loadSavedConfigParametersMock.mockRejectedValue(abortError);

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=abc')
		});

		expect(result).toEqual({ ok: 'none' });
	});

	it('returns error when configId load throws generic error', async () => {
		loadSavedConfigParametersMock.mockRejectedValue(new Error('Network error'));

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('configId=abc')
		});

		expect(result).toEqual({ ok: false, errors: ['Failed to load configuration parameters'] });
	});

	it('loads from config param successfully', async () => {
		const params = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
		parseConfigParamMock.mockReturnValue({ ok: true, parameters: params });

		const configEncoded = btoa(JSON.stringify(params));
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams(`config=${configEncoded}`)
		});

		expect(result).toEqual({ ok: true, parameters: params, stabilityWarnings: [] });
	});

	it('returns errors when config param is invalid', async () => {
		parseConfigParamMock.mockReturnValue({
			ok: false,
			errors: ['Invalid type'],
			logMessage: 'Bad param',
			logDetails: {}
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('config=invalidbase64')
		});

		expect(result).toEqual({ ok: false, errors: ['Invalid type'] });
	});

	it('returns error when parseConfigParam throws', async () => {
		parseConfigParamMock.mockImplementation(() => {
			throw new Error('Parse failure');
		});

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams('config=somevalue')
		});

		expect(result).toEqual({ ok: false, errors: ['Failed to parse configuration parameters'] });
	});

	it('includes stability warnings when params are unstable', async () => {
		const params = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
		parseConfigParamMock.mockReturnValue({ ok: true, parameters: params });
		checkParameterStabilityMock.mockReturnValue({
			isStable: false,
			warnings: ['Potentially chaotic']
		});

		const configEncoded = btoa(JSON.stringify(params));
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams(`config=${configEncoded}`)
		});

		expect(result).toEqual({
			ok: true,
			parameters: params,
			stabilityWarnings: ['Potentially chaotic']
		});
	});
});
