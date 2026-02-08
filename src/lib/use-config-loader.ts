/**
 * Unified configuration loader for chaos map visualizations.
 *
 * Provides a standardized $effect-based approach for loading configurations
 * from URL parameters (configId, share, or config). Replaces the inconsistent
 * onMount vs $effect patterns across different visualization pages.
 *
 * Key features:
 * - Reactive to URL changes (browser back/forward works)
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

/**
 * Creates a reactive configuration loader that monitors URL parameters
 * and loads configurations from various sources.
 *
 * @example
 * ```typescript
 * const configState = $state<ConfigLoaderState>({
 *   errors: [],
 *   showError: false,
 *   warnings: [],
 *   showWarning: false,
 *   isLoading: false
 * });
 *
 * useConfigLoader({
 *   page,
 *   mapType: 'lorenz',
 *   base,
 *   onParametersLoaded: (params) => {
 *     sigma = params.sigma;
 *     rho = params.rho;
 *     beta = params.beta;
 *   }
 * }, configState);
 * ```
 */
export function useConfigLoader<T extends ChaosMapType>(
	options: ConfigLoaderOptions<T>,
	state: ConfigLoaderState
): void {
	let lastAppliedConfigKey: string | null = null;
	let configLoadAbortController: AbortController | null = null;

	$effect(() => {
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
						typeof fetch.preconnect !== 'undefined'
							? { preconnect: fetch.preconnect }
							: {};
					const fetchWithSignal = Object.assign(
						baseFetch,
						preconnectProp
					) as typeof fetch;

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
						if (signal.aborted) return;
						if (lastAppliedConfigKey !== currentConfigKey) return;
						state.errors = [
							'Failed to load configuration: ' +
								(e instanceof Error ? e.message : 'Unknown error')
						];
						state.showError = true;
						state.isLoading = false;
						return;
					}

					// Check if we should still apply this result
					if (signal.aborted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;

					state.isLoading = false;

					if (!result.ok) {
						state.errors = result.errors;
						state.showError = true;
						return;
					}

					// Apply parameters to visualization
					const typedParams = result.parameters;
					onParametersLoaded(typedParams);

					// Check stability
					const stability = checkParameterStability(mapType, typedParams);
					if (!stability.isStable) {
						state.warnings = stability.warnings;
						state.showWarning = true;
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
					onParametersLoaded(typedParams);

					// Check stability
					const stability = checkParameterStability(mapType, typedParams);
					if (!stability.isStable) {
						state.warnings = stability.warnings;
						state.showWarning = true;
					}
				} catch (e) {
					console.error('Invalid config parameter:', e);
					state.errors = ['Failed to parse configuration parameters'];
					state.showError = true;
					state.isLoading = false;
				}
			} else {
				// No config to load
				state.isLoading = false;
			}
		});

		// Return cleanup to unsubscribe when effect re-runs or component unmounts
		return () => {
			configLoadAbortController?.abort();
			configLoadAbortController = null;
			unsubscribe();
		};
	});
}
