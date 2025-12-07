/**
 * Chaos Map Parameter Validation
 *
 * Provides validation utilities for chaos map parameters to warn users
 * about potentially unstable configurations (FR-019).
 */

import type { ChaosMapType, ChaosMapParameters } from '$lib/types';

// Stable parameter ranges for each chaos map type
// Values outside these ranges may produce unstable or undefined behavior
interface ParameterRange {
	min: number;
	max: number;
}

type StableRanges<T> = {
	[K in keyof T]: ParameterRange;
};

const STABLE_RANGES: Record<ChaosMapType, StableRanges<Record<string, number>>> = {
	lorenz: {
		sigma: { min: 0, max: 50 },
		rho: { min: 0, max: 100 },
		beta: { min: 0, max: 10 }
	},
	henon: {
		a: { min: 0, max: 2 },
		b: { min: -1, max: 1 },
		iterations: { min: 1, max: 50000 }
	},
	logistic: {
		r: { min: 0, max: 4 },
		x0: { min: 0, max: 1 },
		iterations: { min: 1, max: 1000 }
	},
	newton: {
		xMin: { min: -10, max: 10 },
		xMax: { min: -10, max: 10 },
		yMin: { min: -10, max: 10 },
		yMax: { min: -10, max: 10 },
		maxIterations: { min: 1, max: 200 }
	},
	standard: {
		K: { min: 0, max: 10 },
		numP: { min: 1, max: 100 },
		numQ: { min: 1, max: 100 },
		iterations: { min: 1, max: 100000 }
	},
	'bifurcation-logistic': {
		rMin: { min: 0, max: 4 },
		rMax: { min: 0, max: 4 },
		maxIterations: { min: 1, max: 5000 }
	},
	'bifurcation-henon': {
		aMin: { min: 0, max: 2 },
		aMax: { min: 0, max: 2 },
		b: { min: -1, max: 1 },
		maxIterations: { min: 1, max: 5000 }
	},
	'chaos-esthetique': {
		a: { min: 0, max: 2 },
		b: { min: 0, max: 2 },
		x0: { min: -50, max: 50 },
		y0: { min: -50, max: 50 },
		iterations: { min: 1, max: 100000 }
	}
};

export interface StabilityCheckResult {
	isStable: boolean;
	warnings: string[];
}

/**
 * Check if chaos map parameters are within stable ranges.
 *
 * @param mapType - The type of chaos map
 * @param params - The parameters to validate
 * @returns An object with stability status and any warnings
 *
 * @example
 * ```typescript
 * const result = checkParameterStability('lorenz', { sigma: 100, rho: 28, beta: 2.667 });
 * // result: { isStable: false, warnings: ['sigma (100) is outside stable range [0, 50]'] }
 * ```
 */
export function checkParameterStability(
	mapType: ChaosMapType,
	params: ChaosMapParameters
): StabilityCheckResult {
	const warnings: string[] = [];
	const ranges = STABLE_RANGES[mapType];

	if (!ranges) {
		return { isStable: true, warnings: [] };
	}

	const paramRecord = params as unknown as Record<string, number>;

	for (const [key, value] of Object.entries(paramRecord)) {
		const range = ranges[key];
		if (range && typeof value === 'number') {
			if (value < range.min || value > range.max) {
				warnings.push(
					`${key} (${value}) is outside stable range [${range.min}, ${range.max}]`
				);
			}
		}
	}

	return {
		isStable: warnings.length === 0,
		warnings
	};
}

/**
 * Get the stable ranges for a specific chaos map type.
 *
 * @param mapType - The type of chaos map
 * @returns The stable ranges for each parameter, or undefined if not found
 */
export function getStableRanges(
	mapType: ChaosMapType
): StableRanges<Record<string, number>> | undefined {
	return STABLE_RANGES[mapType];
}

/**
 * Validate that a map type is one of the supported chaos map types.
 *
 * @param mapType - The map type string to validate
 * @returns True if the map type is valid
 */
export function isValidMapType(mapType: string): mapType is ChaosMapType {
	return mapType in STABLE_RANGES;
}
