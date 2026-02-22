import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import NewtonRenderer from './NewtonRenderer.svelte';

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

describe('NewtonRenderer (smoke)', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders without throwing with default props', () => {
		expect(() =>
			render(NewtonRenderer, {
				props: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 10, height: 200 }
			})
		).not.toThrow();
	});

	it('renders a canvas element', () => {
		const { container } = render(NewtonRenderer, {
			props: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 10, height: 200 }
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});
});
