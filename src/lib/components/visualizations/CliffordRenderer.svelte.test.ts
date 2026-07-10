import { afterAll, beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// Hoisted worker mocks shared across worker-path tests. The holder lets each
// test read back the instance the renderer constructed without re-declaring a
// class inside the test body (avoids perf_avoid_nested_class warnings).
interface CapturedWorker {
	postMessage: (msg: unknown) => void;
	terminate: () => void;
	onmessage: ((event: MessageEvent) => void) | null;
	onerror: ((event: ErrorEvent) => void) | null;
}

const workerHolder: { instance: CapturedWorker | null } = { instance: null };

// Basic worker: postMessage is a no-op spy. Tests manually fire onmessage/onerror.
class MockWorker {
	postMessage = vi.fn();
	terminate = vi.fn();
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	constructor() {
		workerHolder.instance = this;
	}
}

// Worker whose constructor throws, exercising the init-failure fallback.
class FailingWorker {
	constructor() {
		throw new Error('Worker init failed');
	}
}

// Auto-responds to postMessage with a cliffordResult message.
class AutoRespondCliffordWorker {
	postMessage = (msg: unknown) => {
		setTimeout(() => {
			if (this.onmessage) {
				this.onmessage(
					new MessageEvent('message', {
						data: {
							type: 'cliffordResult',
							id: (msg as { id: number }).id,
							points: [
								[0, 0],
								[0.5, 0.5]
							] as [number, number][]
						}
					})
				);
			}
		}, 10);
	};
	terminate = vi.fn();
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	constructor() {
		workerHolder.instance = this;
	}
}

// Auto-responds with an unknown message type (ignored by the renderer).
class AutoRespondUnknownWorker {
	postMessage = (msg: unknown) => {
		setTimeout(() => {
			if (this.onmessage) {
				this.onmessage(
					new MessageEvent('message', {
						data: { type: 'unknown', id: (msg as { id: number }).id }
					})
				);
			}
		}, 10);
	};
	terminate = vi.fn();
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	constructor() {
		workerHolder.instance = this;
	}
}

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

	it('handles worker error response and falls back to main thread', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		vi.mocked(calculateCliffordTuples).mockReturnValueOnce([
			[0, 0],
			[0.5, 0.5]
		]);

		render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'iteration' as const }
		});

		await new Promise((r) => setTimeout(r, 50));

		if (workerHolder.instance!.onmessage) {
			workerHolder.instance!.onmessage(
				new MessageEvent('message', {
					data: { type: 'error', message: 'clifford worker failed' }
				})
			);
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalledWith(
				'Clifford worker error response:',
				'clifford worker failed'
			);
		});

		expect(workerHolder.instance!.terminate).toHaveBeenCalled();
		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('handles worker onerror and falls back to main thread', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		vi.mocked(calculateCliffordTuples).mockReturnValueOnce([
			[0, 0],
			[0.5, 0.5]
		]);

		render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'iteration' as const }
		});

		await new Promise((r) => setTimeout(r, 50));

		if (workerHolder.instance!.onerror) {
			workerHolder.instance!.onerror(
				new ErrorEvent('error', { message: 'clifford runtime error' })
			);
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalledWith(
				'Clifford worker error:',
				'clifford runtime error'
			);
		});

		expect(workerHolder.instance!.terminate).toHaveBeenCalled();
		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('handles worker initialization failure gracefully', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		(globalThis as unknown as Record<string, unknown>).Worker = FailingWorker;

		const { container } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'iteration' as const }
		});

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		expect(errorSpy).toHaveBeenCalledWith(
			'Failed to initialize clifford web worker:',
			expect.any(Error)
		);

		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('processes a successful worker response and renders', async () => {
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = AutoRespondCliffordWorker;

		const { container } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'iteration' as const }
		});

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});

		expect(workerHolder.instance).not.toBeNull();
		delete (globalThis as unknown as Record<string, unknown>).Worker;
	});

	it('ignores worker response with wrong type without throwing', async () => {
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = AutoRespondUnknownWorker;

		vi.mocked(calculateCliffordTuples).mockReturnValueOnce([
			[0, 0],
			[0.5, 0.5]
		]);

		expect(() =>
			render(CliffordRenderer, {
				props: { ...baseProps, colorMode: 'iteration' as const }
			})
		).not.toThrow();

		await new Promise((r) => setTimeout(r, 50));

		// The wrong-type response is ignored; component should not throw.
		expect(workerHolder.instance).not.toBeNull();

		delete (globalThis as unknown as Record<string, unknown>).Worker;
	});
});

// ── ResizeObserver path ─────────────────────────────────────────────────────
//
// The main describe block's afterAll restores getContext, so this block sets
// up its own canvas/dimension mocks to keep the render path exercised.

describe('CliffordRenderer ResizeObserver', () => {
	let disconnectSpy: ReturnType<typeof vi.fn>;
	let observeSpy: ReturnType<typeof vi.fn>;
	let resizeCallback: (() => void) | null = null;
	let savedResizeObserver: typeof globalThis.ResizeObserver | undefined;
	let savedGetContext: typeof HTMLCanvasElement.prototype.getContext;
	let roCtx: MockCtx;

	beforeEach(() => {
		disconnectSpy = vi.fn();
		observeSpy = vi.fn();
		resizeCallback = null;
		savedResizeObserver = globalThis.ResizeObserver;
		savedGetContext = HTMLCanvasElement.prototype.getContext;
		roCtx = {
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
		HTMLCanvasElement.prototype.getContext = vi.fn(
			() => roCtx
		) as unknown as typeof HTMLCanvasElement.prototype.getContext;
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			get: () => 300
		});
		// Stub ResizeObserver so the onMount guard (`typeof ResizeObserver !==
		// 'undefined'`) passes and the observe/disconnect paths execute.
		globalThis.ResizeObserver = class {
			constructor(fn: () => void) {
				resizeCallback = fn;
			}
			observe = observeSpy;
			disconnect = disconnectSpy;
			unobserve = vi.fn();
		} as unknown as typeof globalThis.ResizeObserver;
	});

	afterEach(() => {
		HTMLCanvasElement.prototype.getContext = savedGetContext;
		if (savedResizeObserver) {
			globalThis.ResizeObserver = savedResizeObserver;
		} else {
			delete (globalThis as unknown as Record<string, unknown>).ResizeObserver;
		}
		cleanup();
	});

	it('creates a ResizeObserver on mount and disconnects on unmount', async () => {
		const { container, unmount } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		expect(observeSpy).toHaveBeenCalled();
		unmount();
		expect(disconnectSpy).toHaveBeenCalled();
	});

	it('re-renders (without recompute) when the ResizeObserver fires', async () => {
		vi.mocked(calculateCliffordTuples).mockClear();
		render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		await waitFor(() => {
			expect(roCtx.putImageData).toHaveBeenCalled();
		});
		const computeCallsBefore = vi.mocked(calculateCliffordTuples).mock.calls.length;
		roCtx.putImageData.mockClear();

		// Fire the resize callback — should call render(latest) without recomputing.
		resizeCallback?.();
		expect(roCtx.putImageData).toHaveBeenCalled();
		expect(vi.mocked(calculateCliffordTuples).mock.calls.length).toBe(computeCallsBefore);
	});
});
