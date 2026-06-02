// src/lib/lorenz/lyapunov.test.ts
import { describe, expect, test } from 'bun:test';
import { estimateLargestLyapunov, LYAPUNOV_STEPS } from './lyapunov';
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
	steps: LYAPUNOV_STEPS
};

describe('estimateLargestLyapunov', () => {
	test('classic Lorenz is chaotic with positive λ₁', () => {
		const est = estimateLargestLyapunov(base);
		expect(est.diverged).toBe(false);
		expect(est.value).toBeGreaterThan(0.5);
		expect(est.classification).toBe('chaotic');
	});

	test('low-ρ Lorenz is not chaotic', () => {
		const est = estimateLargestLyapunov({ ...base, rho: 10 });
		expect(est.value).toBeLessThan(0.1);
		expect(est.classification).not.toBe('chaotic');
	});

	test('flags diverged on a blow-up configuration', () => {
		const est = estimateLargestLyapunov({ ...base, dt: 10, steps: 200 });
		expect(est.diverged).toBe(true);
	});
});
