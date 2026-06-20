/**
 * Worker-path coverage for CliffordRenderer.
 *
 * The main test file (CliffordRenderer.svelte.test.ts) runs without a Worker
 * global, so the component always falls back to the main-thread compute path.
 * This file mocks `window.Worker` to exercise the worker initialization,
 * postMessage request, onmessage success/error handlers, onerror fallback,
 * and cleanup-on-unmount branches.
 */
import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import { calculateCliffordTuples } from '$lib/clifford';
import CliffordRenderer from './CliffordRenderer.svelte';
import type { ChaosMapsWorkerResponse } from '$lib/workers/types';

// ---------------------------------------------------------------------------
// Canvas / context mock (shared with the main test file's approach)
// ---------------------------------------------------------------------------
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
	) => {
		data: Uint8ClampedArray;
		width: number;
		height: number;
	};
	putImageData: ReturnType<typeof vi.fn>;
}

let ctx: MockCtx;

// ---------------------------------------------------------------------------
// Mock Worker
// ---------------------------------------------------------------------------
class MockWorker {
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	postMessage = vi.fn();
	terminate = vi.fn();
	addEventListener = vi.fn();
	removeEventListener = vi.fn();
}

const createdWorkers: MockWorker[] = [];
let originalWorker: typeof globalThis.Worker | undefined;

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
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
		configurable: true,
		get() {
			return 300;
		}
	});

	originalWorker = window.Worker;
	(window as unknown as { Worker: typeof globalThis.Worker }).Worker = class {
		constructor() {
			const w = new MockWorker();
			createdWorkers.push(w);
			return w;
		}
	} as unknown as typeof globalThis.Worker;
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
	(window as unknown as { Worker: typeof globalThis.Worker }).Worker =
		originalWorker ?? globalThis.Worker;
});

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

function latestWorker(): MockWorker {
	const w = createdWorkers[createdWorkers.length - 1];
	if (!w) throw new Error('No mock worker was created');
	return w;
}

describe('CliffordRenderer – worker path', () => {
	afterEach(() => {
		cleanup();
		createdWorkers.length = 0;
		vi.mocked(calculateCliffordTuples).mockReturnValue([
			[0, 0],
			[0.5, -0.2],
			[1, 0.5]
		]);
		vi.mocked(ctx.putImageData).mockClear();
		vi.mocked(ctx.clearRect).mockClear();
	});

	it('creates a Worker on mount and posts a clifford request after debounce', async () => {
		vi.useFakeTimers();
		render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		// Advance past the 250ms debounce to trigger requestPoints.
		vi.advanceTimersByTime(300);
		const worker = latestWorker();
		expect(worker.postMessage).toHaveBeenCalledTimes(1);
		const payload = worker.postMessage.mock.calls[0][0] as {
			type: string;
			id: number;
			a: number;
		};
		expect(payload.type).toBe('clifford');
		expect(payload.a).toBe(-1.4);
		vi.useRealTimers();
	});

	it('renders points received from the worker (onmessage cliffordResult)', async () => {
		vi.useFakeTimers();
		render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		vi.advanceTimersByTime(300);
		const worker = latestWorker();
		const requestId = (worker.postMessage.mock.calls[0][0] as { id: number }).id;
		// Simulate worker response with valid points.
		worker.onmessage?.({
			data: {
				type: 'cliffordResult',
				id: requestId,
				points: [
					[0, 0],
					[0.5, -0.2],
					[1, 0.5]
				]
			} as ChaosMapsWorkerResponse
		} as MessageEvent);
		expect(ctx.putImageData).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('ignores stale worker responses (mismatched id)', async () => {
		vi.useFakeTimers();
		render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		vi.advanceTimersByTime(300);
		const worker = latestWorker();
		// Send a response with a wrong id — should be ignored.
		worker.onmessage?.({
			data: {
				type: 'cliffordResult',
				id: 99999,
				points: [
					[0, 0],
					[1, 1]
				]
			} as ChaosMapsWorkerResponse
		} as MessageEvent);
		expect(ctx.putImageData).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('ignores non-cliffordResult worker messages', async () => {
		vi.useFakeTimers();
		render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		vi.advanceTimersByTime(300);
		const worker = latestWorker();
		const requestId = (worker.postMessage.mock.calls[0][0] as { id: number }).id;
		worker.onmessage?.({
			data: {
				type: 'standardResult',
				id: requestId,
				points: [[0, 0]]
			} as ChaosMapsWorkerResponse
		} as MessageEvent);
		expect(ctx.putImageData).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('falls back to main-thread compute on worker error response', async () => {
		vi.useFakeTimers();
		render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		vi.advanceTimersByTime(300);
		const worker = latestWorker();
		vi.mocked(calculateCliffordTuples).mockClear();
		// Simulate worker error response.
		worker.onmessage?.({
			data: {
				type: 'error',
				id: 0,
				message: 'boom'
			} as ChaosMapsWorkerResponse
		} as MessageEvent);
		// Error path terminates the worker and falls back to main-thread compute.
		expect(worker.terminate).toHaveBeenCalled();
		expect(calculateCliffordTuples).toHaveBeenCalled();
		expect(ctx.putImageData).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('falls back to main-thread compute on worker onerror', async () => {
		vi.useFakeTimers();
		render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		vi.advanceTimersByTime(300);
		const worker = latestWorker();
		vi.mocked(calculateCliffordTuples).mockClear();
		worker.onerror?.({
			message: 'worker crashed',
			filename: '',
			lineno: 0,
			colno: 0,
			error: new Error('crashed')
		} as ErrorEvent);
		expect(worker.terminate).toHaveBeenCalled();
		expect(calculateCliffordTuples).toHaveBeenCalled();
		expect(ctx.putImageData).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('terminates the worker on unmount', async () => {
		vi.useFakeTimers();
		const { unmount } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		vi.advanceTimersByTime(300);
		const worker = latestWorker();
		unmount();
		expect(worker.terminate).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('does not render when worker errors after unmount', async () => {
		vi.useFakeTimers();
		const { unmount } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		vi.advanceTimersByTime(300);
		const worker = latestWorker();
		vi.mocked(calculateCliffordTuples).mockClear();
		// Unmount first, then simulate a worker error.
		unmount();
		worker.onmessage?.({
			data: { type: 'error', id: 0, message: 'late error' } as ChaosMapsWorkerResponse
		} as MessageEvent);
		// The isUnmounted guard should prevent the main-thread fallback.
		expect(calculateCliffordTuples).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('does not render when worker onerror fires after unmount', async () => {
		vi.useFakeTimers();
		const { unmount } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		vi.advanceTimersByTime(300);
		const worker = latestWorker();
		vi.mocked(calculateCliffordTuples).mockClear();
		unmount();
		worker.onerror?.({
			message: 'late crash',
			filename: '',
			lineno: 0,
			colno: 0,
			error: new Error('crashed')
		} as ErrorEvent);
		// The isUnmounted guard should prevent the main-thread fallback.
		expect(calculateCliffordTuples).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('handles pending render queued while worker is computing', async () => {
		vi.useFakeTimers();
		const { rerender } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		// Trigger the initial debounced requestPoints (posts to worker).
		vi.advanceTimersByTime(300);
		const worker = latestWorker();
		expect(worker.postMessage).toHaveBeenCalledTimes(1);
		const requestId = (worker.postMessage.mock.calls[0][0] as { id: number }).id;

		// While the worker is still computing (isComputing === true), change a
		// math parameter. The $effect calls scheduleRender which should queue a
		// pending render (hasPendingRender = true) instead of posting immediately.
		rerender({ ...baseProps, colorMode: 'density' as const, a: 1.5 });
		vi.advanceTimersByTime(300);
		// No new postMessage yet — the render is pending while computing.
		expect(worker.postMessage).toHaveBeenCalledTimes(1);

		// Deliver the worker response — the onmessage handler processes the
		// pending render by calling scheduleRender (debounced).
		worker.onmessage?.({
			data: {
				type: 'cliffordResult',
				id: requestId,
				points: [
					[0, 0],
					[0.5, -0.2]
				]
			} as ChaosMapsWorkerResponse
		} as MessageEvent);
		// After the response, the pending render is scheduled (debounced).
		vi.advanceTimersByTime(300);
		// A second postMessage should have been issued for the pending render.
		expect(worker.postMessage).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});
});
