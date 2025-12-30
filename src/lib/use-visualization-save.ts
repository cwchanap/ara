/**
 * useVisualizationSave - Reusable save/load logic for visualization pages
 *
 * Provides state management and handlers for:
 * - Save dialog state
 * - Save success/error toasts
 * - Config loading from URL parameters
 * - Stability warnings
 */

import { base } from '$app/paths';
import { TOAST_SUCCESS_DURATION_MS, TOAST_ERROR_DURATION_MS } from '$lib/constants';
import { checkParameterStability } from '$lib/chaos-validation';
import { loadSavedConfigParameters, parseConfigParam } from '$lib/saved-config-loader';
import type { ChaosMapType, ChaosMapParameters } from '$lib/types';

export interface SaveState {
	showSaveDialog: boolean;
	saveSuccess: boolean;
	saveError: string | null;
	configErrors: string[];
	showConfigError: boolean;
	stabilityWarnings: string[];
	showStabilityWarning: boolean;
}

export interface SaveHandlers {
	openSaveDialog: () => void;
	closeSaveDialog: () => void;
	handleSave: (name: string, getParameters: () => ChaosMapParameters) => Promise<void>;
	clearSaveSuccess: () => void;
	clearSaveError: () => void;
	dismissConfigError: () => void;
	dismissStabilityWarning: () => void;
}

export interface LoadConfigOptions<T extends ChaosMapType> {
	mapType: T;
	searchParams: URLSearchParams;
	fetchFn?: typeof fetch;
	signal?: AbortSignal;
}

export type LoadConfigResult<T extends ChaosMapType> =
	| {
			ok: true;
			parameters: Extract<ChaosMapParameters, { type: T }>;
			stabilityWarnings: string[];
	  }
	| {
			ok: false;
			errors: string[];
	  }
	| {
			ok: 'none';
	  };

/**
 * Creates a save handler for visualization pages.
 *
 * @param mapType - The chaos map type
 * @param state - The reactive state object
 * @returns Save handler function
 */
export function createSaveHandler(
	mapType: ChaosMapType,
	state: SaveState
): (name: string, getParameters: () => ChaosMapParameters) => Promise<void> {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return async (name: string, getParameters: () => ChaosMapParameters) => {
		// Clear any existing timeout and errors
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
		state.saveError = null;

		try {
			const response = await fetch(`${base}/api/save-config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					mapType,
					parameters: getParameters()
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Failed to save' }));
				state.saveError = errorData.error || 'Failed to save configuration';
				timeoutId = setTimeout(() => {
					state.saveError = null;
					timeoutId = null;
				}, TOAST_ERROR_DURATION_MS);
				return;
			}

			state.saveSuccess = true;
			state.showSaveDialog = false;
			timeoutId = setTimeout(() => {
				state.saveSuccess = false;
				timeoutId = null;
			}, TOAST_SUCCESS_DURATION_MS);
		} catch (error) {
			state.saveError =
				error instanceof Error ? error.message : 'Failed to save configuration';
			timeoutId = setTimeout(() => {
				state.saveError = null;
				timeoutId = null;
			}, TOAST_ERROR_DURATION_MS);
		}
	};
}

/**
 * Load configuration parameters from URL.
 *
 * Handles both `configId` (load from API) and `config` (inline JSON) URL parameters.
 *
 * @param options - Load configuration options
 * @returns Load result with parameters or errors
 */
export async function loadConfigFromUrl<T extends ChaosMapType>(
	options: LoadConfigOptions<T>
): Promise<LoadConfigResult<T>> {
	const { mapType, searchParams, fetchFn = fetch, signal } = options;

	const configId = searchParams.get('configId');
	if (configId) {
		try {
			const result = await loadSavedConfigParameters({
				configId,
				mapType,
				base,
				fetchFn
			});

			if (signal?.aborted) return { ok: 'none' };

			if (!result.ok) {
				return { ok: false, errors: result.errors };
			}

			const stability = checkParameterStability(mapType, result.parameters);
			return {
				ok: true,
				parameters: result.parameters,
				stabilityWarnings: stability.isStable ? [] : stability.warnings
			};
		} catch (err) {
			if (
				signal?.aborted ||
				(err instanceof DOMException && err.name === 'AbortError') ||
				(err instanceof Error && err.name === 'AbortError')
			) {
				return { ok: 'none' };
			}
			return { ok: false, errors: ['Failed to load configuration parameters'] };
		}
	}

	const configParam = searchParams.get('config');
	if (configParam) {
		try {
			const parsed = parseConfigParam({ mapType, configParam });
			if (!parsed.ok) {
				console.error(parsed.logMessage, parsed.logDetails);
				return { ok: false, errors: parsed.errors };
			}

			const stability = checkParameterStability(mapType, parsed.parameters);
			return {
				ok: true,
				parameters: parsed.parameters,
				stabilityWarnings: stability.isStable ? [] : stability.warnings
			};
		} catch (e) {
			console.error('Invalid config parameter:', e);
			return { ok: false, errors: ['Failed to parse configuration parameters'] };
		}
	}

	return { ok: 'none' };
}

/**
 * Create initial save state.
 */
export function createInitialSaveState(): SaveState {
	return {
		showSaveDialog: false,
		saveSuccess: false,
		saveError: null,
		configErrors: [],
		showConfigError: false,
		stabilityWarnings: [],
		showStabilityWarning: false
	};
}
