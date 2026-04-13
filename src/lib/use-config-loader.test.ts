import { describe, expect, mock, test } from 'bun:test';
import type { Page } from '@sveltejs/kit';
import { writable } from 'svelte/store';
import type { ChaosMapParameters } from '$lib/types';

// Re-register $lib/saved-config-loader with a correct real-like implementation.
// This overrides any mock registered by use-config-loader-catch.test.ts, which
// runs first alphabetically in the same Bun process and leaves parseConfigParam
// returning ok:false for all calls (and throwing after the last catch test).
mock.module('$lib/saved-config-loader', () => ({
	parseConfigParam: ({ mapType, configParam }: { mapType: string; configParam: string }) => {
		try {
			const decoded = decodeURIComponent(configParam);
			const parsed = JSON.parse(decoded) as Record<string, unknown>;
			if (!parsed || typeof parsed !== 'object' || parsed['type'] !== mapType) {
				return {
					ok: false as const,
					error: 'Invalid parameters',
					errors: ['Invalid parameters'],
					logMessage: '',
					logDetails: {}
				};
			}
			return { ok: true as const, parameters: parsed };
		} catch {
			return {
				ok: false as const,
				error: 'Failed to parse configuration parameters',
				errors: ['Failed to parse configuration parameters'],
				logMessage: 'Invalid config parameter',
				logDetails: {}
			};
		}
	},
	loadSavedConfigParameters: async ({
		configId,
		mapType,
		base,
		fetchFn
	}: {
		configId: string;
		mapType: string;
		base: string;
		fetchFn: typeof fetch;
	}) => {
		try {
			const response = await fetchFn(
				`${base}/api/saved-config/${encodeURIComponent(configId)}`
			);
			if (!response.ok) {
				return {
					ok: false as const,
					error: 'Failed to load configuration parameters',
					errors: ['Failed to load configuration parameters']
				};
			}
			const data = (await response.json()) as { mapType?: string; parameters?: unknown };
			if (!data || data.mapType !== mapType || !data.parameters) {
				return {
					ok: false as const,
					error: 'Invalid configuration data',
					errors: ['Invalid configuration data']
				};
			}
			return { ok: true as const, parameters: data.parameters, source: 'api' as const };
		} catch {
			return {
				ok: false as const,
				error: 'Failed to load configuration parameters',
				errors: ['Failed to load configuration parameters']
			};
		}
	},
	loadSharedConfigParameters: async ({
		shareCode,
		mapType,
		base,
		fetchFn
	}: {
		shareCode: string;
		mapType: string;
		base: string;
		fetchFn: typeof fetch;
	}) => {
		try {
			const response = await fetchFn(`${base}/api/shared/${encodeURIComponent(shareCode)}`);
			if (!response.ok) {
				return {
					ok: false as const,
					error: `Failed to load shared configuration (${response.status})`,
					errors: [`Failed to load shared configuration (${response.status})`]
				};
			}
			const data = (await response.json()) as { mapType?: string; parameters?: unknown };
			if (!data || data.mapType !== mapType || !data.parameters) {
				return {
					ok: false as const,
					error: 'Invalid shared configuration data',
					errors: ['Invalid shared configuration data']
				};
			}
			return {
				ok: true as const,
				parameters: data.parameters,
				source: 'sharedApi' as const
			};
		} catch {
			return {
				ok: false as const,
				error: 'Failed to load shared configuration',
				errors: ['Failed to load shared configuration']
			};
		}
	}
}));

const { createInitialConfigLoaderState, useConfigLoader } = await import('./use-config-loader');

type LorenzParams = Extract<ChaosMapParameters, { type: 'lorenz' }>;

const basePageData = {
	session: null,
	user: null,
	profile: null
} satisfies App.PageData;

function createPage(url: string): Page {
	const pageUrl = new URL(url) as Page['url'];
	return {
		url: pageUrl,
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: basePageData,
		form: null,
		state: {}
	} satisfies Page;
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

async function waitFor(predicate: () => boolean, timeoutMs = 200) {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error('Timed out waiting for condition');
		}
		await flushPromises();
	}
}

describe('useConfigLoader', () => {
	test('creates initial state', () => {
		const state = createInitialConfigLoaderState();

		expect(state).toEqual({
			errors: [],
			showError: false,
			warnings: [],
			showWarning: false,
			isLoading: false
		});
	});

	test('applies config param (caller handles stability warnings)', () => {
		const params: LorenzParams = { type: 'lorenz', sigma: 100, rho: 28, beta: 2.667 };
		const configParam = encodeURIComponent(JSON.stringify(params));
		const page = writable<Page>(createPage(`http://localhost/lorenz?config=${configParam}`));
		const state = createInitialConfigLoaderState();
		const loaded: LorenzParams[] = [];

		const { cleanup } = useConfigLoader(
			{
				page,
				mapType: 'lorenz',
				base: '',
				onParametersLoaded: (value: LorenzParams) => {
					loaded.push(value);
					return value;
				}
			},
			state
		);

		expect(loaded).toHaveLength(1);
		expect(loaded[0]).toEqual(params);
		// Note: Stability checking is now the caller's responsibility
		// The hook does not set warnings - the caller should check stability
		expect(state.showError).toBe(false);
		expect(state.isLoading).toBe(false);

		cleanup();
	});

	test('reports parse errors and clears when config removed', () => {
		const invalidParam = '%invalid%encoding';
		const page = writable<Page>(
			createPage(`http://localhost/lorenz?config=${encodeURIComponent(invalidParam)}`)
		);
		const state = createInitialConfigLoaderState();
		const onParametersLoaded = mock((params: LorenzParams) => params);

		const { cleanup } = useConfigLoader(
			{
				page,
				mapType: 'lorenz',
				base: '',
				onParametersLoaded
			},
			state
		);

		expect(onParametersLoaded).not.toHaveBeenCalled();
		expect(state.showError).toBe(true);
		expect(state.errors[0]).toContain('Failed to parse configuration parameters');

		page.set(createPage('http://localhost/lorenz'));

		expect(state.showError).toBe(false);
		expect(state.errors).toEqual([]);
		expect(state.warnings).toEqual([]);

		cleanup();
	});

	test('reports errors when applying parameters throws', () => {
		const params: LorenzParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		const configParam = encodeURIComponent(JSON.stringify(params));
		const page = writable<Page>(createPage(`http://localhost/lorenz?config=${configParam}`));
		const state = createInitialConfigLoaderState();

		const { cleanup } = useConfigLoader(
			{
				page,
				mapType: 'lorenz',
				base: '',
				onParametersLoaded: () => {
					throw new Error('boom');
				}
			},
			state
		);

		expect(state.showError).toBe(true);
		expect(state.errors[0]).toContain('Failed to apply parameters: boom');
		expect(state.warnings).toEqual([]);

		cleanup();
	});

	test('loads shared configuration and applies parameters', async () => {
		const params: LorenzParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		const mockResponse = {
			ok: true,
			json: async () => ({ mapType: 'lorenz', parameters: params })
		};
		const rawFetchMock = mock(
			(_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
				void _input;
				void _init;
				return Promise.resolve(mockResponse as Response);
			}
		);
		const fetchMock: typeof fetch = Object.assign(rawFetchMock, { preconnect: () => {} });
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock;

		try {
			const page = writable<Page>(createPage('http://localhost/lorenz?share=abc123'));
			const state = createInitialConfigLoaderState();
			const loaded: LorenzParams[] = [];

			const { cleanup } = useConfigLoader(
				{
					page,
					mapType: 'lorenz',
					base: '/base',
					onParametersLoaded: (value: LorenzParams) => {
						loaded.push(value);
						return value;
					}
				},
				state
			);

			expect(state.isLoading).toBe(true);

			await waitFor(() => loaded.length === 1);

			expect(state.isLoading).toBe(false);
			expect(state.showError).toBe(false);
			expect(rawFetchMock).toHaveBeenCalledTimes(1);
			expect(rawFetchMock.mock.calls[0]?.[0]).toBe('/base/api/shared/abc123');

			cleanup();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('reports errors when saved config load fails', async () => {
		const mockResponse = {
			ok: false,
			status: 404
		};
		const rawFetchMock = mock(
			(_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
				void _input;
				void _init;
				return Promise.resolve(mockResponse as Response);
			}
		);
		const fetchMock: typeof fetch = Object.assign(rawFetchMock, { preconnect: () => {} });
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock;

		try {
			const page = writable<Page>(createPage('http://localhost/lorenz?configId=missing'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = mock((params: LorenzParams) => params);

			const { cleanup } = useConfigLoader(
				{
					page,
					mapType: 'lorenz',
					base: '',
					onParametersLoaded
				},
				state
			);

			expect(state.isLoading).toBe(true);

			await waitFor(() => state.isLoading === false);

			expect(state.showError).toBe(true);
			expect(state.errors[0]).toContain('Failed to load configuration parameters');
			expect(rawFetchMock).toHaveBeenCalledTimes(1);
			expect(onParametersLoaded).not.toHaveBeenCalled();

			cleanup();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
	test('sets warning state when onCheckStability reports unstable shared config', async () => {
		const params: LorenzParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		const mockResponse = {
			ok: true,
			json: async () => ({ mapType: 'lorenz', parameters: params })
		};
		const rawFetchMock = mock(() => Promise.resolve(mockResponse as Response));
		const fetchMock: typeof fetch = Object.assign(rawFetchMock, { preconnect: () => {} });
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock;

		try {
			const page = writable<Page>(createPage('http://localhost/lorenz?share=warn123'));
			const state = createInitialConfigLoaderState();

			const { cleanup } = useConfigLoader(
				{
					page,
					mapType: 'lorenz',
					base: '',
					onParametersLoaded: (value: LorenzParams) => value,
					onCheckStability: () => ({
						isStable: false,
						warnings: ['Sigma may be unstable']
					})
				},
				state
			);

			await waitFor(() => state.isLoading === false);
			expect(state.showWarning).toBe(true);
			expect(state.warnings).toEqual(['Sigma may be unstable']);

			cleanup();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('surfaces loader fetch exception as user-facing load error', async () => {
		const rawFetchMock = mock(() => Promise.reject(new Error('socket closed')));
		const fetchMock: typeof fetch = Object.assign(rawFetchMock, { preconnect: () => {} });
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock;

		try {
			const page = writable<Page>(createPage('http://localhost/lorenz?configId=explode'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = mock((params: LorenzParams) => params);

			const { cleanup } = useConfigLoader(
				{
					page,
					mapType: 'lorenz',
					base: '',
					onParametersLoaded
				},
				state
			);

			await waitFor(() => state.isLoading === false);
			expect(state.showError).toBe(true);
			expect(state.errors[0]).toContain('Failed to load configuration parameters');
			expect(onParametersLoaded).not.toHaveBeenCalled();

			cleanup();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('applies direct config and sets warning state when onCheckStability reports unstable', () => {
		const params: LorenzParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		const configParam = encodeURIComponent(JSON.stringify(params));
		const page = writable<Page>(createPage(`http://localhost/lorenz?config=${configParam}`));
		const state = createInitialConfigLoaderState();

		const { cleanup } = useConfigLoader(
			{
				page,
				mapType: 'lorenz',
				base: '',
				onParametersLoaded: (value: LorenzParams) => value,
				onCheckStability: () => ({ isStable: false, warnings: ['High sigma'] })
			},
			state
		);

		expect(state.showWarning).toBe(true);
		expect(state.warnings).toEqual(['High sigma']);
		expect(state.showError).toBe(false);

		cleanup();
	});

	test('does not reload when page updates to the same configKey', async () => {
		// Exercises the early-return deduplication guard:
		// `if (configKey === lastAppliedConfigKey) return;`
		const params: LorenzParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		const mockResponse = {
			ok: true,
			json: async () => ({ mapType: 'lorenz', parameters: params })
		};
		const rawFetchMock = mock(() => Promise.resolve(mockResponse as Response));
		const fetchMock: typeof fetch = Object.assign(rawFetchMock, { preconnect: () => {} });
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock;

		try {
			const page = writable<Page>(createPage('http://localhost/lorenz?configId=same-id'));
			const state = createInitialConfigLoaderState();
			const loaded: LorenzParams[] = [];

			const { cleanup } = useConfigLoader(
				{
					page,
					mapType: 'lorenz',
					base: '',
					onParametersLoaded: (value: LorenzParams) => {
						loaded.push(value);
						return value;
					}
				},
				state
			);

			await waitFor(() => loaded.length === 1);

			// Navigate to the exact same URL — same configKey should be deduped
			page.set(createPage('http://localhost/lorenz?configId=same-id'));
			await flushPromises();

			expect(loaded).toHaveLength(1);
			expect(rawFetchMock).toHaveBeenCalledTimes(1);

			cleanup();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('reports Error-instance throws from onParametersLoaded for shared config', async () => {
		// Exercises the `err instanceof Error ? err.message : String(err)` branch
		// where `err` IS an Error instance (distinct from the string-throw test).
		const params: LorenzParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		const mockResponse = {
			ok: true,
			json: async () => ({ mapType: 'lorenz', parameters: params })
		};
		const rawFetchMock = mock(() => Promise.resolve(mockResponse as Response));
		const fetchMock: typeof fetch = Object.assign(rawFetchMock, { preconnect: () => {} });
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock;

		try {
			const page = writable<Page>(createPage('http://localhost/lorenz?share=error-instance'));
			const state = createInitialConfigLoaderState();

			const { cleanup } = useConfigLoader(
				{
					page,
					mapType: 'lorenz',
					base: '',
					onParametersLoaded: () => {
						throw new Error('error-instance-failure');
					}
				},
				state
			);

			await waitFor(() => state.isLoading === false);
			expect(state.showError).toBe(true);
			expect(state.errors[0]).toBe('Failed to apply parameters: error-instance-failure');

			cleanup();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('does not apply result when cleanup is called before async load settles', async () => {
		// Exercises the `if (signal.aborted || isUnmounted) return;` guard at the
		// top of the result-processing block (after loadSaved/SharedConfigParameters returns).
		let resolveFetch!: (value: Response) => void;
		const rawFetchMock = mock(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				})
		);
		const fetchMock: typeof fetch = Object.assign(rawFetchMock, { preconnect: () => {} });
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock;

		try {
			const page = writable<Page>(createPage('http://localhost/lorenz?configId=slow-load'));
			const state = createInitialConfigLoaderState();
			const loaded: LorenzParams[] = [];

			const { cleanup } = useConfigLoader(
				{
					page,
					mapType: 'lorenz',
					base: '',
					onParametersLoaded: (value: LorenzParams) => {
						loaded.push(value);
						return value;
					}
				},
				state
			);

			expect(state.isLoading).toBe(true);

			// Abort before the fetch resolves — sets signal.aborted = true
			cleanup();

			// Now resolve the fetch so the async body can continue
			resolveFetch({
				ok: true,
				json: async () => ({
					mapType: 'lorenz',
					parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
				})
			} as Response);

			await flushPromises();
			await flushPromises();

			// Because the signal was aborted, the result should be discarded
			expect(loaded).toHaveLength(0);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('reports non-Error throws from onParametersLoaded for shared config', async () => {
		const params: LorenzParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		const mockResponse = {
			ok: true,
			json: async () => ({ mapType: 'lorenz', parameters: params })
		};
		const rawFetchMock = mock(() => Promise.resolve(mockResponse as Response));
		const fetchMock: typeof fetch = Object.assign(rawFetchMock, { preconnect: () => {} });
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock;

		try {
			const page = writable<Page>(createPage('http://localhost/lorenz?share=throw-string'));
			const state = createInitialConfigLoaderState();

			const { cleanup } = useConfigLoader(
				{
					page,
					mapType: 'lorenz',
					base: '',
					onParametersLoaded: () => {
						throw 'string-failure';
					}
				},
				state
			);

			await waitFor(() => state.isLoading === false);
			expect(state.showError).toBe(true);
			expect(state.errors[0]).toBe('Failed to apply parameters: string-failure');

			cleanup();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('reports non-Error throws from onParametersLoaded for direct config param', () => {
		const params: LorenzParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		const configParam = encodeURIComponent(JSON.stringify(params));
		const page = writable<Page>(createPage(`http://localhost/lorenz?config=${configParam}`));
		const state = createInitialConfigLoaderState();

		const { cleanup } = useConfigLoader(
			{
				page,
				mapType: 'lorenz',
				base: '',
				onParametersLoaded: () => {
					throw 'direct-string-failure';
				}
			},
			state
		);

		expect(state.showError).toBe(true);
		expect(state.errors[0]).toBe('Failed to apply parameters: direct-string-failure');

		cleanup();
	});
});
