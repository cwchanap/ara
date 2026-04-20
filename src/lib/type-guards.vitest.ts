import { describe, expect, it } from 'vitest';
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

const lorenz: ChaosMapParameters = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
const henon: ChaosMapParameters = { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 };
const rossler: ChaosMapParameters = { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 };
const logistic: ChaosMapParameters = { type: 'logistic', r: 3.9, x0: 0.1, iterations: 100 };
const lozi: ChaosMapParameters = { type: 'lozi', a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 2000 };
const newton: ChaosMapParameters = {
	type: 'newton',
	xMin: -2,
	xMax: 2,
	yMin: -2,
	yMax: 2,
	maxIterations: 50
};
const standard: ChaosMapParameters = {
	type: 'standard',
	k: 1,
	numP: 50,
	numQ: 50,
	iterations: 1000
};
const bifLogistic: ChaosMapParameters = {
	type: 'bifurcation-logistic',
	rMin: 2.5,
	rMax: 4.0,
	maxIterations: 1000
};
const bifHenon: ChaosMapParameters = {
	type: 'bifurcation-henon',
	aMin: 0.8,
	aMax: 1.4,
	b: 0.3,
	maxIterations: 500
};
const chaosEst: ChaosMapParameters = {
	type: 'chaos-esthetique',
	a: 1.4,
	b: 0.3,
	x0: 0,
	y0: 0,
	iterations: 10000
};
const lyapunov: ChaosMapParameters = {
	type: 'lyapunov',
	rMin: 2.5,
	rMax: 4.0,
	iterations: 500,
	transientIterations: 200
};

describe('isLorenzParameters', () => {
	it('returns true for lorenz params', () => expect(isLorenzParameters(lorenz)).toBe(true));
	it('returns false for henon params', () => expect(isLorenzParameters(henon)).toBe(false));
	it('returns false for null', () => expect(isLorenzParameters(null)).toBe(false));
	it('returns false for undefined', () => expect(isLorenzParameters(undefined)).toBe(false));
});

describe('isHenonParameters', () => {
	it('returns true for henon params', () => expect(isHenonParameters(henon)).toBe(true));
	it('returns false for lorenz params', () => expect(isHenonParameters(lorenz)).toBe(false));
	it('returns false for null', () => expect(isHenonParameters(null)).toBe(false));
	it('returns false for undefined', () => expect(isHenonParameters(undefined)).toBe(false));
});

describe('isRosslerParameters', () => {
	it('returns true for rossler params', () => expect(isRosslerParameters(rossler)).toBe(true));
	it('returns false for lorenz params', () => expect(isRosslerParameters(lorenz)).toBe(false));
	it('returns false for null', () => expect(isRosslerParameters(null)).toBe(false));
	it('returns false for undefined', () => expect(isRosslerParameters(undefined)).toBe(false));
});

describe('isLogisticParameters', () => {
	it('returns true for logistic params', () => expect(isLogisticParameters(logistic)).toBe(true));
	it('returns false for lorenz params', () => expect(isLogisticParameters(lorenz)).toBe(false));
	it('returns false for null', () => expect(isLogisticParameters(null)).toBe(false));
	it('returns false for undefined', () => expect(isLogisticParameters(undefined)).toBe(false));
});

describe('isLoziParameters', () => {
	it('returns true for lozi params', () => expect(isLoziParameters(lozi)).toBe(true));
	it('returns false for lorenz params', () => expect(isLoziParameters(lorenz)).toBe(false));
	it('returns false for null', () => expect(isLoziParameters(null)).toBe(false));
	it('returns false for undefined', () => expect(isLoziParameters(undefined)).toBe(false));
});

describe('isNewtonParameters', () => {
	it('returns true for newton params', () => expect(isNewtonParameters(newton)).toBe(true));
	it('returns false for lorenz params', () => expect(isNewtonParameters(lorenz)).toBe(false));
	it('returns false for null', () => expect(isNewtonParameters(null)).toBe(false));
	it('returns false for undefined', () => expect(isNewtonParameters(undefined)).toBe(false));
});

describe('isStandardParameters', () => {
	it('returns true for standard params', () => expect(isStandardParameters(standard)).toBe(true));
	it('returns false for lorenz params', () => expect(isStandardParameters(lorenz)).toBe(false));
	it('returns false for null', () => expect(isStandardParameters(null)).toBe(false));
	it('returns false for undefined', () => expect(isStandardParameters(undefined)).toBe(false));
});

describe('isBifurcationLogisticParameters', () => {
	it('returns true for bifurcation-logistic params', () =>
		expect(isBifurcationLogisticParameters(bifLogistic)).toBe(true));
	it('returns false for lorenz params', () =>
		expect(isBifurcationLogisticParameters(lorenz)).toBe(false));
	it('returns false for null', () => expect(isBifurcationLogisticParameters(null)).toBe(false));
	it('returns false for undefined', () =>
		expect(isBifurcationLogisticParameters(undefined)).toBe(false));
});

describe('isBifurcationHenonParameters', () => {
	it('returns true for bifurcation-henon params', () =>
		expect(isBifurcationHenonParameters(bifHenon)).toBe(true));
	it('returns false for lorenz params', () =>
		expect(isBifurcationHenonParameters(lorenz)).toBe(false));
	it('returns false for null', () => expect(isBifurcationHenonParameters(null)).toBe(false));
	it('returns false for undefined', () =>
		expect(isBifurcationHenonParameters(undefined)).toBe(false));
});

describe('isChaosEsthetiqueParameters', () => {
	it('returns true for chaos-esthetique params', () =>
		expect(isChaosEsthetiqueParameters(chaosEst)).toBe(true));
	it('returns false for lorenz params', () =>
		expect(isChaosEsthetiqueParameters(lorenz)).toBe(false));
	it('returns false for null', () => expect(isChaosEsthetiqueParameters(null)).toBe(false));
	it('returns false for undefined', () =>
		expect(isChaosEsthetiqueParameters(undefined)).toBe(false));
});

describe('isLyapunovParameters', () => {
	it('returns true for lyapunov params', () => expect(isLyapunovParameters(lyapunov)).toBe(true));
	it('returns false for lorenz params', () => expect(isLyapunovParameters(lorenz)).toBe(false));
	it('returns false for null', () => expect(isLyapunovParameters(null)).toBe(false));
	it('returns false for undefined', () => expect(isLyapunovParameters(undefined)).toBe(false));
});

describe('isParametersOfType', () => {
	it('returns true when type matches', () =>
		expect(isParametersOfType(lorenz, 'lorenz')).toBe(true));
	it('returns false when type does not match', () =>
		expect(isParametersOfType(lorenz, 'henon')).toBe(false));
	it('returns true for each type', () => {
		expect(isParametersOfType(henon, 'henon')).toBe(true);
		expect(isParametersOfType(rossler, 'rossler')).toBe(true);
		expect(isParametersOfType(logistic, 'logistic')).toBe(true);
		expect(isParametersOfType(lozi, 'lozi')).toBe(true);
		expect(isParametersOfType(newton, 'newton')).toBe(true);
		expect(isParametersOfType(standard, 'standard')).toBe(true);
		expect(isParametersOfType(bifLogistic, 'bifurcation-logistic')).toBe(true);
		expect(isParametersOfType(bifHenon, 'bifurcation-henon')).toBe(true);
		expect(isParametersOfType(chaosEst, 'chaos-esthetique')).toBe(true);
		expect(isParametersOfType(lyapunov, 'lyapunov')).toBe(true);
	});
	it('returns false for null', () => expect(isParametersOfType(null, 'lorenz')).toBe(false));
	it('returns false for undefined', () =>
		expect(isParametersOfType(undefined, 'lorenz')).toBe(false));
});
