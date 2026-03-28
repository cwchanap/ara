import { describe, expect, it } from 'vitest';
import { calculateRossler } from './rossler';
import type { RosslerParams } from './rossler';

const defaultParams: RosslerParams = {
	x0: 1,
	y0: 0,
	z0: 0,
	steps: 100,
	dt: 0.01,
	a: 0.2,
	b: 0.2,
	c: 5.7
};

describe('calculateRossler', () => {
	it('returns an array of the correct length', () => {
		const points = calculateRossler(defaultParams);
		expect(points).toHaveLength(100);
	});

	it('returns objects with x, y, z properties', () => {
		const points = calculateRossler(defaultParams);
		expect(points[0]).toHaveProperty('x');
		expect(points[0]).toHaveProperty('y');
		expect(points[0]).toHaveProperty('z');
	});

	it('returns empty array when steps is 0', () => {
		const points = calculateRossler({ ...defaultParams, steps: 0 });
		expect(points).toHaveLength(0);
	});

	it('produces finite values for classic parameters', () => {
		const points = calculateRossler(defaultParams);
		for (const { x, y, z } of points) {
			expect(isFinite(x)).toBe(true);
			expect(isFinite(y)).toBe(true);
			expect(isFinite(z)).toBe(true);
		}
	});

	it('starting point is not included (first point is after first step)', () => {
		// The returned points are the state AFTER each integration step
		const points = calculateRossler({ ...defaultParams, steps: 1 });
		expect(points).toHaveLength(1);
		// The point should be different from the initial conditions (integration moved it)
		const { x, y, z } = points[0];
		// With small dt=0.01, values should be close but not identical to initial
		const isChanged =
			x !== defaultParams.x0 || y !== defaultParams.y0 || z !== defaultParams.z0;
		expect(isChanged).toBe(true);
	});

	it('larger dt produces more change per step', () => {
		const smallDt = calculateRossler({ ...defaultParams, steps: 1, dt: 0.001 });
		const largeDt = calculateRossler({ ...defaultParams, steps: 1, dt: 0.1 });
		// With larger dt, the displacement from initial should be greater
		const distSmall = Math.sqrt(
			(smallDt[0].x - defaultParams.x0) ** 2 +
				(smallDt[0].y - defaultParams.y0) ** 2 +
				(smallDt[0].z - defaultParams.z0) ** 2
		);
		const distLarge = Math.sqrt(
			(largeDt[0].x - defaultParams.x0) ** 2 +
				(largeDt[0].y - defaultParams.y0) ** 2 +
				(largeDt[0].z - defaultParams.z0) ** 2
		);
		expect(distLarge).toBeGreaterThan(distSmall);
	});

	it('works with single step', () => {
		const points = calculateRossler({ ...defaultParams, steps: 1 });
		expect(points).toHaveLength(1);
	});

	it('different parameters produce different trajectories', () => {
		const points1 = calculateRossler(defaultParams);
		const points2 = calculateRossler({ ...defaultParams, a: 0.3 });
		// After 100 steps, the trajectories should diverge
		const lastDiff = Math.abs(points1[99].x - points2[99].x);
		expect(lastDiff).toBeGreaterThan(0);
	});
});
