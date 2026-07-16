import { describe, expect, test } from 'vitest';
import {
	applyArnoldCatStepInPlace,
	applyArnoldCatInverseInPlace,
	torusToPixel,
	torusToPixelY,
	advanceArnoldCatSimulation,
	type ArnoldCatSimState
} from './arnold-cat';

describe('applyArnoldCatStepInPlace', () => {
	test('maps known one-step pairs', () => {
		const xs = new Uint32Array([0, 1, 0, 5]);
		const ys = new Uint32Array([0, 0, 1, 7]);
		applyArnoldCatStepInPlace(xs, ys);
		// (x',y') = (x+y, x+2y) mod 2^32
		expect(Array.from(xs)).toEqual([0, 1, 1, 12]);
		expect(Array.from(ys)).toEqual([0, 1, 2, 19]);
	});

	test('wraps near 2^32', () => {
		const xs = new Uint32Array([0xffffffff, 0xfffffffe]);
		const ys = new Uint32Array([1, 3]);
		applyArnoldCatStepInPlace(xs, ys);
		expect(xs[0]).toBe(0); // ffffffff+1
		expect(ys[0]).toBe(1); // ffffffff + 2 = 1 (mod 2^32)
		expect(xs[1]).toBe(1); // fffffffe+3
		expect(ys[1]).toBe(4); // fffffffe + 6
	});

	test('respects count parameter', () => {
		const xs = new Uint32Array([1, 9]);
		const ys = new Uint32Array([0, 9]);
		applyArnoldCatStepInPlace(xs, ys, 1);
		expect(xs[0]).toBe(1);
		expect(ys[0]).toBe(1);
		expect(xs[1]).toBe(9);
		expect(ys[1]).toBe(9);
	});
});

describe('applyArnoldCatInverseInPlace', () => {
	test('recovers after k forward steps', () => {
		const n = 200;
		const xs = new Uint32Array(n);
		const ys = new Uint32Array(n);
		const ix = new Uint32Array(n);
		const iy = new Uint32Array(n);
		for (let i = 0; i < n; i++) {
			const x = (Math.imul(i + 1, 2654435761) >>> 0) >>> 0;
			const y = (Math.imul(i + 7, 1597334677) >>> 0) >>> 0;
			xs[i] = x;
			ys[i] = y;
			ix[i] = x;
			iy[i] = y;
		}
		const k = 1000;
		for (let s = 0; s < k; s++) applyArnoldCatStepInPlace(xs, ys);
		for (let s = 0; s < k; s++) applyArnoldCatInverseInPlace(xs, ys);
		expect(Array.from(xs)).toEqual(Array.from(ix));
		expect(Array.from(ys)).toEqual(Array.from(iy));
	});
});

describe('torusToPixel / torusToPixelY', () => {
	test('maps into [0, dim-1] and never returns dim', () => {
		const dim = 600;
		expect(torusToPixel(0, dim)).toBe(0);
		expect(torusToPixel(0xffffffff, dim)).toBeLessThan(dim);
		expect(torusToPixel(0x80000000, dim)).toBeGreaterThanOrEqual(0);
		expect(torusToPixelY(0, dim)).toBe(dim - 1); // y=0 at bottom
		expect(torusToPixelY(0xffffffff, dim)).toBeGreaterThanOrEqual(0);
		expect(torusToPixelY(0xffffffff, dim)).toBeLessThan(dim);
	});

	test('dim <= 1 returns 0', () => {
		expect(torusToPixel(123, 1)).toBe(0);
		expect(torusToPixelY(123, 0)).toBe(0);
	});
});

describe('advanceArnoldCatSimulation', () => {
	function makeState(overrides: Partial<ArnoldCatSimState> = {}): ArnoldCatSimState {
		return {
			xs: new Uint32Array([1]),
			ys: new Uint32Array([0]),
			acc: 0,
			iterationCount: 0,
			paused: false,
			...overrides
		};
	}

	const MAX_FRAME_DT = 0.05;
	const MAX_STEPS = 30;

	test('is display-rate independent for 30 vs 60 FPS over 1s at speed 5', () => {
		const a = makeState();
		const b = makeState();
		const speed = 5;
		// 60 FPS: 60 frames of 1/60 s
		for (let i = 0; i < 60; i++) {
			advanceArnoldCatSimulation(a, 1 / 60, speed, MAX_FRAME_DT, MAX_STEPS);
		}
		// 30 FPS: 30 frames of 1/30 s
		for (let i = 0; i < 30; i++) {
			advanceArnoldCatSimulation(b, 1 / 30, speed, MAX_FRAME_DT, MAX_STEPS);
		}
		expect(a.iterationCount).toBe(5);
		expect(b.iterationCount).toBe(5);
		expect(a.acc).toBeLessThan(1);
		expect(b.acc).toBeLessThan(1);
	});

	test('speed=1 for ~1s at 60 FPS applies 1 step not 60', () => {
		const s = makeState();
		for (let i = 0; i < 60; i++) {
			advanceArnoldCatSimulation(s, 1 / 60, 1, MAX_FRAME_DT, MAX_STEPS);
		}
		expect(s.iterationCount).toBe(1);
	});

	test('fractional accumulation across two 100ms frames at speed 5', () => {
		const s = makeState();
		// Plan used MAX_FRAME_DT (0.05) here, but 100ms > 50ms would hitch-clamp credit
		// to 0.25 and contradict the intended acc=0.5 → 1-step story. Cap at 0.1 so
		// these frames are treated as normal (hitch discard is covered by its own test).
		const frameCap = 0.1;
		advanceArnoldCatSimulation(s, 0.1, 5, frameCap, MAX_STEPS);
		expect(s.iterationCount).toBe(0);
		expect(s.acc).toBeCloseTo(0.5, 8);
		advanceArnoldCatSimulation(s, 0.1, 5, frameCap, MAX_STEPS);
		expect(s.iterationCount).toBe(1);
		expect(s.acc).toBeCloseTo(0, 8);
	});

	test('MAX_FRAME_DT discards hitch excess', () => {
		const s = makeState();
		advanceArnoldCatSimulation(s, 1.0, 30, MAX_FRAME_DT, MAX_STEPS);
		// credit min(1, 0.05)*30 = 1.5 → 1 whole step
		expect(s.iterationCount).toBe(1);
		expect(s.acc).toBeCloseTo(0.5, 8);
	});

	test('paused freezes iteration and acc', () => {
		const s = makeState({ acc: 0.25, paused: true });
		advanceArnoldCatSimulation(s, 0.1, 5, MAX_FRAME_DT, MAX_STEPS);
		expect(s.iterationCount).toBe(0);
		expect(s.acc).toBe(0.25);
	});
});
