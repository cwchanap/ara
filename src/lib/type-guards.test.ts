import { describe, test, expect } from 'bun:test';
import {
	isLorenzParameters,
	isHenonParameters,
	isRosslerParameters,
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
		expect(isLorenzParameters(null)).toBe(false);
		expect(isLorenzParameters(undefined)).toBe(false);
		expect(isLorenzParameters({} as ChaosMapParameters)).toBe(false);
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
		expect(isHenonParameters(null)).toBe(false);
		expect(isHenonParameters(undefined)).toBe(false);
		expect(isHenonParameters({} as ChaosMapParameters)).toBe(false);
	});

	test('isParametersOfType works with generic type', () => {
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};
		const rosslerParams: ChaosMapParameters = {
			type: 'rossler',
			a: 0.2,
			b: 0.2,
			c: 5.7
		};

		expect(isParametersOfType(lorenzParams, 'lorenz')).toBe(true);
		expect(isParametersOfType(lorenzParams, 'henon')).toBe(false);
		expect(isParametersOfType(rosslerParams, 'rossler')).toBe(true);
		expect(isParametersOfType(rosslerParams, 'lorenz')).toBe(false);
		expect(isParametersOfType(null, 'lorenz')).toBe(false);
		expect(isParametersOfType(undefined, 'henon')).toBe(false);
	});

	test('all type guards return false for mismatched types', () => {
		const rosslerParams: ChaosMapParameters = {
			type: 'rossler',
			a: 0.2,
			b: 0.2,
			c: 5.7
		};

		expect(isRosslerParameters(rosslerParams)).toBe(true);
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

	test('isRosslerParameters correctly identifies Rossler parameters', () => {
		const rosslerParams: ChaosMapParameters = { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 };
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};

		expect(isRosslerParameters(rosslerParams)).toBe(true);
		expect(isRosslerParameters(lorenzParams)).toBe(false);
		expect(isRosslerParameters(null)).toBe(false);
		expect(isRosslerParameters(undefined)).toBe(false);
	});

	test('isLogisticParameters correctly identifies Logistic parameters', () => {
		const logisticParams: ChaosMapParameters = {
			type: 'logistic',
			r: 3.9,
			x0: 0.1,
			iterations: 100
		};
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};

		expect(isLogisticParameters(logisticParams)).toBe(true);
		expect(isLogisticParameters(lorenzParams)).toBe(false);
		expect(isLogisticParameters(null)).toBe(false);
		expect(isLogisticParameters(undefined)).toBe(false);
	});

	test('isLoziParameters correctly identifies Lozi parameters', () => {
		const loziParams: ChaosMapParameters = {
			type: 'lozi',
			a: 1.7,
			b: 0.5,
			x0: 0,
			y0: 0,
			iterations: 2000
		};
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};

		expect(isLoziParameters(loziParams)).toBe(true);
		expect(isLoziParameters(lorenzParams)).toBe(false);
		expect(isLoziParameters(null)).toBe(false);
		expect(isLoziParameters(undefined)).toBe(false);
	});

	test('isNewtonParameters correctly identifies Newton parameters', () => {
		const newtonParams: ChaosMapParameters = {
			type: 'newton',
			xMin: -2,
			xMax: 2,
			yMin: -2,
			yMax: 2,
			maxIterations: 50
		};
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};

		expect(isNewtonParameters(newtonParams)).toBe(true);
		expect(isNewtonParameters(lorenzParams)).toBe(false);
		expect(isNewtonParameters(null)).toBe(false);
		expect(isNewtonParameters(undefined)).toBe(false);
	});

	test('isStandardParameters correctly identifies Standard map parameters', () => {
		const standardParams: ChaosMapParameters = {
			type: 'standard',
			k: 1,
			numP: 50,
			numQ: 50,
			iterations: 1000
		};
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};

		expect(isStandardParameters(standardParams)).toBe(true);
		expect(isStandardParameters(lorenzParams)).toBe(false);
		expect(isStandardParameters(null)).toBe(false);
		expect(isStandardParameters(undefined)).toBe(false);
	});

	test('isBifurcationLogisticParameters correctly identifies BifurcationLogistic parameters', () => {
		const bifParams: ChaosMapParameters = {
			type: 'bifurcation-logistic',
			rMin: 2.5,
			rMax: 4.0,
			maxIterations: 1000
		};
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};

		expect(isBifurcationLogisticParameters(bifParams)).toBe(true);
		expect(isBifurcationLogisticParameters(lorenzParams)).toBe(false);
		expect(isBifurcationLogisticParameters(null)).toBe(false);
		expect(isBifurcationLogisticParameters(undefined)).toBe(false);
	});

	test('isBifurcationHenonParameters correctly identifies BifurcationHenon parameters', () => {
		const bifParams: ChaosMapParameters = {
			type: 'bifurcation-henon',
			aMin: 0.8,
			aMax: 1.4,
			b: 0.3,
			maxIterations: 500
		};
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};

		expect(isBifurcationHenonParameters(bifParams)).toBe(true);
		expect(isBifurcationHenonParameters(lorenzParams)).toBe(false);
		expect(isBifurcationHenonParameters(null)).toBe(false);
		expect(isBifurcationHenonParameters(undefined)).toBe(false);
	});

	test('isChaosEsthetiqueParameters correctly identifies ChaosEsthetique parameters', () => {
		const ceParams: ChaosMapParameters = {
			type: 'chaos-esthetique',
			a: 1.4,
			b: 0.3,
			x0: 0,
			y0: 0,
			iterations: 10000
		};
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};

		expect(isChaosEsthetiqueParameters(ceParams)).toBe(true);
		expect(isChaosEsthetiqueParameters(lorenzParams)).toBe(false);
		expect(isChaosEsthetiqueParameters(null)).toBe(false);
		expect(isChaosEsthetiqueParameters(undefined)).toBe(false);
	});

	test('isLyapunovParameters correctly identifies Lyapunov parameters', () => {
		const lyapunovParams: ChaosMapParameters = {
			type: 'lyapunov',
			rMin: 2.5,
			rMax: 4.0,
			iterations: 500,
			transientIterations: 200
		};
		const lorenzParams: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};

		expect(isLyapunovParameters(lyapunovParams)).toBe(true);
		expect(isLyapunovParameters(lorenzParams)).toBe(false);
		expect(isLyapunovParameters(null)).toBe(false);
		expect(isLyapunovParameters(undefined)).toBe(false);
	});
});
