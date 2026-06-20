import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import CliffordRenderer from './CliffordRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;
	const ctx = {
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		fillStyle: '' as string,
		globalAlpha: 1,
		createImageData: (w: number, h: number) => ({
			data: new Uint8ClampedArray(w * h * 4),
			width: w,
			height: h
		}),
		putImageData: vi.fn()
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

// Worker is unavailable in jsdom, so the component uses the main-thread fallback.
vi.mock('$lib/clifford', () => ({
	calculateCliffordTuples: vi.fn(() => [
		[0, 0],
		[0.5, -0.2],
		[1, 0.5]
	])
}));

const baseProps = {
	a: -1.4,
	b: 1.6,
	c: 1.0,
	d: 0.7,
	iterations: 1000,
	zoom: 1,
	pointSize: 1.5,
	opacity: 0.6,
	height: 200
};

describe('CliffordRenderer', () => {
	afterEach(() => cleanup());

	it('renders an svg (axes) and a canvas in density mode', async () => {
		const { container } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('renders per-point color modes without throwing', async () => {
		for (const colorMode of ['single', 'iteration', 'radius', 'angle'] as const) {
			const { container, unmount } = render(CliffordRenderer, {
				props: { ...baseProps, colorMode }
			});
			await waitFor(() => {
				expect(container.querySelector('canvas')).not.toBeNull();
			});
			unmount();
		}
	});

	it('does not throw on non-finite parameters (renders blank)', async () => {
		const { container } = render(CliffordRenderer, {
			props: { ...baseProps, a: Number.NaN, colorMode: 'iteration' as const }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});
});
