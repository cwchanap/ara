import { describe, expect, it } from 'vitest';
import { checkParameterStability, validateParameters } from './chaos-validation';

describe('checkParameterStability – newton', () => {
	it('returns stable when xMin < xMax and yMin < yMax', () => {
		const result = checkParameterStability('newton', {
			type: 'newton',
			xMin: -2,
			xMax: 2,
			yMin: -2,
			yMax: 2,
			maxIterations: 50
		});
		expect(result.isStable).toBe(true);
		expect(result.warnings).toEqual([]);
	});

	it('warns when xMin >= xMax', () => {
		const result = checkParameterStability('newton', {
			type: 'newton',
			xMin: 2,
			xMax: -2,
			yMin: -2,
			yMax: 2,
			maxIterations: 50
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings).toContain('xMin must be less than xMax');
	});

	it('warns when xMin equals xMax', () => {
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

	it('warns when yMin >= yMax', () => {
		const result = checkParameterStability('newton', {
			type: 'newton',
			xMin: -2,
			xMax: 2,
			yMin: 2,
			yMax: -2,
			maxIterations: 50
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings).toContain('yMin must be less than yMax');
	});

	it('warns for both xMin >= xMax and yMin >= yMax simultaneously', () => {
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

describe('checkParameterStability – bifurcation-logistic', () => {
	it('returns stable when rMin < rMax', () => {
		const result = checkParameterStability('bifurcation-logistic', {
			type: 'bifurcation-logistic',
			rMin: 2.5,
			rMax: 4.0,
			maxIterations: 1000
		});
		expect(result.isStable).toBe(true);
		expect(result.warnings).toEqual([]);
	});

	it('warns when rMin >= rMax', () => {
		const result = checkParameterStability('bifurcation-logistic', {
			type: 'bifurcation-logistic',
			rMin: 4.0,
			rMax: 2.5,
			maxIterations: 1000
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings).toContain('rMin must be less than rMax');
	});

	it('warns when rMin equals rMax', () => {
		const result = checkParameterStability('bifurcation-logistic', {
			type: 'bifurcation-logistic',
			rMin: 3.0,
			rMax: 3.0,
			maxIterations: 1000
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings).toContain('rMin must be less than rMax');
	});
});

describe('checkParameterStability – invalid parameters propagation', () => {
	it('returns isStable=false and propagates validation errors when params are structurally invalid', () => {
		// Missing required keys → validateParameters returns isValid: false
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = checkParameterStability('lorenz', { type: 'lorenz', sigma: 10 } as any);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('Missing required parameters'))).toBe(true);
	});

	it('propagates non-number parameter errors', () => {
		const result = checkParameterStability('lorenz', {
			type: 'lorenz',
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			sigma: 'bad' as any,
			rho: 28,
			beta: 2.667
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('sigma'))).toBe(true);
	});
});

describe('validateParameters – edge cases', () => {
	it('handles standard map with uppercase K via backward-compat normalization', () => {
		const result = validateParameters('standard', {
			K: 0.97,
			numP: 20,
			numQ: 20,
			iterations: 20000
		});
		expect(result.isValid).toBe(true);
	});

	it('returns invalid for params that are not an object', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = validateParameters('lorenz', 'not-an-object' as any);
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain('Parameters must be an object');
	});

	it('returns invalid for null params', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = validateParameters('lorenz', null as any);
		expect(result.isValid).toBe(false);
	});

	it('returns invalid when extra keys are present', () => {
		const badParams = { sigma: 10, rho: 28, beta: 2.667, extraKey: 1 };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = validateParameters('lorenz', badParams as any);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('extraKey'))).toBe(true);
	});

	it('returns invalid for unknown map type', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = validateParameters('unknown-type' as any, { sigma: 10 });
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('Unknown map type'))).toBe(true);
	});
});
