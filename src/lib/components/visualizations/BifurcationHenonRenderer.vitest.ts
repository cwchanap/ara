import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import BifurcationHenonRenderer from './BifurcationHenonRenderer.svelte';

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

describe('BifurcationHenonRenderer (smoke)', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('renders without throwing with default props', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationHenonRenderer, {
				props: { aMin: 1.04, aMax: 1.1, b: 0.3, maxIterations: 10, height: 200 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('renders a canvas element', async () => {
		vi.useFakeTimers();
		const { container } = render(BifurcationHenonRenderer, {
			props: { aMin: 1.04, aMax: 1.1, b: 0.3, maxIterations: 10, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(200);
		expect(container.querySelector('canvas')).not.toBeNull();
	});
});
