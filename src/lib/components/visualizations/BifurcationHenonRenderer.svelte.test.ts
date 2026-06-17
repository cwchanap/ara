import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import BifurcationHenonRenderer from './BifurcationHenonRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
// Store the original clientWidth descriptor so we can restore it.
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

// Module-level mock context so individual tests can assert on draw calls.
// This deepens smoke tests beyond mere "doesn't throw" checks.
const mockCtx = {
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

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () => mockCtx
	});
	// jsdom reports clientWidth as 0 (no layout engine). Give the container a
	// non-zero width so the renderer's dimension guard doesn't skip rendering.
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
		configurable: true,
		get() {
			return 300;
		}
	});
});

afterAll(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: originalGetContext
	});
	if (originalClientWidth) {
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
	} else {
		// Property didn't exist originally; remove our override.
		delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
	}
});

describe('BifurcationHenonRenderer', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
		// Reset call counts so assertions are isolated per test.
		vi.mocked(mockCtx.fillRect).mockClear();
		vi.mocked(mockCtx.clearRect).mockClear();
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

	it('renders a canvas element and draws points via fillRect', async () => {
		vi.useFakeTimers();
		render(BifurcationHenonRenderer, {
			props: { aMin: 1.04, aMax: 1.1, b: 0.3, maxIterations: 10, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(200);
		// The renderer should clear the canvas and plot bifurcation points.
		expect(mockCtx.clearRect).toHaveBeenCalled();
		expect(mockCtx.fillRect).toHaveBeenCalled();
	});

	it('renders with zero maxIterations without drawing any points', async () => {
		vi.useFakeTimers();
		render(BifurcationHenonRenderer, {
			props: { aMin: 1.04, aMax: 1.1, b: 0.3, maxIterations: 0, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(200);
		// Canvas is cleared but no points are plotted with zero iterations.
		expect(mockCtx.clearRect).toHaveBeenCalled();
		expect(mockCtx.fillRect).not.toHaveBeenCalled();
	});

	it('renders with minimal height', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationHenonRenderer, {
				props: { aMin: 1.04, aMax: 1.1, b: 0.3, maxIterations: 10, height: 50 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('renders with different parameter ranges', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationHenonRenderer, {
				props: { aMin: 1.0, aMax: 1.5, b: 0.2, maxIterations: 50, height: 300 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('renders with extreme parameter values', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationHenonRenderer, {
				props: { aMin: 0.5, aMax: 2.0, b: 0.5, maxIterations: 100, height: 800 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
		// Even with extreme values, the canvas should have been drawn to.
		expect(mockCtx.fillRect).toHaveBeenCalled();
	});

	it('renders with negative b parameter', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationHenonRenderer, {
				props: { aMin: 1.04, aMax: 1.1, b: -0.3, maxIterations: 10, height: 200 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('renders a canvas with correct styling classes', async () => {
		vi.useFakeTimers();
		const { container } = render(BifurcationHenonRenderer, {
			props: { aMin: 1.04, aMax: 1.1, b: 0.3, maxIterations: 10, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(200);
		const canvas = container.querySelector('canvas');
		expect(canvas).not.toBeNull();
		expect(canvas).toHaveClass('w-full', 'h-full', 'block');
	});

	it('renders with large maxIterations', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationHenonRenderer, {
				props: { aMin: 1.04, aMax: 1.1, b: 0.3, maxIterations: 10000, height: 200 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('renders with very small aMin', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationHenonRenderer, {
				props: { aMin: 0.5, aMax: 1.1, b: 0.3, maxIterations: 10, height: 200 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('renders with very large aMax', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationHenonRenderer, {
				props: { aMin: 1.04, aMax: 1.5, b: 0.3, maxIterations: 10, height: 200 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});
});
