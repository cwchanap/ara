/**
 * Chaos Map Parameter Validation
 *
 * Provides validation utilities for chaos map parameters to warn users
 * about potentially unstable configurations (FR-019).
 */

import {
	CLIFFORD_COLOR_MODES,
	TINKERBELL_COLOR_MODES,
	type ChaosMapType,
	type ChaosMapParameters
} from '$lib/types';

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
	ikeda: {
		u: { min: 0, max: 1 },
		x0: { min: -2, max: 2 },
		y0: { min: -2, max: 2 },
		iterations: { min: 1, max: 50000 },
		burnIn: { min: 0, max: 10000 }
	},
	clifford: {
		a: { min: -3, max: 3 },
		b: { min: -3, max: 3 },
		c: { min: -3, max: 3 },
		d: { min: -3, max: 3 },
		iterations: { min: 1, max: 250000 }
	},
	tinkerbell: {
		a: { min: -3, max: 3 },
		b: { min: -3, max: 3 },
		c: { min: -3, max: 3 },
		d: { min: -3, max: 3 },
		iterations: { min: 1, max: 250000 }
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
	'gumowski-mira': {
		mu: { min: -1, max: 1 },
		a: { min: 0, max: 1 },
		b: { min: 0, max: 0.5 },
		x0: { min: -20, max: 20 },
		y0: { min: -20, max: 20 },
		iterations: { min: 1, max: 250000 },
		burnIn: { min: 0, max: 10000 }
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
	},
	'double-pendulum': {
		theta1: { min: -2 * Math.PI, max: 2 * Math.PI },
		theta2: { min: -2 * Math.PI, max: 2 * Math.PI },
		omega1: { min: -50, max: 50 },
		omega2: { min: -50, max: 50 },
		l1: { min: 0.1, max: 5 },
		l2: { min: 0.1, max: 5 },
		m1: { min: 0.1, max: 10 },
		m2: { min: 0.1, max: 10 },
		gravity: { min: 0, max: 50 },
		damping: { min: 0, max: 2 }
	}
};

/** Kinds for optional fields validated only when present (e.g. Lorenz, Ikeda render fields). */
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
		trailLength: { kind: 'number', min: 1, max: 100000 },
		trailStyle: { kind: 'enum', values: ['comet', 'cumulative', 'stationary'] },
		viewMode: { kind: 'enum', values: ['3d', 'xy', 'xz', 'yz'] },
		autoRotate: { kind: 'boolean' },
		rotationSpeed: { kind: 'number' },
		zoom: { kind: 'number', min: 0.5 }
	},
	ikeda: {
		renderMode: { kind: 'enum', values: ['single', 'multi'] },
		seeds: { kind: 'number', min: 1, max: 5000 },
		colorMode: { kind: 'enum', values: ['single', 'iteration', 'seed', 'radius'] },
		pointSize: { kind: 'number', min: 0.5, max: 6 },
		opacity: { kind: 'number', min: 0, max: 1 }
	},
	clifford: {
		colorMode: { kind: 'enum', values: [...CLIFFORD_COLOR_MODES] },
		zoom: { kind: 'number', min: 0.5, max: 5 },
		pointSize: { kind: 'number', min: 0.5, max: 6 },
		opacity: { kind: 'number', min: 0, max: 1 }
	},
	tinkerbell: {
		colorMode: { kind: 'enum', values: [...TINKERBELL_COLOR_MODES] },
		zoom: { kind: 'number', min: 0.5, max: 5 },
		pointSize: { kind: 'number', min: 0.5, max: 6 },
		opacity: { kind: 'number', min: 0, max: 1 }
	},
	'gumowski-mira': {
		renderMode: { kind: 'enum', values: ['single', 'multi'] },
		seeds: { kind: 'number', min: 1, max: 5000 },
		colorMode: { kind: 'enum', values: ['single', 'iteration', 'seed', 'radius'] },
		pointSize: { kind: 'number', min: 0.5, max: 6 },
		opacity: { kind: 'number', min: 0, max: 1 }
	},
	'double-pendulum': {
		speed: { kind: 'number', min: 0, max: 10 },
		showTrail: { kind: 'boolean' },
		trailLength: { kind: 'number', min: 1, max: 5000 },
		compareMode: { kind: 'boolean' },
		compareOffset: { kind: 'number', min: -1, max: 1 }
	}
};

export interface StabilityCheckResult {
	isStable: boolean;
	warnings: string[];
}

export interface ParameterValidationResult {
	isValid: boolean;
	errors: string[];
	/** Normalized parameters with optional numeric fields clamped to declared ranges. */
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

	let paramObj = { ...(params as Record<string, unknown>) };

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
	// Use Object.hasOwn to avoid matching inherited Object.prototype keys
	// (e.g. 'constructor', 'toString') that would bypass validation.
	const extraKeys = actualKeys.filter(
		(key) =>
			!expectedKeys.includes(key) && key !== 'type' && !Object.hasOwn(optionalFields, key)
	);
	if (extraKeys.length > 0) {
		errors.push(`Unexpected parameters: ${extraKeys.join(', ')}`);
	}

	// Validate values: range keys + optional-field keys must be numbers;
	// optional enum/boolean fields are validated by their declared kind.
	// Optional numeric fields are clamped to declared ranges instead of rejected,
	// so that a single out-of-range styling param doesn't discard the entire config.
	for (const key of actualKeys) {
		if (key === 'type') continue;
		const value = paramObj[key];
		const spec = Object.hasOwn(optionalFields, key) ? optionalFields[key] : undefined;
		if (spec) {
			if (spec.kind === 'number') {
				if (typeof value !== 'number' || !Number.isFinite(value)) {
					errors.push(`Parameter '${key}' must be a valid number, got: ${typeof value}`);
				} else {
					let clamped = value;
					if (spec.min !== undefined && clamped < spec.min) {
						clamped = spec.min;
						paramObj[key] = clamped;
					}
					if (spec.max !== undefined && clamped > spec.max) {
						clamped = spec.max;
						paramObj[key] = clamped;
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
		if (typeof value !== 'number' || !Number.isFinite(value)) {
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

	/* c8 ignore next 3 -- validateParameters already rejects unknown map types */
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
		case 'ikeda':
		case 'gumowski-mira':
			if (paramRecord.burnIn >= paramRecord.iterations) {
				warnings.push(
					'burnIn must be less than iterations or the visualization will be empty'
				);
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
		case 'double-pendulum':
			if (paramRecord.gravity === 0) {
				warnings.push('gravity is 0; the pendulum will not swing');
			}
			// damping is a linear viscous term (-damping*omega). For typical
			// lengths (l1+l2 ≈ 2, g ≈ 9.81) critical damping is ~2*sqrt(g/L) ≈ 4.4,
			// so the slider's max of 2 is still *under*damped — but above ~1 the
			// motion decays within a few swings, which looks like the sim "stopped".
			if (paramRecord.damping > 1) {
				warnings.push(
					'damping is high; the pendulum will settle to rest within a few swings'
				);
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
