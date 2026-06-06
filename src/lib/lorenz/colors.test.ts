import { describe, expect, test, it } from 'vitest';
import { computeColors } from './colors';
import type { LorenzResult } from './integrators';

function makeResult(points: [number, number, number][]): LorenzResult {
	const positions = new Float32Array(points.length * 3);
	const speeds = new Float32Array(points.length);
	points.forEach((pt, i) => {
		positions[i * 3] = pt[0];
		positions[i * 3 + 1] = pt[1];
		positions[i * 3 + 2] = pt[2];
		speeds[i] = i;
	});
	return { positions, speeds, diverged: false };
}

function makeResultWithSpeeds(points: [number, number, number][], speeds: number[]): LorenzResult {
	const positions = new Float32Array(points.length * 3);
	const speedArr = new Float32Array(speeds.length);
	points.forEach((pt, i) => {
		positions[i * 3] = pt[0];
		positions[i * 3 + 1] = pt[1];
		positions[i * 3 + 2] = pt[2];
		speedArr[i] = speeds[i];
	});
	return { positions, speeds: speedArr, diverged: false };
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
		expect(colors[0]).toBeCloseTo(0, 2);
		expect(colors[2]).toBeCloseTo(1, 2);
	});

	test('time mode goes from cyan at the start to magenta at the end', () => {
		const colors = computeColors(result, 'time');
		const lastIdx = (result.speeds.length - 1) * 3;
		expect(colors[0]).toBeLessThan(colors[lastIdx]);
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
		expect(colors[0]).not.toBeCloseTo(colors[6], 3);
	});

	test('speed mode maps speed to gradient', () => {
		const colors = computeColors(result, 'speed');
		expect(colors.length).toBe(9);
		for (const c of colors) {
			expect(c).toBeGreaterThanOrEqual(0);
			expect(c).toBeLessThanOrEqual(1);
		}
		const r0 = colors[0];
		const r6 = colors[6];
		expect(r0).toBeLessThan(r6);
	});

	test('speed mode with zero speeds maps all to cyan', () => {
		const zeroResult = makeResultWithSpeeds(
			[
				[1, 2, 3],
				[4, 5, 6]
			],
			[0, 0]
		);
		const colors = computeColors(zeroResult, 'speed');
		expect(colors[0]).toBeCloseTo(colors[3], 6);
		expect(colors[1]).toBeCloseTo(colors[4], 6);
		expect(colors[2]).toBeCloseTo(colors[5], 6);
	});

	test('zheight mode maps z-position to gradient', () => {
		const colors = computeColors(result, 'zheight');
		expect(colors.length).toBe(9);
		for (const c of colors) {
			expect(c).toBeGreaterThanOrEqual(0);
			expect(c).toBeLessThanOrEqual(1);
		}
		const r0 = colors[0];
		const r6 = colors[6];
		expect(r0).toBeLessThan(r6);
	});

	test('zheight mode with flat z values falls back to division by 1', () => {
		const flatResult = makeResultWithSpeeds(
			[
				[1, 2, 5],
				[3, 4, 5],
				[5, 6, 5]
			],
			[0, 1, 2]
		);
		const colors = computeColors(flatResult, 'zheight');
		expect(colors[0]).toBeCloseTo(colors[3], 6);
		expect(colors[3]).toBeCloseTo(colors[6], 6);
	});

	test('empty result returns empty Float32Array', () => {
		const empty: LorenzResult = {
			positions: new Float32Array(0),
			speeds: new Float32Array(0),
			diverged: false
		};
		const colors = computeColors(empty, 'time');
		expect(colors.length).toBe(0);
	});
});

// ════════════════════════════════════════════════════════════════════════════
// Merged from colors.vitest.ts (exact-color-value assertions)
// ════════════════════════════════════════════════════════════════════════════

function makeColorResult(points: [number, number, number][], speeds?: number[]): LorenzResult {
	const positions = new Float32Array(points.length * 3);
	const s = new Float32Array(points.length);
	points.forEach((pt, i) => {
		positions[i * 3] = pt[0];
		positions[i * 3 + 1] = pt[1];
		positions[i * 3 + 2] = pt[2];
		s[i] = speeds ? speeds[i] : i;
	});
	return { positions, speeds: s, diverged: false };
}

describe('colors.ts', () => {
	it('handles empty results', () => {
		const result = makeColorResult([]);
		const colors = computeColors(result, 'single');
		expect(colors.length).toBe(0);
	});

	it('handles single mode', () => {
		const result = makeColorResult([
			[1, 2, 3],
			[4, 5, 6]
		]);
		const colors = computeColors(result, 'single');
		expect(colors.length).toBe(6);
		// CYAN is { r: 0, g: 0.953, b: 1 } (approximately)
		expect(colors[0]).toBe(0);
		expect(colors[1]).toBeCloseTo(0.9529, 3);
		expect(colors[2]).toBe(1);
		expect(colors[3]).toBe(0);
		expect(colors[4]).toBeCloseTo(0.9529, 3);
		expect(colors[5]).toBe(1);
	});

	it('handles time mode', () => {
		const result = makeColorResult([
			[1, 2, 3],
			[4, 5, 6]
		]);
		const colors = computeColors(result, 'time');
		expect(colors.length).toBe(6);
		// first point is CYAN
		expect(colors[0]).toBe(0);
		expect(colors[2]).toBe(1);
		// last point is MAGENTA (188/255, 19/255, 254/255) => (0.737, 0.0745, 0.996)
		expect(colors[3]).toBeCloseTo(0.737, 3);
		expect(colors[5]).toBeCloseTo(0.996, 3);
	});

	it('handles time mode with a single point', () => {
		const result = makeColorResult([[1, 2, 3]]);
		const colors = computeColors(result, 'time');
		expect(colors.length).toBe(3);
		expect(colors[0]).toBe(0); // CYAN
	});

	it('handles speed mode when max speed > 0', () => {
		const result = makeColorResult(
			[
				[0, 0, 0],
				[1, 1, 1]
			],
			[1, 2]
		);
		const colors = computeColors(result, 'speed');
		expect(colors.length).toBe(6);
		// first is 1/2 speed (0.5 t), second is 2/2 speed (1.0 t)
		expect(colors[3]).toBeCloseTo(0.737, 3); // MAGENTA
	});

	it('handles speed mode when max speed == 0', () => {
		const result = makeColorResult(
			[
				[0, 0, 0],
				[1, 1, 1]
			],
			[0, 0]
		);
		const colors = computeColors(result, 'speed');
		expect(colors[0]).toBe(0); // CYAN
		expect(colors[3]).toBe(0); // CYAN
	});

	it('handles zheight mode when range > 0', () => {
		const result = makeColorResult([
			[0, 0, 10],
			[0, 0, 20]
		]);
		const colors = computeColors(result, 'zheight');
		// min z is 10, max z is 20. first is 0.0 t, second is 1.0 t
		expect(colors[0]).toBe(0); // CYAN
		expect(colors[3]).toBeCloseTo(0.737, 3); // MAGENTA
	});

	it('handles zheight mode when range == 0', () => {
		const result = makeColorResult([
			[0, 0, 10],
			[0, 0, 10]
		]);
		const colors = computeColors(result, 'zheight');
		// range is 0. t is 0
		expect(colors[0]).toBe(0); // CYAN
		expect(colors[3]).toBe(0); // CYAN
	});

	it('handles divergence mode without ghost', () => {
		const result = makeColorResult([[0, 0, 0]]);
		const colors = computeColors(result, 'divergence');
		expect(colors[0]).toBe(0); // CYAN
	});

	it('handles divergence mode with ghost when max dist > 0', () => {
		const result = makeColorResult([
			[0, 0, 0],
			[1, 2, 3]
		]);
		const ghost = makeColorResult([
			[0, 0, 0],
			[2, 4, 6]
		]);
		const colors = computeColors(result, 'divergence', { ghost });
		// dist at 0 is 0. dist at 1 is sqrt(1+4+9) = sqrt(14). max dist is sqrt(14)
		expect(colors[0]).toBe(0); // CYAN
		expect(colors[3]).toBeCloseTo(0.737, 3); // MAGENTA
	});

	it('handles divergence mode with ghost when max dist == 0', () => {
		const result = makeColorResult([
			[0, 0, 0],
			[1, 2, 3]
		]);
		const ghost = makeColorResult([
			[0, 0, 0],
			[1, 2, 3]
		]);
		const colors = computeColors(result, 'divergence', { ghost });
		expect(colors[0]).toBe(0); // CYAN
		expect(colors[3]).toBe(0); // CYAN
	});

	it('clamps interpolation input values in clamp01', () => {
		// We can test clamp01 via speed mode with custom speeds to get values <0 or >1 if possible,
		// or just check that they behave correctly. Let's make sure it covers the clamp branches.
		// Wait, clamp01 is called via writeGradient. Inside writeGradient, `const c = clamp01(t);`
		// In speed mode, t = result.speeds[i] / max. Since speeds can be negative?
		// Wait, speed is calculated as a norm so it shouldn't be negative in real calculations,
		// but we can pass negative speeds to makeColorResult to force t < 0.
		const result = makeColorResult(
			[
				[0, 0, 0],
				[1, 1, 1],
				[2, 2, 2]
			],
			[-5, 10, 20]
		);
		const colors = computeColors(result, 'speed');
		// first speed is -5, max is 20. -5/20 = -0.25 => clamp to 0 => CYAN
		expect(colors[0]).toBe(0);
		// second speed is 10, max is 20. 10/20 = 0.5 => CYAN/MAGENTA mix
		// third speed is 20, max is 20. 20/20 = 1 => MAGENTA
		expect(colors[6]).toBeCloseTo(0.737, 3);
	});
});
