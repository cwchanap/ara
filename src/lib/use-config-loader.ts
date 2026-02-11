/**
 * Unified configuration loader for chaos map visualizations.
 *
 * Provides a standardized approach for loading configurations from URL
 * parameters (configId, share, or config). Must be called from within a
 * Svelte component's $effect for reactivity.
 *
 * Key features:
 * - Reactive to URL changes when called from $effect
 * - Proper abort controller cleanup
 * - Tracks "already loaded" state to prevent re-fetching
 * - Returns reactive errors/warnings for UI display
 */

import { type Readable } from 'svelte/store';
import type { Page } from '@sveltejs/kit';
import type { ChaosMapType, ChaosMapParameters } from '$lib/types';
import {
	loadSavedConfigParameters,
	loadSharedConfigParameters,
	parseConfigParam
} from '$lib/saved-config-loader';
import { checkParameterStability } from '$lib/chaos-validation';

type ParametersFor<T extends ChaosMapType> = Extract<ChaosMapParameters, { type: T }>;

export interface ConfigLoaderState {
	/** Errors from config loading (e.g., network errors, validation errors) */
	errors: string[];
	/** Whether to show the error alert */
	showError: boolean;
	/** Stability warnings from parameter checks */
	warnings: string[];
	/** Whether to show the stability warning alert */
	showWarning: boolean;
	/** Whether a config is currently being loaded */
	isLoading: boolean;
}

/**
 * Creates initial state for the config loader
 */
export function createInitialConfigLoaderState(): ConfigLoaderState {
	return {
		errors: [],
		showError: false,
		warnings: [],
		showWarning: false,
		isLoading: false
	};
}

export interface ConfigLoaderOptions<T extends ChaosMapType> {
	/** The Svelte page store containing URL params */
	page: Readable<Page>;
	/** The chaos map type being visualized */
	mapType: T;
	/** The base path for API calls */
	base: string;
	/** Callback to apply loaded parameters to the visualization */
	onParametersLoaded: (params: ParametersFor<T>) => void;
}

export interface ConfigLoaderCleanup {
	/** Call to abort any pending config loads and unsubscribe from the page store */
	cleanup: () => void;
}

/**
 * Creates a reactive configuration loader that monitors URL parameters
 * and loads configurations from various sources.
 *
 * IMPORTANT: This function must be called from within a Svelte 5 $effect rune
 * to maintain reactivity. The returned cleanup function should be returned
 * from the $effect to properly handle cleanup.
 *
 * @example
 * ```svelte
 * <script>
 *   const configState = $state(createInitialConfigLoaderState());
 *
 *   $effect(() => {
 *     const { cleanup } = useConfigLoader({
 *       page,
 *       mapType: 'lorenz',
 *       base,
 *       onParametersLoaded: (params) => {
 *         sigma = params.sigma;
 *         rho = params.rho;
 *         beta = params.beta;
 *       }
 *     }, configState);
 *
 *     return cleanup;
 *   });
 * </script>
 * ```
 */
export function useConfigLoader<T extends ChaosMapType>(
	options: ConfigLoaderOptions<T>,
	state: ConfigLoaderState
): ConfigLoaderCleanup {
	let lastAppliedConfigKey: string | null = null;
	let configLoadAbortController: AbortController | null = null;
	let isUnmounted = false;

	const { page, mapType, base, onParametersLoaded } = options;

	// Subscribe to page store for reactivity
	const unsubscribe = page.subscribe(($page) => {
		// Extract URL parameters
		const configId = $page.url.searchParams.get('configId');
		const shareCode = $page.url.searchParams.get('share');
		const configParam = $page.url.searchParams.get('config');

		// Generate a unique key for this config source
		const configKey = shareCode
			? `share:${shareCode}`
			: configId
				? `id:${configId}`
				: configParam
					? `param:${configParam}`
					: null;

		// Skip if we've already loaded this config
		if (configKey === lastAppliedConfigKey) return;
		lastAppliedConfigKey = configKey;

		// Abort any pending config load
		configLoadAbortController?.abort();
		configLoadAbortController = null;

		// Handle shared or saved configurations (require API calls)
		if (shareCode || configId) {
			// Reset state
			state.errors = [];
			state.showError = false;
			state.warnings = [];
			state.showWarning = false;
			state.isLoading = true;

			const controller = new AbortController();
			configLoadAbortController = controller;
			const { signal } = controller;
			const currentConfigKey = configKey;

			void (async () => {
				// Create fetch function with abort signal
				const baseFetch = (
					input: Parameters<typeof fetch>[0],
					init?: Parameters<typeof fetch>[1]
				) => fetch(input, { ...init, signal });
				const preconnectProp =
					typeof fetch.preconnect !== 'undefined' ? { preconnect: fetch.preconnect } : {};
				const fetchWithSignal = Object.assign(baseFetch, preconnectProp) as typeof fetch;

				let result;
				try {
					if (shareCode) {
						result = await loadSharedConfigParameters({
							shareCode,
							mapType,
							base,
							fetchFn: fetchWithSignal
						});
					} else {
						result = await loadSavedConfigParameters({
							configId: configId!,
							mapType,
							base,
							fetchFn: fetchWithSignal
						});
					}
				} catch (e) {
					// Check if this was an abort error (expected during cleanup)
					if (e instanceof Error && e.name === 'AbortError') {
						return; // Silently ignore abort errors
					}
					console.error('Failed to load configuration:', e);
					if (signal.aborted || isUnmounted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;
					// Reset lastAppliedConfigKey to allow retry on transient failures
					lastAppliedConfigKey = null;
					state.errors = [
						'Failed to load configuration: ' +
							(e instanceof Error ? e.message : 'Unknown error')
					];
					state.showError = true;
					state.isLoading = false;
					return;
				}

				// Check if we should still apply this result
				if (signal.aborted || isUnmounted) return;
				if (lastAppliedConfigKey !== currentConfigKey) return;

				state.isLoading = false;

				if (!result.ok) {
					// Reset lastAppliedConfigKey to allow retry on transient failures
					lastAppliedConfigKey = null;
					state.errors = result.errors;
					state.showError = true;
					return;
				}

				// Apply parameters to visualization
				const typedParams = result.parameters;
				try {
					onParametersLoaded(typedParams);
				} catch (err) {
					// Prevent caller exceptions from leaving UI in inconsistent state
					const errorMessage = err instanceof Error ? err.message : String(err);
					state.errors = [`Failed to apply parameters: ${errorMessage}`];
					state.showError = true;
					return;
				}

				// Check stability (only if onParametersLoaded succeeded)
				try {
					const stability = checkParameterStability(mapType, typedParams);
					if (!stability.isStable) {
						state.warnings = stability.warnings;
						state.showWarning = true;
					}
				} catch (e) {
					// Log stability check errors but don't block parameter application
					console.error('Stability check failed:', e);
				}
			})();
		}
		// Handle direct config parameter (synchronous)
		else if (configParam) {
			try {
				state.errors = [];
				state.showError = false;
				state.warnings = [];
				state.showWarning = false;
				state.isLoading = false;

				// Validate parameters structure before using
				const parsed = parseConfigParam({ mapType, configParam });
				if (!parsed.ok) {
					console.error(parsed.logMessage, parsed.logDetails);
					state.errors = parsed.errors;
					state.showError = true;
					return;
				}

				// Apply parameters to visualization
				const typedParams = parsed.parameters;
				try {
					onParametersLoaded(typedParams);
				} catch (err) {
					// Prevent caller exceptions from leaving UI in inconsistent state
					const errorMessage = err instanceof Error ? err.message : String(err);
					state.errors = [`Failed to apply parameters: ${errorMessage}`];
					state.showError = true;
					return;
				}

				// Check stability
				const stability = checkParameterStability(mapType, typedParams);
				if (!stability.isStable) {
					state.warnings = stability.warnings;
					state.showWarning = true;
				}
			} catch (e) {
				console.error('Configuration error:', e);
				const errorMessage = e instanceof Error ? e.message : 'Unknown error';
				state.errors = [`Configuration error: ${errorMessage}`];
				state.showError = true;
			}
		} else {
			// No config to load - clear any stale errors/warnings
			state.errors = [];
			state.showError = false;
			state.warnings = [];
			state.showWarning = false;
			state.isLoading = false;
		}
	});

	// Return cleanup function
	const cleanup = () => {
		isUnmounted = true;
		configLoadAbortController?.abort();
		configLoadAbortController = null;
		unsubscribe();
	};

	return { cleanup };
}
