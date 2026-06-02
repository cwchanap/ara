/**
 * Additional tests for chaos-validation.ts
 *
 * Covers gaps in chaos-validation.test.ts:
 * - validateParameters for newton (no tests there)
 * - validateParameters for standard (only backward-compat tests)
 * - validateParameters for chaos-esthetique (no tests there)
 * - checkParameterStability for newton (only xMin/xMax, missing yMin/yMax, maxIterations)
 * - checkParameterStability for standard (missing numP, numQ, iterations stability)
 * - checkParameterStability for chaos-esthetique (more scenarios)
 * - Infinity and -Infinity parameter values
 * - getStableRanges for standard, newton, chaos-esthetique
 */

import { describe, expect, test } from 'bun:test';
import {
	validateParameters,
	checkParameterStability,
	getStableRanges,
	isValidMapType
} from './chaos-validation';

// ── validateParameters for newton ────────────────────────────────────────────

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
