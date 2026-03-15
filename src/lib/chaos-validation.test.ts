import { describe, expect, test } from 'bun:test';
import {
	validateParameters,
	checkParameterStability,
	isValidMapType,
	getStableRanges
} from './chaos-validation';
import type { StandardParameters, ChaosMapType } from './types';
import { VALID_MAP_TYPES } from './types';

describe('validateParameters for rossler', () => {
	test('returns valid for correct rossler parameters', () => {
		const params = { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 };
		const result = validateParameters('rossler', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing parameters', () => {
		const params = { type: 'rossler', a: 0.2, b: 0.2 }; // missing c
		const result = validateParameters('rossler', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('c'))).toBe(true);
	});

	test('returns invalid for non-numeric parameters', () => {
		const params = { type: 'rossler', a: 'not a number', b: 0.2, c: 5.7 };
		const result = validateParameters('rossler', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('a'))).toBe(true);
	});

	test('returns invalid for NaN parameters', () => {
		const params = { type: 'rossler', a: NaN, b: 0.2, c: 5.7 };
		const result = validateParameters('rossler', params);
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const params = { type: 'rossler', a: 0.2, b: 0.2, c: 5.7, extra: 123 };
		const result = validateParameters('rossler', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('extra'))).toBe(true);
	});
});

describe('checkParameterStability for rossler', () => {
	test('returns stable for classic parameters', () => {
		const params = { type: 'rossler' as const, a: 0.2, b: 0.2, c: 5.7 };
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test('returns warnings for a below stable range (a < 0.126)', () => {
		const params = { type: 'rossler' as const, a: 0.05, b: 0.2, c: 5.7 }; // a < 0.126
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('a'))).toBe(true);
	});

	test('returns warnings for a above stable range (a > 0.43295)', () => {
		const params = { type: 'rossler' as const, a: 0.5, b: 0.2, c: 5.7 }; // a > 0.43295
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('a'))).toBe(true);
	});

	test('returns warnings for b below stable range (b < 0.01)', () => {
		const params = { type: 'rossler' as const, a: 0.2, b: 0.005, c: 5.7 }; // b < 0.01
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('b'))).toBe(true);
	});

	test('returns warnings for b above stable range (b > 2)', () => {
		const params = { type: 'rossler' as const, a: 0.2, b: 2.5, c: 5.7 }; // b > 2
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('b'))).toBe(true);
	});

	test('returns warnings for c below stable range (c < 1)', () => {
		const params = { type: 'rossler' as const, a: 0.2, b: 0.2, c: 0.5 }; // c < 1
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('c'))).toBe(true);
	});

	test('returns warnings for c above stable range (c > 30)', () => {
		const params = { type: 'rossler' as const, a: 0.2, b: 0.2, c: 35 }; // c > 30
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('c'))).toBe(true);
	});

	test('returns stable for boundary values', () => {
		const params = { type: 'rossler' as const, a: 0.126, b: 0.01, c: 1 };
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(true);
	});

	test('returns stable for max boundary values', () => {
		const params = { type: 'rossler' as const, a: 0.43295, b: 2, c: 30 };
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(true);
	});
});

describe('isValidMapType for rossler', () => {
	test('returns true for rossler', () => {
		expect(isValidMapType('rossler')).toBe(true);
	});
});

describe('getStableRanges for rossler', () => {
	test('returns correct ranges for rossler', () => {
		const ranges = getStableRanges('rossler');
		expect(ranges).toBeDefined();
		expect(ranges?.a).toEqual({ min: 0.126, max: 0.43295 });
		expect(ranges?.b).toEqual({ min: 0.01, max: 2 });
		expect(ranges?.c).toEqual({ min: 1, max: 30 });
	});
});

describe('validateParameters for lyapunov', () => {
	test('returns valid for correct lyapunov parameters', () => {
		const params = {
			type: 'lyapunov',
			rMin: 0,
			rMax: 3.5,
			iterations: 500,
			transientIterations: 200
		};
		const result = validateParameters('lyapunov', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing parameters', () => {
		const params = { type: 'lyapunov', rMin: 2.5, rMax: 3.5, iterations: 500 }; // missing transientIterations
		const result = validateParameters('lyapunov', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('transientIterations'))).toBe(true);
	});

	test('returns invalid for non-numeric parameters', () => {
		const params = {
			type: 'lyapunov',
			rMin: 'not a number',
			rMax: 3.5,
			iterations: 500,
			transientIterations: 200
		};
		const result = validateParameters('lyapunov', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('rMin'))).toBe(true);
	});

	test('returns invalid for NaN parameters', () => {
		const params = {
			type: 'lyapunov',
			rMin: NaN,
			rMax: 3.5,
			iterations: 500,
			transientIterations: 200
		};
		const result = validateParameters('lyapunov', params);
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const params = {
			type: 'lyapunov',
			rMin: 2.5,
			rMax: 3.5,
			iterations: 500,
			transientIterations: 200,
			extra: 123
		};
		const result = validateParameters('lyapunov', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('extra'))).toBe(true);
	});
});

describe('checkParameterStability for lyapunov', () => {
	test('returns stable for in-range parameters', () => {
		const params = {
			type: 'lyapunov' as const,
			rMin: 2.5,
			rMax: 3.5,
			iterations: 500,
			transientIterations: 200
		};
		const result = checkParameterStability('lyapunov', params);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test('returns warnings when rMin is below stable range', () => {
		const params = {
			type: 'lyapunov' as const,
			rMin: -0.5,
			rMax: 3.5,
			iterations: 500,
			transientIterations: 200
		};
		const result = checkParameterStability('lyapunov', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('rMin'))).toBe(true);
	});

	test('returns warnings when rMax is above stable range', () => {
		const params = {
			type: 'lyapunov' as const,
			rMin: 3.0,
			rMax: 4.5,
			iterations: 500,
			transientIterations: 200
		};
		const result = checkParameterStability('lyapunov', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('rMax'))).toBe(true);
	});

	test('returns warnings when iterations is outside stable range', () => {
		const params = {
			type: 'lyapunov' as const,
			rMin: 3.0,
			rMax: 3.5,
			iterations: 50, // below min 100
			transientIterations: 200
		};
		const result = checkParameterStability('lyapunov', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('iterations'))).toBe(true);
	});

	test('returns warnings when transientIterations is outside stable range', () => {
		const params = {
			type: 'lyapunov' as const,
			rMin: 3.0,
			rMax: 3.5,
			iterations: 500,
			transientIterations: 6000 // above max 5000
		};
		const result = checkParameterStability('lyapunov', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('transientIterations'))).toBe(true);
	});

	test('returns warnings when rMin is not less than rMax', () => {
		const params = {
			type: 'lyapunov' as const,
			rMin: 3.5,
			rMax: 3.0,
			iterations: 500,
			transientIterations: 200
		};
		const result = checkParameterStability('lyapunov', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('rMin must be less than rMax'))).toBe(true);
	});

	test('returns warnings when transientIterations exceeds iterations', () => {
		const params = {
			type: 'lyapunov' as const,
			rMin: 3.0,
			rMax: 3.5,
			iterations: 300,
			transientIterations: 400
		};
		const result = checkParameterStability('lyapunov', params);
		expect(result.isStable).toBe(false);
		expect(
			result.warnings.some((w) => w.includes('transientIterations must be <= iterations'))
		).toBe(true);
	});

	test('returns stable for boundary values', () => {
		const params = {
			type: 'lyapunov' as const,
			rMin: 0,
			rMax: 4.0,
			iterations: 100,
			transientIterations: 50
		};
		const result = checkParameterStability('lyapunov', params);
		expect(result.isStable).toBe(true);
	});
});

describe('isValidMapType for lyapunov', () => {
	test('returns true for lyapunov', () => {
		expect(isValidMapType('lyapunov')).toBe(true);
	});
});

describe('getStableRanges for lyapunov', () => {
	test('returns correct ranges for lyapunov', () => {
		const ranges = getStableRanges('lyapunov');
		expect(ranges).toBeDefined();
		expect(ranges?.rMin).toEqual({ min: 0, max: 4 });
		expect(ranges?.rMax).toEqual({ min: 0, max: 4 });
		expect(ranges?.iterations).toEqual({ min: 100, max: 10000 });
		expect(ranges?.transientIterations).toEqual({ min: 50, max: 5000 });
	});
});

describe('validateParameters for lozi', () => {
	test('returns valid for correct lozi parameters', () => {
		const params = { type: 'lozi', a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 2000 };
		const result = validateParameters('lozi', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing parameters', () => {
		const params = { type: 'lozi', a: 1.7, b: 0.5, x0: 0, y0: 0 }; // missing iterations
		const result = validateParameters('lozi', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('iterations'))).toBe(true);
	});

	test('returns invalid for non-numeric parameters', () => {
		const params = { type: 'lozi', a: 'not a number', b: 0.5, x0: 0, y0: 0, iterations: 2000 };
		const result = validateParameters('lozi', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('a'))).toBe(true);
	});

	test('returns invalid for NaN parameters', () => {
		const params = { type: 'lozi', a: NaN, b: 0.5, x0: 0, y0: 0, iterations: 2000 };
		const result = validateParameters('lozi', params);
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const params = { type: 'lozi', a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 2000, extra: 123 };
		const result = validateParameters('lozi', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('extra'))).toBe(true);
	});
});

describe('checkParameterStability for lozi', () => {
	test('returns stable for in-range parameters', () => {
		const params = { type: 'lozi' as const, a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 2000 };
		const result = checkParameterStability('lozi', params);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test('returns warnings for a below stable range (a < 0)', () => {
		const params = { type: 'lozi' as const, a: -0.5, b: 0.5, x0: 0, y0: 0, iterations: 2000 };
		const result = checkParameterStability('lozi', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('a'))).toBe(true);
	});

	test('returns warnings for a above stable range (a > 2)', () => {
		const params = { type: 'lozi' as const, a: 2.5, b: 0.5, x0: 0, y0: 0, iterations: 2000 };
		const result = checkParameterStability('lozi', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('a'))).toBe(true);
	});

	test('returns warnings for b below stable range (b < 0)', () => {
		const params = { type: 'lozi' as const, a: 1.7, b: -0.5, x0: 0, y0: 0, iterations: 2000 };
		const result = checkParameterStability('lozi', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('b'))).toBe(true);
	});

	test('returns warnings for b above stable range (b > 1)', () => {
		const params = { type: 'lozi' as const, a: 1.7, b: 1.5, x0: 0, y0: 0, iterations: 2000 };
		const result = checkParameterStability('lozi', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('b'))).toBe(true);
	});

	test('returns warnings for x0 outside stable range', () => {
		const params = { type: 'lozi' as const, a: 1.7, b: 0.5, x0: 5, y0: 0, iterations: 2000 };
		const result = checkParameterStability('lozi', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('x0'))).toBe(true);
	});

	test('returns warnings for y0 outside stable range', () => {
		const params = { type: 'lozi' as const, a: 1.7, b: 0.5, x0: 0, y0: -5, iterations: 2000 };
		const result = checkParameterStability('lozi', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('y0'))).toBe(true);
	});

	test('returns warnings for iterations outside stable range', () => {
		const params = { type: 'lozi' as const, a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 100000 };
		const result = checkParameterStability('lozi', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('iterations'))).toBe(true);
	});

	test('returns stable for boundary values (min)', () => {
		const params = { type: 'lozi' as const, a: 0, b: 0, x0: -2, y0: -2, iterations: 1 };
		const result = checkParameterStability('lozi', params);
		expect(result.isStable).toBe(true);
	});

	test('returns stable for boundary values (max)', () => {
		const params = { type: 'lozi' as const, a: 2, b: 1, x0: 2, y0: 2, iterations: 50000 };
		const result = checkParameterStability('lozi', params);
		expect(result.isStable).toBe(true);
	});
});

describe('checkParameterStability for newton', () => {
	test('returns warnings when xMin is not less than xMax', () => {
		const params = {
			type: 'newton' as const,
			xMin: 2,
			xMax: 2,
			yMin: -2,
			yMax: 2,
			maxIterations: 50
		};
		const result = checkParameterStability('newton', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('xMin must be less than xMax'))).toBe(true);
	});
});

describe('checkParameterStability for standard', () => {
	test("accepts legacy 'K' parameter for backward compatibility", () => {
		const params = {
			type: 'standard',
			K: 2,
			numP: 10,
			numQ: 10,
			iterations: 20000
		};
		const result = validateParameters('standard', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("returns warnings when legacy 'K' is outside stable range", () => {
		const params = {
			type: 'standard',
			K: 20,
			numP: 10,
			numQ: 10,
			iterations: 20000
		};
		const result = checkParameterStability('standard', params as unknown as StandardParameters);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('k (20)'))).toBe(true);
	});

	test('returns warnings when k is outside stable range', () => {
		const params = {
			type: 'standard' as const,
			k: 20,
			numP: 10,
			numQ: 10,
			iterations: 20000
		};
		const result = checkParameterStability('standard', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('k'))).toBe(true);
	});
});

describe('validateParameters backward compatibility', () => {
	test('normalizes uppercase K to lowercase k for standard map', () => {
		const params = {
			type: 'standard',
			K: 0.971635,
			numP: 10,
			numQ: 10,
			iterations: 20000
		};
		const result = validateParameters('standard', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.parameters).toBeDefined();
		expect(result.parameters?.k).toBe(0.971635);
		expect('K' in (result.parameters ?? {})).toBe(false);
	});

	test('does not normalize k to K for standard map when k is already present', () => {
		const params = {
			type: 'standard',
			k: 0.971635,
			numP: 10,
			numQ: 10,
			iterations: 20000
		};
		const result = validateParameters('standard', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.parameters?.k).toBe(0.971635);
		expect('K' in (result.parameters ?? {})).toBe(false);
	});

	test('returns normalized parameters for valid inputs', () => {
		const params = {
			type: 'standard',
			k: 0.971635,
			numP: 10,
			numQ: 10,
			iterations: 20000
		};
		const result = validateParameters('standard', params);
		expect(result.isValid).toBe(true);
		expect(result.parameters).toBeDefined();
		expect(result.parameters).toEqual(params);
	});

	test('normalizes K to k for standard map when both K and k are present, removing K', () => {
		const params = {
			type: 'standard',
			K: 5,
			k: 0.971635,
			numP: 10,
			numQ: 10,
			iterations: 20000
		};
		const result = validateParameters('standard', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		// Existing k should be preserved, K should be removed
		expect(result.parameters?.k).toBe(0.971635);
		expect('K' in (result.parameters ?? {})).toBe(false);
	});

	test('rejects K parameter for non-standard maps (lorenz)', () => {
		const params = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667,
			K: 5
		};
		const result = validateParameters('lorenz', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('K'))).toBe(true);
	});

	test('rejects K parameter for non-standard maps (rossler)', () => {
		const params = {
			type: 'rossler',
			a: 0.2,
			b: 0.2,
			c: 5.7,
			K: 5
		};
		const result = validateParameters('rossler', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('K'))).toBe(true);
	});

	test('rejects K parameter for non-standard maps (henon)', () => {
		const params = {
			type: 'henon',
			a: 1.4,
			b: 0.3,
			iterations: 10000,
			K: 5
		};
		const result = validateParameters('henon', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('K'))).toBe(true);
	});
});

describe('checkParameterStability for chaos-esthetique', () => {
	test('returns warnings when values are outside stable range', () => {
		const params = {
			type: 'chaos-esthetique' as const,
			a: 3,
			b: -1,
			x0: 100,
			y0: -100,
			iterations: 10000
		};
		const result = checkParameterStability('chaos-esthetique', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.length).toBeGreaterThan(0);
	});
});

describe('isValidMapType for lozi', () => {
	test('returns true for lozi', () => {
		expect(isValidMapType('lozi')).toBe(true);
	});
});

describe('getStableRanges for lozi', () => {
	test('returns correct ranges for lozi', () => {
		const ranges = getStableRanges('lozi');
		expect(ranges).toBeDefined();
		expect(ranges?.a).toEqual({ min: 0, max: 2 });
		expect(ranges?.b).toEqual({ min: 0, max: 1 });
		expect(ranges?.x0).toEqual({ min: -2, max: 2 });
		expect(ranges?.y0).toEqual({ min: -2, max: 2 });
		expect(ranges?.iterations).toEqual({ min: 1, max: 50000 });
	});
});

describe('validateParameters for lorenz', () => {
	test('returns valid for correct lorenz parameters', () => {
		const params = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
		const result = validateParameters('lorenz', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing parameters', () => {
		const params = { type: 'lorenz', sigma: 10, rho: 28 }; // missing beta
		const result = validateParameters('lorenz', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('beta'))).toBe(true);
	});

	test('returns invalid for non-numeric parameters', () => {
		const params = { type: 'lorenz', sigma: 'not a number', rho: 28, beta: 2.667 };
		const result = validateParameters('lorenz', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('sigma'))).toBe(true);
	});

	test('returns invalid for NaN parameters', () => {
		const params = { type: 'lorenz', sigma: NaN, rho: 28, beta: 2.667 };
		const result = validateParameters('lorenz', params);
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const params = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667, extra: 123 };
		const result = validateParameters('lorenz', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('extra'))).toBe(true);
	});

	test('returns invalid for null parameters', () => {
		const result = validateParameters('lorenz', null);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('object'))).toBe(true);
	});

	test('returns invalid for unknown map type', () => {
		const params = { type: 'unknown', sigma: 10, rho: 28, beta: 2.667 };
		const result = validateParameters('unknown' as unknown as ChaosMapType, params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('Unknown map type'))).toBe(true);
	});
});

describe('checkParameterStability for lorenz', () => {
	test('returns stable for classic parameters', () => {
		const params = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
		const result = checkParameterStability('lorenz', params);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test('returns warnings for sigma below stable range (sigma < 0)', () => {
		const params = { type: 'lorenz' as const, sigma: -1, rho: 28, beta: 2.667 };
		const result = checkParameterStability('lorenz', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('sigma'))).toBe(true);
	});

	test('returns warnings for sigma above stable range (sigma > 50)', () => {
		const params = { type: 'lorenz' as const, sigma: 100, rho: 28, beta: 2.667 };
		const result = checkParameterStability('lorenz', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('sigma'))).toBe(true);
	});

	test('returns warnings for rho above stable range (rho > 100)', () => {
		const params = { type: 'lorenz' as const, sigma: 10, rho: 150, beta: 2.667 };
		const result = checkParameterStability('lorenz', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('rho'))).toBe(true);
	});

	test('returns warnings for beta above stable range (beta > 10)', () => {
		const params = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 15 };
		const result = checkParameterStability('lorenz', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('beta'))).toBe(true);
	});

	test('returns stable for minimum boundary values', () => {
		const params = { type: 'lorenz' as const, sigma: 0, rho: 0, beta: 0 };
		const result = checkParameterStability('lorenz', params);
		expect(result.isStable).toBe(true);
	});

	test('returns stable for maximum boundary values', () => {
		const params = { type: 'lorenz' as const, sigma: 50, rho: 100, beta: 10 };
		const result = checkParameterStability('lorenz', params);
		expect(result.isStable).toBe(true);
	});
});

describe('getStableRanges for lorenz', () => {
	test('returns correct ranges for lorenz', () => {
		const ranges = getStableRanges('lorenz');
		expect(ranges).toBeDefined();
		expect(ranges?.sigma).toEqual({ min: 0, max: 50 });
		expect(ranges?.rho).toEqual({ min: 0, max: 100 });
		expect(ranges?.beta).toEqual({ min: 0, max: 10 });
	});
});

describe('validateParameters for henon', () => {
	test('returns valid for correct henon parameters', () => {
		const params = { type: 'henon', a: 1.4, b: 0.3, iterations: 10000 };
		const result = validateParameters('henon', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing iterations', () => {
		const params = { type: 'henon', a: 1.4, b: 0.3 };
		const result = validateParameters('henon', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('iterations'))).toBe(true);
	});

	test('returns invalid for non-numeric a', () => {
		const params = { type: 'henon', a: 'not a number', b: 0.3, iterations: 2000 };
		const result = validateParameters('henon', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes("Parameter 'a'"))).toBe(true);
	});

	test('returns invalid for NaN b', () => {
		const params = { type: 'henon', a: 1.4, b: NaN, iterations: 2000 };
		const result = validateParameters('henon', params);
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const params = { type: 'henon', a: 1.4, b: 0.3, iterations: 2000, extra: 0 };
		const result = validateParameters('henon', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('extra'))).toBe(true);
	});
});

describe('checkParameterStability for henon', () => {
	test('returns stable for classic parameters', () => {
		const params = { type: 'henon' as const, a: 1.4, b: 0.3, iterations: 10000 };
		const result = checkParameterStability('henon', params);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test('returns warnings for a below stable range (a < 0)', () => {
		const params = { type: 'henon' as const, a: -0.5, b: 0.3, iterations: 2000 };
		const result = checkParameterStability('henon', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /\ba\b/.test(w))).toBe(true);
	});

	test('returns warnings for a above stable range (a > 2)', () => {
		const params = { type: 'henon' as const, a: 2.5, b: 0.3, iterations: 2000 };
		const result = checkParameterStability('henon', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /\ba\b/.test(w))).toBe(true);
	});

	test('returns warnings for b below stable range (b < -1)', () => {
		const params = { type: 'henon' as const, a: 1.4, b: -1.5, iterations: 2000 };
		const result = checkParameterStability('henon', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /\bb\b/.test(w))).toBe(true);
	});

	test('returns warnings for b above stable range (b > 1)', () => {
		const params = { type: 'henon' as const, a: 1.4, b: 1.5, iterations: 2000 };
		const result = checkParameterStability('henon', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /\bb\b/.test(w))).toBe(true);
	});

	test('returns warnings for iterations above stable range', () => {
		const params = { type: 'henon' as const, a: 1.4, b: 0.3, iterations: 100000 };
		const result = checkParameterStability('henon', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('iterations'))).toBe(true);
	});

	test('returns stable for boundary values (min)', () => {
		const params = { type: 'henon' as const, a: 0, b: -1, iterations: 1 };
		const result = checkParameterStability('henon', params);
		expect(result.isStable).toBe(true);
	});

	test('returns stable for boundary values (max)', () => {
		const params = { type: 'henon' as const, a: 2, b: 1, iterations: 50000 };
		const result = checkParameterStability('henon', params);
		expect(result.isStable).toBe(true);
	});
});

describe('getStableRanges for henon', () => {
	test('returns correct ranges for henon', () => {
		const ranges = getStableRanges('henon');
		expect(ranges).toBeDefined();
		expect(ranges?.a).toEqual({ min: 0, max: 2 });
		expect(ranges?.b).toEqual({ min: -1, max: 1 });
		expect(ranges?.iterations).toEqual({ min: 1, max: 50000 });
	});
});

describe('validateParameters for logistic', () => {
	test('returns valid for correct logistic parameters', () => {
		const params = { type: 'logistic', r: 3.9, x0: 0.1, iterations: 100 };
		const result = validateParameters('logistic', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing x0', () => {
		const params = { type: 'logistic', r: 3.9, iterations: 100 };
		const result = validateParameters('logistic', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('x0'))).toBe(true);
	});

	test('returns invalid for non-numeric r', () => {
		const params = { type: 'logistic', r: 'not a number', x0: 0.1, iterations: 100 };
		const result = validateParameters('logistic', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes("Parameter 'r'"))).toBe(true);
	});

	test('returns invalid for NaN iterations', () => {
		const params = { type: 'logistic', r: 3.9, x0: 0.1, iterations: NaN };
		const result = validateParameters('logistic', params);
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const params = { type: 'logistic', r: 3.9, x0: 0.1, iterations: 100, extra: 0 };
		const result = validateParameters('logistic', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('extra'))).toBe(true);
	});
});

describe('checkParameterStability for logistic', () => {
	test('returns stable for classic parameters', () => {
		const params = { type: 'logistic' as const, r: 3.9, x0: 0.1, iterations: 100 };
		const result = checkParameterStability('logistic', params);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test('returns warnings for r below stable range (r < 0)', () => {
		const params = { type: 'logistic' as const, r: -0.5, x0: 0.1, iterations: 100 };
		const result = checkParameterStability('logistic', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /\br\b/.test(w))).toBe(true);
	});

	test('returns warnings for r above stable range (r > 4)', () => {
		const params = { type: 'logistic' as const, r: 4.5, x0: 0.1, iterations: 100 };
		const result = checkParameterStability('logistic', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /\br\b/.test(w))).toBe(true);
	});

	test('returns warnings for x0 below stable range (x0 < 0)', () => {
		const params = { type: 'logistic' as const, r: 3.9, x0: -0.5, iterations: 100 };
		const result = checkParameterStability('logistic', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('x0'))).toBe(true);
	});

	test('returns warnings for x0 above stable range (x0 > 1)', () => {
		const params = { type: 'logistic' as const, r: 3.9, x0: 1.5, iterations: 100 };
		const result = checkParameterStability('logistic', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('x0'))).toBe(true);
	});

	test('returns warnings for iterations above stable range', () => {
		const params = { type: 'logistic' as const, r: 3.9, x0: 0.1, iterations: 5000 };
		const result = checkParameterStability('logistic', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('iterations'))).toBe(true);
	});

	test('returns stable for boundary values (min)', () => {
		const params = { type: 'logistic' as const, r: 0, x0: 0, iterations: 1 };
		const result = checkParameterStability('logistic', params);
		expect(result.isStable).toBe(true);
	});

	test('returns stable for boundary values (max)', () => {
		const params = { type: 'logistic' as const, r: 4, x0: 1, iterations: 1000 };
		const result = checkParameterStability('logistic', params);
		expect(result.isStable).toBe(true);
	});
});

describe('getStableRanges for logistic', () => {
	test('returns correct ranges for logistic', () => {
		const ranges = getStableRanges('logistic');
		expect(ranges).toBeDefined();
		expect(ranges?.r).toEqual({ min: 0, max: 4 });
		expect(ranges?.x0).toEqual({ min: 0, max: 1 });
		expect(ranges?.iterations).toEqual({ min: 1, max: 1000 });
	});
});

describe('validateParameters for bifurcation-logistic', () => {
	test('returns valid for correct bifurcation-logistic parameters', () => {
		const params = { type: 'bifurcation-logistic', rMin: 2.5, rMax: 4.0, maxIterations: 1000 };
		const result = validateParameters('bifurcation-logistic', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing rMax', () => {
		const params = { type: 'bifurcation-logistic', rMin: 2.5, maxIterations: 1000 };
		const result = validateParameters('bifurcation-logistic', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('rMax'))).toBe(true);
	});

	test('returns invalid for non-numeric rMin', () => {
		const params = {
			type: 'bifurcation-logistic',
			rMin: 'not a number',
			rMax: 4.0,
			maxIterations: 1000
		};
		const result = validateParameters('bifurcation-logistic', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('rMin'))).toBe(true);
	});

	test('returns invalid for NaN maxIterations', () => {
		const params = { type: 'bifurcation-logistic', rMin: 2.5, rMax: 4.0, maxIterations: NaN };
		const result = validateParameters('bifurcation-logistic', params);
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const params = {
			type: 'bifurcation-logistic',
			rMin: 2.5,
			rMax: 4.0,
			maxIterations: 1000,
			extra: 0
		};
		const result = validateParameters('bifurcation-logistic', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('extra'))).toBe(true);
	});
});

describe('checkParameterStability for bifurcation-logistic', () => {
	test('returns stable for in-range parameters', () => {
		const params = {
			type: 'bifurcation-logistic' as const,
			rMin: 2.5,
			rMax: 4.0,
			maxIterations: 1000
		};
		const result = checkParameterStability('bifurcation-logistic', params);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test('returns warnings when rMin is below stable range', () => {
		const params = {
			type: 'bifurcation-logistic' as const,
			rMin: -0.5,
			rMax: 4.0,
			maxIterations: 1000
		};
		const result = checkParameterStability('bifurcation-logistic', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('rMin'))).toBe(true);
	});

	test('returns warnings when rMax is above stable range', () => {
		const params = {
			type: 'bifurcation-logistic' as const,
			rMin: 2.5,
			rMax: 4.5,
			maxIterations: 1000
		};
		const result = checkParameterStability('bifurcation-logistic', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('rMax'))).toBe(true);
	});

	test('returns warnings when rMin is not less than rMax', () => {
		const params = {
			type: 'bifurcation-logistic' as const,
			rMin: 3.5,
			rMax: 3.0,
			maxIterations: 1000
		};
		const result = checkParameterStability('bifurcation-logistic', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('rMin must be less than rMax'))).toBe(true);
	});

	test('returns warnings when rMin equals rMax', () => {
		const params = {
			type: 'bifurcation-logistic' as const,
			rMin: 3.0,
			rMax: 3.0,
			maxIterations: 1000
		};
		const result = checkParameterStability('bifurcation-logistic', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('rMin must be less than rMax'))).toBe(true);
	});

	test('returns warnings when maxIterations is above stable range', () => {
		const params = {
			type: 'bifurcation-logistic' as const,
			rMin: 2.5,
			rMax: 4.0,
			maxIterations: 10000
		};
		const result = checkParameterStability('bifurcation-logistic', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('maxIterations'))).toBe(true);
	});

	test('returns stable for boundary values', () => {
		const params = {
			type: 'bifurcation-logistic' as const,
			rMin: 0,
			rMax: 4,
			maxIterations: 5000
		};
		const result = checkParameterStability('bifurcation-logistic', params);
		expect(result.isStable).toBe(true);
	});
});

describe('getStableRanges for bifurcation-logistic', () => {
	test('returns correct ranges for bifurcation-logistic', () => {
		const ranges = getStableRanges('bifurcation-logistic');
		expect(ranges).toBeDefined();
		expect(ranges?.rMin).toEqual({ min: 0, max: 4 });
		expect(ranges?.rMax).toEqual({ min: 0, max: 4 });
		expect(ranges?.maxIterations).toEqual({ min: 1, max: 5000 });
	});
});

describe('validateParameters for bifurcation-henon', () => {
	test('returns valid for correct bifurcation-henon parameters', () => {
		const params = {
			type: 'bifurcation-henon',
			aMin: 0.8,
			aMax: 1.4,
			b: 0.3,
			maxIterations: 500
		};
		const result = validateParameters('bifurcation-henon', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing b', () => {
		const params = { type: 'bifurcation-henon', aMin: 0.8, aMax: 1.4, maxIterations: 500 };
		const result = validateParameters('bifurcation-henon', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => /\bb\b/.test(e))).toBe(true);
	});

	test('returns invalid for non-numeric aMin', () => {
		const params = {
			type: 'bifurcation-henon',
			aMin: 'not a number',
			aMax: 1.4,
			b: 0.3,
			maxIterations: 500
		};
		const result = validateParameters('bifurcation-henon', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('aMin'))).toBe(true);
	});

	test('returns invalid for NaN aMax', () => {
		const params = {
			type: 'bifurcation-henon',
			aMin: 0.8,
			aMax: NaN,
			b: 0.3,
			maxIterations: 500
		};
		const result = validateParameters('bifurcation-henon', params);
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const params = {
			type: 'bifurcation-henon',
			aMin: 0.8,
			aMax: 1.4,
			b: 0.3,
			maxIterations: 500,
			extra: 0
		};
		const result = validateParameters('bifurcation-henon', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('extra'))).toBe(true);
	});
});

describe('checkParameterStability for bifurcation-henon', () => {
	test('returns stable for in-range parameters', () => {
		const params = {
			type: 'bifurcation-henon' as const,
			aMin: 0.8,
			aMax: 1.4,
			b: 0.3,
			maxIterations: 500
		};
		const result = checkParameterStability('bifurcation-henon', params);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test('returns warnings when aMin is below stable range', () => {
		const params = {
			type: 'bifurcation-henon' as const,
			aMin: -0.5,
			aMax: 1.4,
			b: 0.3,
			maxIterations: 500
		};
		const result = checkParameterStability('bifurcation-henon', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('aMin'))).toBe(true);
	});

	test('returns warnings when aMax is above stable range', () => {
		const params = {
			type: 'bifurcation-henon' as const,
			aMin: 0.8,
			aMax: 2.5,
			b: 0.3,
			maxIterations: 500
		};
		const result = checkParameterStability('bifurcation-henon', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('aMax'))).toBe(true);
	});

	test('returns warnings when b is outside stable range', () => {
		const params = {
			type: 'bifurcation-henon' as const,
			aMin: 0.8,
			aMax: 1.4,
			b: 1.5,
			maxIterations: 500
		};
		const result = checkParameterStability('bifurcation-henon', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /\bb\b/.test(w))).toBe(true);
	});

	test('returns warnings when aMin is not less than aMax', () => {
		const params = {
			type: 'bifurcation-henon' as const,
			aMin: 1.4,
			aMax: 0.8,
			b: 0.3,
			maxIterations: 500
		};
		const result = checkParameterStability('bifurcation-henon', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('aMin must be less than aMax'))).toBe(true);
	});

	test('returns warnings when aMin equals aMax', () => {
		const params = {
			type: 'bifurcation-henon' as const,
			aMin: 1.0,
			aMax: 1.0,
			b: 0.3,
			maxIterations: 500
		};
		const result = checkParameterStability('bifurcation-henon', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('aMin must be less than aMax'))).toBe(true);
	});

	test('returns warnings when maxIterations is above stable range', () => {
		const params = {
			type: 'bifurcation-henon' as const,
			aMin: 0.8,
			aMax: 1.4,
			b: 0.3,
			maxIterations: 10000
		};
		const result = checkParameterStability('bifurcation-henon', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('maxIterations'))).toBe(true);
	});

	test('returns stable for boundary values', () => {
		const params = {
			type: 'bifurcation-henon' as const,
			aMin: 0,
			aMax: 2,
			b: -1,
			maxIterations: 5000
		};
		const result = checkParameterStability('bifurcation-henon', params);
		expect(result.isStable).toBe(true);
	});
});

describe('getStableRanges for bifurcation-henon', () => {
	test('returns correct ranges for bifurcation-henon', () => {
		const ranges = getStableRanges('bifurcation-henon');
		expect(ranges).toBeDefined();
		expect(ranges?.aMin).toEqual({ min: 0, max: 2 });
		expect(ranges?.aMax).toEqual({ min: 0, max: 2 });
		expect(ranges?.b).toEqual({ min: -1, max: 1 });
		expect(ranges?.maxIterations).toEqual({ min: 1, max: 5000 });
	});
});

describe('isValidMapType for all map types', () => {
	test('returns true for all valid map types', () => {
		for (const mapType of VALID_MAP_TYPES) {
			expect(isValidMapType(mapType)).toBe(true);
		}
	});

	test('returns false for invalid map type', () => {
		expect(isValidMapType('invalid-type')).toBe(false);
	});

	test('returns false for empty string', () => {
		expect(isValidMapType('')).toBe(false);
	});
});

describe('getStableRanges for all map types', () => {
	test('returns undefined for unknown map type', () => {
		const ranges = getStableRanges('unknown' as unknown as ChaosMapType);
		expect(ranges).toBeUndefined();
	});

	test('returns defined ranges for all valid map types', () => {
		for (const mapType of VALID_MAP_TYPES) {
			expect(getStableRanges(mapType)).toBeDefined();
		}
	});
});
