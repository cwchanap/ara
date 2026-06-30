import { describe, test, expect } from 'vitest';
import {
	gumowskiMiraStep,
	calculateGumowskiMiraTuples,
	calculateGumowskiMiraMultiSeed
} from './gumowski-mira';

describe('gumowskiMiraStep', () => {
	test('produces a deterministic result for known inputs', () => {
		const [x, y] = gumowskiMiraStep(0.1, 0, 0.31, 0.008, 0.05);
		expect(x).toBeCloseTo(0.0446634, 5);
		expect(y).toBeCloseTo(-0.083407, 5);
	});

	test('g(x) = μ·x + 2(1−μ)·x²/(1+x²) at x=0 returns 0', () => {
		// g(0) = 0 for any μ; step from (0,0) with a=0 means xNew = 0 + 0 + g(0) = 0
		const [x, y] = gumowskiMiraStep(0, 0, 0.5, 0, 0.05);
		expect(x).toBe(0);
		expect(y).toBe(0); // -x + g(xNew) = -0 + g(0) = 0
	});
});

describe('calculateGumowskiMiraTuples', () => {
	test('returns empty array for zero iterations', () => {
		const points = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 0,
			burnIn: 0
		});
		expect(points).toEqual([]);
	});

	test('returns empty array for negative iterations', () => {
		const points = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: -5,
			burnIn: 0
		});
		expect(points).toEqual([]);
	});

	test('produces the correct number of points (minus burn-in)', () => {
		const points = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 100,
			burnIn: 20
		});
		expect(points.length).toBe(80);
	});

	test('burn-in discards the first N points', () => {
		const burned = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 50,
			burnIn: 10
		});
		const full = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 50,
			burnIn: 0
		});
		expect(burned[0]).toEqual(full[10]);
	});

	test('all points are finite for stable parameters', () => {
		const points = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 1000,
			burnIn: 0
		});
		for (const [x, y] of points) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
	});

	test('stops early when orbit diverges to non-finite values', () => {
		// With a huge initial condition the b·y² term overflows to -Infinity
		// on the first iteration, triggering the Number.isFinite break guard.
		const points = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 1e300,
			y0: 1e300,
			iterations: 100,
			burnIn: 0
		});
		// The break fires before any finite point is pushed, so the result is
		// either empty or contains only finite values (never non-finite).
		for (const [x, y] of points) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
		expect(points.length).toBeLessThan(100);
	});
});

describe('calculateGumowskiMiraMultiSeed', () => {
	test('returns empty for non-positive seeds', () => {
		const result = calculateGumowskiMiraMultiSeed({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 100,
			burnIn: 0,
			seeds: 0
		});
		expect(result.points).toEqual([]);
		expect(result.seedIndices).toEqual([]);
	});

	test('returns empty for non-positive iterations', () => {
		const result = calculateGumowskiMiraMultiSeed({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 0,
			burnIn: 0,
			seeds: 10
		});
		expect(result.points).toEqual([]);
	});

	test('returns empty for non-positive maxPoints', () => {
		const result = calculateGumowskiMiraMultiSeed({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 100,
			burnIn: 0,
			seeds: 10,
			maxPoints: 0
		});
		expect(result.points).toEqual([]);
	});

	test('is deterministic — same params produce identical points', () => {
		const params = {
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 200,
			burnIn: 20,
			seeds: 30
		};
		const r1 = calculateGumowskiMiraMultiSeed(params);
		const r2 = calculateGumowskiMiraMultiSeed(params);
		expect(r1.points).toEqual(r2.points);
		expect(r1.seedIndices).toEqual(r2.seedIndices);
	});

	test('seedIndices parallel points', () => {
		const result = calculateGumowskiMiraMultiSeed({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 50,
			burnIn: 0,
			seeds: 5
		});
		expect(result.points.length).toBe(result.seedIndices.length);
		const uniqueSeeds = new Set(result.seedIndices);
		expect(uniqueSeeds.size).toBeLessThanOrEqual(5);
	});

	test('respects maxPoints cap', () => {
		const result = calculateGumowskiMiraMultiSeed({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 100,
			burnIn: 0,
			seeds: 50,
			maxPoints: 100
		});
		expect(result.points.length).toBeLessThanOrEqual(100);
	});

	test('skips seeds whose orbits diverge to non-finite values', () => {
		// Extreme mu + a cause rapid divergence for most random seeds in [-1,1].
		// The Number.isFinite break guard stops each diverging seed early; the
		// function still returns whatever finite points it collected.
		const result = calculateGumowskiMiraMultiSeed({
			mu: 1,
			a: 1,
			b: 0.5,
			iterations: 500,
			burnIn: 0,
			seeds: 20
		});
		for (const [x, y] of result.points) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
		// No non-finite points should ever be collected.
		expect(result.points.length).toBe(result.seedIndices.length);
	});
});
