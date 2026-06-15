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

	it('restores running after re-seed so physics resumes', async () => {
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

		// Re-seed with the same dangerous params but a new restartSignal
		await rerender({ ...baseProps, l1: 0, restartSignal: 1 });
		await tick();

		// Pump another frame. If running were not restored, physics would
		// stay frozen and the overlay would disappear. With the fix it
		// resumes and immediately diverges again.
		queue.splice(0).forEach((q) => q.cb(50));
		await tick();
		expect(container.textContent).toContain('SIMULATION DIVERGED');
	});
});
