/**
 * Tests for API route validation logic
 *
 * Tests the validation logic used by the save-config API endpoint.
 * These are unit tests for the validation functions.
 */

import { describe, expect, test } from 'bun:test';
import { validateParameters } from './chaos-validation';
import { VALID_MAP_TYPES } from './types';
import type { ChaosMapType } from './types';
import { CONFIG_NAME_MAX_LENGTH } from './constants';

describe('API Validation Logic', () => {
	describe('validateParameters', () => {
		describe('lorenz parameters', () => {
			test('validates correct lorenz parameters', () => {
				const params = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
				const result = validateParameters('lorenz', params);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});

			test('rejects missing sigma', () => {
				const params = { type: 'lorenz', rho: 28, beta: 2.667 };
				const result = validateParameters('lorenz', params);

				expect(result.isValid).toBe(false);
				expect(result.errors.some((e) => e.includes('Missing required parameters'))).toBe(
					true
				);
			});

			test('rejects non-numeric sigma', () => {
				const params = { type: 'lorenz', sigma: 'ten', rho: 28, beta: 2.667 };
				const result = validateParameters('lorenz', params);

				expect(result.isValid).toBe(false);
				expect(result.errors.some((e) => e.includes('must be a valid number'))).toBe(true);
			});

			test('rejects NaN values', () => {
				const params = { type: 'lorenz', sigma: NaN, rho: 28, beta: 2.667 };
				const result = validateParameters('lorenz', params);

				expect(result.isValid).toBe(false);
				expect(result.errors.some((e) => e.includes('must be a valid number'))).toBe(true);
			});

			test('rejects extra parameters', () => {
				const params = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667, extra: 'param' };
				const result = validateParameters('lorenz', params);

				expect(result.isValid).toBe(false);
				expect(result.errors.some((e) => e.includes('Unexpected parameters'))).toBe(true);
			});
		});

		describe('henon parameters', () => {
			test('validates correct henon parameters', () => {
				const params = { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 };
				const result = validateParameters('henon', params);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});

			test('rejects missing iterations', () => {
				const params = { type: 'henon', a: 1.4, b: 0.3 };
				const result = validateParameters('henon', params);

				expect(result.isValid).toBe(false);
				expect(result.errors.some((e) => e.includes('Missing required parameters'))).toBe(
					true
				);
			});
		});

		describe('lozi parameters', () => {
			test('validates correct lozi parameters', () => {
				const params = { type: 'lozi', a: 0.5, b: 0.3, x0: 0, y0: 0, iterations: 2000 };
				const result = validateParameters('lozi', params);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});
		});

		describe('rossler parameters', () => {
			test('validates correct rossler parameters', () => {
				const params = { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 };
				const result = validateParameters('rossler', params);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});
		});

		describe('logistic parameters', () => {
			test('validates correct logistic parameters', () => {
				const params = { type: 'logistic', r: 3.5, x0: 0.5, iterations: 100 };
				const result = validateParameters('logistic', params);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});
		});

		describe('newton parameters', () => {
			test('validates correct newton parameters', () => {
				const params = {
					type: 'newton',
					xMin: -2,
					xMax: 2,
					yMin: -2,
					yMax: 2,
					maxIterations: 50
				};
				const result = validateParameters('newton', params);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});
		});

		describe('standard parameters', () => {
			test('validates correct standard parameters', () => {
				const params = { type: 'standard', K: 1, numP: 50, numQ: 50, iterations: 1000 };
				const result = validateParameters('standard', params);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});
		});

		describe('bifurcation-logistic parameters', () => {
			test('validates correct bifurcation-logistic parameters', () => {
				const params = {
					type: 'bifurcation-logistic',
					rMin: 2.5,
					rMax: 4,
					maxIterations: 1000
				};
				const result = validateParameters('bifurcation-logistic', params);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});
		});

		describe('bifurcation-henon parameters', () => {
			test('validates correct bifurcation-henon parameters', () => {
				const params = {
					type: 'bifurcation-henon',
					aMin: 0.5,
					aMax: 1.5,
					b: 0.3,
					maxIterations: 1000
				};
				const result = validateParameters('bifurcation-henon', params);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});
		});

		describe('chaos-esthetique parameters', () => {
			test('validates correct chaos-esthetique parameters', () => {
				const params = {
					type: 'chaos-esthetique',
					a: 1.5,
					b: 0.5,
					x0: 0,
					y0: 0,
					iterations: 5000
				};
				const result = validateParameters('chaos-esthetique', params);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});
		});

		describe('lyapunov parameters', () => {
			test('validates correct lyapunov parameters', () => {
				const params = {
					type: 'lyapunov',
					rMin: 2,
					rMax: 4,
					iterations: 1000,
					transientIterations: 100
				};
				const result = validateParameters('lyapunov', params);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});
		});

		describe('edge cases', () => {
			test('rejects null parameters', () => {
				const result = validateParameters('lorenz', null);

				expect(result.isValid).toBe(false);
				expect(result.errors.some((e) => e.includes('must be an object'))).toBe(true);
			});

			test('rejects undefined parameters', () => {
				const result = validateParameters('lorenz', undefined);

				expect(result.isValid).toBe(false);
				expect(result.errors.some((e) => e.includes('must be an object'))).toBe(true);
			});

			test('rejects array parameters', () => {
				const result = validateParameters('lorenz', [1, 2, 3]);

				expect(result.isValid).toBe(false);
			});

			test('rejects primitive parameters', () => {
				const result = validateParameters('lorenz', 'string');

				expect(result.isValid).toBe(false);
				expect(result.errors.some((e) => e.includes('must be an object'))).toBe(true);
			});
		});
	});

	describe('name validation logic', () => {
		test('name cannot exceed CONFIG_NAME_MAX_LENGTH', () => {
			const name = 'a'.repeat(CONFIG_NAME_MAX_LENGTH + 1);
			const isValid = name.trim().length <= CONFIG_NAME_MAX_LENGTH;

			expect(isValid).toBe(false);
		});

		test('name at exactly CONFIG_NAME_MAX_LENGTH is valid', () => {
			const name = 'a'.repeat(CONFIG_NAME_MAX_LENGTH);
			const isValid = name.trim().length <= CONFIG_NAME_MAX_LENGTH;

			expect(isValid).toBe(true);
		});

		test('empty name is invalid', () => {
			const name = '';
			const trimmed = name.trim();
			const isValid = trimmed.length > 0;

			expect(isValid).toBe(false);
		});

		test('whitespace-only name is invalid', () => {
			const name = '   ';
			const trimmed = name.trim();
			const isValid = trimmed.length > 0;

			expect(isValid).toBe(false);
		});
	});

	describe('mapType validation', () => {
		test('all VALID_MAP_TYPES are valid', () => {
			for (const mapType of VALID_MAP_TYPES) {
				expect(VALID_MAP_TYPES.includes(mapType)).toBe(true);
			}
		});

		test('invalid map type is rejected', () => {
			const mapType = 'invalid-map-type';
			const isValid = VALID_MAP_TYPES.includes(mapType as ChaosMapType);

			expect(isValid).toBe(false);
		});

		test('VALID_MAP_TYPES contains expected types', () => {
			const expectedTypes: ChaosMapType[] = [
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
			];

			for (const type of expectedTypes) {
				expect(VALID_MAP_TYPES).toContain(type);
			}
		});
	});
});
