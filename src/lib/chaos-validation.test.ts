import { describe, expect, test, it } from 'vitest';
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

	test('returns invalid for Infinity parameters', () => {
		const params = { type: 'rossler', a: Infinity, b: 0.2, c: 5.7 };
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

	test('warns on both rMin >= rMax and transientIterations > iterations simultaneously', () => {
		const params = {
			type: 'lyapunov' as const,
			rMin: 3.5,
			rMax: 2.0,
			iterations: 500,
			transientIterations: 600
		};
		const result = checkParameterStability('lyapunov', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings).toContain('rMin must be less than rMax');
		expect(result.warnings).toContain('transientIterations must be <= iterations');
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

	test('returns invalid for Infinity parameters', () => {
		const params = { type: 'lorenz', sigma: Infinity, rho: 28, beta: 2.667 };
		const result = validateParameters('lorenz', params);
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for -Infinity parameters', () => {
		const params = { type: 'lorenz', sigma: -Infinity, rho: 28, beta: 2.667 };
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

describe('checkParameterStability with invalid parameters', () => {
	test('returns isStable:false with validation errors when params are structurally invalid', () => {
		// Passing params that fail validateParameters covers lines 182-183 in checkParameterStability
		const invalidParams = { type: 'lorenz', sigma: 'not-a-number', rho: 28, beta: 2.667 };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = checkParameterStability('lorenz', invalidParams as any);
		expect(result.isStable).toBe(false);
		expect(result.warnings.length).toBeGreaterThan(0);
		expect(result.warnings.some((w) => w.includes('sigma'))).toBe(true);
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

describe('Lorenz extended-field validation', () => {
	const full = {
		type: 'lorenz' as const,
		sigma: 10,
		rho: 28,
		beta: 8 / 3,
		x0: 0.1,
		y0: 0,
		z0: 0,
		epsilon: 0.001,
		showGhost: true,
		solver: 'rk4' as const,
		dt: 0.005,
		stepsPerFrame: 5,
		speed: 1,
		colorMode: 'time' as const,
		trailLength: 15000,
		trailStyle: 'comet' as const,
		viewMode: '3d' as const,
		autoRotate: true,
		rotationSpeed: 0.5,
		zoom: 1
	};

	test('accepts a fully-populated Lorenz config', () => {
		const result = validateParameters('lorenz', full);
		expect(result.isValid).toBe(true);
	});

	test('still accepts a legacy sigma/rho/beta-only config', () => {
		const result = validateParameters('lorenz', {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 8 / 3
		});
		expect(result.isValid).toBe(true);
	});

	test('rejects an invalid solver enum value', () => {
		const result = validateParameters('lorenz', { ...full, solver: 'verlet' });
		expect(result.isValid).toBe(false);
	});

	test('rejects a non-boolean showGhost', () => {
		const result = validateParameters('lorenz', { ...full, showGhost: 'yes' });
		expect(result.isValid).toBe(false);
	});

	test('warns when dt is too large with the euler solver', () => {
		const result = checkParameterStability(
			'lorenz',
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ ...full, solver: 'euler', dt: 0.05 } as any
		);
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/dt|Euler|euler/);
	});

	test('clamps epsilon below min to 0 (epsilon < 0)', () => {
		const result = validateParameters('lorenz', { ...full, epsilon: -1 });
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.parameters?.epsilon).toBe(0);
	});

	test('clamps dt below min to 0 (dt < 0)', () => {
		const result = validateParameters('lorenz', { ...full, dt: -0.01 });
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.parameters?.dt).toBe(0);
	});

	test('clamps stepsPerFrame below min to 1 (stepsPerFrame < 1)', () => {
		const result = validateParameters('lorenz', { ...full, stepsPerFrame: 0 });
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.parameters?.stepsPerFrame).toBe(1);
	});

	test('accepts the stationary trailStyle', () => {
		const result = validateParameters('lorenz', { ...full, trailStyle: 'stationary' });
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('checkParameterStability does not warn for stationary trailStyle', () => {
		const result = checkParameterStability('lorenz', { ...full, trailStyle: 'stationary' });
		expect(result.warnings.join(' ')).not.toMatch(/trailStyle/);
	});

	test('clamps trailLength below min to 1 (trailLength < 1)', () => {
		const result = validateParameters('lorenz', { ...full, trailLength: 0 });
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.parameters?.trailLength).toBe(1);
	});

	test('clamps trailLength above max to 100000 (trailLength > 100000)', () => {
		const result = validateParameters('lorenz', { ...full, trailLength: 100001 });
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.parameters?.trailLength).toBe(100000);
	});

	test('accepts trailLength at max boundary (100000)', () => {
		const result = validateParameters('lorenz', { ...full, trailLength: 100000 });
		expect(result.isValid).toBe(true);
	});

	test('clamps zoom below min to 0.5 (zoom < 0.5)', () => {
		const result = validateParameters('lorenz', { ...full, zoom: 0 });
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.parameters?.zoom).toBe(0.5);
	});

	test('clamps zoom at negative value to 0.5', () => {
		const result = validateParameters('lorenz', { ...full, zoom: -1 });
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.parameters?.zoom).toBe(0.5);
	});

	test('accepts epsilon at boundary (epsilon = 0)', () => {
		const result = validateParameters('lorenz', { ...full, epsilon: 0 });
		expect(result.isValid).toBe(true);
	});

	test('accepts zoom at min boundary (zoom = 0.5)', () => {
		const result = validateParameters('lorenz', { ...full, zoom: 0.5 });
		expect(result.isValid).toBe(true);
	});

	test('rejects Infinity in optional number fields (dt)', () => {
		const result = validateParameters('lorenz', { ...full, dt: Infinity });
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('dt'))).toBe(true);
	});

	test('rejects -Infinity in optional number fields (x0)', () => {
		const result = validateParameters('lorenz', { ...full, x0: -Infinity });
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('x0'))).toBe(true);
	});

	test('rejects inherited Object.prototype keys as extra parameters (constructor)', () => {
		// Before the Object.hasOwn fix, 'constructor' would match via prototype
		// and silently skip validation.
		const result = validateParameters('lorenz', {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667,
			constructor: 123
		});
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('constructor'))).toBe(true);
	});

	test('rejects inherited Object.prototype keys as extra parameters (toString)', () => {
		const result = validateParameters('rossler', {
			type: 'rossler',
			a: 0.2,
			b: 0.2,
			c: 5.7,
			toString: 'malicious'
		});
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('toString'))).toBe(true);
	});

	test('rejects inherited Object.prototype key on map type without optional fields', () => {
		// rossler has no OPTIONAL_FIELDS entry, so optionalFields is {}.
		// Without Object.hasOwn, 'hasOwnProperty' in {} is true via prototype.
		const result = validateParameters('rossler', {
			type: 'rossler',
			a: 0.2,
			b: 0.2,
			c: 5.7,
			hasOwnProperty: 42
		});
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('hasOwnProperty'))).toBe(true);
	});
});

// ════════════════════════════════════════════════════════════════════════════
// Merged from chaos-validation.extra.test.ts
// ════════════════════════════════════════════════════════════════════════════

describe('validateParameters for newton', () => {
	test('returns valid for correct newton parameters', () => {
		const result = validateParameters('newton', {
			type: 'newton',
			xMin: -2,
			xMax: 2,
			yMin: -2,
			yMax: 2,
			maxIterations: 50
		});
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing xMin', () => {
		const result = validateParameters('newton', {
			type: 'newton',
			xMax: 2,
			yMin: -2,
			yMax: 2,
			maxIterations: 50
		});
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => /xMin/.test(e))).toBe(true);
	});

	test('returns invalid for missing yMax', () => {
		const result = validateParameters('newton', {
			type: 'newton',
			xMin: -2,
			xMax: 2,
			yMin: -2,
			maxIterations: 50
		});
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for non-numeric maxIterations', () => {
		const result = validateParameters('newton', {
			type: 'newton',
			xMin: -2,
			xMax: 2,
			yMin: -2,
			yMax: 2,
			maxIterations: 'fifty'
		});
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => /must be a valid number/.test(e))).toBe(true);
	});

	test('returns invalid for NaN xMax', () => {
		const result = validateParameters('newton', {
			type: 'newton',
			xMin: -2,
			xMax: NaN,
			yMin: -2,
			yMax: 2,
			maxIterations: 50
		});
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const result = validateParameters('newton', {
			type: 'newton',
			xMin: -2,
			xMax: 2,
			yMin: -2,
			yMax: 2,
			maxIterations: 50,
			extraParam: 99
		});
		expect(result.isValid).toBe(false);
	});
});

// ── validateParameters for standard ──────────────────────────────────────────

describe('validateParameters for standard', () => {
	test('returns valid for correct standard parameters', () => {
		const result = validateParameters('standard', {
			type: 'standard',
			k: 0.97,
			numP: 20,
			numQ: 20,
			iterations: 20000
		});
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing k', () => {
		const result = validateParameters('standard', {
			type: 'standard',
			numP: 20,
			numQ: 20,
			iterations: 20000
		});
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => /\bk\b/.test(e))).toBe(true);
	});

	test('returns invalid for missing numP', () => {
		const result = validateParameters('standard', {
			type: 'standard',
			k: 0.97,
			numQ: 20,
			iterations: 20000
		});
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for non-numeric numQ', () => {
		const result = validateParameters('standard', {
			type: 'standard',
			k: 0.97,
			numP: 20,
			numQ: 'twenty',
			iterations: 20000
		});
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for NaN iterations', () => {
		const result = validateParameters('standard', {
			type: 'standard',
			k: 0.97,
			numP: 20,
			numQ: 20,
			iterations: NaN
		});
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const result = validateParameters('standard', {
			type: 'standard',
			k: 0.97,
			numP: 20,
			numQ: 20,
			iterations: 20000,
			extra: 1
		});
		expect(result.isValid).toBe(false);
	});
});

// ── validateParameters for chaos-esthetique ──────────────────────────────────

describe('validateParameters for chaos-esthetique', () => {
	test('returns valid for correct chaos-esthetique parameters', () => {
		const result = validateParameters('chaos-esthetique', {
			type: 'chaos-esthetique',
			a: 1.4,
			b: 0.3,
			x0: 0,
			y0: 0,
			iterations: 10000
		});
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing a', () => {
		const result = validateParameters('chaos-esthetique', {
			type: 'chaos-esthetique',
			b: 0.3,
			x0: 0,
			y0: 0,
			iterations: 10000
		});
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for missing iterations', () => {
		const result = validateParameters('chaos-esthetique', {
			type: 'chaos-esthetique',
			a: 1.4,
			b: 0.3,
			x0: 0,
			y0: 0
		});
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for non-numeric b', () => {
		const result = validateParameters('chaos-esthetique', {
			type: 'chaos-esthetique',
			a: 1.4,
			b: 'point-three',
			x0: 0,
			y0: 0,
			iterations: 10000
		});
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => /must be a valid number/.test(e))).toBe(true);
	});

	test('returns invalid for NaN x0', () => {
		const result = validateParameters('chaos-esthetique', {
			type: 'chaos-esthetique',
			a: 1.4,
			b: 0.3,
			x0: NaN,
			y0: 0,
			iterations: 10000
		});
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const result = validateParameters('chaos-esthetique', {
			type: 'chaos-esthetique',
			a: 1.4,
			b: 0.3,
			x0: 0,
			y0: 0,
			iterations: 10000,
			extra: 42
		});
		expect(result.isValid).toBe(false);
	});
});

// ── checkParameterStability for newton ───────────────────────────────────────

describe('checkParameterStability for newton – additional cases', () => {
	test('returns stable for valid ranges', () => {
		const result = checkParameterStability('newton', {
			type: 'newton',
			xMin: -2,
			xMax: 2,
			yMin: -2,
			yMax: 2,
			maxIterations: 50
		});
		expect(result.isStable).toBe(true);
	});

	test('returns warnings when yMin is not less than yMax', () => {
		const result = checkParameterStability('newton', {
			type: 'newton',
			xMin: -2,
			xMax: 2,
			yMin: 3,
			yMax: 1,
			maxIterations: 50
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.length).toBeGreaterThan(0);
	});

	test('returns warnings when xMin equals xMax', () => {
		const result = checkParameterStability('newton', {
			type: 'newton',
			xMin: 2,
			xMax: 2,
			yMin: -2,
			yMax: 2,
			maxIterations: 50
		});
		expect(result.isStable).toBe(false);
	});

	test('returns warnings when maxIterations is above stable range', () => {
		const result = checkParameterStability('newton', {
			type: 'newton',
			xMin: -2,
			xMax: 2,
			yMin: -2,
			yMax: 2,
			maxIterations: 9999
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /maxIterations/.test(w))).toBe(true);
	});

	test('returns warnings when maxIterations is below stable range', () => {
		const result = checkParameterStability('newton', {
			type: 'newton',
			xMin: -2,
			xMax: 2,
			yMin: -2,
			yMax: 2,
			maxIterations: 0
		});
		expect(result.isStable).toBe(false);
	});

	test('warns for both xMin >= xMax and yMin >= yMax simultaneously', () => {
		const result = checkParameterStability('newton', {
			type: 'newton',
			xMin: 1,
			xMax: -1,
			yMin: 1,
			yMax: -1,
			maxIterations: 50
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings).toContain('xMin must be less than xMax');
		expect(result.warnings).toContain('yMin must be less than yMax');
	});
});

// ── checkParameterStability for standard ─────────────────────────────────────

describe('checkParameterStability for standard – additional cases', () => {
	test('returns stable for in-range parameters', () => {
		const result = checkParameterStability('standard', {
			type: 'standard',
			k: 0.97,
			numP: 20,
			numQ: 20,
			iterations: 20000
		});
		expect(result.isStable).toBe(true);
	});

	test('returns warnings when numP is above stable range', () => {
		const result = checkParameterStability('standard', {
			type: 'standard',
			k: 0.97,
			numP: 999,
			numQ: 20,
			iterations: 20000
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /numP/.test(w))).toBe(true);
	});

	test('returns warnings when numQ is above stable range', () => {
		const result = checkParameterStability('standard', {
			type: 'standard',
			k: 0.97,
			numP: 20,
			numQ: 999,
			iterations: 20000
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /numQ/.test(w))).toBe(true);
	});

	test('returns warnings when iterations is above stable range', () => {
		const result = checkParameterStability('standard', {
			type: 'standard',
			k: 0.97,
			numP: 20,
			numQ: 20,
			iterations: 9999999
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /iterations/.test(w))).toBe(true);
	});

	test('returns warnings when k is above stable range', () => {
		const result = checkParameterStability('standard', {
			type: 'standard',
			k: 100,
			numP: 20,
			numQ: 20,
			iterations: 20000
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /\bk\b/.test(w))).toBe(true);
	});
});

// ── checkParameterStability for chaos-esthetique ─────────────────────────────

describe('checkParameterStability for chaos-esthetique – additional cases', () => {
	test('returns stable for in-range parameters', () => {
		const result = checkParameterStability('chaos-esthetique', {
			type: 'chaos-esthetique',
			a: 1.4,
			b: 0.3,
			x0: 0,
			y0: 0,
			iterations: 10000
		});
		expect(result.isStable).toBe(true);
	});

	test('returns warnings when a is above stable range', () => {
		const result = checkParameterStability('chaos-esthetique', {
			type: 'chaos-esthetique',
			a: 100,
			b: 0.3,
			x0: 0,
			y0: 0,
			iterations: 10000
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /\ba\b/.test(w))).toBe(true);
	});

	test('returns warnings when b is above stable range', () => {
		const result = checkParameterStability('chaos-esthetique', {
			type: 'chaos-esthetique',
			a: 1.4,
			b: 100,
			x0: 0,
			y0: 0,
			iterations: 10000
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /\bb\b/.test(w))).toBe(true);
	});

	test('returns warnings when iterations is above stable range', () => {
		const result = checkParameterStability('chaos-esthetique', {
			type: 'chaos-esthetique',
			a: 1.4,
			b: 0.3,
			x0: 0,
			y0: 0,
			iterations: 999999
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /iterations/.test(w))).toBe(true);
	});

	test('returns warnings when x0 is outside stable range', () => {
		const result = checkParameterStability('chaos-esthetique', {
			type: 'chaos-esthetique',
			a: 1.4,
			b: 0.3,
			x0: 1000,
			y0: 0,
			iterations: 10000
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /x0/.test(w))).toBe(true);
	});

	test('returns warnings when y0 is outside stable range', () => {
		const result = checkParameterStability('chaos-esthetique', {
			type: 'chaos-esthetique',
			a: 1.4,
			b: 0.3,
			x0: 0,
			y0: -1000,
			iterations: 10000
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /y0/.test(w))).toBe(true);
	});
});

// ── Infinity parameter values ─────────────────────────────────────────────────
// validateParameters uses `isNaN()` which does not catch Infinity
// Infinity values are now rejected by Number.isFinite in validateParameters.

describe('validateParameters with Infinity values', () => {
	test('rejects Infinity for lorenz sigma (Number.isFinite catches it)', () => {
		const result = validateParameters('lorenz', {
			type: 'lorenz',
			sigma: Infinity,
			rho: 28,
			beta: 2.667
		});
		// Infinity is now rejected by Number.isFinite
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('sigma'))).toBe(true);
	});

	test('stability check also flags Infinity sigma as invalid', () => {
		const stability = checkParameterStability('lorenz', {
			type: 'lorenz',
			sigma: Infinity,
			rho: 28,
			beta: 2.667
		});
		expect(stability.isStable).toBe(false);
	});

	test('rejects -Infinity for logistic r (Number.isFinite catches it)', () => {
		const result = validateParameters('logistic', {
			type: 'logistic',
			r: -Infinity,
			x0: 0.1,
			iterations: 100
		});
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => /\br\b/.test(e))).toBe(true);
	});

	test('rejects Infinity iterations for henon (Number.isFinite catches it)', () => {
		const result = validateParameters('henon', {
			type: 'henon',
			a: 1.4,
			b: 0.3,
			iterations: Infinity
		});
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('iterations'))).toBe(true);
	});
});

// ── getStableRanges for standard, newton, chaos-esthetique ───────────────────

describe('getStableRanges – additional map types', () => {
	test('returns correct ranges for standard map', () => {
		const ranges = getStableRanges('standard');
		expect(ranges).toBeDefined();
		expect(ranges!.k).toBeDefined();
		expect(ranges!.numP).toBeDefined();
		expect(ranges!.numQ).toBeDefined();
		expect(ranges!.iterations).toBeDefined();
	});

	test('returns correct ranges for newton', () => {
		const ranges = getStableRanges('newton');
		expect(ranges).toBeDefined();
		expect(ranges!.xMin).toBeDefined();
		expect(ranges!.xMax).toBeDefined();
		expect(ranges!.yMin).toBeDefined();
		expect(ranges!.yMax).toBeDefined();
		expect(ranges!.maxIterations).toBeDefined();
	});

	test('returns correct ranges for chaos-esthetique', () => {
		const ranges = getStableRanges('chaos-esthetique');
		expect(ranges).toBeDefined();
		expect(ranges!.a).toBeDefined();
		expect(ranges!.b).toBeDefined();
		expect(ranges!.x0).toBeDefined();
		expect(ranges!.y0).toBeDefined();
		expect(ranges!.iterations).toBeDefined();
	});

	test('stable range min is less than max for all standard params', () => {
		const ranges = getStableRanges('standard')!;
		for (const [, range] of Object.entries(ranges)) {
			expect(range.min).toBeLessThanOrEqual(range.max);
		}
	});

	test('stable range min is less than max for all newton params', () => {
		const ranges = getStableRanges('newton')!;
		for (const [, range] of Object.entries(ranges)) {
			expect(range.min).toBeLessThanOrEqual(range.max);
		}
	});
});

// ── isValidMapType edge cases ─────────────────────────────────────────────────

describe('isValidMapType – edge cases', () => {
	test('returns false for null', () => {
		expect(isValidMapType(null as unknown as string)).toBe(false);
	});

	test('returns false for undefined', () => {
		expect(isValidMapType(undefined as unknown as string)).toBe(false);
	});

	test('returns false for number', () => {
		expect(isValidMapType(42 as unknown as string)).toBe(false);
	});

	test('returns false for object', () => {
		expect(isValidMapType({} as unknown as string)).toBe(false);
	});

	test('returns false for whitespace string', () => {
		expect(isValidMapType(' lorenz')).toBe(false);
	});

	test('returns false for lorenz with wrong casing', () => {
		expect(isValidMapType('Lorenz')).toBe(false);
		expect(isValidMapType('LORENZ')).toBe(false);
	});
});

describe('validateParameters with non-object input', () => {
	test('returns invalid for params that are not an object', () => {
		const result = validateParameters(
			'lorenz',
			'not-an-object' as unknown as Record<string, unknown>
		);
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain('Parameters must be an object');
	});
});

// ════════════════════════════════════════════════════════════════════════════
// Merged from chaos-validation.vitest.ts (the 'it'-style suite)
// ════════════════════════════════════════════════════════════════════════════

describe('validateParameters', () => {
	describe('non-object params', () => {
		it('rejects null', () => {
			const result = validateParameters('lorenz', null);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Parameters must be an object');
		});

		it('rejects undefined', () => {
			const result = validateParameters('lorenz', undefined);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Parameters must be an object');
		});

		it('rejects string', () => {
			const result = validateParameters('lorenz', 'not an object');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Parameters must be an object');
		});

		it('rejects number', () => {
			const result = validateParameters('lorenz', 42);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Parameters must be an object');
		});

		it('rejects boolean', () => {
			const result = validateParameters('lorenz', true);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Parameters must be an object');
		});
	});

	describe('Standard map K normalization', () => {
		it('normalizes uppercase K to lowercase k', () => {
			const result = validateParameters('standard', {
				type: 'standard',
				K: 1.5,
				numP: 10,
				numQ: 10,
				iterations: 5000
			});
			expect(result.isValid).toBe(true);
			expect(result.parameters).toHaveProperty('k', 1.5);
			expect(result.parameters).not.toHaveProperty('K');
		});

		it('keeps k when both K and k are present', () => {
			const result = validateParameters('standard', {
				type: 'standard',
				K: 1.5,
				k: 2.0,
				numP: 10,
				numQ: 10,
				iterations: 5000
			});
			expect(result.isValid).toBe(true);
			expect(result.parameters).toHaveProperty('k', 2.0);
			expect(result.parameters).not.toHaveProperty('K');
		});

		it('accepts lowercase k directly', () => {
			const result = validateParameters('standard', {
				k: 1.5,
				numP: 10,
				numQ: 10,
				iterations: 5000
			});
			expect(result.isValid).toBe(true);
			expect(result.parameters).toHaveProperty('k', 1.5);
		});
	});

	describe('unknown map type', () => {
		it('rejects unknown map type', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = validateParameters('unknown' as any, { a: 1 });
			expect(result.isValid).toBe(false);
			expect(result.errors).toEqual([expect.stringContaining('Unknown map type')]);
		});
	});

	describe('missing keys', () => {
		it('reports missing parameters for lorenz', () => {
			const result = validateParameters('lorenz', { sigma: 10 });
			expect(result.isValid).toBe(false);
			expect(result.errors).toEqual([expect.stringContaining('Missing required parameters')]);
			expect(result.errors[0]).toContain('rho');
			expect(result.errors[0]).toContain('beta');
		});
	});

	describe('extra keys', () => {
		it('reports unexpected parameters', () => {
			const result = validateParameters('lorenz', {
				sigma: 10,
				rho: 28,
				beta: 2.667,
				extra: 5
			});
			expect(result.isValid).toBe(false);
			expect(result.errors).toEqual([expect.stringContaining('Unexpected parameters')]);
			expect(result.errors[0]).toContain('extra');
		});

		it('allows type field without reporting as extra', () => {
			const result = validateParameters('lorenz', {
				type: 'lorenz',
				sigma: 10,
				rho: 28,
				beta: 2.667
			});
			expect(result.isValid).toBe(true);
		});
	});

	describe('non-number values', () => {
		it('rejects string values', () => {
			const result = validateParameters('lorenz', {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				sigma: '10' as any,
				rho: 28,
				beta: 2.667
			});
			expect(result.isValid).toBe(false);
			expect(result.errors).toEqual([
				expect.stringContaining("Parameter 'sigma' must be a valid number")
			]);
		});

		it('rejects NaN values', () => {
			const result = validateParameters('lorenz', {
				sigma: NaN,
				rho: 28,
				beta: 2.667
			});
			expect(result.isValid).toBe(false);
			expect(result.errors).toEqual([
				expect.stringContaining("Parameter 'sigma' must be a valid number")
			]);
		});
	});

	describe('valid params for each map type', () => {
		it('accepts valid lorenz params', () => {
			const result = validateParameters('lorenz', { sigma: 10, rho: 28, beta: 2.667 });
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('accepts valid rossler params', () => {
			const result = validateParameters('rossler', { a: 0.2, b: 0.2, c: 5.7 });
			expect(result.isValid).toBe(true);
		});

		it('accepts valid henon params', () => {
			const result = validateParameters('henon', { a: 1.4, b: 0.3, iterations: 10000 });
			expect(result.isValid).toBe(true);
		});

		it('accepts valid lozi params', () => {
			const result = validateParameters('lozi', {
				a: 1.4,
				b: 0.3,
				x0: 0.1,
				y0: 0.1,
				iterations: 10000
			});
			expect(result.isValid).toBe(true);
		});

		it('accepts valid logistic params', () => {
			const result = validateParameters('logistic', { r: 3.7, x0: 0.5, iterations: 500 });
			expect(result.isValid).toBe(true);
		});

		it('accepts valid newton params', () => {
			const result = validateParameters('newton', {
				xMin: -2,
				xMax: 2,
				yMin: -2,
				yMax: 2,
				maxIterations: 50
			});
			expect(result.isValid).toBe(true);
		});

		it('accepts valid bifurcation-logistic params', () => {
			const result = validateParameters('bifurcation-logistic', {
				rMin: 2.5,
				rMax: 4,
				maxIterations: 500
			});
			expect(result.isValid).toBe(true);
		});

		it('accepts valid bifurcation-henon params', () => {
			const result = validateParameters('bifurcation-henon', {
				aMin: 0.5,
				aMax: 1.5,
				b: 0.3,
				maxIterations: 500
			});
			expect(result.isValid).toBe(true);
		});

		it('accepts valid chaos-esthetique params', () => {
			const result = validateParameters('chaos-esthetique', {
				a: 0.5,
				b: 0.5,
				x0: 0.1,
				y0: 0.1,
				iterations: 50000
			});
			expect(result.isValid).toBe(true);
		});

		it('accepts valid lyapunov params', () => {
			const result = validateParameters('lyapunov', {
				rMin: 2,
				rMax: 4,
				iterations: 500,
				transientIterations: 100
			});
			expect(result.isValid).toBe(true);
		});
	});

	describe('optional fields validation', () => {
		it('accepts valid optional fields for lorenz', () => {
			const result = validateParameters('lorenz', {
				sigma: 10,
				rho: 28,
				beta: 2.667,
				epsilon: 0.01,
				showGhost: true,
				solver: 'rk4',
				dt: 0.005,
				colorMode: 'time',
				trailStyle: 'comet'
			});
			expect(result.isValid).toBe(true);
		});

		it('rejects invalid number type for optional field', () => {
			const result = validateParameters('lorenz', {
				sigma: 10,
				rho: 28,
				beta: 2.667,
				epsilon: 'not-a-number'
			});
			expect(result.isValid).toBe(false);
			expect(result.errors[0]).toContain("Parameter 'epsilon' must be a valid number");
		});

		it('clamps optional field below minimum', () => {
			const result = validateParameters('lorenz', {
				sigma: 10,
				rho: 28,
				beta: 2.667,
				epsilon: -1
			});
			expect(result.isValid).toBe(true);
			expect(result.parameters?.epsilon).toBe(0);
		});

		it('clamps optional field above maximum', () => {
			const result = validateParameters('lorenz', {
				sigma: 10,
				rho: 28,
				beta: 2.667,
				trailLength: 200000
			});
			expect(result.isValid).toBe(true);
			expect(result.parameters?.trailLength).toBe(100000);
		});

		it('rejects invalid boolean type for optional field', () => {
			const result = validateParameters('lorenz', {
				sigma: 10,
				rho: 28,
				beta: 2.667,
				showGhost: 'true'
			});
			expect(result.isValid).toBe(false);
			expect(result.errors[0]).toContain("Parameter 'showGhost' must be a boolean");
		});

		it('rejects invalid enum value for optional field', () => {
			const result = validateParameters('lorenz', {
				sigma: 10,
				rho: 28,
				beta: 2.667,
				solver: 'invalid-solver'
			});
			expect(result.isValid).toBe(false);
			expect(result.errors[0]).toContain("Parameter 'solver' must be one of");
		});
	});

	describe('input immutability', () => {
		it('does not mutate the caller input object when clamping optional fields', () => {
			const input = { sigma: 10, rho: 28, beta: 2.667, epsilon: -5 };
			const inputCopy = { ...input };
			validateParameters('lorenz', input);
			expect(input).toEqual(inputCopy);
			expect(input.epsilon).toBe(-5);
		});

		it('does not mutate the caller input object when clamping optional fields above max', () => {
			const input = { sigma: 10, rho: 28, beta: 2.667, trailLength: 999999 };
			const inputCopy = { ...input };
			validateParameters('lorenz', input);
			expect(input).toEqual(inputCopy);
			expect(input.trailLength).toBe(999999);
		});
	});
});

describe('checkParameterStability', () => {
	describe('invalid params delegation', () => {
		it('delegates to validateParameters for null', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = checkParameterStability('lorenz', null as any);
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('Parameters must be an object');
		});

		it('delegates to validateParameters for missing keys', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = checkParameterStability('lorenz', { sigma: 10 } as any);
			expect(result.isStable).toBe(false);
			expect(result.warnings[0]).toContain('Missing required parameters');
		});
	});

	describe('unknown map type', () => {
		it('returns isStable false due to validation failure', () => {
			const result = checkParameterStability(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				'unknown' as any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{} as any
			);
			expect(result.isStable).toBe(false);
			expect(result.warnings).toEqual([expect.stringContaining('Unknown map type')]);
		});
	});

	describe('min/max relationship warnings', () => {
		it('warns when newton xMin >= xMax', () => {
			const result = checkParameterStability('newton', {
				type: 'newton',
				xMin: 2,
				xMax: 1,
				yMin: -2,
				yMax: 2,
				maxIterations: 50
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('xMin must be less than xMax');
		});

		it('warns when newton yMin >= yMax', () => {
			const result = checkParameterStability('newton', {
				type: 'newton',
				xMin: -2,
				xMax: 2,
				yMin: 2,
				yMax: 1,
				maxIterations: 50
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('yMin must be less than yMax');
		});

		it('warns when newton xMin === xMax', () => {
			const result = checkParameterStability('newton', {
				type: 'newton',
				xMin: 0,
				xMax: 0,
				yMin: -2,
				yMax: 2,
				maxIterations: 50
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('xMin must be less than xMax');
		});

		it('warns when bifurcation-logistic rMin >= rMax', () => {
			const result = checkParameterStability('bifurcation-logistic', {
				type: 'bifurcation-logistic',
				rMin: 4,
				rMax: 3,
				maxIterations: 500
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('rMin must be less than rMax');
		});

		it('warns when bifurcation-henon aMin >= aMax', () => {
			const result = checkParameterStability('bifurcation-henon', {
				type: 'bifurcation-henon',
				aMin: 2,
				aMax: 1,
				b: 0.3,
				maxIterations: 500
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('aMin must be less than aMax');
		});

		it('warns when lyapunov rMin >= rMax', () => {
			const result = checkParameterStability('lyapunov', {
				type: 'lyapunov',
				rMin: 4,
				rMax: 2,
				iterations: 500,
				transientIterations: 100
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('rMin must be less than rMax');
		});

		it('warns when lyapunov transientIterations > iterations', () => {
			const result = checkParameterStability('lyapunov', {
				type: 'lyapunov',
				rMin: 2,
				rMax: 4,
				iterations: 200,
				transientIterations: 500
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('transientIterations must be <= iterations');
		});

		it('warns when ikeda burnIn >= iterations', () => {
			const result = checkParameterStability('ikeda', {
				type: 'ikeda',
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 1000
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain(
				'burnIn must be less than iterations or the visualization will be empty'
			);
		});

		it('does not warn when ikeda burnIn < iterations', () => {
			const result = checkParameterStability('ikeda', {
				type: 'ikeda',
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 5000,
				burnIn: 100
			});
			expect(result.isStable).toBe(true);
			expect(result.warnings).toHaveLength(0);
		});

		it('warns when ikeda burnIn equals iterations', () => {
			const result = checkParameterStability('ikeda', {
				type: 'ikeda',
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 200,
				burnIn: 200
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain(
				'burnIn must be less than iterations or the visualization will be empty'
			);
		});

		it('warns when gumowski-mira burnIn >= iterations', () => {
			const result = checkParameterStability('gumowski-mira', {
				type: 'gumowski-mira',
				mu: 0.31,
				a: 0.008,
				b: 0.05,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 1000
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain(
				'burnIn must be less than iterations or the visualization will be empty'
			);
		});

		it('does not warn when gumowski-mira burnIn < iterations', () => {
			const result = checkParameterStability('gumowski-mira', {
				type: 'gumowski-mira',
				mu: 0.31,
				a: 0.008,
				b: 0.05,
				x0: 0.1,
				y0: 0,
				iterations: 15000,
				burnIn: 500
			});
			expect(result.isStable).toBe(true);
			expect(result.warnings).toHaveLength(0);
		});

		it('warns when gumowski-mira burnIn equals iterations', () => {
			const result = checkParameterStability('gumowski-mira', {
				type: 'gumowski-mira',
				mu: 0.31,
				a: 0.008,
				b: 0.05,
				x0: 0.1,
				y0: 0,
				iterations: 200,
				burnIn: 200
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain(
				'burnIn must be less than iterations or the visualization will be empty'
			);
		});

		it('warns when lorenz dt is <= 0 or > 0.02', () => {
			const result = checkParameterStability('lorenz', {
				type: 'lorenz',
				sigma: 10,
				rho: 28,
				beta: 2.667,
				dt: 0.03
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain(
				'dt (0.03) is outside the recommended range (0, 0.02]'
			);
		});

		it('warns when lorenz Euler solver is used with dt > 0.01', () => {
			const result = checkParameterStability('lorenz', {
				type: 'lorenz',
				sigma: 10,
				rho: 28,
				beta: 2.667,
				dt: 0.015,
				solver: 'euler'
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain(
				'Euler integration with dt=0.015 is prone to numerical blow-up; reduce dt or use RK4'
			);
		});

		it('warns when lorenz epsilon is <= 0', () => {
			const result = checkParameterStability('lorenz', {
				type: 'lorenz',
				sigma: 10,
				rho: 28,
				beta: 2.667,
				epsilon: 0
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain(
				'epsilon (0) must be positive for the perturbed orbit'
			);
		});
	});

	describe('out-of-range warnings', () => {
		it('warns when lorenz sigma is above stable range', () => {
			const result = checkParameterStability('lorenz', {
				type: 'lorenz',
				sigma: 100,
				rho: 28,
				beta: 2.667
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('sigma (100) is outside stable range [0, 50]');
		});

		it('warns when lorenz sigma is below stable range', () => {
			const result = checkParameterStability('lorenz', {
				type: 'lorenz',
				sigma: -1,
				rho: 28,
				beta: 2.667
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('sigma (-1) is outside stable range [0, 50]');
		});

		it('warns for multiple out-of-range params', () => {
			const result = checkParameterStability('lorenz', {
				type: 'lorenz',
				sigma: 100,
				rho: 200,
				beta: 2.667
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toHaveLength(2);
		});

		it('accepts boundary values as stable', () => {
			const result = checkParameterStability('lorenz', {
				type: 'lorenz',
				sigma: 0,
				rho: 0,
				beta: 0
			});
			expect(result.isStable).toBe(true);
			expect(result.warnings).toHaveLength(0);
		});

		it('accepts upper boundary values as stable', () => {
			const result = checkParameterStability('lorenz', {
				type: 'lorenz',
				sigma: 50,
				rho: 100,
				beta: 10
			});
			expect(result.isStable).toBe(true);
		});
	});

	describe('stable params', () => {
		it('returns stable for valid henon params', () => {
			const result = checkParameterStability('henon', {
				type: 'henon',
				a: 1.4,
				b: 0.3,
				iterations: 10000
			});
			expect(result.isStable).toBe(true);
			expect(result.warnings).toHaveLength(0);
		});
	});
});

describe('getStableRanges', () => {
	it('returns ranges for lorenz', () => {
		const ranges = getStableRanges('lorenz');
		expect(ranges).toBeDefined();
		expect(ranges!.sigma).toEqual({ min: 0, max: 50 });
	});

	it('returns ranges for rossler', () => {
		const ranges = getStableRanges('rossler');
		expect(ranges).toBeDefined();
		expect(ranges!.a).toEqual({ min: 0.126, max: 0.43295 });
	});

	it('returns undefined for unknown map type', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ranges = getStableRanges('unknown' as any);
		expect(ranges).toBeUndefined();
	});

	it('returns ranges for all map types', () => {
		const types = [
			'lorenz',
			'rossler',
			'henon',
			'lozi',
			'logistic',
			'newton',
			'standard',
			'bifurcation-logistic',
			'bifurcation-henon',
			'chaos-esthetique',
			'lyapunov'
		] as const;
		for (const t of types) {
			expect(getStableRanges(t)).toBeDefined();
		}
	});
});

describe('isValidMapType', () => {
	it('returns true for lorenz', () => {
		expect(isValidMapType('lorenz')).toBe(true);
	});

	it('returns true for rossler', () => {
		expect(isValidMapType('rossler')).toBe(true);
	});

	it('returns true for chaos-esthetique', () => {
		expect(isValidMapType('chaos-esthetique')).toBe(true);
	});

	it('returns true for bifurcation-logistic', () => {
		expect(isValidMapType('bifurcation-logistic')).toBe(true);
	});

	it('returns false for unknown', () => {
		expect(isValidMapType('unknown')).toBe(false);
	});

	it('returns false for empty string', () => {
		expect(isValidMapType('')).toBe(false);
	});
});

describe('validateParameters - ikeda', () => {
	test('accepts a valid minimal ikeda config', () => {
		const result = validateParameters('ikeda', {
			type: 'ikeda',
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 800,
			burnIn: 100
		});
		expect(result.isValid).toBe(true);
	});

	test('accepts optional render fields with valid values', () => {
		const result = validateParameters('ikeda', {
			type: 'ikeda',
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 800,
			burnIn: 100,
			renderMode: 'multi',
			seeds: 250,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6
		});
		expect(result.isValid).toBe(true);
	});

	test('rejects an invalid colorMode enum value', () => {
		const result = validateParameters('ikeda', {
			type: 'ikeda',
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 800,
			burnIn: 100,
			colorMode: 'rainbow'
		});
		expect(result.isValid).toBe(false);
	});

	test('rejects a missing required field (burnIn)', () => {
		const result = validateParameters('ikeda', {
			type: 'ikeda',
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 800
		});
		expect(result.isValid).toBe(false);
	});

	test('clamps pointSize above max (6) to 6', () => {
		const result = validateParameters('ikeda', {
			type: 'ikeda',
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 800,
			burnIn: 100,
			pointSize: 10
		});
		expect(result.isValid).toBe(true);
		expect(result.parameters?.pointSize).toBe(6);
	});

	test('clamps pointSize below min (0.5) to 0.5', () => {
		const result = validateParameters('ikeda', {
			type: 'ikeda',
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 800,
			burnIn: 100,
			pointSize: 0.1
		});
		expect(result.isValid).toBe(true);
		expect(result.parameters?.pointSize).toBe(0.5);
	});

	test('clamps opacity below min (0) to 0', () => {
		const result = validateParameters('ikeda', {
			type: 'ikeda',
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 800,
			burnIn: 100,
			opacity: -0.5
		});
		expect(result.isValid).toBe(true);
		expect(result.parameters?.opacity).toBe(0);
	});

	test('clamps opacity above max (1) to 1', () => {
		const result = validateParameters('ikeda', {
			type: 'ikeda',
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 800,
			burnIn: 100,
			opacity: 1.5
		});
		expect(result.isValid).toBe(true);
		expect(result.parameters?.opacity).toBe(1);
	});

	test('clamps seeds above max (5000) to 5000', () => {
		const result = validateParameters('ikeda', {
			type: 'ikeda',
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 800,
			burnIn: 100,
			seeds: 10000
		});
		expect(result.isValid).toBe(true);
		expect(result.parameters?.seeds).toBe(5000);
	});

	test('still rejects NaN in optional numeric fields', () => {
		const result = validateParameters('ikeda', {
			type: 'ikeda',
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 800,
			burnIn: 100,
			pointSize: NaN
		});
		expect(result.isValid).toBe(false);
	});
});

describe('double-pendulum validation', () => {
	const valid = {
		type: 'double-pendulum' as const,
		theta1: Math.PI / 2,
		theta2: Math.PI / 2,
		omega1: 0,
		omega2: 0,
		l1: 1,
		l2: 1,
		m1: 1,
		m2: 1,
		gravity: 9.81,
		damping: 0
	};

	it('accepts a complete valid parameter set', () => {
		const result = validateParameters('double-pendulum', valid);
		expect(result.isValid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('reports missing required parameters', () => {
		const { gravity, ...incomplete } = valid;
		void gravity;
		const result = validateParameters('double-pendulum', incomplete);
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toContain('gravity');
	});

	it('accepts optional sim/render fields and clamps out-of-range trailLength', () => {
		const result = validateParameters('double-pendulum', {
			...valid,
			speed: 1,
			showTrail: true,
			trailLength: 999999,
			compareMode: false,
			compareOffset: 0.001
		});
		expect(result.isValid).toBe(true);
		expect((result.parameters as Record<string, number>).trailLength).toBe(5000);
	});

	it('warns when gravity is zero (pendulum will not swing)', () => {
		const result = checkParameterStability('double-pendulum', { ...valid, gravity: 0 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toContain('gravity');
	});

	it('warns when damping is high (motion decays within a few swings)', () => {
		const result = checkParameterStability('double-pendulum', { ...valid, damping: 1.5 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /damping/i.test(w))).toBe(true);
	});

	it('does not warn about damping at the mild damped-preset value (0.1)', () => {
		const result = checkParameterStability('double-pendulum', { ...valid, damping: 0.1 });
		expect(result.warnings.some((w) => /damping/i.test(w))).toBe(false);
	});

	it('warns when a core physical param is below its stable range (l1=0)', () => {
		// l1=0 is the degenerate divide-by-zero case; it must be flagged as
		// unstable so a user is warned before saving a config that blows up.
		const result = checkParameterStability('double-pendulum', { ...valid, l1: 0 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /l1 \(0\)/.test(w))).toBe(true);
	});

	it('warns when an angular velocity exceeds its stable range (omega1=60)', () => {
		const result = checkParameterStability('double-pendulum', { ...valid, omega1: 60 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /omega1/.test(w))).toBe(true);
	});

	it('warns when mass is below its stable range (m1=0.01)', () => {
		const result = checkParameterStability('double-pendulum', { ...valid, m1: 0.01 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /m1/.test(w))).toBe(true);
	});

	it('warns for multiple out-of-range params at once', () => {
		const result = checkParameterStability('double-pendulum', {
			...valid,
			l1: 0,
			omega2: -100
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => /l1/.test(w))).toBe(true);
		expect(result.warnings.some((w) => /omega2/.test(w))).toBe(true);
	});

	it('is stable for default chaotic parameters', () => {
		const result = checkParameterStability('double-pendulum', valid);
		expect(result.isStable).toBe(true);
	});

	it('exposes stable ranges and recognizes the map type', () => {
		expect(getStableRanges('double-pendulum')).toBeDefined();
		expect(isValidMapType('double-pendulum')).toBe(true);
	});
});

describe('clifford validation', () => {
	const valid = {
		type: 'clifford' as const,
		a: -1.4,
		b: 1.6,
		c: 1.0,
		d: 0.7,
		iterations: 120000
	};

	test('accepts a valid clifford config', () => {
		const result = validateParameters('clifford', valid);
		expect(result.isValid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test('reports missing required parameters', () => {
		const { a, ...missingA } = valid;
		void a;
		const result = validateParameters('clifford', { ...missingA, type: 'clifford' });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toMatch(/Missing required parameters/);
	});

	test('rejects an invalid colorMode enum value', () => {
		const result = validateParameters('clifford', { ...valid, colorMode: 'rainbow' });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toMatch(/colorMode/);
	});

	test('accepts a valid colorMode and clamps zoom into range', () => {
		const result = validateParameters('clifford', {
			...valid,
			colorMode: 'density',
			zoom: 999
		});
		expect(result.isValid).toBe(true);
		expect((result.parameters as Record<string, number>).zoom).toBe(5);
	});

	test('warns when a shape parameter is outside the stable range', () => {
		const result = checkParameterStability('clifford', { ...valid, a: 99 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/a \(99\)/);
	});

	test('classic defaults are stable', () => {
		expect(checkParameterStability('clifford', valid).isStable).toBe(true);
	});
});

describe('tinkerbell validation', () => {
	const valid = {
		type: 'tinkerbell' as const,
		a: 0.9,
		b: -0.6013,
		c: 2.0,
		d: 0.5,
		iterations: 100000
	};

	test('accepts a valid tinkerbell config', () => {
		const result = validateParameters('tinkerbell', valid);
		expect(result.isValid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test('reports missing required parameters', () => {
		const { a, ...missingA } = valid;
		void a;
		const result = validateParameters('tinkerbell', { ...missingA, type: 'tinkerbell' });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toMatch(/Missing required parameters/);
	});

	test('rejects an invalid colorMode enum value', () => {
		const result = validateParameters('tinkerbell', { ...valid, colorMode: 'rainbow' });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toMatch(/colorMode/);
	});

	test('accepts a valid colorMode and clamps zoom into range', () => {
		const result = validateParameters('tinkerbell', {
			...valid,
			colorMode: 'density',
			zoom: 999
		});
		expect(result.isValid).toBe(true);
		expect((result.parameters as Record<string, number>).zoom).toBe(5);
	});

	test('rejects extra parameters', () => {
		const result = validateParameters('tinkerbell', { ...valid, extra: 42 });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toContain('extra');
	});

	test('warns when a shape parameter is outside the stable range', () => {
		const result = checkParameterStability('tinkerbell', { ...valid, a: 99 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/a \(99\)/);
	});

	test('classic defaults are stable', () => {
		expect(checkParameterStability('tinkerbell', valid).isStable).toBe(true);
	});
});

describe('gumowski-mira validation', () => {
	const valid = {
		type: 'gumowski-mira' as const,
		mu: -0.2,
		a: 0.008,
		b: 0.05,
		x0: 0.1,
		y0: 0,
		iterations: 50000,
		burnIn: 1000
	};

	test('accepts a valid minimal config', () => {
		const result = validateParameters('gumowski-mira', valid);
		expect(result.isValid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test('accepts optional render fields with valid values', () => {
		const result = validateParameters('gumowski-mira', {
			...valid,
			renderMode: 'multi',
			seeds: 250,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6
		});
		expect(result.isValid).toBe(true);
	});

	test('rejects an invalid colorMode enum value', () => {
		const result = validateParameters('gumowski-mira', {
			...valid,
			colorMode: 'rainbow'
		});
		expect(result.isValid).toBe(false);
	});

	test('rejects an invalid renderMode enum value', () => {
		const result = validateParameters('gumowski-mira', {
			...valid,
			renderMode: 'all'
		});
		expect(result.isValid).toBe(false);
	});

	test('rejects a missing required field (burnIn)', () => {
		const { burnIn, ...missingBurnIn } = valid;
		void burnIn;
		const result = validateParameters('gumowski-mira', missingBurnIn);
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toContain('burnIn');
	});

	test('rejects non-numeric mu', () => {
		const result = validateParameters('gumowski-mira', { ...valid, mu: 'flat' });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toMatch(/must be a valid number/);
	});

	test('rejects NaN in a core field', () => {
		const result = validateParameters('gumowski-mira', { ...valid, a: NaN });
		expect(result.isValid).toBe(false);
	});

	test('rejects extra parameters', () => {
		const result = validateParameters('gumowski-mira', { ...valid, extra: 42 });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toContain('extra');
	});

	test('clamps pointSize above max (6) to 6', () => {
		const result = validateParameters('gumowski-mira', { ...valid, pointSize: 10 });
		expect(result.isValid).toBe(true);
		expect(result.parameters?.pointSize).toBe(6);
	});

	test('clamps pointSize below min (0.5) to 0.5', () => {
		const result = validateParameters('gumowski-mira', { ...valid, pointSize: 0.1 });
		expect(result.isValid).toBe(true);
		expect(result.parameters?.pointSize).toBe(0.5);
	});

	test('clamps opacity below min (0) to 0', () => {
		const result = validateParameters('gumowski-mira', { ...valid, opacity: -0.5 });
		expect(result.isValid).toBe(true);
		expect(result.parameters?.opacity).toBe(0);
	});

	test('clamps opacity above max (1) to 1', () => {
		const result = validateParameters('gumowski-mira', { ...valid, opacity: 1.5 });
		expect(result.isValid).toBe(true);
		expect(result.parameters?.opacity).toBe(1);
	});

	test('clamps seeds above max (5000) to 5000', () => {
		const result = validateParameters('gumowski-mira', { ...valid, seeds: 10000 });
		expect(result.isValid).toBe(true);
		expect(result.parameters?.seeds).toBe(5000);
	});

	test('clamps seeds below min (1) to 1', () => {
		const result = validateParameters('gumowski-mira', { ...valid, seeds: 0 });
		expect(result.isValid).toBe(true);
		expect(result.parameters?.seeds).toBe(1);
	});

	test('still rejects NaN in optional numeric fields', () => {
		const result = validateParameters('gumowski-mira', { ...valid, pointSize: NaN });
		expect(result.isValid).toBe(false);
	});

	test('returns stable for in-range parameters', () => {
		const result = checkParameterStability('gumowski-mira', valid);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test('warns when mu is above stable range', () => {
		const result = checkParameterStability('gumowski-mira', { ...valid, mu: 2 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/mu/);
	});

	test('warns when mu is below stable range', () => {
		const result = checkParameterStability('gumowski-mira', { ...valid, mu: -2 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/mu/);
	});

	test('warns when b is outside stable range', () => {
		const result = checkParameterStability('gumowski-mira', { ...valid, b: 1 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/b/);
	});

	test('warns when x0 is outside stable range', () => {
		const result = checkParameterStability('gumowski-mira', { ...valid, x0: 100 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/x0/);
	});

	test('warns when iterations is above stable range', () => {
		const result = checkParameterStability('gumowski-mira', { ...valid, iterations: 999999 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/iterations/);
	});

	test('warns when a is outside stable range', () => {
		const result = checkParameterStability('gumowski-mira', { ...valid, a: 5 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/a/);
	});

	test('warns when y0 is outside stable range', () => {
		const result = checkParameterStability('gumowski-mira', { ...valid, y0: 100 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/y0/);
	});

	test('warns when burnIn is outside stable range', () => {
		const result = checkParameterStability('gumowski-mira', { ...valid, burnIn: 999999 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/burnIn/);
	});

	test('is stable for boundary values (min)', () => {
		const result = checkParameterStability('gumowski-mira', {
			type: 'gumowski-mira' as const,
			mu: -1,
			a: 0,
			b: 0,
			x0: -20,
			y0: -20,
			iterations: 1,
			burnIn: 0
		});
		expect(result.isStable).toBe(true);
	});

	test('is stable for boundary values (max)', () => {
		const result = checkParameterStability('gumowski-mira', {
			type: 'gumowski-mira' as const,
			mu: 1,
			a: 1,
			b: 0.5,
			x0: 20,
			y0: 20,
			iterations: 250000,
			burnIn: 10000
		});
		expect(result.isStable).toBe(true);
	});

	test('returns correct stable ranges', () => {
		const ranges = getStableRanges('gumowski-mira');
		expect(ranges).toBeDefined();
		expect(ranges?.mu).toEqual({ min: -1, max: 1 });
		expect(ranges?.a).toEqual({ min: 0, max: 1 });
		expect(ranges?.b).toEqual({ min: 0, max: 0.5 });
		expect(ranges?.x0).toEqual({ min: -20, max: 20 });
		expect(ranges?.y0).toEqual({ min: -20, max: 20 });
		expect(ranges?.iterations).toEqual({ min: 1, max: 250000 });
		expect(ranges?.burnIn).toEqual({ min: 0, max: 10000 });
	});

	test('is recognized as a valid map type', () => {
		expect(isValidMapType('gumowski-mira')).toBe(true);
	});
});

describe('bakers-map parameter validation', () => {
	const validParams = { type: 'bakers-map' as const, pointCount: 3000, speed: 1 };

	test('validates correct bakers-map parameters', () => {
		const result = validateParameters('bakers-map', validParams);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('rejects missing speed', () => {
		const result = validateParameters('bakers-map', { type: 'bakers-map', pointCount: 3000 });
		expect(result.isValid).toBe(false);
		expect(result.errors[0]).toContain('speed');
	});

	test('rejects missing pointCount', () => {
		const result = validateParameters('bakers-map', { type: 'bakers-map', speed: 1 });
		expect(result.isValid).toBe(false);
		expect(result.errors[0]).toContain('pointCount');
	});

	test('checkParameterStability reports out-of-range speed', () => {
		const result = checkParameterStability('bakers-map', {
			type: 'bakers-map',
			pointCount: 3000,
			speed: 100
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('speed'))).toBe(true);
	});

	test('checkParameterStability reports out-of-range pointCount', () => {
		const result = checkParameterStability('bakers-map', {
			type: 'bakers-map',
			pointCount: 999999,
			speed: 1
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('pointCount'))).toBe(true);
	});

	test('checkParameterStability passes for in-range values', () => {
		const result = checkParameterStability('bakers-map', validParams);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});
});

describe('arnold-cat parameter validation', () => {
	const validParams = { type: 'arnold-cat' as const, pointCount: 3000, speed: 5 };

	test('validates correct arnold-cat parameters', () => {
		const result = validateParameters('arnold-cat', validParams);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('rejects missing speed', () => {
		const result = validateParameters('arnold-cat', {
			type: 'arnold-cat',
			pointCount: 3000
		});
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('speed'))).toBe(true);
	});

	test('rejects missing pointCount', () => {
		const result = validateParameters('arnold-cat', { type: 'arnold-cat', speed: 5 });
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('pointCount'))).toBe(true);
	});

	test('checkParameterStability reports out-of-range speed', () => {
		const result = checkParameterStability('arnold-cat', {
			type: 'arnold-cat',
			pointCount: 3000,
			speed: 100
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('speed'))).toBe(true);
	});

	test('checkParameterStability reports out-of-range pointCount', () => {
		const result = checkParameterStability('arnold-cat', {
			type: 'arnold-cat',
			pointCount: 999999,
			speed: 5
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('pointCount'))).toBe(true);
	});

	test('checkParameterStability passes for in-range values', () => {
		const result = checkParameterStability('arnold-cat', validParams);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});
});
