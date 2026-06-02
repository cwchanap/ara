// src/lib/lorenz/presets.test.ts
import { describe, expect, test } from 'bun:test';
import { LORENZ_PRESETS, matchPreset } from './presets';

describe('LORENZ_PRESETS', () => {
	test('classic preset is the canonical Lorenz parameters', () => {
		const classic = LORENZ_PRESETS.find((p) => p.id === 'classic');
		expect(classic).toBeDefined();
		expect(classic!.sigma).toBe(10);
		expect(classic!.rho).toBe(28);
		expect(classic!.beta).toBeCloseTo(8 / 3, 12);
	});

	test('every preset is within the documented ρ slider range [0, 100]', () => {
		for (const p of LORENZ_PRESETS) {
			expect(p.rho).toBeGreaterThanOrEqual(0);
			expect(p.rho).toBeLessThanOrEqual(100);
			expect(p.sigma).toBeGreaterThanOrEqual(0);
			expect(p.sigma).toBeLessThanOrEqual(50);
			expect(p.beta).toBeGreaterThanOrEqual(0);
			expect(p.beta).toBeLessThanOrEqual(10);
		}
	});
});

describe('matchPreset', () => {
	test('matches an exact preset by id', () => {
		expect(matchPreset({ sigma: 10, rho: 28, beta: 8 / 3 })).toBe('classic');
		expect(matchPreset({ sigma: 10, rho: 40, beta: 8 / 3 })).toBe('chaotic');
	});

	test('returns "custom" when no preset matches', () => {
		expect(matchPreset({ sigma: 3, rho: 7, beta: 1 })).toBe('custom');
	});
});
