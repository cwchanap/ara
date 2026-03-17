/**
 * Targeted tests for the defensive catch blocks in useConfigLoader.
 *
 * These tests cover the defensive catch blocks that wrap
 * loadSavedConfigParameters / loadSharedConfigParameters calls which normally
 * do not throw in practice (they handle their own errors internally and return
 * error objects). By mocking $lib/saved-config-loader to throw, we exercise
 * those defensive paths.
 *
 * They also cover the defensive catch around the synchronous parseConfigParam
 * call — similarly unreachable in practice — by forcing that function to throw.
 *
 * Note: This file uses mock.module() so it is kept separate from the main
 * use-config-loader.test.ts to avoid polluting its test environment.
 */

import { describe, expect, mock, test } from 'bun:test';
import type { Page } from '@sveltejs/kit';
import { writable } from 'svelte/store';

// Controls whether loadSavedConfigParameters throws.
let loadSavedThrow: Error | null = new Error('DB connection failure');
// Controls whether loadSharedConfigParameters throws.
let loadSharedThrow: Error | null = null;
// Controls whether parseConfigParam throws.
let parseConfigThrow: Error | null = null;

// Controllable signal: resolved by the mock when loadSavedConfigParameters is invoked,
// allowing tests to await the exact async call instead of relying on flushPromises().
let notifyLoadSavedCalled: (() => void) | null = null;
// Controllable signal for loadSharedConfigParameters.
let notifyLoadSharedCalled: (() => void) | null = null;

mock.module('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: async () => {
		notifyLoadSavedCalled?.();
		notifyLoadSavedCalled = null;
		if (loadSavedThrow) throw loadSavedThrow;
		return {
			ok: true as const,
			parameters: { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 },
			source: 'api' as const
		};
	},
	loadSharedConfigParameters: async () => {
		notifyLoadSharedCalled?.();
		notifyLoadSharedCalled = null;
		if (loadSharedThrow) throw loadSharedThrow;
		return { ok: false as const, error: 'not found', errors: ['not found'] };
	},
	parseConfigParam: () => {
		if (parseConfigThrow) throw parseConfigThrow;
		return { ok: false as const, errors: ['parse error'], logMessage: '', logDetails: {} };
	}
}));

const { createInitialConfigLoaderState, useConfigLoader } = await import('./use-config-loader');

type LorenzParams = { type: 'lorenz'; sigma: number; rho: number; beta: number };

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

async function waitFor(predicate: () => boolean, timeoutMs = 500) {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error('Timed out waiting for condition');
		}
		await flushPromises();
	}
}

describe('useConfigLoader catch blocks (functions throw unexpectedly)', () => {
	test('sets error state on configId path when loadSavedConfigParameters throws', async () => {
		loadSavedThrow = new Error('DB connection failure');
		loadSharedThrow = null;
		parseConfigThrow = null;

		const page = writable<Page>(createPage('http://localhost/lorenz?configId=test-id'));
		const state = createInitialConfigLoaderState();

		useConfigLoader(
			{
				page,
				mapType: 'lorenz',
				base: '',
				onParametersLoaded: (p: LorenzParams) => p
			},
			state
		);

		await waitFor(() => !state.isLoading && state.errors.length > 0);
		expect(state.showError).toBe(true);
		expect(state.errors[0]).toContain('Failed to load configuration');
	});

	test('silently returns on configId path when loadSavedConfigParameters throws AbortError', async () => {
		const abortErr = new Error('Aborted');
		abortErr.name = 'AbortError';
		loadSavedThrow = abortErr;
		loadSharedThrow = null;
		parseConfigThrow = null;

		// Controllable promise: resolves the moment the mock function is entered,
		// giving us a deterministic point to await rather than relying on flushPromises().
		const loadSavedCalledPromise = new Promise<void>((resolve) => {
			notifyLoadSavedCalled = resolve;
		});

		const page = writable<Page>(createPage('http://localhost/lorenz?configId=test-id'));
		const state = createInitialConfigLoaderState();

		useConfigLoader(
			{
				page,
				mapType: 'lorenz',
				base: '',
				onParametersLoaded: (p: LorenzParams) => p
			},
			state
		);

		// Wait for loadSavedConfigParameters to be invoked, then give the
		// async catch block one microtask to finish processing.
		await loadSavedCalledPromise;
		await flushPromises();

		// AbortError should be silently ignored — no error state set
		expect(state.showError).toBe(false);
		expect(state.errors).toEqual([]);
	});

	test('sets error state on shareCode path when loadSharedConfigParameters throws', async () => {
		loadSavedThrow = null;
		loadSharedThrow = new Error('Share DB failure');
		parseConfigThrow = null;

		const page = writable<Page>(createPage('http://localhost/lorenz?share=ABCD1234'));
		const state = createInitialConfigLoaderState();

		useConfigLoader(
			{
				page,
				mapType: 'lorenz',
				base: '',
				onParametersLoaded: (p: LorenzParams) => p
			},
			state
		);

		await waitFor(() => !state.isLoading && state.errors.length > 0);
		expect(state.showError).toBe(true);
		expect(state.errors[0]).toContain('Failed to load configuration');
	});

	test('sets error state on config param path when parseConfigParam throws', () => {
		loadSavedThrow = null;
		loadSharedThrow = null;
		parseConfigThrow = new Error('Unexpected parse failure');

		const configParam = encodeURIComponent(
			JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
		);
		const page = writable<Page>(createPage(`http://localhost/lorenz?config=${configParam}`));
		const state = createInitialConfigLoaderState();

		useConfigLoader(
			{
				page,
				mapType: 'lorenz',
				base: '',
				onParametersLoaded: (p: LorenzParams) => p
			},
			state
		);

		expect(state.showError).toBe(true);
		expect(state.errors[0]).toContain('Configuration error');
	});
});
