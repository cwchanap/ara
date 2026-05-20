import { describe, expect, it } from 'vitest';
import {
	validateParameters,
	checkParameterStability,
	getStableRanges,
	isValidMapType
} from './chaos-validation';

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
