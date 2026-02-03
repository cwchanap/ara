import { describe, test, expect } from 'bun:test';
import {
	isLorenzParameters,
	isHenonParameters,
	isLogisticParameters,
	isLoziParameters,
	isNewtonParameters,
	isStandardParameters,
	isBifurcationLogisticParameters,
	isBifurcationHenonParameters,
	isChaosEsthetiqueParameters,
	isLyapunovParameters,
	isParametersOfType
} from './type-guards';
import type { ChaosMapParameters } from './types';

describe('Type Guards', () => {
	test('isLorenzParameters correctly identifies Lorenz parameters', () => {
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};
		const henonParams: ChaosMapParameters = {
			type: 'henon',
			a: 1.4,
			b: 0.3,
			iterations: 2000
		};

		expect(isLorenzParameters(lorenzParams)).toBe(true);
		expect(isLorenzParameters(henonParams)).toBe(false);
	});

	test('isHenonParameters correctly identifies Henon parameters', () => {
		const henonParams: ChaosMapParameters = {
			type: 'henon',
			a: 1.4,
			b: 0.3,
			iterations: 2000
		};
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};

		expect(isHenonParameters(henonParams)).toBe(true);
		expect(isHenonParameters(lorenzParams)).toBe(false);
	});

	test('isParametersOfType works with generic type', () => {
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};

		expect(isParametersOfType(lorenzParams, 'lorenz')).toBe(true);
		expect(isParametersOfType(lorenzParams, 'henon')).toBe(false);
	});

	test('all type guards return false for mismatched types', () => {
		const rosslerParams: ChaosMapParameters = {
			type: 'rossler',
			a: 0.2,
			b: 0.2,
			c: 5.7
		};

		expect(isLorenzParameters(rosslerParams)).toBe(false);
		expect(isHenonParameters(rosslerParams)).toBe(false);
		expect(isLogisticParameters(rosslerParams)).toBe(false);
		expect(isLoziParameters(rosslerParams)).toBe(false);
		expect(isNewtonParameters(rosslerParams)).toBe(false);
		expect(isStandardParameters(rosslerParams)).toBe(false);
		expect(isBifurcationLogisticParameters(rosslerParams)).toBe(false);
		expect(isBifurcationHenonParameters(rosslerParams)).toBe(false);
		expect(isChaosEsthetiqueParameters(rosslerParams)).toBe(false);
		expect(isLyapunovParameters(rosslerParams)).toBe(false);
	});
});
