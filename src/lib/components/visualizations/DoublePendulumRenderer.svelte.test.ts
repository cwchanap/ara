import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import DoublePendulumRenderer from './DoublePendulumRenderer.svelte';

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
});
