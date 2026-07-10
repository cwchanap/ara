import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import TinkerbellRenderer from './TinkerbellRenderer.svelte';

/**
 * These tests exercise the main-thread compute + canvas render paths of
 * TinkerbellRenderer (the worker is intentionally absent so requestPoints()
 * falls back to computeMainThread). A mocked 2D canvas context and non-zero
 * container dimensions are required because jsdom provides neither.
 */

// Captured 2D context method calls so assertions can verify drawing happened.
let ctxSpies: {
	clearRect: ReturnType<typeof vi.fn>;
	createImageData: ReturnType<typeof vi.fn>;
	putImageData: ReturnType<typeof vi.fn>;
	beginPath: ReturnType<typeof vi.fn>;
	arc: ReturnType<typeof vi.fn>;
	fill: ReturnType<typeof vi.fn>;
};

function makeCtxSpies() {
	return {
		clearRect: vi.fn(),
		createImageData: vi.fn(() => {
			// Return an ImageData-like object with a writable data array.
			return { data: new Uint8ClampedArray(16) } as unknown as ImageData;
		}),
		putImageData: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn()
	};
}

let savedGetContext: typeof HTMLCanvasElement.prototype.getContext;
let savedClientWidth: number;
let savedClientHeight: number;

function installCanvasMock() {
	ctxSpies = makeCtxSpies();
	savedGetContext = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = vi.fn(() => {
		const ctx = {
			...ctxSpies,
			globalAlpha: 1,
			fillStyle: ''
		} as unknown as CanvasRenderingContext2D;
		return ctx;
	}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

function installDimensions(width: number, height: number) {
	const proto = HTMLElement.prototype;
	savedClientWidth = Object.getOwnPropertyDescriptor(proto, 'clientWidth')?.value as number;
	savedClientHeight = Object.getOwnPropertyDescriptor(proto, 'clientHeight')?.value as number;
	Object.defineProperty(proto, 'clientWidth', {
		configurable: true,
		get: () => width
	});
	Object.defineProperty(proto, 'clientHeight', {
		configurable: true,
		get: () => height
	});
}

function restoreCanvasMock() {
	HTMLCanvasElement.prototype.getContext = savedGetContext;
}

function restoreDimensions() {
	const proto = HTMLElement.prototype;
	Object.defineProperty(proto, 'clientWidth', {
		configurable: true,
		get: () => savedClientWidth
	});
	Object.defineProperty(proto, 'clientHeight', {
		configurable: true,
		get: () => savedClientHeight
	});
}

// Flush the DEBOUNCE_MS (250) render debounce.
const FLUSH = () => new Promise((r) => setTimeout(r, 300));

describe('TinkerbellRenderer main-thread render paths', () => {
	beforeEach(() => {
		// No Worker available → requestPoints() uses computeMainThread().
		vi.stubGlobal('Worker', undefined);
		installCanvasMock();
		installDimensions(600, 500);
	});

	afterEach(() => {
		restoreCanvasMock();
		restoreDimensions();
		vi.unstubAllGlobals();
		cleanup();
	});

	it('computes on the main thread and draws the density buffer', async () => {
		render(TinkerbellRenderer, {
			a: 0.9,
			b: -0.6013,
			c: 2.0,
			d: 0.5,
			iterations: 1000,
			colorMode: 'density',
			height: 500
		});
		await FLUSH();
		// density path calls putImageData with the accumulated buffer.
		expect(ctxSpies.putImageData).toHaveBeenCalled();
	});

	it('draws per-point arcs for the iteration color mode', async () => {
		render(TinkerbellRenderer, {
			a: 0.9,
			b: -0.6013,
			c: 2.0,
			d: 0.5,
			iterations: 500,
			colorMode: 'iteration',
			pointSize: 2,
			opacity: 0.7,
			height: 500
		});
		await FLUSH();
		// per-point path calls beginPath/arc/fill for each point.
		expect(ctxSpies.beginPath).toHaveBeenCalled();
		expect(ctxSpies.arc).toHaveBeenCalled();
		expect(ctxSpies.fill).toHaveBeenCalled();
	});

	it('draws per-point arcs for the single color mode', async () => {
		render(TinkerbellRenderer, {
			iterations: 300,
			colorMode: 'single',
			height: 500
		});
		await FLUSH();
		expect(ctxSpies.fill).toHaveBeenCalled();
	});

	it('draws per-point arcs for the radius color mode', async () => {
		render(TinkerbellRenderer, {
			iterations: 300,
			colorMode: 'radius',
			height: 500
		});
		await FLUSH();
		expect(ctxSpies.fill).toHaveBeenCalled();
	});

	it('draws per-point arcs for the angle color mode', async () => {
		render(TinkerbellRenderer, {
			iterations: 300,
			colorMode: 'angle',
			height: 500
		});
		await FLUSH();
		expect(ctxSpies.fill).toHaveBeenCalled();
	});

	it('skips rendering and warns when parameters are invalid', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		render(TinkerbellRenderer, {
			a: Number.NaN,
			iterations: 1000,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid parameters'));
		// No drawing should occur for invalid params.
		expect(ctxSpies.fill).not.toHaveBeenCalled();
		expect(ctxSpies.putImageData).not.toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it('re-renders without recomputing when a render-only setting changes', async () => {
		const { rerender } = render(TinkerbellRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6,
			height: 500
		});
		await FLUSH();
		ctxSpies.fill.mockClear();
		ctxSpies.putImageData.mockClear();

		// Changing zoom (render-only) triggers the second $effect which calls
		// render(latest) directly — no debounce, synchronous after tick.
		await rerender({
			iterations: 500,
			colorMode: 'iteration',
			zoom: 2,
			pointSize: 1.5,
			opacity: 0.6,
			height: 500
		});
		await tick();
		// The cached latest points are re-drawn.
		expect(ctxSpies.fill).toHaveBeenCalled();
	});

	it('cleans up the render timeout on unmount', async () => {
		const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
		const { unmount } = render(TinkerbellRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		// Unmount before the debounce fires to exercise the cleanup return.
		unmount();
		expect(clearTimeoutSpy).toHaveBeenCalled();
		clearTimeoutSpy.mockRestore();
	});

	it('warns and skips drawing when the 2D context is unavailable', async () => {
		// Override the canvas mock so getContext returns null for this test,
		// exercising the render() guard that bails out on a missing context.
		HTMLCanvasElement.prototype.getContext = vi.fn(
			() => null
		) as unknown as typeof HTMLCanvasElement.prototype.getContext;
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		render(TinkerbellRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('canvas or 2D context unavailable')
		);
		warnSpy.mockRestore();
	});
});

// ── Worker error / fallback paths ────────────────────────────────────────────

const posted: unknown[] = [];
let workerOnmessage: ((e: { data: unknown }) => void) | null = null;
let workerOnerror: ((e: ErrorEvent) => void) | null = null;

class MockWorker {
	constructor() {
		return {
			postMessage: (msg: unknown) => posted.push(msg),
			terminate: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			set onmessage(fn: (e: { data: unknown }) => void) {
				workerOnmessage = fn;
			},
			get onmessage(): ((e: { data: unknown }) => void) | null {
				return workerOnmessage;
			},
			set onerror(fn: (e: ErrorEvent) => void) {
				workerOnerror = fn;
			},
			get onerror(): ((e: ErrorEvent) => void) | null {
				return workerOnerror;
			}
		};
	}
}

describe('TinkerbellRenderer worker error fallback', () => {
	beforeEach(() => {
		posted.length = 0;
		workerOnmessage = null;
		workerOnerror = null;
		vi.stubGlobal('Worker', MockWorker);
		installCanvasMock();
		installDimensions(600, 500);
	});

	afterEach(() => {
		restoreCanvasMock();
		restoreDimensions();
		vi.unstubAllGlobals();
		cleanup();
	});

	it('falls back to main-thread compute on a worker error response', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		render(TinkerbellRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		expect(posted.length).toBeGreaterThan(0);

		// Simulate the worker returning an error response.
		workerOnmessage?.({
			data: { type: 'error', message: 'boom' }
		});
		await tick();
		// After the error the renderer falls back to the main thread and draws.
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('worker error response'),
			'boom'
		);
		expect(ctxSpies.fill).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('falls back to main-thread compute on a worker onerror event', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		render(TinkerbellRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();

		workerOnerror?.({ message: 'worker crashed' } as ErrorEvent);
		await tick();
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('worker error'),
			'worker crashed'
		);
		expect(ctxSpies.fill).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('ignores worker results with a stale request id', async () => {
		render(TinkerbellRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		ctxSpies.fill.mockClear();

		// Post a stale-id result (id 0, but latestWorkerRequestId has advanced).
		workerOnmessage?.({
			data: {
				type: 'tinkerbellResult',
				id: 999,
				points: [[0, 0]] as [number, number][]
			}
		});
		await tick();
		// Stale result must not trigger a render.
		expect(ctxSpies.fill).not.toHaveBeenCalled();
	});

	it('renders points from a valid worker result', async () => {
		render(TinkerbellRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		const req = posted[0] as { id: number };
		ctxSpies.fill.mockClear();

		workerOnmessage?.({
			data: {
				type: 'tinkerbellResult',
				id: req.id,
				points: [
					[0.1, 0.2],
					[0.3, 0.4]
				] as [number, number][]
			}
		});
		await tick();
		expect(ctxSpies.fill).toHaveBeenCalled();
	});

	it('defers a slider edit made while the worker is computing, then re-renders', async () => {
		const { rerender } = render(TinkerbellRenderer, {
			a: 0.9,
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		// The first request is in flight (isComputing = true); don't answer it.
		expect(posted.length).toBe(1);
		ctxSpies.fill.mockClear();

		// Change a math input while computing → scheduleRender sets
		// hasPendingRender instead of posting immediately.
		await rerender({
			a: 1.2,
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await tick();
		// No new post yet (still computing the first request).
		expect(posted.length).toBe(1);

		// Deliver the first result → render runs, then the pending render is
		// rescheduled (hasPendingRender → scheduleRender → new post).
		const firstReq = posted[0] as { id: number };
		workerOnmessage?.({
			data: {
				type: 'tinkerbellResult',
				id: firstReq.id,
				points: [[0.1, 0.2]] as [number, number][]
			}
		});
		await tick();
		await FLUSH();
		// The deferred render posted a second request with the new `a`.
		expect(posted.length).toBe(2);
		const secondReq = posted[1] as { a: number };
		expect(secondReq.a).toBe(1.2);
	});
});
