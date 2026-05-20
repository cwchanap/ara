import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import BifurcationLogisticRenderer from './BifurcationLogisticRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

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

	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () => mockCtx
	});
});

afterAll(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: originalGetContext
	});
});

describe('BifurcationLogisticRenderer (smoke)', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('renders without throwing with default props', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationLogisticRenderer, {
				props: { rMin: 3.5, rMax: 4.0, maxIterations: 10, height: 200 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('renders a canvas element', async () => {
		vi.useFakeTimers();
		const { container } = render(BifurcationLogisticRenderer, {
			props: { rMin: 3.5, rMax: 4.0, maxIterations: 10, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(200);
		expect(container.querySelector('canvas')).not.toBeNull();
	});
});

describe('BifurcationLogisticRenderer canvas rendering', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
		vi.clearAllMocks();
	});

	it('calls createImageData during render', async () => {
		vi.useFakeTimers();
		render(BifurcationLogisticRenderer, {
			props: { rMin: 3.5, rMax: 4.0, maxIterations: 10, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(200);
		expect(mockCtx.createImageData).toHaveBeenCalled();
	});

	it('calls putImageData after computation', async () => {
		vi.useFakeTimers();
		render(BifurcationLogisticRenderer, {
			props: { rMin: 3.5, rMax: 4.0, maxIterations: 10, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(200);
		expect(mockCtx.putImageData).toHaveBeenCalled();
	});

	it('renders with different r ranges', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationLogisticRenderer, {
				props: { rMin: 2.5, rMax: 3.5, maxIterations: 10, height: 200 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
		expect(mockCtx.putImageData).toHaveBeenCalled();
	});

	it('renders with low maxIterations', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(BifurcationLogisticRenderer, {
				props: { rMin: 3.5, rMax: 4.0, maxIterations: 1, height: 200 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('renders with custom height', async () => {
		vi.useFakeTimers();
		const { container } = render(BifurcationLogisticRenderer, {
			props: { rMin: 3.5, rMax: 4.0, maxIterations: 10, height: 400 }
		});
		await vi.advanceTimersByTimeAsync(200);
		const wrapper = container.querySelector('div');
		expect(wrapper?.getAttribute('style')).toContain('400px');
	});

	it('renders corner decorations', async () => {
		vi.useFakeTimers();
		const { container } = render(BifurcationLogisticRenderer, {
			props: { rMin: 3.5, rMax: 4.0, maxIterations: 10, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(200);
		const corners = container.querySelectorAll('.absolute.w-2.h-2');
		expect(corners.length).toBe(4);
	});

	it('displays LIVE_RENDER label', async () => {
		vi.useFakeTimers();
		const { container } = render(BifurcationLogisticRenderer, {
			props: { rMin: 3.5, rMax: 4.0, maxIterations: 10, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(200);
		expect(container.textContent).toContain('LIVE_RENDER');
	});

	it('requests 2d context', async () => {
		vi.useFakeTimers();
		const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
		render(BifurcationLogisticRenderer, {
			props: { rMin: 3.5, rMax: 4.0, maxIterations: 10, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(200);
		expect(getContextSpy).toHaveBeenCalledWith('2d');
		getContextSpy.mockRestore();
	});
});
