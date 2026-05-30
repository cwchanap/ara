import { describe, expect, test } from 'bun:test';
import { checkParameterStability, getStableRanges, isValidMapType } from './chaos-validation';
import { getDefaultParameters } from './comparison-url-state';
import type { ChuaParameters } from './types';

describe('chua validation', () => {
	test('chua is a valid map type', () => {
		expect(isValidMapType('chua')).toBe(true);
	});

	test('has stable ranges for all five math params', () => {
		const ranges = getStableRanges('chua');
		expect(ranges).toBeDefined();
		expect(Object.keys(ranges ?? {}).sort()).toEqual(['a', 'alpha', 'b', 'beta', 'gamma']);
	});

	test('classic double-scroll parameters are stable', () => {
		const params: ChuaParameters = {
			type: 'chua',
			alpha: 15.6,
			beta: 28,
			gamma: 0,
			a: -8 / 7,
			b: -5 / 7
		};
		expect(checkParameterStability('chua', params).isStable).toBe(true);
	});

	test('out-of-range alpha produces a warning', () => {
		const params: ChuaParameters = {
			type: 'chua',
			alpha: 100,
			beta: 28,
			gamma: 0,
			a: -8 / 7,
			b: -5 / 7
		};
		const result = checkParameterStability('chua', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toContain('alpha');
	});

	test('getDefaultParameters returns the classic preset', () => {
		const params = getDefaultParameters('chua') as ChuaParameters;
		expect(params.type).toBe('chua');
		expect(params.alpha).toBeCloseTo(15.6, 5);
		expect(params.beta).toBeCloseTo(28, 5);
		expect(params.gamma).toBe(0);
		expect(params.a).toBeCloseTo(-8 / 7, 5);
		expect(params.b).toBeCloseTo(-5 / 7, 5);
	});
});
