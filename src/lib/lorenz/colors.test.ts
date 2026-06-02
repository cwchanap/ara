// src/lib/lorenz/colors.test.ts
import { describe, expect, test } from 'bun:test';
import { computeColors } from './colors';
import type { LorenzResult } from './integrators';

function makeResult(points: [number, number, number][]): LorenzResult {
	const positions = new Float32Array(points.length * 3);
	const speeds = new Float32Array(points.length);
	points.forEach((pt, i) => {
		positions[i * 3] = pt[0];
		positions[i * 3 + 1] = pt[1];
		positions[i * 3 + 2] = pt[2];
		speeds[i] = i; // increasing speed
	});
	return { positions, speeds, diverged: false };
}

const result = makeResult([
	[0, 0, 0],
	[1, 1, 5],
	[2, 2, 10]
]);

describe('computeColors', () => {
	test('returns RGB triples in [0,1] of length points*3', () => {
		const colors = computeColors(result, 'time');
		expect(colors.length).toBe(9);
		for (const c of colors) {
			expect(c).toBeGreaterThanOrEqual(0);
			expect(c).toBeLessThanOrEqual(1);
		}
	});

	test('single mode is a constant neon-cyan across all vertices', () => {
		const colors = computeColors(result, 'single');
		expect(colors[0]).toBeCloseTo(colors[3], 6);
		expect(colors[1]).toBeCloseTo(colors[4], 6);
		expect(colors[2]).toBeCloseTo(colors[5], 6);
		// cyan #00f3ff => r≈0, g≈0.953, b≈1
		expect(colors[0]).toBeCloseTo(0, 2);
		expect(colors[2]).toBeCloseTo(1, 2);
	});

	test('time mode goes from cyan at the start to magenta at the end', () => {
		const colors = computeColors(result, 'time');
		const lastIdx = (result.speeds.length - 1) * 3;
		expect(colors[0]).toBeLessThan(colors[lastIdx]); // red rises toward magenta
	});

	test('divergence falls back to a single color when no ghost is provided', () => {
		const colors = computeColors(result, 'divergence');
		expect(colors[0]).toBeCloseTo(colors[3], 6);
	});

	test('divergence uses ghost separation when a ghost is provided', () => {
		const ghost = makeResult([
			[0, 0, 0],
			[1.5, 1, 5],
			[5, 2, 10]
		]);
		const colors = computeColors(result, 'divergence', { ghost });
		// Larger separation at the last point => different color than the first.
		expect(colors[0]).not.toBeCloseTo(colors[6], 3);
	});
});
