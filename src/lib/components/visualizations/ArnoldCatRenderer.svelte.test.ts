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
		// setTimeout-based RAF so frames interleave with awaits.
		// Capture acc on entry to advanceArnoldCatSimulation (state is mutated in-place).
		// autoAdvance can be frozen so post-reset only injects a controlled short dt.
		let t = 0;
		let autoAdvance = true;
		let pendingBoostMs = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			const id = setTimeout(() => {
				if (pendingBoostMs > 0) {
					t += pendingBoostMs;
					pendingBoostMs = 0;
				} else if (autoAdvance) {
					t += 50;
				}
				cb(t);
			}, 0);
			return id as unknown as number;
		});
		vi.stubGlobal('cancelAnimationFrame', (id: number) => {
			clearTimeout(id);
		});

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

		// Build iterations + residual acc via wall-clock frames
		await new Promise((r) => setTimeout(r, 80));
		const beforeReset = readIteration(target);
		expect(beforeReset).toBeGreaterThanOrEqual(4);
		expect(accOnEntry.length).toBeGreaterThan(0);

		// Pause + reset → iteration 0 and acc 0
		updateProps({ paused: true, resetSignal: 1 });
		await tick();
		await new Promise((r) => setTimeout(r, 40));
		expect(readIteration(target)).toBe(0);

		// Freeze auto-advance so wall-clock flushes cannot flood steps.
		// Resume then inject one 30ms boost (speed 5 → +0.15 acc → 0 whole steps).
		// First advance after reset must see acc === 0 (residual cleared).
		autoAdvance = false;
		await new Promise((r) => setTimeout(r, 20)); // drain queued frames at frozen t
		updateProps({ paused: false });
		await tick();
		const lenBeforeResume = accOnEntry.length;
		pendingBoostMs = 30;
		await new Promise((r) => setTimeout(r, 40));
		expect(accOnEntry.length).toBeGreaterThan(lenBeforeResume);
		expect(accOnEntry[lenBeforeResume]).toBe(0);

		updateProps({ paused: true });
		await tick();
		await new Promise((r) => setTimeout(r, 40));
		// Short post-reset interval must not jump iteration from stale acc
		expect(readIteration(target)).toBe(0);

		unmount(component);
		target.remove();
	});

	test('randomizeSignal clears residual acc so short interval does not jump', async () => {
		// Same residual-acc coverage as resetSignal, but for randomizeSignal.
		// Design spec (line 492) requires both reset and randomize to clear acc.
		let t = 0;
		let autoAdvance = true;
		let pendingBoostMs = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			const id = setTimeout(() => {
				if (pendingBoostMs > 0) {
					t += pendingBoostMs;
					pendingBoostMs = 0;
				} else if (autoAdvance) {
					t += 50;
				}
				cb(t);
			}, 0);
			return id as unknown as number;
		});
		vi.stubGlobal('cancelAnimationFrame', (id: number) => {
			clearTimeout(id);
		});

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

		// Build iterations + residual acc via wall-clock frames
		await new Promise((r) => setTimeout(r, 80));
		const beforeRandomize = readIteration(target);
		expect(beforeRandomize).toBeGreaterThanOrEqual(4);
		expect(accOnEntry.length).toBeGreaterThan(0);

		// Pause + randomize → iteration 0 and acc 0
		updateProps({ paused: true, randomizeSignal: 1 });
		await tick();
		await new Promise((r) => setTimeout(r, 40));
		expect(readIteration(target)).toBe(0);

		// Freeze auto-advance so wall-clock flushes cannot flood steps.
		// Resume then inject one 30ms boost (speed 5 → +0.15 acc → 0 whole steps).
		// First advance after randomize must see acc === 0 (residual cleared).
		autoAdvance = false;
		await new Promise((r) => setTimeout(r, 20)); // drain queued frames at frozen t
		updateProps({ paused: false });
		await tick();
		const lenBeforeResume = accOnEntry.length;
		pendingBoostMs = 30;
		await new Promise((r) => setTimeout(r, 40));
		expect(accOnEntry.length).toBeGreaterThan(lenBeforeResume);
		expect(accOnEntry[lenBeforeResume]).toBe(0);

		updateProps({ paused: true });
		await tick();
		await new Promise((r) => setTimeout(r, 40));
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
});
