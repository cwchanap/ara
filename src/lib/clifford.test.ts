import { describe, expect, test } from 'vitest';
import { calculateCliffordTuples } from './clifford';

const CLASSIC = { a: -1.4, b: 1.6, c: 1.0, d: 0.7 };

describe('calculateCliffordTuples', () => {
	test('returns an empty array for non-positive iterations', () => {
		expect(calculateCliffordTuples({ ...CLASSIC, iterations: 0 })).toEqual([]);
		expect(calculateCliffordTuples({ ...CLASSIC, iterations: -5 })).toEqual([]);
	});

	test('is deterministic for identical parameters', () => {
		const a = calculateCliffordTuples({ ...CLASSIC, iterations: 500 });
		const b = calculateCliffordTuples({ ...CLASSIC, iterations: 500 });
		expect(a).toEqual(b);
		expect(a.length).toBe(500);
	});

	test('honors the maxPoints cap', () => {
		const pts = calculateCliffordTuples({ ...CLASSIC, iterations: 1000, maxPoints: 100 });
		expect(pts.length).toBe(100);
	});

	test('returns empty when maxPoints is non-positive', () => {
		expect(calculateCliffordTuples({ ...CLASSIC, iterations: 1000, maxPoints: 0 })).toEqual([]);
	});

	test('every point is finite and within the analytic bounds for several parameter sets', () => {
		const paramSets = [
			CLASSIC,
			{ a: 1.7, b: 1.7, c: 0.6, d: 1.2 },
			{ a: 3, b: 3, c: 3, d: 3 },
			{ a: -3, b: -3, c: -3, d: -3 }
		];
		for (const p of paramSets) {
			const pts = calculateCliffordTuples({ ...p, iterations: 2000 });
			const xBound = 1 + Math.abs(p.c);
			const yBound = 1 + Math.abs(p.d);
			for (const [x, y] of pts) {
				expect(Number.isFinite(x)).toBe(true);
				expect(Number.isFinite(y)).toBe(true);
				expect(Math.abs(x)).toBeLessThanOrEqual(xBound + 1e-9);
				expect(Math.abs(y)).toBeLessThanOrEqual(yBound + 1e-9);
			}
		}
	});

	test('stops early (defensive break) when an iterate becomes non-finite', () => {
		// Math.sin(Infinity) === NaN in JS, so an infinite coefficient produces
		// a non-finite iterate on the first step and triggers the guard break.
		const pts = calculateCliffordTuples({
			...CLASSIC,
			a: Number.POSITIVE_INFINITY,
			iterations: 100
		});
		expect(pts).toEqual([]);
	});
});
