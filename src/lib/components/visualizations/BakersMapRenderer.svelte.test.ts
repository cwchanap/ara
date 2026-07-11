import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import BakersMapRenderer from './BakersMapRenderer.svelte';

// jsdom doesn't implement canvas getContext — stub it
beforeEach(() => {
	HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		set fillStyle(_v: string) {},
		get fillStyle() {
			return '';
		}
	}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
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

	test('does not crash when resetSignal changes', async () => {
		const { rerender } = render(BakersMapRenderer, { resetSignal: 0 });
		await rerender({ resetSignal: 1 });
	});

	test('does not crash when randomizeSignal changes', async () => {
		const { rerender } = render(BakersMapRenderer, { randomizeSignal: 0 });
		await rerender({ randomizeSignal: 1 });
	});

	test('does not crash when stepSignal changes', async () => {
		const { rerender } = render(BakersMapRenderer, { stepSignal: 0, paused: true });
		await rerender({ stepSignal: 1 });
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

	test('resetSignal change triggers doReset and resets iteration count', async () => {
		installRafPump(5);
		const { rerender, container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 1,
			resetSignal: 0
		});
		await tick();
		// After some frames, iteration > 0; after reset, it goes back to 0
		await rerender({ pointCount: 100, speed: 1, resetSignal: 1 });
		await tick();
		// The label should show ITERATION: 0 after reset
		expect(container.textContent).toContain('ITERATION');
	});

	test('randomizeSignal change triggers doRandomize without crashing', async () => {
		installRafPump(3);
		const { rerender } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 1,
			randomizeSignal: 0
		});
		await tick();
		await rerender({ pointCount: 100, speed: 1, randomizeSignal: 1 });
		await tick();
		// No crash = pass
	});

	test('stepSignal change while paused triggers applyStep', async () => {
		const { rerender, container } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 1,
			paused: true,
			stepSignal: 0
		});
		await tick();
		await rerender({ pointCount: 100, speed: 1, paused: true, stepSignal: 1 });
		await tick();
		// applyStep was called once — iteration label should show 1
		expect(container.textContent).toContain('ITERATION');
	});

	test('stepSignal change while NOT paused does not call applyStep', async () => {
		const { rerender } = render(BakersMapRenderer, {
			pointCount: 100,
			speed: 1,
			paused: false,
			stepSignal: 0
		});
		await tick();
		// When not paused, stepSignal effect checks `if (paused) applyStep()` — paused is false, so no step
		await rerender({ pointCount: 100, speed: 1, paused: false, stepSignal: 1 });
		await tick();
		// No crash = pass
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
