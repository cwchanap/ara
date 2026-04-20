import { describe, expect, it } from 'vitest';
import { checkParameterStability, isValidMapType } from './chaos-validation';

describe('checkParameterStability', () => {
	describe('bifurcation-henon', () => {
		it('returns stable when aMin < aMax', () => {
			const result = checkParameterStability('bifurcation-henon', {
				type: 'bifurcation-henon',
				aMin: 0.8,
				aMax: 1.2,
				b: 0.3,
				maxIterations: 1000
			});
			expect(result.isStable).toBe(true);
			expect(result.warnings).toEqual([]);
		});

		it('warns when aMin >= aMax', () => {
			const result = checkParameterStability('bifurcation-henon', {
				type: 'bifurcation-henon',
				aMin: 1.2,
				aMax: 0.8,
				b: 0.3,
				maxIterations: 1000
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('aMin must be less than aMax');
		});

		it('warns when aMin equals aMax', () => {
			const result = checkParameterStability('bifurcation-henon', {
				type: 'bifurcation-henon',
				aMin: 1.0,
				aMax: 1.0,
				b: 0.3,
				maxIterations: 1000
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('aMin must be less than aMax');
		});
	});

	describe('lyapunov', () => {
		it('returns stable when rMin < rMax and transientIterations <= iterations', () => {
			const result = checkParameterStability('lyapunov', {
				type: 'lyapunov',
				rMin: 2.0,
				rMax: 3.5,
				transientIterations: 100,
				iterations: 500
			});
			expect(result.isStable).toBe(true);
			expect(result.warnings).toEqual([]);
		});

		it('warns when rMin >= rMax', () => {
			const result = checkParameterStability('lyapunov', {
				type: 'lyapunov',
				rMin: 3.5,
				rMax: 2.0,
				transientIterations: 100,
				iterations: 500
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('rMin must be less than rMax');
		});

		it('warns when transientIterations > iterations', () => {
			const result = checkParameterStability('lyapunov', {
				type: 'lyapunov',
				rMin: 2.0,
				rMax: 3.5,
				transientIterations: 600,
				iterations: 500
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('transientIterations must be <= iterations');
		});

		it('warns on both rMin >= rMax and transientIterations > iterations', () => {
			const result = checkParameterStability('lyapunov', {
				type: 'lyapunov',
				rMin: 3.5,
				rMax: 2.0,
				transientIterations: 600,
				iterations: 500
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings).toContain('rMin must be less than rMax');
			expect(result.warnings).toContain('transientIterations must be <= iterations');
		});
	});

	describe('lorenz', () => {
		it('returns stable for typical lorenz params', () => {
			const result = checkParameterStability('lorenz', {
				type: 'lorenz',
				sigma: 10,
				rho: 28,
				beta: 2.667
			});
			expect(result.isStable).toBe(true);
		});

		it('warns when sigma is out of range', () => {
			const result = checkParameterStability('lorenz', {
				type: 'lorenz',
				sigma: 100,
				rho: 28,
				beta: 2.667
			});
			expect(result.isStable).toBe(false);
			expect(result.warnings.some((w) => w.includes('sigma'))).toBe(true);
		});
	});
});

describe('isValidMapType', () => {
	it('returns true for valid map types', () => {
		expect(isValidMapType('lorenz')).toBe(true);
		expect(isValidMapType('henon')).toBe(true);
		expect(isValidMapType('rossler')).toBe(true);
		expect(isValidMapType('lozi')).toBe(true);
		expect(isValidMapType('logistic')).toBe(true);
		expect(isValidMapType('newton')).toBe(true);
		expect(isValidMapType('standard')).toBe(true);
		expect(isValidMapType('lyapunov')).toBe(true);
		expect(isValidMapType('bifurcation-logistic')).toBe(true);
		expect(isValidMapType('bifurcation-henon')).toBe(true);
		expect(isValidMapType('chaos-esthetique')).toBe(true);
	});

	it('returns false for unknown map types', () => {
		expect(isValidMapType('unknown')).toBe(false);
		expect(isValidMapType('')).toBe(false);
		expect(isValidMapType('LORENZ')).toBe(false);
	});
});
