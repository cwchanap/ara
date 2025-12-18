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

		const derivatives = (x: number, y: number, z: number) => {
			return {
				dx: -y - z,
				dy: x + a * y,
				dz: b + z * (x - c)
			};
		};

		// Calculate expected values using RK4 method
		const k1 = derivatives(x0, y0, z0);
		const k2 = derivatives(x0 + (dt * k1.dx) / 2, y0 + (dt * k1.dy) / 2, z0 + (dt * k1.dz) / 2);
		const k3 = derivatives(x0 + (dt * k2.dx) / 2, y0 + (dt * k2.dy) / 2, z0 + (dt * k2.dz) / 2);
		const k4 = derivatives(x0 + dt * k3.dx, y0 + dt * k3.dy, z0 + dt * k3.dz);

		const expectedX = x0 + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx);
		const expectedY = y0 + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy);
		const expectedZ = z0 + (dt / 6) * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz);

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

		const x0 = 0.1,
			y0 = 0,
			z0 = 0;
		const a = 0.2,
			b = 0.2,
			c = 5.7;
		const dt = 0.01;

		const derivatives = (x: number, y: number, z: number) => {
			return {
				dx: -y - z,
				dy: x + a * y,
				dz: b + z * (x - c)
			};
		};

		const k1 = derivatives(x0, y0, z0);
		const k2 = derivatives(x0 + (dt * k1.dx) / 2, y0 + (dt * k1.dy) / 2, z0 + (dt * k1.dz) / 2);
		const k3 = derivatives(x0 + (dt * k2.dx) / 2, y0 + (dt * k2.dy) / 2, z0 + (dt * k2.dz) / 2);
		const k4 = derivatives(x0 + dt * k3.dx, y0 + dt * k3.dy, z0 + dt * k3.dz);

		const expectedX = x0 + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx);
		const expectedY = y0 + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy);
		const expectedZ = z0 + (dt / 6) * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz);

		expect(firstPoint.x).toBeCloseTo(expectedX, 10);
		expect(firstPoint.y).toBeCloseTo(expectedY, 10);
		expect(firstPoint.z).toBeCloseTo(expectedZ, 10);
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
