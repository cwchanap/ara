import { describe, expect, test } from 'bun:test';
import {
	validateParameters,
	checkParameterStability,
	isValidMapType,
	getStableRanges
} from './chaos-validation';

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
	test('returns warnings when K is outside stable range', () => {
		const params = {
			type: 'standard' as const,
			K: 20,
			numP: 10,
			numQ: 10,
			iterations: 20000
		};
		const result = checkParameterStability('standard', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('K'))).toBe(true);
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
