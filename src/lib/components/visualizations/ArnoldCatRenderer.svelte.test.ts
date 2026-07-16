import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick, mount, unmount } from 'svelte';
import * as arnoldCat from '$lib/arnold-cat';
import ArnoldCatRenderer from './ArnoldCatRenderer.svelte';
import { createReactiveProps } from './arnold-cat-test-helpers.svelte';

// jsdom doesn't implement canvas getContext — stub it
beforeEach(() => {
	const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext') as unknown as {
		mockReturnValue: (v: unknown) => void;
	};
	spy.mockReturnValue({
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		set fillStyle(_v: string) {},
		get fillStyle() {
			return '';
		}
	});
});

// jsdom doesn't implement RAF — default stub returns an ID without invoking.
// Tests that need renderFrame to actually run use `installRafPump`.
beforeEach(() => {
	vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/**
 * Install a RAF mock that synchronously invokes the callback a limited
 * number of times, then stops. This exercises renderFrame without infinite recursion.
 */
function installRafPump(maxCalls: number): void {
	let calls = 0;
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		calls += 1;
		if (calls <= maxCalls) {
			cb(calls * 200);
		}
		return calls;
	});
}

/**
 * Install an async RAF mock that schedules frames via setTimeout with
 * incrementing timestamps so Svelte effects can run between frames.
 */
function installAsyncRafPump(maxCalls: number): void {
	let calls = 0;
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		calls += 1;
		if (calls <= maxCalls) {
			setTimeout(() => cb(calls * 200), 0);
		}
		return calls;
	});
}

/** Wait for scheduled setTimeout-based RAF frames to flush. */
async function waitForFrames(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 50));
}

function readIteration(root: ParentNode): number {
	const label = root.querySelector('[data-testid="iteration-label"]');
	return Number(label?.textContent?.replace(/\D/g, '') ?? -1);
}

describe('ArnoldCatRenderer', () => {
	test('mounts without errors and creates canvas', () => {
		const { container } = render(ArnoldCatRenderer);
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	test('creates the LIVE_RENDER badge', () => {
		const { container } = render(ArnoldCatRenderer);
		expect(container.textContent).toContain('LIVE_RENDER');
	});

	test('cancelAnimationFrame is called on unmount', () => {
		const { unmount: um } = render(ArnoldCatRenderer);
		um();
		expect(cancelAnimationFrame).toHaveBeenCalled();
	});

	test('signal init skip: after mount, iteration label shows 0', () => {
		const { container } = render(ArnoldCatRenderer, {
			props: { pointCount: 100, paused: true }
		});
		expect(container.textContent).toContain('ITERATION: 0');
		expect(readIteration(container)).toBe(0);
	});

	test('stepSignal increments iteration when pump runs', async () => {
		installAsyncRafPump(500);
		const [props, updateProps] = createReactiveProps({
			pointCount: 100,
			speed: 1,
			paused: true,
			stepSignal: 0
		});
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(ArnoldCatRenderer, { target, props });

		await waitForFrames();
		expect(readIteration(target)).toBe(0);

		updateProps({ stepSignal: 1 });
		await tick();
		await waitForFrames();
		expect(readIteration(target)).toBe(1);

		unmount(component);
		target.remove();
	});

	test('paused=true does not advance via time pump', async () => {
		// Controlled timestamps spanning ~1s at 60fps — must not advance when paused
		const timestamps: number[] = [];
		for (let i = 0; i <= 60; i++) timestamps.push(i * (1000 / 60));

		let idx = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			const t = timestamps[Math.min(idx, timestamps.length - 1)];
			idx += 1;
			if (idx <= timestamps.length) queueMicrotask(() => cb(t));
			return idx;
		});

		const { container } = render(ArnoldCatRenderer, {
			props: { speed: 5, pointCount: 100, paused: true }
		});
		await new Promise((r) => setTimeout(r, 50));
		expect(readIteration(container)).toBe(0);
	});

	test('extreme pointCount prop does not throw and still mounts', () => {
		expect(() => {
			const { container } = render(ArnoldCatRenderer, {
				props: { pointCount: 1e9, paused: true }
			});
			expect(container.querySelector('canvas')).toBeTruthy();
			expect(container.textContent).toContain('LIVE_RENDER');
			// Clamped length exposed for verification (≤ 10000)
			const countEl = container.querySelector('[data-testid="point-count"]');
			if (countEl) {
				const n = Number(countEl.textContent);
				expect(n).toBeLessThanOrEqual(10000);
				expect(n).toBeGreaterThanOrEqual(100);
			}
		}).not.toThrow();
	});

	test('renderer applies ~5 steps over 1s at speed 5 regardless of frame count pattern', async () => {
		const timestamps: number[] = [];
		// 60 frames at 16.666ms
		for (let i = 0; i <= 60; i++) timestamps.push(i * (1000 / 60));

		let idx = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			const t = timestamps[Math.min(idx, timestamps.length - 1)];
			idx += 1;
			if (idx <= timestamps.length) queueMicrotask(() => cb(t));
			return idx;
		});

		const { container } = render(ArnoldCatRenderer, {
			props: { speed: 5, pointCount: 100, paused: false }
		});
		await new Promise((r) => setTimeout(r, 50));
		const n = readIteration(container);
		// allow off-by-one from first-frame lastTimestamp init
		expect(n).toBeGreaterThanOrEqual(4);
		expect(n).toBeLessThanOrEqual(6);
	});

	test('resetSignal clears residual acc so short interval does not jump', async () => {
		// Deterministic manual RAF pump (no setTimeout timing flakiness).
		// Capture acc on entry to advanceArnoldCatSimulation (state is mutated in-place).
		let rafCallback: ((t: number) => void) | null = null;
		let rafTime = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			rafCallback = cb;
			return 1;
		});
		vi.stubGlobal('cancelAnimationFrame', () => {
			rafCallback = null;
		});

		function fireFrames(count: number, dtMs: number) {
			for (let i = 0; i < count; i++) {
				rafTime += dtMs;
				const cb = rafCallback;
				rafCallback = null;
				if (cb) cb(rafTime);
			}
		}

		const originalAdvance = arnoldCat.advanceArnoldCatSimulation;
		const accOnEntry: number[] = [];
		vi.spyOn(arnoldCat, 'advanceArnoldCatSimulation').mockImplementation(
			(state, dtSeconds, stepsPerSec, maxFrameDt, maxStepsPerFrame) => {
				accOnEntry.push(state.acc);
				return originalAdvance(state, dtSeconds, stepsPerSec, maxFrameDt, maxStepsPerFrame);
			}
		);

		const [props, updateProps] = createReactiveProps({
			pointCount: 100,
			speed: 5,
			paused: false,
			resetSignal: 0
		});
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(ArnoldCatRenderer, { target, props });

		// Wait for onMount to flush (sets initialized, calls requestAnimationFrame)
		await tick();

		// Fire 20 frames of 50ms at speed 5 → 5 steps + residual acc
		fireFrames(20, 50);
		const beforeReset = readIteration(target);
		expect(beforeReset).toBeGreaterThanOrEqual(4);
		expect(accOnEntry.length).toBeGreaterThan(0);

		// Pause + reset → iteration 0 and acc 0
		updateProps({ paused: true, resetSignal: 1 });
		await tick();
		fireFrames(1, 50); // frame while paused (label update only)
		expect(readIteration(target)).toBe(0);

		// Resume and fire one short frame (30ms at speed 5 → +0.15 acc → 0 whole steps).
		// First advance after reset must see acc === 0 (residual cleared).
		const lenBeforeResume = accOnEntry.length;
		updateProps({ paused: false });
		await tick();
		fireFrames(1, 30);
		expect(accOnEntry.length).toBeGreaterThan(lenBeforeResume);
		expect(accOnEntry[lenBeforeResume]).toBe(0);

		// Short post-reset interval must not jump iteration from stale acc
		expect(readIteration(target)).toBe(0);

		unmount(component);
		target.remove();
	});

	test('randomizeSignal clears residual acc so short interval does not jump', async () => {
		// Same residual-acc coverage as resetSignal, but for randomizeSignal.
		// Design spec (line 492) requires both reset and randomize to clear acc.
		// Uses a deterministic manual RAF pump (no setTimeout timing flakiness).
		let rafCallback: ((t: number) => void) | null = null;
		let rafTime = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			rafCallback = cb;
			return 1;
		});
		vi.stubGlobal('cancelAnimationFrame', () => {
			rafCallback = null;
		});

		function fireFrames(count: number, dtMs: number) {
			for (let i = 0; i < count; i++) {
				rafTime += dtMs;
				const cb = rafCallback;
				rafCallback = null;
				if (cb) cb(rafTime);
			}
		}

		const originalAdvance = arnoldCat.advanceArnoldCatSimulation;
		const accOnEntry: number[] = [];
		vi.spyOn(arnoldCat, 'advanceArnoldCatSimulation').mockImplementation(
			(state, dtSeconds, stepsPerSec, maxFrameDt, maxStepsPerFrame) => {
				accOnEntry.push(state.acc);
				return originalAdvance(state, dtSeconds, stepsPerSec, maxFrameDt, maxStepsPerFrame);
			}
		);

		const [props, updateProps] = createReactiveProps({
			pointCount: 100,
			speed: 5,
			paused: false,
			randomizeSignal: 0
		});
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(ArnoldCatRenderer, { target, props });

		// Wait for onMount to flush (sets initialized, calls requestAnimationFrame)
		await tick();

		// Fire 20 frames of 50ms at speed 5 → 5 steps + residual acc
		fireFrames(20, 50);
		expect(readIteration(target)).toBeGreaterThanOrEqual(4);
		expect(accOnEntry.length).toBeGreaterThan(0);

		// Pause + randomize → iteration 0 and acc 0
		updateProps({ paused: true, randomizeSignal: 1 });
		await tick();
		fireFrames(1, 50); // frame while paused (label update only)
		expect(readIteration(target)).toBe(0);

		// Resume and fire one short frame (30ms at speed 5 → +0.15 acc → 0 whole steps).
		// First advance after randomize must see acc === 0 (residual cleared).
		const lenBeforeResume = accOnEntry.length;
		updateProps({ paused: false });
		await tick();
		fireFrames(1, 30);
		expect(accOnEntry.length).toBeGreaterThan(lenBeforeResume);
		expect(accOnEntry[lenBeforeResume]).toBe(0);

		// Short post-randomize interval must not jump iteration from stale acc
		expect(readIteration(target)).toBe(0);

		unmount(component);
		target.remove();
	});

	test('renderFrame draws points when RAF pump is installed', () => {
		installRafPump(3);
		const { container } = render(ArnoldCatRenderer, {
			props: { pointCount: 100, speed: 1 }
		});
		const canvas = container.querySelector('canvas')!;
		expect(canvas).toBeTruthy();
		const ctx = canvas.getContext('2d')!;
		expect(ctx.fillRect).toHaveBeenCalled();
	});

	test('accepts speed and paused props', () => {
		const { container } = render(ArnoldCatRenderer, {
			props: { speed: 5, paused: true, pointCount: 100 }
		});
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	test('cleans up on unmount without throwing', () => {
		const { unmount: um } = render(ArnoldCatRenderer);
		expect(() => um()).not.toThrow();
	});

	test('pointCount change after mount reinitializes distribution', async () => {
		const [props, updateProps] = createReactiveProps({
			pointCount: 100,
			speed: 1,
			paused: true
		});
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(ArnoldCatRenderer, { target, props });

		// onMount calls initDistribution; tick flushes it.
		await tick();
		const countEl = target.querySelector('[data-testid="point-count"]');
		expect(Number(countEl?.textContent)).toBe(100);

		// Change pointCount after mount — triggers the $effect past the
		// !initialized guard, calling initDistribution.
		updateProps({ pointCount: 500 });
		await tick();
		expect(Number(countEl?.textContent)).toBe(500);

		unmount(component);
		target.remove();
	});

	test('stepSignal change while not paused does not apply manual step', async () => {
		// Deterministic manual RAF pump (no setTimeout timing flakiness).
		let rafCallback: ((t: number) => void) | null = null;
		let rafTime = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			rafCallback = cb;
			return 1;
		});
		vi.stubGlobal('cancelAnimationFrame', () => {
			rafCallback = null;
		});

		function fireFrames(count: number, dtMs: number) {
			for (let i = 0; i < count; i++) {
				rafTime += dtMs;
				const cb = rafCallback;
				rafCallback = null;
				if (cb) cb(rafTime);
			}
		}

		// Track pump steps so we can distinguish time-pump advancement from a
		// manual doStep. Both call applyArnoldCatStepInPlace + increment
		// iterationCount, so only the delta-vs-pump comparison isolates doStep.
		const originalAdvance = arnoldCat.advanceArnoldCatSimulation;
		let pumpSteps = 0;
		vi.spyOn(arnoldCat, 'advanceArnoldCatSimulation').mockImplementation(
			(state, dtSeconds, stepsPerSec, maxFrameDt, maxStepsPerFrame) => {
				const steps = originalAdvance(
					state,
					dtSeconds,
					stepsPerSec,
					maxFrameDt,
					maxStepsPerFrame
				);
				pumpSteps += steps;
				return steps;
			}
		);

		const [props, updateProps] = createReactiveProps({
			pointCount: 100,
			speed: 5,
			paused: false,
			stepSignal: 0
		});
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(ArnoldCatRenderer, { target, props });

		await tick();

		// 150ms frame intervals: frameDt is clamped to MAX_FRAME_DT (0.05s)
		// so pump behavior is identical to 50ms frames, but the raw timestamp
		// always exceeds the 100ms label throttle — so the label updates every
		// frame and before/after reflect the exact iterationCount.
		fireFrames(20, 150);
		const before = readIteration(target);
		expect(before).toBeGreaterThan(0); // pump advanced

		// Reset pump counter; change stepSignal while not paused.
		// Effect runs but doStep is skipped (false branch of `if (paused) doStep()`).
		pumpSteps = 0;
		updateProps({ stepSignal: 1 });
		await tick();

		// Fire one frame to flush the iteration label and advance the pump.
		fireFrames(1, 150);
		const pumpStepsThisFrame = pumpSteps;
		const after = readIteration(target);

		// The iteration delta must equal the pump's contribution only.
		// If doStep incorrectly ran, the delta would be pumpStepsThisFrame + 1.
		expect(after - before).toBe(pumpStepsThisFrame);

		unmount(component);
		target.remove();
	});
});
