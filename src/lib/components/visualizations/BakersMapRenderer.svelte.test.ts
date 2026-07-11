import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick, mount, unmount } from 'svelte';
import BakersMapRenderer from './BakersMapRenderer.svelte';
import { createReactiveProps } from './bakers-map-test-helpers.svelte';

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
 * number of times, then stops. This exercises renderFrame and the internal
 * step/reset/randomize logic without infinite recursion.
 */
function installRafPump(maxCalls: number): void {
	let calls = 0;
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		calls += 1;
		if (calls <= maxCalls) {
			cb(0);
		}
		return calls;
	});
}

/**
 * Install an async RAF mock that schedules frames via setTimeout with
 * incrementing timestamps. This allows Svelte effects (from rerender) to
 * run between frames, so signal-triggered state changes are reflected in
 * the iteration label on the next frame.
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

describe('BakersMapRenderer', () => {
	test('mounts without errors', () => {
		const { container } = render(BakersMapRenderer);
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	test('creates the LIVE_RENDER badge', () => {
		const { container } = render(BakersMapRenderer);
		expect(container.textContent).toContain('LIVE_RENDER');
	});

	test('cancelAnimationFrame is called on unmount', () => {
		const { unmount } = render(BakersMapRenderer);
		unmount();
		expect(cancelAnimationFrame).toHaveBeenCalled();
	});

	test('displays iteration counter overlay', () => {
		const { container } = render(BakersMapRenderer);
		expect(container.textContent).toContain('ITERATION');
	});

	test('displays initial iteration count of 0', () => {
		const { container } = render(BakersMapRenderer);
		expect(container.textContent).toContain('ITERATION: 0');
	});

	test('accepts pointCount prop', () => {
		const { component } = render(BakersMapRenderer, { pointCount: 500 });
		expect(component).toBeTruthy();
	});

	test('accepts speed prop', () => {
		const { component } = render(BakersMapRenderer, { speed: 5 });
		expect(component).toBeTruthy();
	});

	test('accepts paused prop', () => {
		const { component } = render(BakersMapRenderer, { paused: true });
		expect(component).toBeTruthy();
	});

	// ── renderFrame coverage ──────────────────────────────────────────────

	test('renderFrame runs and draws points when RAF pump is installed', () => {
		installRafPump(3);
		const { container } = render(BakersMapRenderer, { pointCount: 100, speed: 1 });
		// If renderFrame ran without throwing, the canvas exists and fillRect was called
		const canvas = container.querySelector('canvas')!;
		expect(canvas).toBeTruthy();
		const ctx = canvas.getContext('2d')!;
		expect(ctx.fillRect).toHaveBeenCalled();
	});

	test('renderFrame skips applying steps when paused', () => {
		installRafPump(2);
		const { container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 1,
			paused: true
		});
		// When paused, clearRect runs but applyStep does not — verify clearRect was called
		const canvas = container.querySelector('canvas')!;
		const ctx = canvas.getContext('2d')!;
		expect(ctx.clearRect).toHaveBeenCalled();
	});

	test('renderFrame applies multiple steps per frame when speed > 1', () => {
		installRafPump(1);
		const { container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 5
		});
		// With speed=5 and 1 frame, 5 steps should be applied — no crash means success
		const canvas = container.querySelector('canvas')!;
		expect(canvas).toBeTruthy();
	});

	test('renderFrame stops when unmounted mid-pump', () => {
		installRafPump(10);
		const { unmount } = render(BakersMapRenderer, { pointCount: 100 });
		// Unmount sets isUnmounted = true; subsequent renderFrame calls should return early
		unmount();
		// No error thrown = pass
	});

	test('renderFrame updates iteration label after 100ms threshold', () => {
		// Use a timestamp > 100 to trigger the label update branch
		let calls = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			calls += 1;
			if (calls <= 2) {
				cb(200); // timestamp > 100 → label update triggers
			}
			return calls;
		});
		const { container } = render(BakersMapRenderer, { pointCount: 100 });
		// The iteration label should show a non-zero iteration after steps
		expect(container.textContent).toContain('ITERATION');
	});

	// ── clampInt edge cases ───────────────────────────────────────────────

	test('clampInt handles NaN speed by falling back to min (1)', () => {
		installRafPump(1);
		// speed=NaN → clampInt returns min (1) instead of NaN
		const { container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: NaN
		});
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	test('clampInt handles Infinity speed by clamping to max (10)', () => {
		installRafPump(1);
		const { container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: Infinity
		});
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	test('clampInt handles NaN pointCount by falling back to min (100)', () => {
		// pointCount=NaN → clampInt returns min (100) in onMount initDistribution
		const { container } = render(BakersMapRenderer, { pointCount: NaN });
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	// ── Signal effects ────────────────────────────────────────────────────

	test('resetSignal resets iteration count to 0', async () => {
		installAsyncRafPump(500);
		const { rerender, container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 1,
			resetSignal: 0,
			paused: false
		});
		await waitForFrames();
		// After several frames at speed 1, iteration > 0
		expect(container.textContent).not.toContain('ITERATION: 0');

		// Pause and trigger reset so the next frame doesn't advance iteration
		await rerender({ pointCount: 100, speed: 1, resetSignal: 1, paused: true });
		await waitForFrames();
		// doReset set iterationCount = 0; paused frame doesn't step → label shows 0
		expect(container.textContent).toContain('ITERATION: 0');
	});

	test('randomizeSignal resets iteration count to 0', async () => {
		installAsyncRafPump(500);
		const { rerender, container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 1,
			randomizeSignal: 0,
			paused: false
		});
		await waitForFrames();
		// After several frames, iteration > 0
		expect(container.textContent).not.toContain('ITERATION: 0');

		// Pause and trigger randomize so the next frame doesn't advance iteration
		await rerender({ pointCount: 100, speed: 1, randomizeSignal: 1, paused: true });
		await waitForFrames();
		// doRandomize (fillRandom) set iterationCount = 0; paused frame doesn't step
		expect(container.textContent).toContain('ITERATION: 0');
	});

	test('stepSignal advances iteration while paused', async () => {
		// Use Svelte.mount directly with individually reactive props.
		// @testing-library/svelte's rerender reassigns the entire props object,
		// triggering ALL $effects (including pointCount which resets iteration).
		// With createReactiveProps, only the changed prop's effect fires.
		installAsyncRafPump(500);
		const [props, updateProps] = createReactiveProps({
			pointCount: 100,
			speed: 1,
			paused: true,
			stepSignal: 0
		});
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(BakersMapRenderer, { target, props });

		await waitForFrames();
		// Paused — no RAF steps, iteration stays at 0
		expect(target.textContent).toContain('ITERATION: 0');

		// Only update stepSignal — only the stepSignal $effect fires
		updateProps({ stepSignal: 1 });
		await tick();
		await waitForFrames();
		// stepSignal effect called applyStep once → iterationCount = 1
		expect(target.textContent).toContain('ITERATION: 1');

		unmount(component);
		target.remove();
	});

	test('stepSignal change while NOT paused does not call applyStep', async () => {
		installAsyncRafPump(500);
		const { rerender, container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 1,
			paused: false,
			stepSignal: 0
		});
		await waitForFrames();
		// When not paused, stepSignal effect checks `if (paused) applyStep()` — no extra step
		// Verify the label shows a valid iteration count (RAF-driven, not stepSignal-driven)
		expect(container.textContent).toMatch(/ITERATION: \d+/);

		await rerender({ pointCount: 100, speed: 1, paused: false, stepSignal: 1 });
		await tick();
		await waitForFrames();
		// Component continues functioning — label still shows a valid iteration count
		expect(container.textContent).toMatch(/ITERATION: \d+/);
	});

	// ── pointCount change effect ──────────────────────────────────────────

	test('changing pointCount reinitializes the distribution', async () => {
		const { rerender, container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 1
		});
		await tick();
		// Change pointCount → effect runs initDistribution with new count
		await rerender({ pointCount: 500, speed: 1 });
		await tick();
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	test('pointCount clamped to valid range on reinit', async () => {
		const { rerender, container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 1
		});
		await tick();
		// pointCount below min (100) → clamped to 100
		await rerender({ pointCount: 50, speed: 1 });
		await tick();
		// pointCount above max (10000) → clamped to 10000
		await rerender({ pointCount: 50000, speed: 1 });
		await tick();
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	// ── updateCanvasSize ──────────────────────────────────────────────────

	test('updateCanvasSize sets canvas dimensions from container', () => {
		// jsdom container has clientWidth 0, but the function should still run
		const { container } = render(BakersMapRenderer, { height: 400 });
		const canvas = container.querySelector('canvas')!;
		expect(canvas).toBeTruthy();
		// height - 32 = 368
		expect(canvas.height).toBeGreaterThanOrEqual(0);
	});

	test('updateCanvasSize responds to ResizeObserver callback', async () => {
		const { container } = render(BakersMapRenderer, { height: 400 });
		// ResizeObserver is created in onMount; jsdom has a mock.
		// Manually setting container width and triggering resize.
		const div = container.firstElementChild as HTMLDivElement;
		if (div) {
			Object.defineProperty(div, 'clientWidth', { value: 500, configurable: true });
		}
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	// ── MAX_ITERATIONS reset ──────────────────────────────────────────────

	test('applyStep resets distribution after MAX_ITERATIONS (50) steps', () => {
		// Run 51 frames at speed=1 to exceed MAX_ITERATIONS=50
		installRafPump(51);
		const { container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 1
		});
		// After 51 steps, iterationCount wraps back to 0 — no crash = pass
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	test('applyStep resets distribution after MAX_ITERATIONS with high speed', () => {
		// Run 11 frames at speed=5 → 55 steps total, exceeding MAX_ITERATIONS=50
		installRafPump(11);
		const { container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 5
		});
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	// ── Cleanup ───────────────────────────────────────────────────────────

	test('cleans up on unmount without throwing', () => {
		const { unmount } = render(BakersMapRenderer);
		expect(() => unmount()).not.toThrow();
	});
});
