import { describe, test, expect } from 'vitest';
import { isChuaParameters } from './type-guards';
import type { ChaosMapParameters } from './types';

describe('isChuaParameters (vitest)', () => {
	test('returns true for chua parameters', () => {
		const params: ChaosMapParameters = {
			type: 'chua',
			alpha: 15.6,
			beta: 28,
			gamma: 0,
			a: -8 / 7,
			b: -5 / 7
		};
		expect(isChuaParameters(params)).toBe(true);
	});

	test('returns false for non-chua parameters', () => {
		const params: ChaosMapParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.667
		};
		expect(isChuaParameters(params)).toBe(false);
	});

	test('returns false for null and undefined', () => {
		expect(isChuaParameters(null)).toBe(false);
		expect(isChuaParameters(undefined)).toBe(false);
	});
});
