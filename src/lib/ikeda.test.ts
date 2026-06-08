import { describe, expect, test } from 'vitest';
import { calculateIkeda, calculateIkedaTuples, calculateIkedaMultiSeed, mulberry32 } from './ikeda';

// One explicit step of the Ikeda map for verification.
function manualStep(x: number, y: number, u: number): [number, number] {
	const t = 0.4 - 6 / (1 + x * x + y * y);
	const xn = 1 + u * (x * Math.cos(t) - y * Math.sin(t));
	const yn = u * (x * Math.sin(t) + y * Math.cos(t));
	return [xn, yn];
}

describe('calculateIkeda', () => {
	test('returns iterations - burnIn points when burnIn < iterations', () => {
		const pts = calculateIkeda({ u: 0.918, x0: 0.1, y0: 0, iterations: 100, burnIn: 20 });
		expect(pts).toHaveLength(80);
	});

	test('first retained point matches the Ikeda equations (burnIn = 0)', () => {
		const u = 0.918,
			x0 = 0.1,
			y0 = 0;
		const [ex, ey] = manualStep(x0, y0, u);
		const pts = calculateIkeda({ u, x0, y0, iterations: 1, burnIn: 0 });
		expect(pts[0].x).toBeCloseTo(ex, 12);
		expect(pts[0].y).toBeCloseTo(ey, 12);
	});

	test('burnIn discards the first burnIn iterations (tail equality)', () => {
		const base = { u: 0.918, x0: 0.1, y0: 0, iterations: 50 };
		const full = calculateIkeda({ ...base, burnIn: 0 });
		const trimmed = calculateIkeda({ ...base, burnIn: 10 });
		expect(trimmed).toHaveLength(40);
		for (let i = 0; i < trimmed.length; i++) {
			expect(trimmed[i].x).toBeCloseTo(full[i + 10].x, 12);
			expect(trimmed[i].y).toBeCloseTo(full[i + 10].y, 12);
		}
	});

	test('classic attractor stays bounded and finite', () => {
		const pts = calculateIkeda({ u: 0.918, x0: 0.1, y0: 0, iterations: 5000, burnIn: 100 });
		for (const p of pts) {
			expect(Number.isFinite(p.x)).toBe(true);
			expect(Number.isFinite(p.y)).toBe(true);
			expect(Math.abs(p.x)).toBeLessThan(20);
			expect(Math.abs(p.y)).toBeLessThan(20);
		}
	});

	test('zero iterations yields no points', () => {
		expect(calculateIkeda({ u: 0.9, x0: 0, y0: 0, iterations: 0, burnIn: 0 })).toHaveLength(0);
	});

	test('burnIn >= iterations yields no points', () => {
		expect(calculateIkeda({ u: 0.9, x0: 0, y0: 0, iterations: 10, burnIn: 10 })).toHaveLength(
			0
		);
	});

	test('stops early when values become non-finite', () => {
		const pts = calculateIkeda({ u: 1e10, x0: 1, y0: 1, iterations: 500, burnIn: 0 });
		for (const p of pts) {
			expect(Number.isFinite(p.x)).toBe(true);
			expect(Number.isFinite(p.y)).toBe(true);
		}
		expect(pts.length).toBeLessThan(500);
	});
});

describe('calculateIkedaTuples', () => {
	test('tuples match object form', () => {
		const params = { u: 0.918, x0: 0.1, y0: 0, iterations: 200, burnIn: 10 };
		const objs = calculateIkeda(params);
		const tuples = calculateIkedaTuples(params);
		expect(tuples).toHaveLength(objs.length);
		for (let i = 0; i < objs.length; i++) {
			expect(tuples[i][0]).toBeCloseTo(objs[i].x, 12);
			expect(tuples[i][1]).toBeCloseTo(objs[i].y, 12);
		}
	});

	test('stops early when values become non-finite', () => {
		const pts = calculateIkedaTuples({ u: 1e10, x0: 1, y0: 1, iterations: 500, burnIn: 0 });
		for (const [x, y] of pts) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
		expect(pts.length).toBeLessThan(500);
	});
});

describe('mulberry32', () => {
	test('is deterministic for a given seed', () => {
		const a = mulberry32(123);
		const b = mulberry32(123);
		for (let i = 0; i < 5; i++) expect(a()).toBe(b());
	});

	test('produces values in [0, 1)', () => {
		const r = mulberry32(42);
		for (let i = 0; i < 100; i++) {
			const v = r();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('calculateIkedaMultiSeed', () => {
	test('is deterministic across identical calls', () => {
		const params = { u: 0.918, iterations: 100, burnIn: 20, seeds: 30 };
		const a = calculateIkedaMultiSeed(params);
		const b = calculateIkedaMultiSeed(params);
		expect(a.points).toEqual(b.points);
		expect(a.seedIndices).toEqual(b.seedIndices);
	});

	test('points and seedIndices have equal length; indices in [0, seeds)', () => {
		const seeds = 25;
		const { points, seedIndices } = calculateIkedaMultiSeed({
			u: 0.918,
			iterations: 80,
			burnIn: 10,
			seeds
		});
		expect(seedIndices).toHaveLength(points.length);
		for (const s of seedIndices) {
			expect(s).toBeGreaterThanOrEqual(0);
			expect(s).toBeLessThan(seeds);
		}
	});

	test('all points are finite for the classic attractor', () => {
		const { points } = calculateIkedaMultiSeed({
			u: 0.918,
			iterations: 200,
			burnIn: 50,
			seeds: 50
		});
		for (const [x, y] of points) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
	});

	test('zero seeds yields no points', () => {
		const { points, seedIndices } = calculateIkedaMultiSeed({
			u: 0.9,
			iterations: 100,
			burnIn: 0,
			seeds: 0
		});
		expect(points).toHaveLength(0);
		expect(seedIndices).toHaveLength(0);
	});

	test('maxPoints caps total collected points and stays a deterministic prefix', () => {
		const base = { u: 0.918, iterations: 200, burnIn: 10, seeds: 100 };
		const uncapped = calculateIkedaMultiSeed(base);
		const cap = 150;
		const capped = calculateIkedaMultiSeed({ ...base, maxPoints: cap });
		expect(uncapped.points.length).toBeGreaterThan(cap);
		expect(capped.points).toHaveLength(cap);
		expect(capped.seedIndices).toHaveLength(cap);
		// Capped output is exactly the prefix of the uncapped output.
		expect(capped.points).toEqual(uncapped.points.slice(0, cap));
		expect(capped.seedIndices).toEqual(uncapped.seedIndices.slice(0, cap));
	});

	test('maxPoints of zero yields no points', () => {
		const { points, seedIndices } = calculateIkedaMultiSeed({
			u: 0.918,
			iterations: 100,
			burnIn: 10,
			seeds: 50,
			maxPoints: 0
		});
		expect(points).toHaveLength(0);
		expect(seedIndices).toHaveLength(0);
	});

	test('negative maxPoints is treated as no cap', () => {
		const base = { u: 0.918, iterations: 100, burnIn: 10, seeds: 50 };
		const uncapped = calculateIkedaMultiSeed(base);
		const negative = calculateIkedaMultiSeed({ ...base, maxPoints: -100 });
		expect(negative.points).toEqual(uncapped.points);
		expect(negative.seedIndices).toEqual(uncapped.seedIndices);
	});
});
