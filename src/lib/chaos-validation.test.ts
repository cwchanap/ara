import { describe, expect, test } from 'bun:test';
import {
	validateParameters,
	checkParameterStability,
	isValidMapType,
	getStableRanges
} from './chaos-validation';

describe('validateParameters for rossler', () => {
	test('returns valid for correct rossler parameters', () => {
		const params = { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 };
		const result = validateParameters('rossler', params);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('returns invalid for missing parameters', () => {
		const params = { type: 'rossler', a: 0.2, b: 0.2 }; // missing c
		const result = validateParameters('rossler', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('c'))).toBe(true);
	});

	test('returns invalid for non-numeric parameters', () => {
		const params = { type: 'rossler', a: 'not a number', b: 0.2, c: 5.7 };
		const result = validateParameters('rossler', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('a'))).toBe(true);
	});

	test('returns invalid for NaN parameters', () => {
		const params = { type: 'rossler', a: NaN, b: 0.2, c: 5.7 };
		const result = validateParameters('rossler', params);
		expect(result.isValid).toBe(false);
	});

	test('returns invalid for extra parameters', () => {
		const params = { type: 'rossler', a: 0.2, b: 0.2, c: 5.7, extra: 123 };
		const result = validateParameters('rossler', params);
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('extra'))).toBe(true);
	});
});

describe('checkParameterStability for rossler', () => {
	test('returns stable for classic parameters', () => {
		const params = { type: 'rossler' as const, a: 0.2, b: 0.2, c: 5.7 };
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test('returns warnings for a below stable range (a < 0.126)', () => {
		const params = { type: 'rossler' as const, a: 0.05, b: 0.2, c: 5.7 }; // a < 0.126
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('a'))).toBe(true);
	});

	test('returns warnings for a above stable range (a > 0.43295)', () => {
		const params = { type: 'rossler' as const, a: 0.5, b: 0.2, c: 5.7 }; // a > 0.43295
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('a'))).toBe(true);
	});

	test('returns warnings for b below stable range (b < 0.01)', () => {
		const params = { type: 'rossler' as const, a: 0.2, b: 0.005, c: 5.7 }; // b < 0.01
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('b'))).toBe(true);
	});

	test('returns warnings for b above stable range (b > 2)', () => {
		const params = { type: 'rossler' as const, a: 0.2, b: 2.5, c: 5.7 }; // b > 2
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('b'))).toBe(true);
	});

	test('returns warnings for c below stable range (c < 1)', () => {
		const params = { type: 'rossler' as const, a: 0.2, b: 0.2, c: 0.5 }; // c < 1
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('c'))).toBe(true);
	});

	test('returns warnings for c above stable range (c > 30)', () => {
		const params = { type: 'rossler' as const, a: 0.2, b: 0.2, c: 35 }; // c > 30
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('c'))).toBe(true);
	});

	test('returns stable for boundary values', () => {
		const params = { type: 'rossler' as const, a: 0.126, b: 0.01, c: 1 };
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(true);
	});

	test('returns stable for max boundary values', () => {
		const params = { type: 'rossler' as const, a: 0.43295, b: 2, c: 30 };
		const result = checkParameterStability('rossler', params);
		expect(result.isStable).toBe(true);
	});
});

describe('isValidMapType for rossler', () => {
	test('returns true for rossler', () => {
		expect(isValidMapType('rossler')).toBe(true);
	});
});

describe('getStableRanges for rossler', () => {
	test('returns correct ranges for rossler', () => {
		const ranges = getStableRanges('rossler');
		expect(ranges).toBeDefined();
		expect(ranges?.a).toEqual({ min: 0.126, max: 0.43295 });
		expect(ranges?.b).toEqual({ min: 0.01, max: 2 });
		expect(ranges?.c).toEqual({ min: 1, max: 30 });
	});
});
