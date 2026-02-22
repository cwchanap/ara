import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import ChaosEsthetiqueRenderer from './ChaosEsthetiqueRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;

	const ctx = {
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		fillStyle: '' as string,
		globalAlpha: 1,
		strokeStyle: '' as string,
		lineWidth: 1,
		shadowBlur: 0,
		shadowColor: '' as string,
		getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
		putImageData: vi.fn(),
		createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) }))
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

describe('ChaosEsthetiqueRenderer (smoke)', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('renders without throwing with default props', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(ChaosEsthetiqueRenderer, {
				props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(400);
	});

	it('renders a div container element', async () => {
		vi.useFakeTimers();
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		expect(container.querySelector('div')).not.toBeNull();
	});
});
