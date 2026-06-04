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
