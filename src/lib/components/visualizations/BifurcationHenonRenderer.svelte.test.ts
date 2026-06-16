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

describe('BifurcationHenonRenderer', () => {
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

	it('renders with zero maxIterations', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationHenonRenderer, {
				props: { aMin: 1.04, aMax: 1.1, b: 0.3, maxIterations: 0, height: 200 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
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

	it('handles container element binding', async () => {
		vi.useFakeTimers();
		const { container } = render(BifurcationHenonRenderer, {
			props: { aMin: 1.04, aMax: 1.1, b: 0.3, maxIterations: 10, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(200);
		const canvas = container.querySelector('canvas');
		expect(canvas).not.toBeNull();
	});

	it('has proper styling classes', async () => {
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
