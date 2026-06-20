import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { calculateCliffordTuples } from '$lib/clifford';
import CliffordRenderer from './CliffordRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

interface MockCtx {
	clearRect: ReturnType<typeof vi.fn>;
	beginPath: ReturnType<typeof vi.fn>;
	arc: ReturnType<typeof vi.fn>;
	fill: ReturnType<typeof vi.fn>;
	fillStyle: string;
	globalAlpha: number;
	createImageData: (
		w: number,
		h: number
	) => { data: Uint8ClampedArray; width: number; height: number };
	putImageData: ReturnType<typeof vi.fn>;
}

let ctx: MockCtx;

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;
	ctx = {
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		fillStyle: '',
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
		delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
	}
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
	afterEach(() => {
		cleanup();
		// Restore the default mock implementation between tests.
		vi.mocked(calculateCliffordTuples).mockReturnValue([
			[0, 0],
			[0.5, -0.2],
			[1, 0.5]
		]);
		// Reset canvas draw-call mocks so per-test assertions are isolated.
		vi.mocked(ctx.putImageData).mockClear();
		vi.mocked(ctx.clearRect).mockClear();
		vi.mocked(ctx.beginPath).mockClear();
		vi.mocked(ctx.arc).mockClear();
		vi.mocked(ctx.fill).mockClear();
	});

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

	it('renders blank (no putImageData call) when compute returns no points', async () => {
		vi.mocked(calculateCliffordTuples).mockReturnValue([]);
		const { container } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		// The density path should not run for empty points.
		expect(ctx.putImageData).not.toHaveBeenCalled();
	});

	it('caps points at MAX_POINTS (250000) without throwing', async () => {
		// Generate > MAX_POINTS points to exercise the slice-to-MAX_POINTS branch.
		const huge: [number, number][] = Array.from({ length: 250001 }, (_, i) => [
			(i % 100) / 100,
			(i % 50) / 50
		]);
		vi.mocked(calculateCliffordTuples).mockReturnValue(huge);
		const { container } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'iteration' as const }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('calls putImageData in density mode (exercises renderDensity)', async () => {
		vi.mocked(calculateCliffordTuples).mockReturnValue([
			[0, 0],
			[0.5, -0.2],
			[1, 0.5]
		]);
		render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		await waitFor(() => {
			expect(ctx.putImageData).toHaveBeenCalled();
		});
	});

	it('binds containerElement to the inner container div', async () => {
		const { container } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		// The component's $effect binds the inner container div; verify it exists.
		expect(container.querySelector('.relative')).not.toBeNull();
	});

	it('re-renders (without recompute) when zoom changes', async () => {
		vi.mocked(calculateCliffordTuples).mockClear();
		const { container, rerender } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'iteration' as const, zoom: 1 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		const computeCallsAfterFirst = vi.mocked(calculateCliffordTuples).mock.calls.length;
		// Changing a render-only prop (zoom) should trigger a re-render but NOT
		// a recompute of the points.
		await rerender({ ...baseProps, colorMode: 'iteration' as const, zoom: 2 });
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		// No new compute calls — zoom is a render-only setting.
		expect(vi.mocked(calculateCliffordTuples).mock.calls.length).toBe(computeCallsAfterFirst);
	});

	it('recomputes when a math parameter (a) changes', async () => {
		vi.mocked(calculateCliffordTuples).mockClear();
		const { container, rerender } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'iteration' as const, a: -1.4 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		const callsAfterFirst = vi.mocked(calculateCliffordTuples).mock.calls.length;
		// Changing a math prop (a) should trigger a recompute (debounced).
		await rerender({ ...baseProps, colorMode: 'iteration' as const, a: 1.5 });
		await waitFor(() => {
			expect(vi.mocked(calculateCliffordTuples).mock.calls.length).toBeGreaterThan(
				callsAfterFirst
			);
		});
	});

	it('does not throw on non-finite zoom (paramsValid rejects)', async () => {
		const { container } = render(CliffordRenderer, {
			props: { ...baseProps, zoom: Number.NaN, colorMode: 'iteration' as const }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('does not throw on non-positive iterations (paramsValid rejects)', async () => {
		const { container } = render(CliffordRenderer, {
			props: { ...baseProps, iterations: 0, colorMode: 'iteration' as const }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('does not throw on non-finite pointSize or opacity', async () => {
		const { container } = render(CliffordRenderer, {
			props: {
				...baseProps,
				pointSize: Number.POSITIVE_INFINITY,
				opacity: Number.NaN,
				colorMode: 'iteration' as const
			}
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('cleans up on unmount without throwing', async () => {
		const { unmount, container } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		expect(() => unmount()).not.toThrow();
	});

	it('warns and skips drawing when 2D context is unavailable', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const originalMockGetContext = HTMLCanvasElement.prototype.getContext;
		// Override getContext to return null for '2d'.
		Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
			configurable: true,
			value: () => null
		});
		try {
			const { container } = render(CliffordRenderer, {
				props: { ...baseProps, colorMode: 'iteration' as const }
			});
			await waitFor(() => {
				expect(container.querySelector('canvas')).not.toBeNull();
			});
			await waitFor(() => {
				expect(warnSpy).toHaveBeenCalledWith(
					expect.stringContaining('canvas or 2D context unavailable')
				);
			});
		} finally {
			Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
				configurable: true,
				value: originalMockGetContext
			});
			warnSpy.mockRestore();
		}
	});

	it('skips out-of-bounds points in density mode without errors', async () => {
		// With zoom > 1, the domain narrows around the center. Points at the
		// extremes map outside the canvas pixel grid; the density loop's bounds
		// check (continue) should skip them without errors.
		vi.mocked(calculateCliffordTuples).mockReturnValue([
			[-10, -10],
			[10, 10],
			[0, 0],
			[0.5, 0.5]
		]);
		render(CliffordRenderer, {
			props: { ...baseProps, zoom: 5, colorMode: 'density' as const }
		});
		await waitFor(() => {
			expect(ctx.putImageData).toHaveBeenCalled();
		});
	});

	it('binds containerElement prop to the inner container div', async () => {
		// Pass a containerElement prop so the $effect binding (containerElement =
		// container) executes. The renderer should still render normally.
		let boundContainer: HTMLDivElement | undefined;
		render(CliffordRenderer, {
			props: {
				...baseProps,
				colorMode: 'density' as const,
				containerElement: boundContainer
			}
		});
		await waitFor(() => {
			expect(ctx.putImageData).toHaveBeenCalled();
		});
	});
});
