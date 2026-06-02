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
	rossler: {
		a: { min: 0.126, max: 0.43295 },
		b: { min: 0.01, max: 2 },
		c: { min: 1, max: 30 }
	},
	henon: {
		a: { min: 0, max: 2 },
		b: { min: -1, max: 1 },
		iterations: { min: 1, max: 50000 }
	},
	lozi: {
		a: { min: 0, max: 2 },
		b: { min: 0, max: 1 },
		x0: { min: -2, max: 2 },
		y0: { min: -2, max: 2 },
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
		k: { min: 0, max: 10 },
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
	},
	lyapunov: {
		rMin: { min: 0, max: 4 },
		rMax: { min: 0, max: 4 },
		iterations: { min: 100, max: 10000 },
		transientIterations: { min: 50, max: 5000 }
	},
	chua: {
		alpha: { min: 8, max: 20 },
		beta: { min: 20, max: 53 },
		gamma: { min: -1, max: 1 },
		a: { min: -2, max: -0.5 },
		b: { min: -1.5, max: -0.3 }
	}
};

/** Kinds for optional, non-range Lorenz fields validated only when present. */
type OptionalFieldKind =
	| { kind: 'number'; min?: number; max?: number }
	| { kind: 'enum'; values: readonly string[] }
	| { kind: 'boolean' };

/**
 * Optional typed fields beyond the core numeric ranges, per map type.
 * Present => validated by kind; absent => fine (backward compatible).
 */
const OPTIONAL_FIELDS: Partial<Record<ChaosMapType, Record<string, OptionalFieldKind>>> = {
	lorenz: {
		x0: { kind: 'number' },
		y0: { kind: 'number' },
		z0: { kind: 'number' },
		epsilon: { kind: 'number', min: 0 },
		showGhost: { kind: 'boolean' },
		solver: { kind: 'enum', values: ['euler', 'rk2', 'rk4'] },
		dt: { kind: 'number', min: 0 },
		stepsPerFrame: { kind: 'number', min: 1 },
		speed: { kind: 'number', min: 0 },
		colorMode: { kind: 'enum', values: ['time', 'speed', 'zheight', 'divergence', 'single'] },
		trailLength: { kind: 'number', min: 1 },
		trailStyle: { kind: 'enum', values: ['comet', 'cumulative'] },
		viewMode: { kind: 'enum', values: ['3d', 'xy', 'xz', 'yz'] },
		autoRotate: { kind: 'boolean' },
		rotationSpeed: { kind: 'number' },
		zoom: { kind: 'number', min: 0 }
	}
};

export interface StabilityCheckResult {
	isStable: boolean;
	warnings: string[];
}

export interface ParameterValidationResult {
	isValid: boolean;
	errors: string[];
	parameters?: Record<string, unknown>;
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

	let paramObj = params as Record<string, unknown>;

	// Backward compatibility: normalize 'K' to 'k' for Standard map
	if (mapType === 'standard' && 'K' in paramObj) {
		const { K, ...rest } = paramObj;
		paramObj = 'k' in rest ? rest : { ...rest, k: K };
	}

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

	const optionalFields = OPTIONAL_FIELDS[mapType] ?? {};

	// Check for extra keys (allow 'type' and any declared optional field).
	const extraKeys = actualKeys.filter(
		(key) => !expectedKeys.includes(key) && key !== 'type' && !(key in optionalFields)
	);
	if (extraKeys.length > 0) {
		errors.push(`Unexpected parameters: ${extraKeys.join(', ')}`);
	}

	// Validate values: range keys + optional-field keys must be numbers;
	// optional enum/boolean fields are validated by their declared kind.
	for (const key of actualKeys) {
		if (key === 'type') continue;
		const value = paramObj[key];
		const spec = optionalFields[key];
		if (spec) {
			if (spec.kind === 'number') {
				if (typeof value !== 'number' || isNaN(value)) {
					errors.push(`Parameter '${key}' must be a valid number, got: ${typeof value}`);
				} else {
					if (spec.min !== undefined && value < spec.min) {
						errors.push(`Parameter '${key}' must be >= ${spec.min}, got: ${value}`);
					}
					if (spec.max !== undefined && value > spec.max) {
						errors.push(`Parameter '${key}' must be <= ${spec.max}, got: ${value}`);
					}
				}
			} else if (spec.kind === 'boolean') {
				if (typeof value !== 'boolean') {
					errors.push(`Parameter '${key}' must be a boolean, got: ${typeof value}`);
				}
			} else if (spec.kind === 'enum') {
				if (typeof value !== 'string' || !spec.values.includes(value)) {
					errors.push(
						`Parameter '${key}' must be one of [${spec.values.join(', ')}], got: ${String(value)}`
					);
				}
			}
			continue;
		}
		// Core range field (or unexpected, already reported): must be a number.
		if (typeof value !== 'number' || isNaN(value)) {
			errors.push(`Parameter '${key}' must be a valid number, got: ${typeof value}`);
		}
	}

	return { isValid: errors.length === 0, errors, parameters: paramObj };
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

	const normalizedParams = (validation.parameters ?? params) as Record<string, unknown>;
	const paramRecord = normalizedParams as Record<string, number>;

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
		case 'lorenz': {
			const dt = paramRecord.dt;
			const solver = (normalizedParams as Record<string, unknown>).solver;
			if (typeof dt === 'number') {
				if (dt <= 0 || dt > 0.02) {
					warnings.push(`dt (${dt}) is outside the recommended range (0, 0.02]`);
				}
				if (solver === 'euler' && dt > 0.01) {
					warnings.push(
						`Euler integration with dt=${dt} is prone to numerical blow-up; reduce dt or use RK4`
					);
				}
			}
			const epsilon = paramRecord.epsilon;
			if (typeof epsilon === 'number' && epsilon <= 0) {
				warnings.push(`epsilon (${epsilon}) must be positive for the perturbed orbit`);
			}
			break;
		}
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
		case 'lyapunov':
			if (paramRecord.rMin >= paramRecord.rMax) {
				warnings.push('rMin must be less than rMax');
			}
			if (paramRecord.transientIterations > paramRecord.iterations) {
				warnings.push('transientIterations must be <= iterations');
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
