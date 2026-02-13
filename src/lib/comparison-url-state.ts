/**
 * URL State Management for Comparison Mode
 *
 * Handles encoding/decoding of comparison parameters in URL query strings.
 * URL format: ?compare=true&left={base64}&right={base64}
 */

import type { ChaosMapType, ChaosMapParameters } from './types';
import { validateParameters } from './chaos-validation';

export interface ComparisonURLState {
	compare: boolean;
	left: ChaosMapParameters;
	right: ChaosMapParameters;
}

/**
 * Default parameters for each chaos map type.
 * Used when URL parameters are missing or invalid.
 */
export function getDefaultParameters(mapType: ChaosMapType): ChaosMapParameters {
	switch (mapType) {
		case 'lorenz':
			return { type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 };
		case 'rossler':
			return { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 };
		case 'henon':
			return { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 };
		case 'lozi':
			return { type: 'lozi', a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 5000 };
		case 'logistic':
			return { type: 'logistic', r: 3.9, x0: 0.1, iterations: 100 };
		case 'newton':
			return { type: 'newton', xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 50 };
		case 'standard':
			return { type: 'standard', k: 0.97, numP: 20, numQ: 20, iterations: 20000 };
		case 'bifurcation-logistic':
			return { type: 'bifurcation-logistic', rMin: 2.5, rMax: 4.0, maxIterations: 1000 };
		case 'bifurcation-henon':
			return { type: 'bifurcation-henon', aMin: 0.8, aMax: 1.4, b: 0.3, maxIterations: 500 };
		case 'chaos-esthetique':
			return { type: 'chaos-esthetique', a: 1.4, b: 0.3, x0: 0, y0: 0, iterations: 10000 };
		case 'lyapunov':
			return {
				type: 'lyapunov',
				rMin: 2.5,
				rMax: 4.0,
				iterations: 100,
				transientIterations: 100
			};
	}
}

/**
 * SSR-safe base64 encoding with UTF-8 support.
 * Uses btoa in browser with unicode escaping, Buffer in Node.js.
 */
export function base64Encode(str: string): string {
	if (typeof btoa !== 'undefined') {
		// Handle unicode by converting to UTF-8 bytes first
		const uriEncoded = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
			String.fromCharCode(parseInt(p1, 16))
		);
		return btoa(uriEncoded);
	}
	// Node.js / SSR environment
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(str, 'utf8').toString('base64');
	}
	throw new Error('No base64 encoding method available in current environment');
}

/**
 * SSR-safe base64 decoding with UTF-8 support.
 * Uses atob in browser with unicode unescaping, Buffer in Node.js.
 */
export function base64Decode(str: string): string {
	if (typeof atob !== 'undefined') {
		// Decode base64, then handle unicode conversion
		const decoded = atob(str);
		return decodeURIComponent(
			decoded
				.split('')
				.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
				.join('')
		);
	}
	// Node.js / SSR environment
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(str, 'base64').toString('utf8');
	}
	throw new Error('No base64 decoding method available in current environment');
}

/**
 * Encode parameters to base64 for URL.
 * Strips the 'type' field to save URL space since it's redundant with the route.
 */
function encodeParams(params: ChaosMapParameters): string {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { type, ...rest } = params;
	return base64Encode(JSON.stringify(rest));
}

/**
 * Decode parameters from base64 URL string.
 */
function decodeParams<T extends ChaosMapType>(
	encoded: string,
	mapType: T
): ChaosMapParameters | null {
	try {
		const decoded = JSON.parse(base64Decode(encoded));
		// Add back the type field
		const params = { ...decoded, type: mapType };

		// Validate the parameters
		const validation = validateParameters(mapType, params);
		if (!validation.isValid) {
			console.warn('Invalid comparison parameters:', validation.errors);
			return null;
		}

		return params as ChaosMapParameters;
	} catch (e) {
		console.warn('Failed to decode comparison parameters:', e);
		return null;
	}
}

/**
 * Encode comparison state to URL search params.
 */
export function encodeComparisonState(state: ComparisonURLState): URLSearchParams {
	const params = new URLSearchParams();
	params.set('compare', 'true');
	params.set('left', encodeParams(state.left));
	params.set('right', encodeParams(state.right));
	return params;
}

/**
 * Build a full comparison URL path.
 */
export function buildComparisonUrl(
	base: string,
	mapType: ChaosMapType,
	state: ComparisonURLState
): string {
	const params = encodeComparisonState(state);
	const cleanedBase = base.replace(/\/+$/, '');
	return `${cleanedBase}/${mapType}/compare?${params.toString()}`;
}

/**
 * Decode comparison state from URL.
 * Returns null if not in comparison mode.
 */
export function decodeComparisonState<T extends ChaosMapType>(
	url: URL,
	mapType: T
): ComparisonURLState | null {
	const compare = url.searchParams.get('compare');
	if (compare !== 'true') return null;

	const leftEncoded = url.searchParams.get('left');
	const rightEncoded = url.searchParams.get('right');

	const defaultParams = getDefaultParameters(mapType);

	const left = leftEncoded ? decodeParams(leftEncoded, mapType) : defaultParams;
	const right = rightEncoded ? decodeParams(rightEncoded, mapType) : defaultParams;

	return {
		compare: true,
		left: left ?? defaultParams,
		right: right ?? defaultParams
	};
}

/**
 * Swap left and right parameters.
 */
export function swapParameters(state: ComparisonURLState): ComparisonURLState {
	return {
		...state,
		left: state.right,
		right: state.left
	};
}

/**
 * Create initial comparison state from current parameters.
 * Used when entering comparison mode from a single visualization.
 */
export function createComparisonStateFromCurrent(
	mapType: ChaosMapType,
	currentParams: ChaosMapParameters
): ComparisonURLState {
	const defaultParams = getDefaultParameters(mapType);
	return {
		compare: true,
		left: currentParams,
		right: defaultParams
	};
}
