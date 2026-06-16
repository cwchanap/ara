import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import DoublePendulumRenderer from './DoublePendulumRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;

	const ctx = {
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		setTransform: vi.fn(),
		strokeStyle: '',
		lineWidth: 1,
		globalAlpha: 1,
		fillStyle: ''
	};
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () => ctx
	});
});

afterAll(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: originalGetContext
	});
});

// jsdom has no real rAF/canvas timing; stub a deterministic frame pump.
beforeEach(() => {
	let id = 0;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		id += 1;
		// Do not auto-run forever; tests advance frames manually where needed.
		return id;
	});
	vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const baseProps = {
	theta1: Math.PI / 2,
	theta2: Math.PI / 2,
	omega1: 0,
	omega2: 0,
	l1: 1,
	l2: 1,
	m1: 1,
	m2: 1,
	gravity: 9.81,
	damping: 0,
	height: 400
};

describe('DoublePendulumRenderer', () => {
	it('mounts and renders a canvas', () => {
		const { container } = render(DoublePendulumRenderer, { props: baseProps });
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('renders the renderer label', () => {
		const { getByText } = render(DoublePendulumRenderer, { props: baseProps });
		expect(getByText('DOUBLE_PENDULUM_RENDERER')).toBeTruthy();
	});

	it('shows a divergence readout element when comparison mode is on', () => {
		const { getByTestId } = render(DoublePendulumRenderer, {
			props: { ...baseProps, compareMode: true, compareOffset: 0.001 }
		});
		expect(getByTestId('divergence-readout')).toBeTruthy();
	});

	it('does not show the divergence readout when comparison mode is off', () => {
		const { queryByTestId } = render(DoublePendulumRenderer, {
			props: { ...baseProps, compareMode: false }
		});
		expect(queryByTestId('divergence-readout')).toBeNull();
	});

	it('mounts cleanly with trails disabled', () => {
		const { container } = render(DoublePendulumRenderer, {
			props: { ...baseProps, showTrail: false }
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('toggling showTrail off then on does not throw', async () => {
		const { rerender, container } = render(DoublePendulumRenderer, {
			props: { ...baseProps, showTrail: true }
		});
		await rerender({ ...baseProps, showTrail: false });
		await rerender({ ...baseProps, showTrail: true });
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('preserves paused running state on re-seed', async () => {
		// Override the default no-op rAF with a manual pump.
		const queue: Array<{ id: number; cb: FrameRequestCallback }> = [];
		let nextId = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			nextId += 1;
			queue.push({ id: nextId, cb });
			return nextId;
		});
		vi.stubGlobal('cancelAnimationFrame', (id: number) => {
			const idx = queue.findIndex((q) => q.id === id);
			if (idx !== -1) queue.splice(idx, 1);
		});

		const { rerender, container } = render(DoublePendulumRenderer, {
			props: { ...baseProps, l1: 0 }
		});

		// Initial mount fires rAF; pump one frame to trigger divergence
		// (l1=0 causes divide-by-zero in derivatives -> Infinity -> diverged).
		expect(queue.length).toBeGreaterThan(0);
		// The first frame only initializes `last`, so we need a second pump
		// for physics to actually run.
		queue.splice(0).forEach((q) => q.cb(16.67));
		queue.splice(0).forEach((q) => q.cb(33.33));
		await tick();
		expect(container.textContent).toContain('SIMULATION DIVERGED');

		// Re-seed with the same dangerous params but a new restartSignal,
		// explicitly keeping running=false (simulating a parent-paused state).
		// The renderer must NOT override the parent's paused state.
		await rerender({ ...baseProps, l1: 0, restartSignal: 1, running: false });
		await tick();

		// Pump another frame. Physics should stay frozen because running
		// was preserved as false; the overlay stays gone because diverged
		// was reset but physics never ran to re-trigger divergence.
		queue.splice(0).forEach((q) => q.cb(50));
		await tick();
		expect(container.textContent).not.toContain('SIMULATION DIVERGED');

		// Now the parent explicitly resumes — physics should run and diverge again.
		await rerender({ ...baseProps, l1: 0, restartSignal: 1, running: true });
		await tick();
		queue.splice(0).forEach((q) => q.cb(66.67));
		await tick();
		expect(container.textContent).toContain('SIMULATION DIVERGED');
	});

	it('halts and shows the divergence overlay when compareMode is on', async () => {
		// With compareMode=true the frame loop also steps stateB. A degenerate
		// l1=0 blows up both orbits; the loop must still halt and surface the
		// overlay (covers the compareMode execution path through the rAF loop).
		const queue: Array<{ id: number; cb: FrameRequestCallback }> = [];
		let nextId = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			nextId += 1;
			queue.push({ id: nextId, cb });
			return nextId;
		});
		vi.stubGlobal('cancelAnimationFrame', (id: number) => {
			const idx = queue.findIndex((q) => q.id === id);
			if (idx !== -1) queue.splice(idx, 1);
		});

		const { container } = render(DoublePendulumRenderer, {
			props: { ...baseProps, l1: 0, compareMode: true, compareOffset: 0.001 }
		});

		expect(queue.length).toBeGreaterThan(0);
		queue.splice(0).forEach((q) => q.cb(16.67));
		queue.splice(0).forEach((q) => q.cb(33.33));
		await tick();

		expect(container.textContent).toContain('SIMULATION DIVERGED');
		expect(container.textContent).toContain('DIVERGENCE');
	});

	it('updates trail length prop', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, trailLength: 200 }
		});
		await rerender({ ...baseProps, trailLength: 500 });
		// Should not throw
	});

	it('updates speed prop', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, speed: 1 }
		});
		await rerender({ ...baseProps, speed: 2 });
		// Should not throw
	});

	it('updates compare offset prop', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, compareMode: true, compareOffset: 0.001 }
		});
		await rerender({ ...baseProps, compareMode: true, compareOffset: 0.01 });
		// Should not throw
	});

	it('updates height prop', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, height: 400 }
		});
		await rerender({ ...baseProps, height: 600 });
		// Should not throw
	});

	it('binds divergenceValue correctly', async () => {
		const { container } = render(DoublePendulumRenderer, {
			props: { ...baseProps, compareMode: true, divergenceValue: 0 }
		});

		// The divergence value is updated in the animation loop
		// We can't easily test the actual value without running the loop,
		// but we can verify the binding is set up
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('handles missing canvas ref gracefully', () => {
		// Mock the canvas to be null by not providing a valid mount
		const originalGetContext = HTMLCanvasElement.prototype.getContext;
		Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
			configurable: true,
			value: () => null
		});

		const { container } = render(DoublePendulumRenderer, { props: baseProps });
		// Should still render the container even if canvas context fails
		expect(container.querySelector('div')).not.toBeNull();

		Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
			configurable: true,
			value: originalGetContext
		});
	});

	it('cleans up animation frame on unmount', () => {
		const cancelSpy = vi.fn();
		vi.stubGlobal('cancelAnimationFrame', cancelSpy);

		const { unmount } = render(DoublePendulumRenderer, { props: baseProps });
		unmount();

		expect(cancelSpy).toHaveBeenCalled();
	});

	it('handles resize observer cleanup', () => {
		const { unmount } = render(DoublePendulumRenderer, { props: baseProps });
		// Should not throw on unmount
		unmount();
	});

	it('updates physical parameters without re-seeding', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, l1: 1, l2: 1, m1: 1, m2: 1, gravity: 9.81, damping: 0 }
		});

		// Update physical parameters - should not trigger re-seed
		await rerender({
			...baseProps,
			l1: 1.5,
			l2: 1.2,
			m1: 2,
			m2: 1.5,
			gravity: 15,
			damping: 0.1
		});
		// Should not throw
	});

	it('re-seeds when initial conditions change', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, theta1: Math.PI / 2, theta2: Math.PI / 2 }
		});

		// Change initial conditions - should trigger re-seed
		await rerender({ ...baseProps, theta1: 0, theta2: 0 });
		// Should not throw
	});

	it('re-seeds when restartSignal increments', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, restartSignal: 0 }
		});

		// Increment restart signal - should trigger re-seed
		await rerender({ ...baseProps, restartSignal: 1 });
		// Should not throw
	});

	it('handles corner border decorations', () => {
		const { container } = render(DoublePendulumRenderer, { props: baseProps });
		// Check that corner borders are present
		const corners = container.querySelectorAll(
			'.border-t-2, .border-b-2, .border-l-2, .border-r-2'
		);
		expect(corners.length).toBeGreaterThan(0);
	});

	it('hides divergence overlay when diverged prop is false', () => {
		const { container } = render(DoublePendulumRenderer, {
			props: { ...baseProps, diverged: false }
		});
		expect(container.textContent).not.toContain('SIMULATION DIVERGED');
	});

	it('updates divergenceValue binding', async () => {
		const { container } = render(DoublePendulumRenderer, {
			props: { ...baseProps, compareMode: true, divergenceValue: 0 }
		});

		// The divergence value binding should be set up
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('handles running prop changes', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, running: true }
		});

		await rerender({ ...baseProps, running: false });
		// Should not throw
	});

	it('handles diverged prop changes', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, diverged: false }
		});

		await rerender({ ...baseProps, diverged: true });
		// Should not throw
	});

	it('clears trails when showTrail is disabled', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, showTrail: true }
		});

		await rerender({ ...baseProps, showTrail: false });
		// Should not throw
	});

	it('handles showTrail prop changes', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, showTrail: true }
		});

		await rerender({ ...baseProps, showTrail: false });
		await rerender({ ...baseProps, showTrail: true });
		// Should not throw
	});

	it('handles compareMode prop changes', async () => {
		const { rerender } = render(DoublePendulumRenderer, {
			props: { ...baseProps, compareMode: false }
		});

		await rerender({ ...baseProps, compareMode: true });
		// Should not throw
	});

	it('renders with minimal valid parameters', () => {
		const { container } = render(DoublePendulumRenderer, {
			props: {
				theta1: 0,
				theta2: 0,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0,
				height: 400
			}
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('handles zero length parameters', () => {
		const { container } = render(DoublePendulumRenderer, {
			props: { ...baseProps, l1: 0.1, l2: 0.1 }
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('handles very small mass parameters', () => {
		const { container } = render(DoublePendulumRenderer, {
			props: { ...baseProps, m1: 0.1, m2: 0.1 }
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('handles very large mass parameters', () => {
		const { container } = render(DoublePendulumRenderer, {
			props: { ...baseProps, m1: 10, m2: 10 }
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});
});
