import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
	createInitialConfigLoaderState,
	useConfigLoader,
	type ConfigLoaderState
} from './use-config-loader';
import type { Page } from '@sveltejs/kit';

vi.mock('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: vi.fn(),
	loadSharedConfigParameters: vi.fn(),
	parseConfigParam: vi.fn()
}));

function makePage(url: string): Page {
	return {
		url: new URL(url) as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: { session: null, user: null, profile: null },
		form: null,
		state: {}
	};
}

type PageStore = {
	subscribe: (run: (value: Page) => void) => () => void;
	set: (value: Page) => void;
};

function makePageStore(url: string): PageStore {
	let value = makePage(url);
	const subscribers = new Set<(value: Page) => void>();
	return {
		subscribe(run) {
			run(value);
			subscribers.add(run);
			return () => subscribers.delete(run);
		},
		set(next) {
			value = next;
			subscribers.forEach((s) => s(value));
		}
	};
}

const lorenzParams = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };

describe('createInitialConfigLoaderState', () => {
	it('returns correct defaults', () => {
		const state = createInitialConfigLoaderState();
		expect(state.errors).toEqual([]);
		expect(state.showError).toBe(false);
		expect(state.warnings).toEqual([]);
		expect(state.showWarning).toBe(false);
		expect(state.isLoading).toBe(false);
	});
});

describe('useConfigLoader', () => {
	let loadSavedConfigParametersMock: ReturnType<typeof vi.fn>;
	let loadSharedConfigParametersMock: ReturnType<typeof vi.fn>;
	let parseConfigParamMock: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.resetAllMocks();
		const loader = await import('$lib/saved-config-loader');
		loadSavedConfigParametersMock = vi.mocked(loader.loadSavedConfigParameters);
		loadSharedConfigParametersMock = vi.mocked(loader.loadSharedConfigParameters);
		parseConfigParamMock = vi.mocked(loader.parseConfigParam);
	});

	it('returns cleanup function', () => {
		const pageStore = makePageStore('http://localhost/lorenz');
		const state: ConfigLoaderState = createInitialConfigLoaderState();
		const onParametersLoaded = vi.fn().mockReturnValue(lorenzParams);
		const { cleanup } = useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);
		expect(typeof cleanup).toBe('function');
		cleanup();
	});

	it('clears state when URL changes from config to no config', async () => {
		const pageStore = makePageStore('http://localhost/lorenz?configId=abc');
		const state: ConfigLoaderState = createInitialConfigLoaderState();
		loadSavedConfigParametersMock.mockResolvedValue({ ok: true, parameters: lorenzParams });
		const onParametersLoaded = vi.fn().mockReturnValue(lorenzParams);

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);
		await vi.waitUntil(() => !state.isLoading);

		// Now navigate to URL with no config params
		state.errors = ['stale error'];
		state.showError = true;
		pageStore.set(makePage('http://localhost/lorenz'));

		expect(state.errors).toEqual([]);
		expect(state.showError).toBe(false);
		expect(state.warnings).toEqual([]);
		expect(state.showWarning).toBe(false);
		expect(state.isLoading).toBe(false);
	});

	it('skips loading if same config key is applied again', () => {
		const pageStore = makePageStore('http://localhost/lorenz?configId=abc');
		const state = createInitialConfigLoaderState();
		loadSavedConfigParametersMock.mockResolvedValue({ ok: true, parameters: lorenzParams });
		const onParametersLoaded = vi.fn().mockReturnValue(lorenzParams);

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);
		// trigger again with same URL - should skip
		pageStore.set(makePage('http://localhost/lorenz?configId=abc'));
		expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
	});

	it('loads from configId and applies parameters', async () => {
		const pageStore = makePageStore('http://localhost/lorenz?configId=abc123');
		const state = createInitialConfigLoaderState();
		loadSavedConfigParametersMock.mockResolvedValue({ ok: true, parameters: lorenzParams });
		const onParametersLoaded = vi.fn().mockReturnValue(lorenzParams);

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);
		expect(state.isLoading).toBe(true);

		await vi.waitUntil(() => !state.isLoading);
		expect(onParametersLoaded).toHaveBeenCalledWith(lorenzParams);
		expect(state.errors).toEqual([]);
	});

	it('shows errors when configId load fails', async () => {
		const pageStore = makePageStore('http://localhost/lorenz?configId=bad');
		const state = createInitialConfigLoaderState();
		loadSavedConfigParametersMock.mockResolvedValue({ ok: false, errors: ['Not found'] });
		const onParametersLoaded = vi.fn();

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);

		await vi.waitUntil(() => !state.isLoading);
		expect(state.errors).toEqual(['Not found']);
		expect(state.showError).toBe(true);
	});

	it('handles network error during configId load', async () => {
		const pageStore = makePageStore('http://localhost/lorenz?configId=abc');
		const state = createInitialConfigLoaderState();
		loadSavedConfigParametersMock.mockRejectedValue(new Error('Network failure'));
		const onParametersLoaded = vi.fn();

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);

		await vi.waitUntil(() => !state.isLoading);
		expect(state.errors[0]).toContain('Failed to load configuration: Network failure');
		expect(state.showError).toBe(true);
	});

	it('silently ignores AbortError during configId load', async () => {
		const pageStore = makePageStore('http://localhost/lorenz?configId=abc');
		const state = createInitialConfigLoaderState();
		const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' });
		loadSavedConfigParametersMock.mockRejectedValue(abortError);
		const onParametersLoaded = vi.fn();

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);

		// Give async IIFE time to execute
		await new Promise((r) => setTimeout(r, 10));
		expect(state.errors).toEqual([]);
	});

	it('loads from shareCode and applies parameters', async () => {
		const pageStore = makePageStore('http://localhost/lorenz?share=ABCD1234');
		const state = createInitialConfigLoaderState();
		loadSharedConfigParametersMock.mockResolvedValue({ ok: true, parameters: lorenzParams });
		const onParametersLoaded = vi.fn().mockReturnValue(lorenzParams);

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);
		expect(state.isLoading).toBe(true);

		await vi.waitUntil(() => !state.isLoading);
		expect(loadSharedConfigParametersMock).toHaveBeenCalled();
		expect(onParametersLoaded).toHaveBeenCalledWith(lorenzParams);
	});

	it('shows errors when shareCode load fails', async () => {
		const pageStore = makePageStore('http://localhost/lorenz?share=BAD');
		const state = createInitialConfigLoaderState();
		loadSharedConfigParametersMock.mockResolvedValue({ ok: false, errors: ['Share expired'] });
		const onParametersLoaded = vi.fn();

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);

		await vi.waitUntil(() => !state.isLoading);
		expect(state.errors).toEqual(['Share expired']);
		expect(state.showError).toBe(true);
	});

	it('applies stability warnings from onCheckStability with configId', async () => {
		const pageStore = makePageStore('http://localhost/lorenz?configId=abc');
		const state = createInitialConfigLoaderState();
		loadSavedConfigParametersMock.mockResolvedValue({ ok: true, parameters: lorenzParams });
		const onParametersLoaded = vi.fn().mockReturnValue(lorenzParams);
		const onCheckStability = vi
			.fn()
			.mockReturnValue({ isStable: false, warnings: ['Unstable params'] });

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded, onCheckStability },
			state
		);

		await vi.waitUntil(() => !state.isLoading);
		expect(state.warnings).toEqual(['Unstable params']);
		expect(state.showWarning).toBe(true);
	});

	it('handles error in onParametersLoaded callback with configId', async () => {
		const pageStore = makePageStore('http://localhost/lorenz?configId=abc');
		const state = createInitialConfigLoaderState();
		loadSavedConfigParametersMock.mockResolvedValue({ ok: true, parameters: lorenzParams });
		const onParametersLoaded = vi.fn().mockImplementation(() => {
			throw new Error('Apply failed');
		});

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);

		await vi.waitUntil(() => state.showError);
		expect(state.errors[0]).toContain('Failed to apply parameters: Apply failed');
	});

	it('loads from config param synchronously', () => {
		const configParam = encodeURIComponent(JSON.stringify(lorenzParams));
		const pageStore = makePageStore(`http://localhost/lorenz?config=${configParam}`);
		const state = createInitialConfigLoaderState();
		parseConfigParamMock.mockReturnValue({ ok: true, parameters: lorenzParams });
		const onParametersLoaded = vi.fn().mockReturnValue(lorenzParams);

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);

		expect(parseConfigParamMock).toHaveBeenCalled();
		expect(onParametersLoaded).toHaveBeenCalledWith(lorenzParams);
		expect(state.errors).toEqual([]);
	});

	it('shows errors when config param is invalid', () => {
		const pageStore = makePageStore('http://localhost/lorenz?config=invalid');
		const state = createInitialConfigLoaderState();
		parseConfigParamMock.mockReturnValue({
			ok: false,
			errors: ['Invalid type'],
			logMessage: 'Bad',
			logDetails: {}
		});
		const onParametersLoaded = vi.fn();

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);

		expect(state.errors).toEqual(['Invalid type']);
		expect(state.showError).toBe(true);
	});

	it('handles error in onParametersLoaded callback with config param', () => {
		const configParam = encodeURIComponent(JSON.stringify(lorenzParams));
		const pageStore = makePageStore(`http://localhost/lorenz?config=${configParam}`);
		const state = createInitialConfigLoaderState();
		parseConfigParamMock.mockReturnValue({ ok: true, parameters: lorenzParams });
		const onParametersLoaded = vi.fn().mockImplementation(() => {
			throw new Error('Apply failed');
		});

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);

		expect(state.errors[0]).toContain('Failed to apply parameters: Apply failed');
		expect(state.showError).toBe(true);
	});

	it('applies stability warnings from onCheckStability with config param', () => {
		const configParam = encodeURIComponent(JSON.stringify(lorenzParams));
		const pageStore = makePageStore(`http://localhost/lorenz?config=${configParam}`);
		const state = createInitialConfigLoaderState();
		parseConfigParamMock.mockReturnValue({ ok: true, parameters: lorenzParams });
		const onParametersLoaded = vi.fn().mockReturnValue(lorenzParams);
		const onCheckStability = vi
			.fn()
			.mockReturnValue({ isStable: false, warnings: ['Unstable'] });

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded, onCheckStability },
			state
		);

		expect(state.warnings).toEqual(['Unstable']);
		expect(state.showWarning).toBe(true);
	});

	it('handles exception in parseConfigParam', () => {
		const pageStore = makePageStore('http://localhost/lorenz?config=bad');
		const state = createInitialConfigLoaderState();
		parseConfigParamMock.mockImplementation(() => {
			throw new Error('Parse error');
		});
		const onParametersLoaded = vi.fn();

		useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);

		expect(state.errors[0]).toContain('Configuration error: Parse error');
		expect(state.showError).toBe(true);
	});

	it('cleanup aborts pending load and unsubscribes', async () => {
		const pageStore = makePageStore('http://localhost/lorenz?configId=abc');
		const state = createInitialConfigLoaderState();
		loadSavedConfigParametersMock.mockReturnValue(
			new Promise<never>(() => {
				// never resolves until cleanup
			})
		);
		const onParametersLoaded = vi.fn();

		const { cleanup } = useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);

		cleanup();
		// After cleanup, page store changes should not trigger new loads
		pageStore.set(makePage('http://localhost/lorenz?configId=xyz'));
		await new Promise((r) => setTimeout(r, 10));
		// onParametersLoaded should never have been called (request was aborted)
		expect(onParametersLoaded).not.toHaveBeenCalled();
	});

	it('does not apply results after cleanup (isUnmounted check)', async () => {
		const pageStore = makePageStore('http://localhost/lorenz?configId=abc');
		const state = createInitialConfigLoaderState();
		let resolveLoad!: (val: unknown) => void;
		loadSavedConfigParametersMock.mockReturnValue(
			new Promise((resolve) => {
				resolveLoad = resolve;
			})
		);
		const onParametersLoaded = vi.fn();

		const { cleanup } = useConfigLoader(
			{ page: pageStore, mapType: 'lorenz', base: '', onParametersLoaded },
			state
		);

		cleanup();
		// Resolve the load AFTER cleanup
		resolveLoad({ ok: true, parameters: lorenzParams });
		await new Promise((r) => setTimeout(r, 10));
		// Should NOT have applied parameters
		expect(onParametersLoaded).not.toHaveBeenCalled();
	});
});
