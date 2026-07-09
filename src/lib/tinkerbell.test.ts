import { describe, expect, test } from 'vitest';
import { calculateTinkerbellTuples } from './tinkerbell';

const CLASSIC = { a: 0.9, b: -0.6013, c: 2.0, d: 0.5 };

describe('calculateTinkerbellTuples', () => {
	test('returns an empty array for non-positive iterations', () => {
		expect(calculateTinkerbellTuples({ ...CLASSIC, iterations: 0 })).toEqual([]);
		expect(calculateTinkerbellTuples({ ...CLASSIC, iterations: -5 })).toEqual([]);
	});

	test('is deterministic for identical parameters', () => {
		const a = calculateTinkerbellTuples({ ...CLASSIC, iterations: 500 });
		const b = calculateTinkerbellTuples({ ...CLASSIC, iterations: 500 });
		expect(a).toEqual(b);
		expect(a.length).toBe(500);
	});

	test('honors the maxPoints cap', () => {
		const pts = calculateTinkerbellTuples({ ...CLASSIC, iterations: 1000, maxPoints: 100 });
		expect(pts.length).toBe(100);
	});

	test('returns empty when maxPoints is non-positive', () => {
		expect(calculateTinkerbellTuples({ ...CLASSIC, iterations: 1000, maxPoints: 0 })).toEqual(
			[]
		);
	});

	test('classic defaults produce a bounded attractor with many finite points', () => {
		const pts = calculateTinkerbellTuples({ ...CLASSIC, iterations: 2000 });
		expect(pts.length).toBe(2000);
		for (const [x, y] of pts) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
			expect(Math.abs(x)).toBeLessThan(5);
			expect(Math.abs(y)).toBeLessThan(5);
		}
	});

	test('breaks early (without collecting the point) when coordinates exceed the magnitude cap', () => {
		// c=10, d=10 drives rapid quadratic divergence from the fixed seed; the
		// orbit escapes well before 1000 steps and the runaway point is dropped.
		const pts = calculateTinkerbellTuples({
			a: 0,
			b: 0,
			c: 10,
			d: 10,
			iterations: 1000
		});
		expect(pts.length).toBeLessThan(1000);
		for (const [x, y] of pts) {
			expect(Math.abs(x)).toBeLessThanOrEqual(1e4);
			expect(Math.abs(y)).toBeLessThanOrEqual(1e4);
		}
	});

	test('stops early when an iterate becomes non-finite', () => {
		const pts = calculateTinkerbellTuples({
			...CLASSIC,
			c: Number.POSITIVE_INFINITY,
			iterations: 100
		});
		expect(pts).toEqual([]);
	});
});
