import { describe, expect, test } from 'bun:test';
import { calculateLozi, calculateLoziTuples } from './lozi';

describe('calculateLozi', () => {
	test('returns array of points with correct length', () => {
		const points = calculateLozi({
			a: 1.7,
			b: 0.5,
			x0: 0,
			y0: 0,
			iterations: 100
		});
		expect(points).toHaveLength(100);
	});

	test('each point has x, y coordinates', () => {
		const points = calculateLozi({
			a: 1.7,
			b: 0.5,
			x0: 0,
			y0: 0,
			iterations: 10
		});

		for (const point of points) {
			expect(typeof point.x).toBe('number');
			expect(typeof point.y).toBe('number');
			expect(Number.isFinite(point.x)).toBe(true);
			expect(Number.isFinite(point.y)).toBe(true);
		}
	});

	test('implements correct Lozi equations', () => {
		// Test a single step manually
		// Lozi equations:
		// x(n+1) = 1 + y(n) - a|x(n)|
		// y(n+1) = b * x(n)
		const x0 = 0.5,
			y0 = 0.3;
		const a = 1.7,
			b = 0.5;

		const points = calculateLozi({ a, b, x0, y0, iterations: 1 });

		const expectedX = 1 + y0 - a * Math.abs(x0);
		const expectedY = b * x0;

		expect(points[0].x).toBeCloseTo(expectedX, 10);
		expect(points[0].y).toBeCloseTo(expectedY, 10);
	});

	test('handles negative x values correctly (piecewise linearity)', () => {
		// When x is negative, |x| = -x, so x(n+1) = 1 + y + ax
		const x0 = -0.5,
			y0 = 0.3;
		const a = 1.7,
			b = 0.5;

		const points = calculateLozi({ a, b, x0, y0, iterations: 1 });

		const expectedX = 1 + y0 - a * Math.abs(x0); // = 1 + 0.3 - 1.7 * 0.5 = 0.45
		const expectedY = b * x0; // = 0.5 * (-0.5) = -0.25

		expect(points[0].x).toBeCloseTo(expectedX, 10);
		expect(points[0].y).toBeCloseTo(expectedY, 10);
	});

	test('produces bounded trajectory with classic parameters', () => {
		// With classic parameters (a=1.7, b=0.5), the attractor should stay bounded
		const points = calculateLozi({
			a: 1.7,
			b: 0.5,
			x0: 0,
			y0: 0,
			iterations: 10000
		});

		// Check that no values explode to infinity
		for (const point of points) {
			expect(Math.abs(point.x)).toBeLessThan(10);
			expect(Math.abs(point.y)).toBeLessThan(10);
		}
	});

	test('trajectory evolves from initial conditions', () => {
		const x0 = 0,
			y0 = 0;
		const a = 1.7,
			b = 0.5;

		const points = calculateLozi({ a, b, x0, y0, iterations: 2 });

		// First iteration: x = 1 + 0 - 1.7*0 = 1, y = 0.5*0 = 0
		expect(points[0].x).toBeCloseTo(1, 10);
		expect(points[0].y).toBeCloseTo(0, 10);

		// Second iteration: x = 1 + 0 - 1.7*1 = -0.7, y = 0.5*1 = 0.5
		expect(points[1].x).toBeCloseTo(-0.7, 10);
		expect(points[1].y).toBeCloseTo(0.5, 10);
	});

	test('different parameters produce different trajectories', () => {
		const points1 = calculateLozi({
			a: 1.7,
			b: 0.5,
			x0: 0,
			y0: 0,
			iterations: 100
		});

		const points2 = calculateLozi({
			a: 1.5,
			b: 0.3,
			x0: 0,
			y0: 0,
			iterations: 100
		});

		// At least some points should differ significantly
		const lastPoint1 = points1[99];
		const lastPoint2 = points2[99];

		const distance = Math.sqrt(
			Math.pow(lastPoint1.x - lastPoint2.x, 2) + Math.pow(lastPoint1.y - lastPoint2.y, 2)
		);

		expect(distance).toBeGreaterThan(0.01);
	});

	test('different initial conditions produce different trajectories', () => {
		const points1 = calculateLozi({
			a: 1.7,
			b: 0.5,
			x0: 0,
			y0: 0,
			iterations: 100
		});

		const points2 = calculateLozi({
			a: 1.7,
			b: 0.5,
			x0: 0.1,
			y0: 0.1,
			iterations: 100
		});

		// Different initial conditions should produce different trajectories
		const lastPoint1 = points1[99];
		const lastPoint2 = points2[99];

		const distance = Math.sqrt(
			Math.pow(lastPoint1.x - lastPoint2.x, 2) + Math.pow(lastPoint1.y - lastPoint2.y, 2)
		);

		expect(distance).toBeGreaterThan(0.001);
	});

	test('handles zero iterations', () => {
		const points = calculateLozi({
			a: 1.7,
			b: 0.5,
			x0: 0,
			y0: 0,
			iterations: 0
		});
		expect(points).toHaveLength(0);
	});

	test('handles b = 0 (degenerate case)', () => {
		const points = calculateLozi({
			a: 1.7,
			b: 0,
			x0: 0.5,
			y0: 0.3,
			iterations: 10
		});

		// When b = 0, y stays at 0 after first iteration (use toBeCloseTo to handle -0)
		for (let i = 1; i < points.length; i++) {
			expect(points[i].y).toBeCloseTo(0, 10);
		}
	});

	test('produces chaotic behavior with classic parameters', () => {
		// Classic Lozi attractor at a=1.7, b=0.5 should show chaotic dynamics
		const points = calculateLozi({
			a: 1.7,
			b: 0.5,
			x0: 0,
			y0: 0,
			iterations: 1000
		});

		// Collect unique x values (rounded to detect spread)
		const uniqueXValues = new Set(points.map((p) => Math.round(p.x * 100) / 100));

		// Chaotic system should visit many different x values
		expect(uniqueXValues.size).toBeGreaterThan(50);
	});
});

describe('calculateLoziTuples', () => {
	test('returns array of tuples with correct length', () => {
		const points = calculateLoziTuples({
			a: 1.7,
			b: 0.5,
			x0: 0,
			y0: 0,
			iterations: 100
		});
		expect(points).toHaveLength(100);
	});

	test('each tuple has [x, y] format', () => {
		const points = calculateLoziTuples({
			a: 1.7,
			b: 0.5,
			x0: 0,
			y0: 0,
			iterations: 10
		});

		for (const point of points) {
			expect(Array.isArray(point)).toBe(true);
			expect(point).toHaveLength(2);
			expect(typeof point[0]).toBe('number');
			expect(typeof point[1]).toBe('number');
		}
	});

	test('produces same values as calculateLozi', () => {
		const params = {
			a: 1.7,
			b: 0.5,
			x0: 0.5,
			y0: 0.3,
			iterations: 100
		};

		const objectPoints = calculateLozi(params);
		const tuplePoints = calculateLoziTuples(params);

		for (let i = 0; i < objectPoints.length; i++) {
			expect(tuplePoints[i][0]).toBeCloseTo(objectPoints[i].x, 10);
			expect(tuplePoints[i][1]).toBeCloseTo(objectPoints[i].y, 10);
		}
	});
});
