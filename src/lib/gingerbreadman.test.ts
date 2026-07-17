import { describe, expect, test } from 'vitest';
import { calculateGingerbreadmanTuples, countUniqueOrbitPoints, orbitKey } from './gingerbreadman';
import { GINGERBREADMAN_PRESETS } from './gingerbreadman-presets';

const CLASSIC = { x0: -0.1, y0: 0 };

describe('orbitKey / countUniqueOrbitPoints', () => {
	test('orbitKey uses 0.001 grid integer keys', () => {
		expect(orbitKey(1.2344, -2.3456)).toBe('1234,-2346');
	});

	test('shipped-like seeds are orbit-rich (≥ 1000 unique @ 1e5, 0.001 grid)', () => {
		expect(countUniqueOrbitPoints(-0.1, 0)).toBeGreaterThanOrEqual(1000);
		expect(countUniqueOrbitPoints(-0.3, 0)).toBeGreaterThanOrEqual(1000);
		expect(countUniqueOrbitPoints(-0.75, 0.1)).toBeGreaterThanOrEqual(1000);
		expect(countUniqueOrbitPoints(-2.13, 0.47)).toBeGreaterThanOrEqual(1000);
	});

	test('every shipped preset IC is orbit-rich', () => {
		for (const p of GINGERBREADMAN_PRESETS) {
			expect(countUniqueOrbitPoints(p.state.x0, p.state.y0), `preset ${p.id}`).toBeGreaterThanOrEqual(
				1000
			);
		}
	});

	test('dyadic short cycles fail the richness bar', () => {
		expect(countUniqueOrbitPoints(0.5, -0.5)).toBeLessThan(1000);
		expect(countUniqueOrbitPoints(3, -2)).toBeLessThan(1000);
	});
});

describe('calculateGingerbreadmanTuples', () => {
	test('returns empty for non-positive iterations', () => {
		expect(calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 0 })).toEqual([]);
		expect(calculateGingerbreadmanTuples({ ...CLASSIC, iterations: -1 })).toEqual([]);
	});

	test('returns empty when maxPoints is non-positive', () => {
		expect(calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 100, maxPoints: 0 })).toEqual(
			[]
		);
	});

	test('honors maxPoints cap', () => {
		const pts = calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 1000, maxPoints: 50 });
		expect(pts.length).toBe(50);
	});

	test('is deterministic and applies one-step recurrence', () => {
		const pts = calculateGingerbreadmanTuples({ x0: -0.1, y0: 0, iterations: 1 });
		// x' = 1 - 0 + |-0.1| = 1.1; y' = -0.1
		expect(pts).toEqual([[1.1, -0.1]]);
		expect(calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 200 })).toEqual(
			calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 200 })
		);
	});

	test('classic seed produces many finite points', () => {
		const pts = calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 2000 });
		expect(pts.length).toBe(2000);
		for (const [x, y] of pts) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
	});

	test('breaks without collecting when magnitude exceeds cap', () => {
		// Huge start: first step may already exceed cap depending on values;
		// use x0 large enough that an early iterate blows past 1e4.
		const pts = calculateGingerbreadmanTuples({
			x0: 1e5,
			y0: 0,
			iterations: 100
		});
		expect(pts.length).toBeLessThan(100);
		for (const [x, y] of pts) {
			expect(Math.abs(x)).toBeLessThanOrEqual(1e4);
			expect(Math.abs(y)).toBeLessThanOrEqual(1e4);
		}
	});

	test('stops when iterate is non-finite', () => {
		const pts = calculateGingerbreadmanTuples({
			x0: Number.NaN,
			y0: 0,
			iterations: 10
		});
		// First step from NaN yields non-finite → empty
		expect(pts).toEqual([]);
	});
});
