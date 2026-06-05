// src/lib/lorenz/defaults.test.ts
import { describe, expect, test } from 'vitest';
import { LORENZ_DEFAULTS, withLorenzDefaults } from './defaults';

describe('withLorenzDefaults', () => {
	test('fills every optional field when only sigma/rho/beta are given', () => {
		const resolved = withLorenzDefaults({ type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 });
		expect(resolved.solver).toBe(LORENZ_DEFAULTS.solver);
		expect(resolved.dt).toBe(LORENZ_DEFAULTS.dt);
		expect(resolved.trailLength).toBe(LORENZ_DEFAULTS.trailLength);
		expect(resolved.trailStyle).toBe(LORENZ_DEFAULTS.trailStyle);
		expect(resolved.colorMode).toBe(LORENZ_DEFAULTS.colorMode);
		expect(resolved.viewMode).toBe(LORENZ_DEFAULTS.viewMode);
		expect(resolved.showGhost).toBe(LORENZ_DEFAULTS.showGhost);
		expect(resolved.epsilon).toBe(LORENZ_DEFAULTS.epsilon);
		expect(resolved.x0).toBe(LORENZ_DEFAULTS.x0);
	});

	test('preserves provided overrides', () => {
		const resolved = withLorenzDefaults({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 8 / 3,
			solver: 'euler',
			dt: 0.01,
			showGhost: true,
			colorMode: 'zheight'
		});
		expect(resolved.solver).toBe('euler');
		expect(resolved.dt).toBe(0.01);
		expect(resolved.showGhost).toBe(true);
		expect(resolved.colorMode).toBe('zheight');
		expect(resolved.sigma).toBe(10);
	});
});
