// src/lib/lorenz/integrators.test.ts
import { describe, expect, test } from 'bun:test';
import { lorenzDeriv, step, integrate } from './integrators';
import type { LorenzIntegrationParams } from './integrators';

const base: LorenzIntegrationParams = {
	sigma: 10,
	rho: 28,
	beta: 8 / 3,
	x0: 0.1,
	y0: 0,
	z0: 0,
	solver: 'rk4',
	dt: 0.005,
	steps: 500
};

describe('lorenzDeriv', () => {
	test('is zero at the origin', () => {
		const d = lorenzDeriv(0, 0, 0, 10, 28, 8 / 3);
		expect(d.dx).toBeCloseTo(0, 12);
		expect(d.dy).toBeCloseTo(0, 12);
		expect(d.dz).toBeCloseTo(0, 12);
	});

	test('matches the Lorenz equations at a sample point', () => {
		const d = lorenzDeriv(1, 2, 3, 10, 28, 8 / 3);
		expect(d.dx).toBeCloseTo(10 * (2 - 1), 12); // 10
		expect(d.dy).toBeCloseTo(1 * (28 - 3) - 2, 12); // 23
		expect(d.dz).toBeCloseTo(1 * 2 - (8 / 3) * 3, 12); // 2 - 8 = -6
	});
});

describe('step', () => {
	const p: LorenzIntegrationParams = { ...base, solver: 'euler' };

	test('euler step equals state + dt*derivative', () => {
		const next = step({ x: 1, y: 2, z: 3 }, p);
		const d = lorenzDeriv(1, 2, 3, p.sigma, p.rho, p.beta);
		expect(next.x).toBeCloseTo(1 + p.dt * d.dx, 12);
		expect(next.y).toBeCloseTo(2 + p.dt * d.dy, 12);
		expect(next.z).toBeCloseTo(3 + p.dt * d.dz, 12);
	});

	test('the origin is a fixed point for every solver', () => {
		for (const solver of ['euler', 'rk2', 'rk4'] as const) {
			const next = step({ x: 0, y: 0, z: 0 }, { ...base, solver });
			expect(next.x).toBeCloseTo(0, 12);
			expect(next.y).toBeCloseTo(0, 12);
			expect(next.z).toBeCloseTo(0, 12);
		}
	});

	test('rk4 differs from euler at a non-trivial point', () => {
		const e = step({ x: 1, y: 2, z: 3 }, { ...base, solver: 'euler' });
		const r = step({ x: 1, y: 2, z: 3 }, { ...base, solver: 'rk4' });
		expect(Math.abs(r.x - e.x) + Math.abs(r.y - e.y) + Math.abs(r.z - e.z)).toBeGreaterThan(0);
	});
});

describe('integrate', () => {
	test('returns positions of length steps*3 and speeds of length steps', () => {
		const result = integrate(base);
		expect(result.diverged).toBe(false);
		expect(result.positions.length).toBe(base.steps * 3);
		expect(result.speeds.length).toBe(base.steps);
	});

	test('speeds[0] equals the derivative magnitude at the first integrated point', () => {
		const result = integrate({ ...base, steps: 1 });
		// First integrated point:
		const first = step({ x: base.x0, y: base.y0, z: base.z0 }, { ...base, steps: 1 });
		const d = lorenzDeriv(first.x, first.y, first.z, base.sigma, base.rho, base.beta);
		const mag = Math.sqrt(d.dx * d.dx + d.dy * d.dy + d.dz * d.dz);
		expect(result.speeds[0]).toBeCloseTo(mag, 6);
	});

	test('flags diverged on a blow-up configuration', () => {
		const result = integrate({ ...base, solver: 'euler', dt: 10, steps: 200 });
		expect(result.diverged).toBe(true);
	});
});
