import { describe, expect, mock, test } from 'bun:test';
import type { Page } from '@sveltejs/kit';
import { writable } from 'svelte/store';
import type { ChaosMapParameters } from '$lib/types';
import { createInitialConfigLoaderState, useConfigLoader } from './use-config-loader';

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

	test('applies config param and shows stability warnings', () => {
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
				onParametersLoaded: (value) => loaded.push(value)
			},
			state
		);

		expect(loaded).toHaveLength(1);
		expect(state.showWarning).toBe(true);
		expect(state.warnings[0]).toContain('sigma');
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
		const onParametersLoaded = mock(() => {});

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
					onParametersLoaded: (value) => loaded.push(value)
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
			const onParametersLoaded = mock(() => {});

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
});
