/**
 * Additional edge-case tests for lozi.ts
 *
 * Covers cases not present in lozi.test.ts:
 * - a = 0 degenerate (x = 1 + y always)
 * - b < 0 (negative b)
 * - b = 1 border value
 * - very large a causing divergence
 * - trajectory consistency across run lengths
 * - initial x = 0 (piecewise abs boundary)
 * - large iteration count correctness
 */

import { describe, expect, test } from 'bun:test';
import { calculateLozi, calculateLoziTuples } from './lozi';

describe('calculateLozi – additional edge cases', () => {
	describe('a = 0 degenerate case', () => {
		test('when a=0, x(n+1) = 1 + y(n) for all steps', () => {
			const points = calculateLozi({ a: 0, b: 0.5, x0: 3, y0: -2, iterations: 5 });

			// With a=0: x_new = 1 + y - 0*|x| = 1 + y
			// Step 1: x1 = 1 + (-2) = -1
			expect(points[0].x).toBeCloseTo(-1, 10);
		});

		test('when a=0, all points are finite', () => {
			const points = calculateLozi({ a: 0, b: 0.5, x0: 100, y0: -50, iterations: 20 });
			for (const pt of points) {
				expect(Number.isFinite(pt.x)).toBe(true);
				expect(Number.isFinite(pt.y)).toBe(true);
			}
		});

		test('when a=0, length is correct', () => {
			const points = calculateLozi({ a: 0, b: 0.5, x0: 0, y0: 0, iterations: 15 });
			expect(points).toHaveLength(15);
		});
	});

	describe('negative b values', () => {
		test('b = -0.5 produces finite trajectory', () => {
			const points = calculateLozi({ a: 1.7, b: -0.5, x0: 0, y0: 0, iterations: 50 });
			expect(points).toHaveLength(50);
			for (const pt of points) {
				expect(Number.isFinite(pt.x)).toBe(true);
				expect(Number.isFinite(pt.y)).toBe(true);
			}
		});

		test('b = -0.5 y(n+1) = b*x(n) is negative when x(n) positive', () => {
			// With b<0, y mirrors x with negative sign
			const points = calculateLozi({ a: 1.7, b: -0.5, x0: 1, y0: 0, iterations: 1 });
			// y1 = b * x0 = -0.5 * 1 = -0.5
			expect(points[0].y).toBeCloseTo(-0.5, 10);
		});
	});

	describe('b = 1 border value', () => {
		test('b=1 maps y to x exactly', () => {
			// y(n+1) = b * x(n) = 1 * x(n) = x(n)
			const points = calculateLozi({ a: 1.7, b: 1, x0: 0.5, y0: 0, iterations: 1 });
			// y1 = 1 * 0.5 = 0.5
			expect(points[0].y).toBeCloseTo(0.5, 10);
		});

		test('b=1 produces finite trajectory', () => {
			const points = calculateLozi({ a: 1.7, b: 1, x0: 0, y0: 0, iterations: 100 });
			expect(points).toHaveLength(100);
			for (const pt of points) {
				expect(Number.isFinite(pt.x)).toBe(true);
				expect(Number.isFinite(pt.y)).toBe(true);
			}
		});
	});

	describe('x0 = 0 (piecewise abs boundary)', () => {
		test('x0=0 gives x1 = 1 + y0 (abs(0)=0)', () => {
			const a = 1.7,
				b = 0.5,
				y0 = 0.3;
			const points = calculateLozi({ a, b, x0: 0, y0, iterations: 1 });
			// x1 = 1 + y0 - a*|0| = 1 + y0
			expect(points[0].x).toBeCloseTo(1 + y0, 10);
		});

		test('x0=0 gives y1 = b*0 = 0', () => {
			const points = calculateLozi({ a: 1.7, b: 0.5, x0: 0, y0: 0.3, iterations: 1 });
			expect(points[0].y).toBeCloseTo(0, 10);
		});
	});

	describe('trajectory consistency across run lengths', () => {
		test('first n points of a long run match a short run of n steps', () => {
			const params = { a: 1.7, b: 0.5, x0: 0.1, y0: 0.1 };
			const short = calculateLozi({ ...params, iterations: 5 });
			const long = calculateLozi({ ...params, iterations: 10 });

			for (let i = 0; i < 5; i++) {
				expect(short[i].x).toBeCloseTo(long[i].x, 12);
				expect(short[i].y).toBeCloseTo(long[i].y, 12);
			}
		});

		test('single step matches first step of multi-step run', () => {
			const params = { a: 1.7, b: 0.5, x0: 0.5, y0: 0.3 };
			const single = calculateLozi({ ...params, iterations: 1 });
			const multi = calculateLozi({ ...params, iterations: 100 });

			expect(single[0].x).toBeCloseTo(multi[0].x, 12);
			expect(single[0].y).toBeCloseTo(multi[0].y, 12);
		});

		test('continuing from step N matches step N+1 of original run', () => {
			const params = { a: 1.7, b: 0.5, x0: 0, y0: 0 };
			const run = calculateLozi({ ...params, iterations: 5 });

			// Resume from step 3's endpoint
			const resumed = calculateLozi({
				a: params.a,
				b: params.b,
				x0: run[2].x,
				y0: run[2].y,
				iterations: 1
			});

			expect(resumed[0].x).toBeCloseTo(run[3].x, 10);
			expect(resumed[0].y).toBeCloseTo(run[3].y, 10);
		});
	});

	describe('large iteration count', () => {
		test('returns exact count for large iterations', () => {
			const points = calculateLozi({ a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 50000 });
			expect(points).toHaveLength(50000);
		});

		test('all points finite for large iteration count', () => {
			const points = calculateLozi({ a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 10000 });
			for (const pt of points) {
				expect(Number.isFinite(pt.x)).toBe(true);
				expect(Number.isFinite(pt.y)).toBe(true);
			}
		});
	});

	describe('single iteration', () => {
		test('single iteration returns exactly one point', () => {
			const points = calculateLozi({ a: 1.7, b: 0.5, x0: 1, y0: 1, iterations: 1 });
			expect(points).toHaveLength(1);
		});

		test('single iteration result matches equation manually', () => {
			const a = 1.2,
				b = 0.4,
				x0 = 0.7,
				y0 = -0.3;
			const points = calculateLozi({ a, b, x0, y0, iterations: 1 });
			const expectedX = 1 + y0 - a * Math.abs(x0);
			const expectedY = b * x0;
			expect(points[0].x).toBeCloseTo(expectedX, 12);
			expect(points[0].y).toBeCloseTo(expectedY, 12);
		});
	});
});

describe('calculateLoziTuples – additional edge cases', () => {
	describe('a = 0 degenerate case', () => {
		test('when a=0, first x coordinate = 1 + y0', () => {
			const tuples = calculateLoziTuples({ a: 0, b: 0.5, x0: 5, y0: 2, iterations: 1 });
			expect(tuples[0][0]).toBeCloseTo(1 + 2, 10);
		});

		test('when a=0, tuple and object results match', () => {
			const params = { a: 0, b: 0.3, x0: 1, y0: -1, iterations: 10 };
			const objects = calculateLozi(params);
			const tuples = calculateLoziTuples(params);
			for (let i = 0; i < objects.length; i++) {
				expect(tuples[i][0]).toBeCloseTo(objects[i].x, 12);
				expect(tuples[i][1]).toBeCloseTo(objects[i].y, 12);
			}
		});
	});

	describe('negative b values', () => {
		test('b=-1 produces finite tuples', () => {
			const tuples = calculateLoziTuples({ a: 1.7, b: -1, x0: 0, y0: 0, iterations: 20 });
			expect(tuples).toHaveLength(20);
			for (const [x, y] of tuples) {
				expect(Number.isFinite(x)).toBe(true);
				expect(Number.isFinite(y)).toBe(true);
			}
		});
	});

	describe('x0 = 0 boundary', () => {
		test('x0=0 first tuple matches expected values', () => {
			const a = 1.5,
				b = 0.6,
				y0 = 0.5;
			const tuples = calculateLoziTuples({ a, b, x0: 0, y0, iterations: 1 });
			expect(tuples[0][0]).toBeCloseTo(1 + y0, 10); // 1 + 0.5 = 1.5
			expect(tuples[0][1]).toBeCloseTo(0, 10); // b * 0 = 0
		});
	});

	describe('large negative x0', () => {
		test('large negative x0 initial condition works', () => {
			const tuples = calculateLoziTuples({ a: 1.7, b: 0.5, x0: -100, y0: 0, iterations: 5 });
			expect(tuples).toHaveLength(5);
			// x1 = 1 + 0 - 1.7 * |-100| = 1 - 170 = -169
			expect(tuples[0][0]).toBeCloseTo(1 - 170, 5);
		});
	});
});
