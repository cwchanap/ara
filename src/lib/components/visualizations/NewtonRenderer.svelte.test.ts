import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import NewtonRenderer from './NewtonRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
let originalClientWidth: PropertyDescriptor | undefined;

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
	createImageData: vi.fn((w: number, h: number) => ({
		data: new Uint8ClampedArray(Math.max((w || 0) * (h || 0) * 4, 4))
	}))
};

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;
	originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () => mockCtx
	});
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
		configurable: true,
		value: 4
	});
});

afterAll(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: originalGetContext
	});
	if (originalClientWidth) {
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
	}
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

describe('NewtonRenderer canvas rendering', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('calls createImageData with canvas dimensions', () => {
		render(NewtonRenderer, {
			props: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 10, height: 200 }
		});
		expect(mockCtx.createImageData).toHaveBeenCalled();
	});

	it('calls putImageData after computing fractal', () => {
		render(NewtonRenderer, {
			props: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 10, height: 200 }
		});
		expect(mockCtx.putImageData).toHaveBeenCalled();
	});

	it('renders with different x range', () => {
		expect(() =>
			render(NewtonRenderer, {
				props: { xMin: -5, xMax: 5, yMin: -2, yMax: 2, maxIterations: 10, height: 200 }
			})
		).not.toThrow();
		expect(mockCtx.putImageData).toHaveBeenCalled();
	});

	it('renders with different y range', () => {
		expect(() =>
			render(NewtonRenderer, {
				props: { xMin: -2, xMax: 2, yMin: -3, yMax: 3, maxIterations: 10, height: 200 }
			})
		).not.toThrow();
	});

	it('renders with minimal iterations', () => {
		expect(() =>
			render(NewtonRenderer, {
				props: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, maxIterations: 1, height: 100 }
			})
		).not.toThrow();
		expect(mockCtx.putImageData).toHaveBeenCalled();
	});

	it('renders with high iteration count', () => {
		expect(() =>
			render(NewtonRenderer, {
				props: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 50, height: 200 }
			})
		).not.toThrow();
	});

	it('displays LIVE_RENDER label', () => {
		const { container } = render(NewtonRenderer, {
			props: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 10, height: 200 }
		});
		expect(container.textContent).toContain('LIVE_RENDER');
	});

	it('sets container height from props', () => {
		const { container } = render(NewtonRenderer, {
			props: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 10, height: 350 }
		});
		const wrapper = container.querySelector('div');
		expect(wrapper?.getAttribute('style')).toContain('350px');
	});

	it('requests 2d context', () => {
		const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
		render(NewtonRenderer, {
			props: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 10, height: 200 }
		});
		expect(getContextSpy).toHaveBeenCalledWith('2d');
		getContextSpy.mockRestore();
	});
});
