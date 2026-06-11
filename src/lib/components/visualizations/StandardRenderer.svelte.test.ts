import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import StandardRenderer from './StandardRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;

	const ctx = {
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		fillStyle: '',
		globalAlpha: 1
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

describe('StandardRenderer', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('renders with fallback computation when worker is unavailable', async () => {
		vi.useFakeTimers();
		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 200
			}
		});

		await vi.advanceTimersByTimeAsync(200);

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});
});

describe('StandardRenderer (coverage)', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('binds containerElement to the rendered div', async () => {
		vi.useFakeTimers();
		let containerEl: HTMLDivElement | undefined;
		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 200,
				get containerElement() {
					return containerEl;
				},
				set containerElement(next: HTMLDivElement | undefined) {
					containerEl = next;
				}
			}
		});
		await vi.advanceTimersByTimeAsync(200);
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		expect(containerEl).toBeInstanceOf(HTMLDivElement);
	});

	it('contains the LIVE_RENDER label in initial markup', async () => {
		vi.useFakeTimers();
		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 200
			}
		});
		const label = container.querySelector('div.pointer-events-none, div.select-none');
		expect(label).not.toBeNull();
		expect(label?.textContent).toContain('LIVE_RENDER');
		await vi.advanceTimersByTimeAsync(200);
	});

	it('applies custom height to the container', async () => {
		vi.useFakeTimers();
		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 400
			}
		});
		await vi.advanceTimersByTimeAsync(200);
		await waitFor(() => {
			const innerDiv = container.firstElementChild as HTMLElement;
			expect(innerDiv?.style.height).toContain('400');
		});
	});

	it('renders without throwing with different k values', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(StandardRenderer, {
				props: {
					k: 2.5,
					numP: 2,
					numQ: 2,
					iterations: 10,
					height: 300
				}
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});
});
