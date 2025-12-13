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

export interface ParameterValidationResult {
	isValid: boolean;
	errors: string[];
}

/**
 * Validate that parameters match the expected structure for a given map type.
 *
 * @param mapType - The type of chaos map
 * @param params - The parameters to validate
 * @returns Validation result with any errors
 */
export function validateParameters(
	mapType: ChaosMapType,
	params: unknown
): ParameterValidationResult {
	const errors: string[] = [];

	// Check if params is an object
	if (!params || typeof params !== 'object') {
		errors.push('Parameters must be an object');
		return { isValid: false, errors };
	}

	const paramObj = params as Record<string, unknown>;
	const ranges = STABLE_RANGES[mapType];

	if (!ranges) {
		errors.push(`Unknown map type: ${mapType}`);
		return { isValid: false, errors };
	}

	const expectedKeys = Object.keys(ranges);
	const actualKeys = Object.keys(paramObj);

	// Check for missing keys
	const missingKeys = expectedKeys.filter((key) => !actualKeys.includes(key));
	if (missingKeys.length > 0) {
		errors.push(`Missing required parameters: ${missingKeys.join(', ')}`);
	}

	// Check for extra keys (but allow 'type' field as it's used for discriminated unions)
	const extraKeys = actualKeys.filter((key) => !expectedKeys.includes(key) && key !== 'type');
	if (extraKeys.length > 0) {
		errors.push(`Unexpected parameters: ${extraKeys.join(', ')}`);
	}

	// Check that all values are numbers (except 'type' field which is a string)
	for (const key of actualKeys) {
		if (key === 'type') continue; // Skip type field as it's a string discriminator
		const value = paramObj[key];
		if (typeof value !== 'number' || isNaN(value)) {
			errors.push(`Parameter '${key}' must be a valid number, got: ${typeof value}`);
		}
	}

	return { isValid: errors.length === 0, errors };
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

	// First, validate parameter structure
	const validation = validateParameters(mapType, params);
	if (!validation.isValid) {
		warnings.push(...validation.errors);
		return { isStable: false, warnings };
	}

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

	// Check min/max parameter relationships
	switch (mapType) {
		case 'newton':
			if (paramRecord.xMin >= paramRecord.xMax) {
				warnings.push('xMin must be less than xMax');
			}
			if (paramRecord.yMin >= paramRecord.yMax) {
				warnings.push('yMin must be less than yMax');
			}
			break;
		case 'bifurcation-logistic':
			if (paramRecord.rMin >= paramRecord.rMax) {
				warnings.push('rMin must be less than rMax');
			}
			break;
		case 'bifurcation-henon':
			if (paramRecord.aMin >= paramRecord.aMax) {
				warnings.push('aMin must be less than aMax');
			}
			break;
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
