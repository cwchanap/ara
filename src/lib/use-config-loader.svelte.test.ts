import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writable } from 'svelte/store';
import type { Page } from '@sveltejs/kit';
import type { LorenzParameters } from '$lib/types';

vi.mock('$lib/saved-config-loader', () => ({
	loadSharedConfigParameters: vi.fn(),
	loadSavedConfigParameters: vi.fn(),
	parseConfigParam: vi.fn()
}));

import { createInitialConfigLoaderState, useConfigLoader } from './use-config-loader';
import {
	loadSharedConfigParameters,
	loadSavedConfigParameters,
	parseConfigParam
} from '$lib/saved-config-loader';

const mockLoadShared = vi.mocked(loadSharedConfigParameters);
const mockLoadSaved = vi.mocked(loadSavedConfigParameters);
const mockParseConfig = vi.mocked(parseConfigParam);

function makePage(url: string): Page {
	return { url: new URL(url) } as Page;
}

const defaultParams: LorenzParameters = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.66 };

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('createInitialConfigLoaderState', () => {
	it('returns correct defaults', () => {
		const state = createInitialConfigLoaderState();
		expect(state).toEqual({
			errors: [],
			showError: false,
			warnings: [],
			showWarning: false,
			isLoading: false
		});
	});
});

describe('useConfigLoader', () => {
	function setup(initialUrl = 'http://localhost/lorenz') {
		const pageStore = writable<Page>(makePage(initialUrl));
		const state = createInitialConfigLoaderState();
		const onParametersLoaded = vi.fn((p: LorenzParameters) => p);
		const onCheckStability = vi.fn(() => ({ isStable: true, warnings: [] }));

		const { cleanup } = useConfigLoader(
			{
				page: pageStore,
				mapType: 'lorenz' as const,
				base: '/base',
				onParametersLoaded,
				onCheckStability
			},
			state
		);

		return { pageStore, state, cleanup, onParametersLoaded, onCheckStability };
	}

	it('clears state when no URL params present', () => {
		const { state, cleanup } = setup('http://localhost/lorenz?foo=bar');
		expect(state.errors).toEqual([]);
		expect(state.showError).toBe(false);
		expect(state.warnings).toEqual([]);
		expect(state.showWarning).toBe(false);
		expect(state.isLoading).toBe(false);
		cleanup();
	});

	describe('configParam (synchronous)', () => {
		it('calls parseConfigParam and onParametersLoaded on success', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);
			const onCheckStability = vi.fn(() => ({ isStable: true, warnings: [] }));

			mockParseConfig.mockReturnValue({
				ok: true,
				parameters: defaultParams
			} as ReturnType<typeof parseConfigParam>);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded,
					onCheckStability
				},
				state
			);

			pageStore.set(
				makePage('http://localhost/lorenz?config=%7B%22type%22%3A%22lorenz%22%7D')
			);

			expect(mockParseConfig).toHaveBeenCalledWith({
				mapType: 'lorenz',
				configParam: '{"type":"lorenz"}'
			});
			expect(onParametersLoaded).toHaveBeenCalledWith(defaultParams);
			expect(onCheckStability).toHaveBeenCalledWith(defaultParams);
			expect(state.errors).toEqual([]);
			expect(state.showError).toBe(false);
			expect(state.isLoading).toBe(false);
			cleanup();
		});

		it('sets errors when parseConfigParam returns ok:false', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockParseConfig.mockReturnValue({
				ok: false,
				error: 'bad config',
				errors: ['bad config'],
				logMessage: 'error',
				logDetails: null
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?config=bad'));

			expect(state.errors).toEqual(['bad config']);
			expect(state.showError).toBe(true);
			expect(onParametersLoaded).not.toHaveBeenCalled();
			cleanup();
		});

		it('sets errors when onParametersLoaded throws', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn(() => {
				throw new Error('apply failed');
			});

			mockParseConfig.mockReturnValue({
				ok: true,
				parameters: defaultParams
			} as ReturnType<typeof parseConfigParam>);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?config=%7B%7D'));

			expect(state.errors).toEqual(['Failed to apply parameters: apply failed']);
			expect(state.showError).toBe(true);
			cleanup();
		});

		it('sets warnings when stability check returns unstable', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);
			const onCheckStability = vi.fn(() => ({
				isStable: false,
				warnings: ['Unstable!']
			}));

			mockParseConfig.mockReturnValue({
				ok: true,
				parameters: defaultParams
			} as ReturnType<typeof parseConfigParam>);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded,
					onCheckStability
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?config=%7B%7D'));

			expect(state.warnings).toEqual(['Unstable!']);
			expect(state.showWarning).toBe(true);
			cleanup();
		});

		it('sets errors when parseConfigParam throws', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockParseConfig.mockImplementation(() => {
				throw new Error('unexpected');
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?config=xyz'));

			expect(state.errors).toEqual(['Configuration error: unexpected']);
			expect(state.showError).toBe(true);
			cleanup();
		});

		it('does not call onCheckStability when not provided', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockParseConfig.mockReturnValue({
				ok: true,
				parameters: defaultParams
			} as ReturnType<typeof parseConfigParam>);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?config=%7B%7D'));

			expect(onParametersLoaded).toHaveBeenCalled();
			expect(state.warnings).toEqual([]);
			expect(state.showWarning).toBe(false);
			cleanup();
		});
	});

	describe('shareCode (async)', () => {
		it('calls loadSharedConfigParameters and sets isLoading', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			let resolvePromise: (v: unknown) => void;
			const pending = new Promise((resolve) => {
				resolvePromise = resolve;
			});

			mockLoadShared.mockReturnValue(
				pending as ReturnType<typeof loadSharedConfigParameters>
			);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?share=abc123'));

			expect(state.isLoading).toBe(true);
			expect(mockLoadShared).toHaveBeenCalledWith(
				expect.objectContaining({
					shareCode: 'abc123',
					mapType: 'lorenz',
					base: '/base'
				})
			);

			resolvePromise!({
				ok: true,
				parameters: defaultParams,
				source: 'sharedApi'
			});

			await new Promise((r) => setTimeout(r, 0));

			expect(state.isLoading).toBe(false);
			expect(onParametersLoaded).toHaveBeenCalledWith(defaultParams);
			cleanup();
		});

		it('handles API failure with errors', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockLoadShared.mockResolvedValue({
				ok: false,
				error: 'expired',
				errors: ['This shared configuration has expired']
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?share=expired'));

			await new Promise((r) => setTimeout(r, 0));

			expect(state.errors).toEqual(['This shared configuration has expired']);
			expect(state.showError).toBe(true);
			expect(onParametersLoaded).not.toHaveBeenCalled();
			cleanup();
		});

		it('handles network error with errors', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockLoadShared.mockRejectedValue(new Error('Network failure'));

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?share=netfail'));

			await new Promise((r) => setTimeout(r, 0));

			expect(state.errors[0]).toContain('Failed to load configuration');
			expect(state.showError).toBe(true);
			cleanup();
		});

		it('silently ignores abort errors', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			const abortError = new Error('The operation was aborted');
			abortError.name = 'AbortError';
			mockLoadShared.mockRejectedValue(abortError);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?share=aborted'));

			await new Promise((r) => setTimeout(r, 0));

			expect(state.errors).toEqual([]);
			expect(state.showError).toBe(false);
			cleanup();
		});

		it('calls onCheckStability after successful load', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);
			const onCheckStability = vi.fn(() => ({
				isStable: false,
				warnings: ['watch out']
			}));

			mockLoadShared.mockResolvedValue({
				ok: true,
				parameters: defaultParams,
				source: 'sharedApi'
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded,
					onCheckStability
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?share=abc'));

			await new Promise((r) => setTimeout(r, 0));

			expect(onCheckStability).toHaveBeenCalledWith(defaultParams);
			expect(state.warnings).toEqual(['watch out']);
			expect(state.showWarning).toBe(true);
			cleanup();
		});

		it('handles onParametersLoaded throwing during async load', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn(() => {
				throw new Error('boom');
			});

			mockLoadShared.mockResolvedValue({
				ok: true,
				parameters: defaultParams,
				source: 'sharedApi'
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?share=throw'));

			await new Promise((r) => setTimeout(r, 0));

			expect(state.errors).toEqual(['Failed to apply parameters: boom']);
			expect(state.showError).toBe(true);
			cleanup();
		});
	});

	describe('configId (async)', () => {
		it('calls loadSavedConfigParameters with configId', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockLoadSaved.mockResolvedValue({
				ok: true,
				parameters: defaultParams,
				source: 'api'
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?configId=cfg-42'));

			await new Promise((r) => setTimeout(r, 0));

			expect(mockLoadSaved).toHaveBeenCalledWith(
				expect.objectContaining({
					configId: 'cfg-42',
					mapType: 'lorenz',
					base: '/base'
				})
			);
			expect(onParametersLoaded).toHaveBeenCalledWith(defaultParams);
			expect(state.isLoading).toBe(false);
			cleanup();
		});

		it('handles loadSavedConfigParameters failure', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockLoadSaved.mockRejectedValue(new Error('db error'));

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?configId=bad'));

			await new Promise((r) => setTimeout(r, 0));

			expect(state.errors[0]).toContain('Failed to load configuration');
			expect(state.showError).toBe(true);
			cleanup();
		});

		it('handles loadSavedConfigParameters returning ok:false', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockLoadSaved.mockResolvedValue({
				ok: false,
				error: 'not found',
				errors: ['Configuration not found']
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?configId=missing'));

			await new Promise((r) => setTimeout(r, 0));

			expect(state.errors).toEqual(['Configuration not found']);
			expect(state.showError).toBe(true);
			cleanup();
		});
	});

	describe('deduplication', () => {
		it('does not re-trigger for same configKey', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockParseConfig.mockReturnValue({
				ok: true,
				parameters: defaultParams
			} as ReturnType<typeof parseConfigParam>);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			const url = 'http://localhost/lorenz?config=%7B%22type%22%3A%22lorenz%22%7D';
			pageStore.set(makePage(url));
			expect(onParametersLoaded).toHaveBeenCalledTimes(1);

			pageStore.set(makePage(url));
			expect(onParametersLoaded).toHaveBeenCalledTimes(1);

			cleanup();
		});

		it('re-triggers for different configKey', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockParseConfig.mockReturnValue({
				ok: true,
				parameters: defaultParams
			} as ReturnType<typeof parseConfigParam>);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?config=cfg1'));
			expect(onParametersLoaded).toHaveBeenCalledTimes(1);

			pageStore.set(makePage('http://localhost/lorenz?config=cfg2'));
			expect(onParametersLoaded).toHaveBeenCalledTimes(2);

			cleanup();
		});
	});

	describe('cleanup', () => {
		it('unsubscribes from page store', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			cleanup();

			mockParseConfig.mockReturnValue({
				ok: true,
				parameters: defaultParams
			} as ReturnType<typeof parseConfigParam>);

			pageStore.set(makePage('http://localhost/lorenz?config=test'));
			expect(mockParseConfig).not.toHaveBeenCalled();
		});

		it('aborts pending async load on cleanup', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			let resolvePromise: (v: unknown) => void;
			const pending = new Promise((resolve) => {
				resolvePromise = resolve;
			});

			mockLoadShared.mockReturnValue(
				pending as ReturnType<typeof loadSharedConfigParameters>
			);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?share=abc'));
			expect(state.isLoading).toBe(true);

			cleanup();

			resolvePromise!({
				ok: true,
				parameters: defaultParams,
				source: 'sharedApi'
			});

			await new Promise((r) => setTimeout(r, 0));

			expect(onParametersLoaded).not.toHaveBeenCalled();
		});
	});

	describe('priority: shareCode > configId > configParam', () => {
		it('prefers shareCode over configId and configParam', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockLoadShared.mockResolvedValue({
				ok: true,
				parameters: defaultParams,
				source: 'sharedApi'
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(
				makePage('http://localhost/lorenz?share=abc&configId=cfg1&config=%7B%7D')
			);

			await new Promise((r) => setTimeout(r, 0));

			expect(mockLoadShared).toHaveBeenCalled();
			expect(mockLoadSaved).not.toHaveBeenCalled();
			expect(mockParseConfig).not.toHaveBeenCalled();
			cleanup();
		});

		it('prefers configId over configParam', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockLoadSaved.mockResolvedValue({
				ok: true,
				parameters: defaultParams,
				source: 'api'
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?configId=cfg1&config=%7B%7D'));

			await new Promise((r) => setTimeout(r, 0));

			expect(mockLoadSaved).toHaveBeenCalled();
			expect(mockParseConfig).not.toHaveBeenCalled();
			cleanup();
		});
	});

	describe('transitioning from config to no config', () => {
		it('clears state when navigating away from config', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			mockParseConfig.mockReturnValue({
				ok: true,
				parameters: defaultParams
			} as ReturnType<typeof parseConfigParam>);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?config=%7B%7D'));
			expect(onParametersLoaded).toHaveBeenCalledTimes(1);

			pageStore.set(makePage('http://localhost/lorenz'));
			expect(state.errors).toEqual([]);
			expect(state.showError).toBe(false);
			expect(state.isLoading).toBe(false);
			cleanup();
		});
	});

	describe('abort on new config', () => {
		it('aborts previous async load when new config arrives', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			let resolveFirst: (v: unknown) => void;
			const firstPending = new Promise((resolve) => {
				resolveFirst = resolve;
			});

			mockLoadShared.mockReturnValueOnce(
				firstPending as ReturnType<typeof loadSharedConfigParameters>
			);
			mockLoadShared.mockResolvedValue({
				ok: true,
				parameters: defaultParams,
				source: 'sharedApi'
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?share=first'));
			expect(state.isLoading).toBe(true);

			pageStore.set(makePage('http://localhost/lorenz?share=second'));

			await new Promise((r) => setTimeout(r, 0));

			resolveFirst!({
				ok: true,
				parameters: { type: 'lorenz', sigma: 1, rho: 1, beta: 1 },
				source: 'sharedApi'
			});

			await new Promise((r) => setTimeout(r, 0));

			expect(onParametersLoaded).toHaveBeenCalledTimes(1);
			expect(onParametersLoaded).toHaveBeenCalledWith(defaultParams);
			cleanup();
		});
	});

	// ── Merged from bun use-config-loader.test.ts / -catch.test.ts ──────────
	// Behaviors not already covered by the base vitest suite.
	describe('stability checks across all sources (merged)', () => {
		it('does not set warnings when stability check returns stable (shared)', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);
			const onCheckStability = vi.fn(() => ({ isStable: true, warnings: [] as string[] }));

			mockLoadShared.mockResolvedValue({
				ok: true,
				parameters: defaultParams,
				source: 'sharedApi'
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded,
					onCheckStability
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?share=stable'));
			await new Promise((r) => setTimeout(r, 0));

			expect(onCheckStability).toHaveBeenCalledWith(defaultParams);
			expect(state.showWarning).toBe(false);
			expect(state.warnings).toEqual([]);
			cleanup();
		});

		it('does not set warnings when stability check returns stable (config param)', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);
			const onCheckStability = vi.fn(() => ({ isStable: true, warnings: [] as string[] }));

			mockParseConfig.mockReturnValue({
				ok: true,
				parameters: defaultParams
			} as ReturnType<typeof parseConfigParam>);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded,
					onCheckStability
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?config=%7B%7D'));

			expect(onCheckStability).toHaveBeenCalledWith(defaultParams);
			expect(state.showWarning).toBe(false);
			expect(state.warnings).toEqual([]);
			cleanup();
		});

		it('sets warnings when stability check returns unstable (configId)', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);
			const onCheckStability = vi.fn(() => ({
				isStable: false,
				warnings: ['Unstable configId']
			}));

			mockLoadSaved.mockResolvedValue({
				ok: true,
				parameters: defaultParams,
				source: 'api'
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded,
					onCheckStability
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?configId=cfg-unstable'));
			await new Promise((r) => setTimeout(r, 0));

			expect(state.showWarning).toBe(true);
			expect(state.warnings).toEqual(['Unstable configId']);
			cleanup();
		});

		it('does not set warnings when stability check returns stable (configId)', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);
			const onCheckStability = vi.fn(() => ({ isStable: true, warnings: [] as string[] }));

			mockLoadSaved.mockResolvedValue({
				ok: true,
				parameters: defaultParams,
				source: 'api'
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded,
					onCheckStability
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?configId=cfg-stable'));
			await new Promise((r) => setTimeout(r, 0));

			expect(onCheckStability).toHaveBeenCalledWith(defaultParams);
			expect(state.showWarning).toBe(false);
			expect(state.warnings).toEqual([]);
			cleanup();
		});
	});

	describe('non-Error throws and abort edge cases (merged)', () => {
		it('reports non-Error (string) throws from onParametersLoaded for shared config', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn(() => {
				throw 'string-failure';
			});

			mockLoadShared.mockResolvedValue({
				ok: true,
				parameters: defaultParams,
				source: 'sharedApi'
			});

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?share=throw-string'));
			await new Promise((r) => setTimeout(r, 0));

			expect(state.errors).toEqual(['Failed to apply parameters: string-failure']);
			expect(state.showError).toBe(true);
			cleanup();
		});

		it('reports non-Error (string) throws from onParametersLoaded for direct config param', () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn(() => {
				throw 'direct-string-failure';
			});

			mockParseConfig.mockReturnValue({
				ok: true,
				parameters: defaultParams
			} as ReturnType<typeof parseConfigParam>);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?config=%7B%7D'));

			expect(state.errors).toEqual(['Failed to apply parameters: direct-string-failure']);
			expect(state.showError).toBe(true);
			cleanup();
		});

		it('silently ignores AbortError on configId path', async () => {
			const pageStore = writable<Page>(makePage('http://localhost/lorenz'));
			const state = createInitialConfigLoaderState();
			const onParametersLoaded = vi.fn((p: LorenzParameters) => p);

			const abortError = new Error('Aborted');
			abortError.name = 'AbortError';
			mockLoadSaved.mockRejectedValue(abortError);

			const { cleanup } = useConfigLoader(
				{
					page: pageStore,
					mapType: 'lorenz' as const,
					base: '/base',
					onParametersLoaded
				},
				state
			);

			pageStore.set(makePage('http://localhost/lorenz?configId=aborted'));
			await new Promise((r) => setTimeout(r, 0));

			expect(state.errors).toEqual([]);
			expect(state.showError).toBe(false);
			cleanup();
		});
	});
});
