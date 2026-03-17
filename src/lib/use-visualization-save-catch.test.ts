/**
 * Targeted tests for the defensive catch blocks in loadConfigFromUrl.
 *
 * In use-visualization-save.ts, loadConfigFromUrl has defensive catch blocks
 * around calls that are not expected to throw in normal operation
 * (loadSavedConfigParameters and parseConfigParam handle their own errors
 * internally and return error objects). By mocking $lib/saved-config-loader to
 * throw, we exercise those defensive paths.
 *
 * Note: This file uses mock.module() so it is kept separate from the main
 * use-visualization-save.test.ts to avoid polluting its test environment.
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Mutable: controls what loadSavedConfigParameters throws per-test.
let loadSavedThrow: Error | null = new Error('Unexpected DB connection failure');
// Mutable: controls what parseConfigParam throws per-test.
let parseConfigThrow: Error | null = new Error('Unexpected parse failure');

mock.module('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: async () => {
		if (loadSavedThrow) throw loadSavedThrow;
		return {
			ok: true as const,
			parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			source: 'api' as const
		};
	},
	parseConfigParam: () => {
		if (parseConfigThrow) throw parseConfigThrow;
		return {
			ok: true as const,
			parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
		};
	},
	loadSharedConfigParameters: async () => ({
		ok: false as const,
		error: 'not found',
		errors: ['not found']
	})
}));

const { loadConfigFromUrl } = await import('./use-visualization-save');

describe('loadConfigFromUrl catch blocks (functions throw unexpectedly)', () => {
	beforeEach(() => {
		loadSavedThrow = null;
		parseConfigThrow = null;
	});

	test('returns {ok:false} on configId path when loadSavedConfigParameters throws', async () => {
		loadSavedThrow = new Error('Unexpected DB connection failure');
		const params = new URLSearchParams({ configId: 'test-id' });
		const result = await loadConfigFromUrl({ mapType: 'lorenz', searchParams: params });
		expect(result.ok).toBe(false);
		if (result.ok === false) {
			expect(result.errors).toEqual(['Failed to load configuration parameters']);
		}
	});

	test('returns {ok:"none"} on configId path when loadSavedConfigParameters throws AbortError', async () => {
		const abortErr = new Error('Aborted');
		abortErr.name = 'AbortError';
		loadSavedThrow = abortErr;
		const params = new URLSearchParams({ configId: 'test-id' });
		const result = await loadConfigFromUrl({ mapType: 'lorenz', searchParams: params });
		expect(result.ok).toBe('none');
	});

	test('returns {ok:false} on config param path when parseConfigParam throws', async () => {
		parseConfigThrow = new Error('Unexpected parse failure');
		const configParam = encodeURIComponent(
			JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
		);
		const params = new URLSearchParams({ config: configParam });
		const result = await loadConfigFromUrl({ mapType: 'lorenz', searchParams: params });
		expect(result.ok).toBe(false);
		if (result.ok === false) {
			expect(result.errors).toEqual(['Failed to parse configuration parameters']);
		}
	});
});
