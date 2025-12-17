import { describe, expect, test } from 'bun:test';
import { calculateRossler } from './rossler';

describe('calculateRossler', () => {
	test('returns array of points with correct length', () => {
		const points = calculateRossler({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 100,
			dt: 0.01,
			a: 0.2,
			b: 0.2,
			c: 5.7
		});
		expect(points).toHaveLength(100);
	});

	test('each point has x, y, z coordinates', () => {
		const points = calculateRossler({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 10,
			dt: 0.01,
			a: 0.2,
			b: 0.2,
			c: 5.7
		});

		for (const point of points) {
			expect(typeof point.x).toBe('number');
			expect(typeof point.y).toBe('number');
			expect(typeof point.z).toBe('number');
			expect(Number.isFinite(point.x)).toBe(true);
			expect(Number.isFinite(point.y)).toBe(true);
			expect(Number.isFinite(point.z)).toBe(true);
		}
	});

	test('implements correct Rössler equations', () => {
		// Test a single step manually
		// Rössler equations:
		// dx/dt = -y - z
		// dy/dt = x + a*y
		// dz/dt = b + z*(x - c)
		const x0 = 1,
			y0 = 1,
			z0 = 1;
		const a = 0.2,
			b = 0.2,
			c = 5.7;
		const dt = 0.01;

		const points = calculateRossler({ x0, y0, z0, steps: 1, dt, a, b, c });

		// Calculate expected values using Euler method
		const dx = -y0 - z0; // -1 - 1 = -2
		const dy = x0 + a * y0; // 1 + 0.2*1 = 1.2
		const dz = b + z0 * (x0 - c); // 0.2 + 1*(1 - 5.7) = 0.2 - 4.7 = -4.5

		const expectedX = x0 + dx * dt; // 1 + (-2)*0.01 = 0.98
		const expectedY = y0 + dy * dt; // 1 + 1.2*0.01 = 1.012
		const expectedZ = z0 + dz * dt; // 1 + (-4.5)*0.01 = 0.955

		expect(points[0].x).toBeCloseTo(expectedX, 10);
		expect(points[0].y).toBeCloseTo(expectedY, 10);
		expect(points[0].z).toBeCloseTo(expectedZ, 10);
	});

	test('produces bounded trajectory with classic parameters', () => {
		// With classic parameters, the attractor should stay bounded
		const points = calculateRossler({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 10000,
			dt: 0.01,
			a: 0.2,
			b: 0.2,
			c: 5.7
		});

		// Check that no values explode to infinity
		for (const point of points) {
			expect(Math.abs(point.x)).toBeLessThan(100);
			expect(Math.abs(point.y)).toBeLessThan(100);
			expect(Math.abs(point.z)).toBeLessThan(100);
		}
	});

	test('trajectory evolves from initial conditions', () => {
		const points = calculateRossler({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 100,
			dt: 0.01,
			a: 0.2,
			b: 0.2,
			c: 5.7
		});

		// First point should be different from initial conditions (evolved one step)
		const firstPoint = points[0];
		// After one step from (0.1, 0, 0):
		// dx = -0 - 0 = 0
		// dy = 0.1 + 0.2*0 = 0.1
		// dz = 0.2 + 0*(0.1 - 5.7) = 0.2
		expect(firstPoint.x).toBeCloseTo(0.1, 5); // x stays nearly same
		expect(firstPoint.y).toBeCloseTo(0.001, 5); // y increases slightly
		expect(firstPoint.z).toBeCloseTo(0.002, 5); // z increases slightly
	});

	test('different parameters produce different trajectories', () => {
		const points1 = calculateRossler({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 100,
			dt: 0.01,
			a: 0.2,
			b: 0.2,
			c: 5.7
		});

		const points2 = calculateRossler({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 100,
			dt: 0.01,
			a: 0.1,
			b: 0.1,
			c: 14 // Different c produces different behavior
		});

		// At least some points should differ significantly
		const lastPoint1 = points1[99];
		const lastPoint2 = points2[99];

		const distance = Math.sqrt(
			Math.pow(lastPoint1.x - lastPoint2.x, 2) +
				Math.pow(lastPoint1.y - lastPoint2.y, 2) +
				Math.pow(lastPoint1.z - lastPoint2.z, 2)
		);

		expect(distance).toBeGreaterThan(0.01);
	});

	test('handles zero steps', () => {
		const points = calculateRossler({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 0,
			dt: 0.01,
			a: 0.2,
			b: 0.2,
			c: 5.7
		});
		expect(points).toHaveLength(0);
	});

	test('handles very small time step', () => {
		const points = calculateRossler({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 10,
			dt: 0.0001,
			a: 0.2,
			b: 0.2,
			c: 5.7
		});

		// Should still produce valid finite values
		for (const point of points) {
			expect(Number.isFinite(point.x)).toBe(true);
			expect(Number.isFinite(point.y)).toBe(true);
			expect(Number.isFinite(point.z)).toBe(true);
		}
	});
});
