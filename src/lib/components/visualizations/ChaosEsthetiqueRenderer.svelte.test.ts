import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
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

describe('ChaosEsthetiqueRenderer (coverage)', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('renders canvas and svg axes after debounce', async () => {
		vi.useFakeTimers();
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('binds containerElement to the rendered div', async () => {
		vi.useFakeTimers();
		let containerEl: HTMLDivElement | undefined;
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: {
				a: 0.9,
				b: 0.9999,
				x0: 18,
				y0: 0,
				iterations: 100,
				height: 200,
				get containerElement() {
					return containerEl;
				},
				set containerElement(next: HTMLDivElement | undefined) {
					containerEl = next;
				}
			}
		});
		await vi.advanceTimersByTimeAsync(400);
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		expect(containerEl).toBeInstanceOf(HTMLDivElement);
	});

	it('applies custom height to the container', async () => {
		vi.useFakeTimers();
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 400 }
		});
		await vi.advanceTimersByTimeAsync(400);
		await waitFor(() => {
			const innerDiv = container.firstElementChild as HTMLElement;
			expect(innerDiv?.style.height).toContain('400');
		});
	});

	it('contains the LIVE_RENDER label in initial markup', async () => {
		vi.useFakeTimers();
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});
		const label = container.querySelector('div.pointer-events-none, div.select-none');
		expect(label).not.toBeNull();
		expect(label?.textContent).toContain('LIVE_RENDER');
		await vi.advanceTimersByTimeAsync(400);
	});

	it('renders without throwing with different parameters', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(ChaosEsthetiqueRenderer, {
				props: { a: 1.4, b: 0.3, x0: 0, y0: 0, iterations: 50, height: 300 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(400);
	});
});
