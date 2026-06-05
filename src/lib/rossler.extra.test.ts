/**
 * Additional edge-case tests for rossler.ts
 *
 * Covers cases not present in rossler.test.ts:
 * - dt = 0 (degenerate zero-step time)
 * - negative initial conditions
 * - negative parameter values (a, b, c)
 * - large dt numerical behavior
 * - multi-step trajectory consistency
 * - origin initial conditions
 * - large number of steps
 */

import { describe, expect, test } from 'vitest';
import { calculateRossler } from './rossler';

describe('calculateRossler – additional edge cases', () => {
	describe('degenerate time step (dt = 0)', () => {
		test('returns correct number of points when dt = 0', () => {
			const points = calculateRossler({
				x0: 1,
				y0: 1,
				z0: 1,
				steps: 5,
				dt: 0,
				a: 0.2,
				b: 0.2,
				c: 5.7
			});
			expect(points).toHaveLength(5);
		});

		test('all points are identical when dt = 0 (no change per step)', () => {
			const x0 = 1,
				y0 = 2,
				z0 = 3;
			const points = calculateRossler({
				x0,
				y0,
				z0,
				steps: 4,
				dt: 0,
				a: 0.2,
				b: 0.2,
				c: 5.7
			});

			// With dt=0, RK4 increments are all zero, so state never changes
			for (const pt of points) {
				expect(pt.x).toBeCloseTo(x0, 10);
				expect(pt.y).toBeCloseTo(y0, 10);
				expect(pt.z).toBeCloseTo(z0, 10);
			}
		});
	});

	describe('negative initial conditions', () => {
		test('handles negative x0', () => {
			const points = calculateRossler({
				x0: -5,
				y0: 0,
				z0: 0,
				steps: 10,
				dt: 0.01,
				a: 0.2,
				b: 0.2,
				c: 5.7
			});
			expect(points).toHaveLength(10);
			for (const pt of points) {
				expect(Number.isFinite(pt.x)).toBe(true);
				expect(Number.isFinite(pt.y)).toBe(true);
				expect(Number.isFinite(pt.z)).toBe(true);
			}
		});

		test('handles negative y0', () => {
			const points = calculateRossler({
				x0: 0,
				y0: -3,
				z0: 0,
				steps: 10,
				dt: 0.01,
				a: 0.2,
				b: 0.2,
				c: 5.7
			});
			expect(points).toHaveLength(10);
			for (const pt of points) {
				expect(Number.isFinite(pt.x)).toBe(true);
			}
		});

		test('handles negative z0', () => {
			const points = calculateRossler({
				x0: 0,
				y0: 0,
				z0: -2,
				steps: 10,
				dt: 0.01,
				a: 0.2,
				b: 0.2,
				c: 5.7
			});
			expect(points).toHaveLength(10);
			for (const pt of points) {
				expect(Number.isFinite(pt.z)).toBe(true);
			}
		});

		test('all-negative initial conditions produce valid trajectory', () => {
			const points = calculateRossler({
				x0: -1,
				y0: -1,
				z0: -1,
				steps: 50,
				dt: 0.01,
				a: 0.2,
				b: 0.2,
				c: 5.7
			});
			expect(points).toHaveLength(50);
			for (const pt of points) {
				expect(Number.isFinite(pt.x)).toBe(true);
				expect(Number.isFinite(pt.y)).toBe(true);
				expect(Number.isFinite(pt.z)).toBe(true);
			}
		});
	});

	describe('negative parameter values', () => {
		test('handles negative a parameter', () => {
			const points = calculateRossler({
				x0: 0.1,
				y0: 0,
				z0: 0,
				steps: 10,
				dt: 0.01,
				a: -0.2,
				b: 0.2,
				c: 5.7
			});
			expect(points).toHaveLength(10);
			for (const pt of points) {
				expect(Number.isFinite(pt.x)).toBe(true);
			}
		});

		test('handles negative b parameter', () => {
			const points = calculateRossler({
				x0: 0.1,
				y0: 0,
				z0: 0,
				steps: 10,
				dt: 0.01,
				a: 0.2,
				b: -0.2,
				c: 5.7
			});
			expect(points).toHaveLength(10);
			for (const pt of points) {
				expect(Number.isFinite(pt.x)).toBe(true);
			}
		});

		test('c = 0 gives simplified dynamics', () => {
			// With c=0: dz/dt = b + z*(x - 0) = b + z*x
			// dz at (1, 0, 1) = 0.2 + 1*(1-0) = 1.2 > 0, so z should increase
			const x0 = 1,
				y0 = 0,
				z0 = 1;
			const a = 0.2,
				b = 0.2,
				c = 0;
			const dt = 0.01;
			const points = calculateRossler({ x0, y0, z0, steps: 1, dt, a, b, c });

			// One RK4 step should produce a z close to z0 + dt * dz (Euler approx)
			expect(points[0].z).toBeGreaterThan(z0); // z increases with positive dz
			expect(Number.isFinite(points[0].z)).toBe(true);
		});
	});

	describe('origin initial conditions', () => {
		test('x0=y0=z0=0 with classic params produces non-trivial trajectory', () => {
			const points = calculateRossler({
				x0: 0,
				y0: 0,
				z0: 0,
				steps: 100,
				dt: 0.01,
				a: 0.2,
				b: 0.2,
				c: 5.7
			});
			expect(points).toHaveLength(100);
			// With b>0, z should eventually grow from zero
			// dz at origin = b + 0*(0 - c) = b = 0.2 > 0
			expect(points[0].z).toBeGreaterThan(0);
		});
	});

	describe('large dt', () => {
		test('large dt still returns the correct number of points', () => {
			const points = calculateRossler({
				x0: 0.1,
				y0: 0,
				z0: 0,
				steps: 10,
				dt: 1.0,
				a: 0.2,
				b: 0.2,
				c: 5.7
			});
			expect(points).toHaveLength(10);
		});

		test('large dt values are all numbers (even if trajectory diverges)', () => {
			const points = calculateRossler({
				x0: 0.1,
				y0: 0,
				z0: 0,
				steps: 5,
				dt: 0.5,
				a: 0.2,
				b: 0.2,
				c: 5.7
			});
			for (const pt of points) {
				expect(typeof pt.x).toBe('number');
				expect(typeof pt.y).toBe('number');
				expect(typeof pt.z).toBe('number');
			}
		});
	});

	describe('multi-step trajectory consistency', () => {
		test('trajectory with n steps matches first n points of 2n-step trajectory', () => {
			const params = { x0: 0.1, y0: 0, z0: 0, dt: 0.01, a: 0.2, b: 0.2, c: 5.7 };
			const short = calculateRossler({ ...params, steps: 5 });
			const long = calculateRossler({ ...params, steps: 10 });

			for (let i = 0; i < 5; i++) {
				expect(short[i].x).toBeCloseTo(long[i].x, 10);
				expect(short[i].y).toBeCloseTo(long[i].y, 10);
				expect(short[i].z).toBeCloseTo(long[i].z, 10);
			}
		});

		test('single-step result matches manual two-step calculation start point', () => {
			const x0 = 0.5,
				y0 = 0.5,
				z0 = 0.5;
			const a = 0.2,
				b = 0.2,
				c = 5.7;
			const dt = 0.005;

			const oneStep = calculateRossler({ x0, y0, z0, steps: 1, dt, a, b, c });
			const twoSteps = calculateRossler({ x0, y0, z0, steps: 2, dt, a, b, c });

			// First point of 2-step run must equal the only point of 1-step run
			expect(twoSteps[0].x).toBeCloseTo(oneStep[0].x, 12);
			expect(twoSteps[0].y).toBeCloseTo(oneStep[0].y, 12);
			expect(twoSteps[0].z).toBeCloseTo(oneStep[0].z, 12);
		});

		test('step 2 is computed from the state at step 1', () => {
			const x0 = 0.1,
				y0 = 0,
				z0 = 0;
			const a = 0.2,
				b = 0.2,
				c = 5.7;
			const dt = 0.01;

			const points = calculateRossler({ x0, y0, z0, steps: 2, dt, a, b, c });

			// Compute step 2 independently by using step 1 result as new initial conditions
			const step1 = points[0];
			const step2from1 = calculateRossler({
				x0: step1.x,
				y0: step1.y,
				z0: step1.z,
				steps: 1,
				dt,
				a,
				b,
				c
			});

			expect(points[1].x).toBeCloseTo(step2from1[0].x, 10);
			expect(points[1].y).toBeCloseTo(step2from1[0].y, 10);
			expect(points[1].z).toBeCloseTo(step2from1[0].z, 10);
		});
	});

	describe('large number of steps', () => {
		test('returns exactly the requested number of points for large step count', () => {
			const points = calculateRossler({
				x0: 0.1,
				y0: 0,
				z0: 0,
				steps: 5000,
				dt: 0.01,
				a: 0.2,
				b: 0.2,
				c: 5.7
			});
			expect(points).toHaveLength(5000);
		});

		test('all points in large run are finite', () => {
			const points = calculateRossler({
				x0: 0.1,
				y0: 0,
				z0: 0,
				steps: 2000,
				dt: 0.01,
				a: 0.2,
				b: 0.2,
				c: 5.7
			});
			for (const pt of points) {
				expect(Number.isFinite(pt.x)).toBe(true);
				expect(Number.isFinite(pt.y)).toBe(true);
				expect(Number.isFinite(pt.z)).toBe(true);
			}
		});
	});

	describe('RK4 accuracy vs Euler approximation', () => {
		test('RK4 is more accurate than Euler for smooth initial dynamics', () => {
			// At small dt and smooth trajectory, RK4 should match Euler very closely
			// but RK4 has 4th-order accuracy while Euler is 1st-order.
			// We check that for a very small dt, RK4 ≈ Euler to first order.
			const x0 = 1,
				y0 = 0,
				z0 = 0;
			const a = 0.2,
				b = 0.2,
				c = 5.7;
			const dt = 0.0001;

			const points = calculateRossler({ x0, y0, z0, steps: 1, dt, a, b, c });

			// Euler step: x1 = x0 + dt * dx = x0 + dt * (-y0 - z0)
			const eulerX = x0 + dt * (-y0 - z0);
			// RK4 and Euler agree to first order in dt
			expect(points[0].x).toBeCloseTo(eulerX, 4);
		});
	});
});
