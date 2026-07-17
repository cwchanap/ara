import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { calculateGingerbreadmanTuples } from '$lib/gingerbreadman';
import type { RenderState } from '$lib/slider-drag-manager.svelte';
import GingerbreadmanRenderer from './GingerbreadmanRenderer.svelte';

/**
 * Main-thread compute + canvas paths for GingerbreadmanRenderer (Worker stubbed
 * off so requestPoints() uses computeMainThread). Fidelity budget, status, and
 * style-only cache paths are required coverage for HPA-61.
 */

vi.mock('$lib/gingerbreadman', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/gingerbreadman')>();
	return {
		...actual,
		calculateGingerbreadmanTuples: vi.fn(
			(params: Parameters<typeof actual.calculateGingerbreadmanTuples>[0]) =>
				actual.calculateGingerbreadmanTuples(params)
		)
	};
});

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

// Flush the COMPUTE_DEBOUNCE_MS (250) + STYLE_FULL_PAINT_MS (150) timers.
const FLUSH = () => new Promise((r) => setTimeout(r, 300));
const FLUSH_STYLE = () => new Promise((r) => setTimeout(r, 200));

const PREVIEW_MAX = 25000;
const MAX_POINTS = 250000;

describe('GingerbreadmanRenderer fidelity + main-thread paths', () => {
	beforeEach(() => {
		// No Worker → requestPoints() uses computeMainThread().
		vi.stubGlobal('Worker', undefined);
		installCanvasMock();
		installDimensions(600, 500);
		vi.mocked(calculateGingerbreadmanTuples).mockClear();
	});

	afterEach(() => {
		restoreCanvasMock();
		restoreDimensions();
		vi.unstubAllGlobals();
		cleanup();
	});

	it('mounts without throwing with defaults', async () => {
		expect(() => render(GingerbreadmanRenderer)).not.toThrow();
		await FLUSH();
	});

	it('preview fidelity caps maxPoints at 25000 for large iterations', async () => {
		render(GingerbreadmanRenderer, {
			x0: -0.1,
			y0: 0,
			iterations: 100000,
			fidelity: 'preview',
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		await vi.waitFor(() => {
			expect(vi.mocked(calculateGingerbreadmanTuples).mock.calls.length).toBeGreaterThan(0);
		});
		const lastCall = vi.mocked(calculateGingerbreadmanTuples).mock.calls.at(-1)?.[0];
		expect(lastCall).toBeDefined();
		expect(lastCall!.maxPoints).toBeLessThanOrEqual(PREVIEW_MAX);
		expect(lastCall!.maxPoints).toBe(PREVIEW_MAX);
		expect(lastCall!.iterations).toBe(100000);
	});

	it('full fidelity allows a larger maxPoints budget', async () => {
		render(GingerbreadmanRenderer, {
			x0: -0.1,
			y0: 0,
			iterations: 100000,
			fidelity: 'full',
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		await vi.waitFor(() => {
			expect(vi.mocked(calculateGingerbreadmanTuples).mock.calls.length).toBeGreaterThan(0);
		});
		const lastCall = vi.mocked(calculateGingerbreadmanTuples).mock.calls.at(-1)?.[0];
		expect(lastCall).toBeDefined();
		expect(lastCall!.maxPoints).toBeGreaterThan(PREVIEW_MAX);
		expect(lastCall!.maxPoints).toBe(Math.min(100000, MAX_POINTS));
	});

	it('reports rendering then complete via onRenderStateChange', async () => {
		const states: RenderState[] = [];
		render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500,
			onRenderStateChange: (s) => states.push(s)
		});
		await FLUSH();
		await vi.waitFor(() => {
			expect(states).toContain('complete');
		});
		const renderingIdx = states.indexOf('rendering');
		const completeIdx = states.indexOf('complete');
		expect(renderingIdx).toBeGreaterThanOrEqual(0);
		expect(completeIdx).toBeGreaterThan(renderingIdx);
	});

	it('style-only changes do not recompute while still completing status', async () => {
		const states: RenderState[] = [];
		const { rerender } = render(GingerbreadmanRenderer, {
			x0: -0.1,
			y0: 0,
			iterations: 500,
			colorMode: 'iteration',
			pointSize: 1.5,
			height: 500,
			onRenderStateChange: (s) => states.push(s)
		});
		await FLUSH();
		await vi.waitFor(() => {
			expect(states).toContain('complete');
		});
		const computeCallsAfterFirst = vi.mocked(calculateGingerbreadmanTuples).mock.calls.length;
		expect(computeCallsAfterFirst).toBeGreaterThan(0);
		states.length = 0;

		await rerender({
			x0: -0.1,
			y0: 0,
			iterations: 500,
			colorMode: 'radius',
			pointSize: 3,
			height: 500,
			onRenderStateChange: (s) => states.push(s)
		});
		await tick();
		await FLUSH_STYLE();
		await vi.waitFor(() => {
			expect(states).toContain('complete');
		});

		// Compute spy call count must remain stable — style path uses cache.
		expect(vi.mocked(calculateGingerbreadmanTuples).mock.calls.length).toBe(
			computeCallsAfterFirst
		);
		const renderingIdx = states.indexOf('rendering');
		const completeIdx = states.indexOf('complete');
		expect(renderingIdx).toBeGreaterThanOrEqual(0);
		expect(completeIdx).toBeGreaterThan(renderingIdx);
	});

	it('computes on the main thread and draws the density buffer', async () => {
		render(GingerbreadmanRenderer, {
			x0: -0.1,
			y0: 0,
			iterations: 1000,
			colorMode: 'density',
			height: 500
		});
		await FLUSH();
		expect(ctxSpies.putImageData).toHaveBeenCalled();
	});

	it('draws per-point arcs for the iteration color mode', async () => {
		render(GingerbreadmanRenderer, {
			x0: -0.1,
			y0: 0,
			iterations: 500,
			colorMode: 'iteration',
			pointSize: 2,
			opacity: 0.7,
			height: 500
		});
		await FLUSH();
		expect(ctxSpies.beginPath).toHaveBeenCalled();
		expect(ctxSpies.arc).toHaveBeenCalled();
		expect(ctxSpies.fill).toHaveBeenCalled();
	});

	it('draws per-point arcs for single, radius, and angle color modes', async () => {
		for (const colorMode of ['single', 'radius', 'angle'] as const) {
			ctxSpies.fill.mockClear();
			const { unmount } = render(GingerbreadmanRenderer, {
				iterations: 300,
				colorMode,
				height: 500
			});
			await FLUSH();
			expect(ctxSpies.fill).toHaveBeenCalled();
			unmount();
		}
	});

	it('skips rendering and warns when parameters are invalid', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		render(GingerbreadmanRenderer, {
			x0: Number.NaN,
			iterations: 1000,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid parameters'));
		expect(ctxSpies.fill).not.toHaveBeenCalled();
		expect(ctxSpies.putImageData).not.toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it('cleans up the render timeout on unmount', async () => {
		const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
		const { unmount } = render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		unmount();
		expect(clearTimeoutSpy).toHaveBeenCalled();
		clearTimeoutSpy.mockRestore();
	});

	it('warns and skips drawing when the 2D context is unavailable', async () => {
		HTMLCanvasElement.prototype.getContext = vi.fn(
			() => null
		) as unknown as typeof HTMLCanvasElement.prototype.getContext;
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		render(GingerbreadmanRenderer, {
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

	it('skips drawing when the container has zero width (dimension guard)', async () => {
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			get: () => 0
		});
		render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		expect(ctxSpies.fill).not.toHaveBeenCalled();
		expect(ctxSpies.putImageData).not.toHaveBeenCalled();
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

describe('GingerbreadmanRenderer worker error fallback', () => {
	beforeEach(() => {
		posted.length = 0;
		workerOnmessage = null;
		workerOnerror = null;
		vi.stubGlobal('Worker', MockWorker);
		installCanvasMock();
		installDimensions(600, 500);
		vi.mocked(calculateGingerbreadmanTuples).mockClear();
	});

	afterEach(() => {
		restoreCanvasMock();
		restoreDimensions();
		vi.unstubAllGlobals();
		cleanup();
	});

	it('posts gingerbreadman with preview-capped maxPoints', async () => {
		render(GingerbreadmanRenderer, {
			x0: -0.1,
			y0: 0,
			iterations: 100000,
			fidelity: 'preview',
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		expect(posted.length).toBeGreaterThan(0);
		const req = posted[0] as {
			type: string;
			maxPoints: number;
			iterations: number;
			x0: number;
		};
		expect(req.type).toBe('gingerbreadman');
		expect(req.maxPoints).toBeLessThanOrEqual(PREVIEW_MAX);
		expect(req.x0).toBe(-0.1);
	});

	it('posts full budget maxPoints when fidelity is full', async () => {
		render(GingerbreadmanRenderer, {
			iterations: 100000,
			fidelity: 'full',
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		const req = posted[0] as { maxPoints: number };
		expect(req.maxPoints).toBe(Math.min(100000, MAX_POINTS));
	});

	it('falls back to main-thread compute on a worker error response', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		expect(posted.length).toBeGreaterThan(0);

		workerOnmessage?.({
			data: { type: 'error', message: 'boom' }
		});
		await tick();
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('worker error response'),
			'boom'
		);
		expect(ctxSpies.fill).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('falls back to main-thread compute on a worker onerror event', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		render(GingerbreadmanRenderer, {
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
		render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		ctxSpies.fill.mockClear();

		workerOnmessage?.({
			data: {
				type: 'gingerbreadmanResult',
				id: 999,
				points: [[0, 0]] as [number, number][]
			}
		});
		await tick();
		expect(ctxSpies.fill).not.toHaveBeenCalled();
	});

	it('renders points from a valid worker result', async () => {
		render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		const req = posted[0] as { id: number };
		ctxSpies.fill.mockClear();

		workerOnmessage?.({
			data: {
				type: 'gingerbreadmanResult',
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
		const { rerender } = render(GingerbreadmanRenderer, {
			x0: -0.1,
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		expect(posted.length).toBe(1);
		ctxSpies.fill.mockClear();

		await rerender({
			x0: -0.5,
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await tick();
		expect(posted.length).toBe(1);

		const firstReq = posted[0] as { id: number };
		workerOnmessage?.({
			data: {
				type: 'gingerbreadmanResult',
				id: firstReq.id,
				points: [[0.1, 0.2]] as [number, number][]
			}
		});
		await tick();
		await FLUSH();
		expect(posted.length).toBe(2);
		const secondReq = posted[1] as { x0: number };
		expect(secondReq.x0).toBe(-0.5);
	});

	it('ignores worker messages with an unknown type', async () => {
		render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		ctxSpies.fill.mockClear();

		workerOnmessage?.({
			data: { type: 'tinkerbellResult', id: 1, points: [[0, 0]] }
		});
		await tick();
		expect(ctxSpies.fill).not.toHaveBeenCalled();
	});

	it('falls back to main-thread compute when Worker constructor throws', async () => {
		vi.stubGlobal(
			'Worker',
			class {
				constructor() {
					throw new Error('Worker init failed');
				}
			}
		);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Failed to initialize gingerbreadman web worker'),
			expect.any(Error)
		);
		expect(ctxSpies.fill).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('renders axes only (no point drawing) when worker returns empty points', async () => {
		render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		const req = posted[0] as { id: number };
		ctxSpies.fill.mockClear();
		ctxSpies.putImageData.mockClear();

		workerOnmessage?.({
			data: {
				type: 'gingerbreadmanResult',
				id: req.id,
				points: [] as [number, number][]
			}
		});
		await tick();
		expect(ctxSpies.fill).not.toHaveBeenCalled();
		expect(ctxSpies.putImageData).not.toHaveBeenCalled();
	});

	it('ignores worker messages received after unmount (isUnmounted guard)', async () => {
		const { unmount } = render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'iteration',
			height: 500
		});
		await FLUSH();
		const req = posted[0] as { id: number };
		ctxSpies.fill.mockClear();

		unmount();

		workerOnmessage?.({
			data: {
				type: 'gingerbreadmanResult',
				id: req.id,
				points: [[0.1, 0.2]] as [number, number][]
			}
		});
		await tick();
		expect(ctxSpies.fill).not.toHaveBeenCalled();
	});
});

// ── ResizeObserver path ─────────────────────────────────────────────────────

describe('GingerbreadmanRenderer ResizeObserver', () => {
	let disconnectSpy: ReturnType<typeof vi.fn>;
	let observeSpy: ReturnType<typeof vi.fn>;
	let resizeCallback: (() => void) | null = null;
	let savedResizeObserver: typeof globalThis.ResizeObserver | undefined;

	beforeEach(() => {
		vi.stubGlobal('Worker', undefined);
		installCanvasMock();
		installDimensions(600, 500);
		disconnectSpy = vi.fn();
		observeSpy = vi.fn();
		resizeCallback = null;
		savedResizeObserver = globalThis.ResizeObserver;
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
		restoreCanvasMock();
		restoreDimensions();
		vi.unstubAllGlobals();
		if (savedResizeObserver) {
			globalThis.ResizeObserver = savedResizeObserver;
		} else {
			delete (globalThis as unknown as Record<string, unknown>).ResizeObserver;
		}
		cleanup();
	});

	it('creates a ResizeObserver on mount and disconnects on unmount', async () => {
		const { unmount } = render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'density',
			height: 500
		});
		await FLUSH();
		expect(observeSpy).toHaveBeenCalled();
		unmount();
		expect(disconnectSpy).toHaveBeenCalled();
	});

	it('re-renders (without recompute) when the ResizeObserver fires', async () => {
		vi.mocked(calculateGingerbreadmanTuples).mockClear();
		render(GingerbreadmanRenderer, {
			iterations: 500,
			colorMode: 'density',
			height: 500
		});
		await FLUSH();
		expect(ctxSpies.putImageData).toHaveBeenCalled();
		const calls = vi.mocked(calculateGingerbreadmanTuples).mock.calls.length;
		ctxSpies.putImageData.mockClear();

		resizeCallback?.();
		expect(ctxSpies.putImageData).toHaveBeenCalled();
		expect(vi.mocked(calculateGingerbreadmanTuples).mock.calls.length).toBe(calls);
	});
});
