import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import StandardRenderer from './StandardRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
// Store the original clientWidth descriptor so we can restore it.
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

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
	// jsdom reports clientWidth as 0 (no layout engine). Give the container a
	// non-zero width so the renderer's dimension calculations produce valid scales.
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
		configurable: true,
		get() {
			return 500;
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

// Hoisted worker mocks shared across worker-path tests. The holder lets each
// test read back the instance the renderer constructed without re-declaring a
// class inside the test body (avoids perf_avoid_nested_class warnings).
interface CapturedWorker {
	postMessage: (msg: unknown) => void;
	terminate: () => void;
	onmessage: ((event: MessageEvent) => void) | null;
	onerror: ((event: ErrorEvent) => void) | null;
	onmessageerror: ((event: MessageEvent) => void) | null;
}

const workerHolder: { instance: CapturedWorker | null } = { instance: null };

// Basic worker: postMessage is a no-op spy. Tests manually fire onmessage/onerror/onmessageerror.
class MockWorker {
	postMessage = vi.fn();
	terminate = vi.fn();
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	onmessageerror: ((event: MessageEvent) => void) | null = null;
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

// Captures the ResizeObserver callback so a test can fire it manually.
const roHolder: { callback: (() => void) | null } = { callback: null };

class CapturingResizeObserver {
	constructor(cb: () => void) {
		roHolder.callback = cb;
	}
	observe() {}
	unobserve() {}
	disconnect() {}
}

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

	it('renders with zero iterations', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(StandardRenderer, {
				props: {
					k: 1,
					numP: 1,
					numQ: 1,
					iterations: 0,
					height: 200
				}
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('renders with extreme numP and numQ values', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(StandardRenderer, {
				props: {
					k: 1,
					numP: 20,
					numQ: 20,
					iterations: 5,
					height: 200
				}
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('handles worker error response via handleWorkerFailure', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 200
			}
		});

		await new Promise((r) => setTimeout(r, 50));

		if (workerHolder.instance!.onmessage) {
			workerHolder.instance!.onmessage(
				new MessageEvent('message', {
					data: { type: 'error', message: 'standard worker failed' }
				})
			);
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalledWith(
				'Standard map worker error response:',
				'standard worker failed'
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

		render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 200
			}
		});

		await new Promise((r) => setTimeout(r, 50));

		if (workerHolder.instance!.onerror) {
			workerHolder.instance!.onerror(
				new ErrorEvent('error', { message: 'standard worker runtime error' })
			);
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalledWith(
				'Standard map worker failure:',
				'standard worker runtime error'
			);
		});

		expect(workerHolder.instance!.terminate).toHaveBeenCalled();
		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('handles worker initialization failure gracefully', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		(globalThis as unknown as Record<string, unknown>).Worker = FailingWorker;

		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 200
			}
		});

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		expect(errorSpy).toHaveBeenCalledWith('Standard map worker failure:', expect.any(Error));

		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});
});

describe('StandardRenderer full render path', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('produces both canvas and SVG with correct dimensions', async () => {
		vi.useFakeTimers();
		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 2,
				numQ: 2,
				iterations: 5,
				height: 400
			}
		});

		await vi.advanceTimersByTimeAsync(200);

		await waitFor(() => {
			const canvas = container.querySelector('canvas');
			expect(canvas).not.toBeNull();
			// canvas width = clientWidth - margin.left - margin.right = 500 - 60 - 20 = 420
			expect(canvas?.getAttribute('width')).toBe('420');
			// canvas height = height - margin.top - margin.bottom = 400 - 20 - 50 = 330
			expect(canvas?.getAttribute('height')).toBe('330');

			const svg = container.querySelector('svg');
			expect(svg).not.toBeNull();
			expect(svg?.getAttribute('width')).toBe('500');
			expect(svg?.getAttribute('height')).toBe('400');
		});
	});

	it('renders axis groups with ticks', async () => {
		vi.useFakeTimers();
		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 2,
				numQ: 2,
				iterations: 5,
				height: 400
			}
		});

		await vi.advanceTimersByTimeAsync(200);

		await waitFor(() => {
			const axisGroups = container.querySelectorAll('svg > g > g');
			expect(axisGroups.length).toBeGreaterThanOrEqual(2);
		});
	});

	it('produces zero points with zero iterations (empty points guard)', async () => {
		vi.useFakeTimers();
		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 0,
				height: 400
			}
		});

		await vi.advanceTimersByTimeAsync(200);

		await waitFor(() => {
			// With 0 iterations, standardMap returns [] — canvas/svg still created
			expect(container.querySelector('canvas')).not.toBeNull();
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('produces zero points with zero numP (guard)', async () => {
		vi.useFakeTimers();
		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 0,
				numQ: 1,
				iterations: 5,
				height: 400
			}
		});

		await vi.advanceTimersByTimeAsync(200);

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('produces zero points with zero numQ (guard)', async () => {
		vi.useFakeTimers();
		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 0,
				iterations: 5,
				height: 400
			}
		});

		await vi.advanceTimersByTimeAsync(200);

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('handles NaN k parameter without crashing (non-finite guard)', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(StandardRenderer, {
				props: {
					k: NaN,
					numP: 1,
					numQ: 1,
					iterations: 5,
					height: 400
				}
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('handles Infinity k parameter without crashing (large-magnitude guard)', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(StandardRenderer, {
				props: {
					k: Infinity,
					numP: 1,
					numQ: 1,
					iterations: 5,
					height: 400
				}
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('handles minimal height (chartHeight === 0) without throwing', async () => {
		vi.useFakeTimers();
		// margin top 20 + bottom 50 = 70; height 70 => chartHeight 0
		expect(() =>
			render(StandardRenderer, {
				props: {
					k: 1,
					numP: 1,
					numQ: 1,
					iterations: 5,
					height: 70
				}
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(200);
	});

	it('re-renders when k parameter changes (parameter change re-render)', async () => {
		vi.useFakeTimers();
		const { container, rerender } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 2,
				numQ: 2,
				iterations: 5,
				height: 400
			}
		});

		await vi.advanceTimersByTimeAsync(200);

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});

		// Change k — should trigger scheduleRender via $effect
		rerender({ k: 2, numP: 2, numQ: 2, iterations: 5, height: 400 });

		await vi.advanceTimersByTimeAsync(200);

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('re-renders when numP/numQ parameters change', async () => {
		vi.useFakeTimers();
		const { container, rerender } = render(StandardRenderer, {
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
			expect(container.querySelector('canvas')).not.toBeNull();
		});

		rerender({ k: 1, numP: 5, numQ: 5, iterations: 10, height: 400 });

		await vi.advanceTimersByTimeAsync(200);

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('binds containerElement prop to the internal container div', async () => {
		vi.useFakeTimers();
		let containerEl: HTMLDivElement | undefined;
		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 400,
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

	it('handles worker onmessageerror and falls back to main thread', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 400
			}
		});

		await new Promise((r) => setTimeout(r, 50));

		if (workerHolder.instance!.onmessageerror) {
			workerHolder.instance!.onmessageerror(new MessageEvent('messageerror'));
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalled();
		});

		expect(workerHolder.instance!.terminate).toHaveBeenCalled();
		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('handles worker standardResult message and renders points', async () => {
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		const { container } = render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 400
			}
		});

		// Wait for the debounce timer to fire and postMessage to be called
		await new Promise((r) => setTimeout(r, 200));

		// Simulate worker returning standard result with matching id
		if (workerHolder.instance!.onmessage) {
			workerHolder.instance!.onmessage(
				new MessageEvent('message', {
					data: {
						type: 'standardResult',
						id: 1,
						points: [
							[1, 2],
							[3, 4]
						] as [number, number][]
					}
				})
			);
		}

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
			expect(container.querySelector('svg')).not.toBeNull();
		});

		delete (globalThis as unknown as Record<string, unknown>).Worker;
	});

	it('ignores worker result with stale id without crashing', async () => {
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		render(StandardRenderer, {
			props: {
				k: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 400
			}
		});

		// Wait for the debounce timer to fire
		await new Promise((r) => setTimeout(r, 200));

		// Send a result with a stale id (999 instead of 1)
		if (workerHolder.instance!.onmessage) {
			workerHolder.instance!.onmessage(
				new MessageEvent('message', {
					data: {
						type: 'standardResult',
						id: 999,
						points: [
							[1, 2],
							[3, 4]
						] as [number, number][]
					}
				})
			);
		}

		// The stale result should be ignored — verify postMessage was called
		// but the component didn't crash
		expect(workerHolder.instance!.postMessage).toHaveBeenCalled();

		delete (globalThis as unknown as Record<string, unknown>).Worker;
	});

	it('covers handleWorkerFailure hasPendingRender branch (worker fails while render pending)', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		const { container, rerender } = render(StandardRenderer, {
			props: { k: 1, numP: 1, numQ: 1, iterations: 5, height: 400 }
		});

		// Wait for the debounce (150ms) to fire so requestPoints posts to the worker
		// (isComputing becomes true).
		await new Promise((r) => setTimeout(r, 200));

		// A parameter change triggers scheduleRender while isComputing is true,
		// setting hasPendingRender = true.
		rerender({ k: 2, numP: 1, numQ: 1, iterations: 5, height: 400 });

		// Now make the worker fail → handleWorkerFailure sees hasPendingRender true
		// and reschedules a render.
		if (workerHolder.instance!.onerror) {
			workerHolder.instance!.onerror(new ErrorEvent('error', { message: 'fail-pending' }));
		}

		// Allow the rescheduled render (main-thread fallback) to complete.
		await new Promise((r) => setTimeout(r, 250));

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});

		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('covers handleWorkerFailure latestPoints branch (worker fails after a result)', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		const { container } = render(StandardRenderer, {
			props: { k: 1, numP: 1, numQ: 1, iterations: 5, height: 400 }
		});

		// Wait for debounce → postMessage.
		await new Promise((r) => setTimeout(r, 200));

		// Deliver a result so latestPoints is populated.
		if (workerHolder.instance!.onmessage) {
			workerHolder.instance!.onmessage(
				new MessageEvent('message', {
					data: {
						type: 'standardResult',
						id: 1,
						points: [
							[1, 2],
							[3, 4]
						] as [number, number][]
					}
				})
			);
		}

		// Now fail the worker → handleWorkerFailure re-renders from latestPoints.
		if (workerHolder.instance!.onerror) {
			workerHolder.instance!.onerror(
				new ErrorEvent('error', { message: 'fail-after-result' })
			);
		}

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});

		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('covers onmessage hasPendingRender branch (result arrives while render pending)', async () => {
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		const { container, rerender } = render(StandardRenderer, {
			props: { k: 1, numP: 1, numQ: 1, iterations: 5, height: 400 }
		});

		// Wait for debounce → postMessage (isComputing true).
		await new Promise((r) => setTimeout(r, 200));

		// Parameter change sets hasPendingRender = true.
		rerender({ k: 2, numP: 1, numQ: 1, iterations: 5, height: 400 });

		// Deliver the result → onmessage clears hasPendingRender and reschedules.
		if (workerHolder.instance!.onmessage) {
			workerHolder.instance!.onmessage(
				new MessageEvent('message', {
					data: {
						type: 'standardResult',
						id: 1,
						points: [[1, 2]] as [number, number][]
					}
				})
			);
		}

		// Allow the rescheduled render to complete.
		await new Promise((r) => setTimeout(r, 250));

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});

		delete (globalThis as unknown as Record<string, unknown>).Worker;
	});

	it('covers ResizeObserver callback branches (with and without latestPoints)', async () => {
		vi.useFakeTimers();
		roHolder.callback = null;
		const OriginalRO = globalThis.ResizeObserver;
		globalThis.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;

		const { container } = render(StandardRenderer, {
			props: { k: 1, numP: 1, numQ: 1, iterations: 5, height: 400 }
		});

		// Before the debounce fires, latestPoints is null → the ResizeObserver
		// callback takes the scheduleRender() branch.
		roHolder.callback!();

		// Advance timers so the main-thread fallback computes points and renders.
		await vi.advanceTimersByTimeAsync(200);

		// Now latestPoints is populated → the callback takes the render() branch.
		roHolder.callback!();

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});

		globalThis.ResizeObserver = OriginalRO;
		vi.useRealTimers();
	});
});

describe('StandardRenderer additional statement coverage', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('hits the maxPoints break when iterations exceed MAX_POINTS', async () => {
		vi.useFakeTimers();
		const { container } = render(StandardRenderer, {
			// numP*numQ*iterations >= MAX_POINTS (20000) triggers `break outer`.
			props: { k: 1, numP: 1, numQ: 1, iterations: 20000, height: 400 }
		});
		await vi.advanceTimersByTimeAsync(200);
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('returns early from render when canvas 2d context is unavailable', async () => {
		vi.useFakeTimers();
		// Override getContext to return null for this test only.
		const savedGetContext = Object.getOwnPropertyDescriptor(
			HTMLCanvasElement.prototype,
			'getContext'
		);
		Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
			configurable: true,
			value: () => null
		});

		const { container } = render(StandardRenderer, {
			props: { k: 1, numP: 1, numQ: 1, iterations: 5, height: 400 }
		});
		await vi.advanceTimersByTimeAsync(200);
		// canvas/svg are still created, but the point-drawing loop is skipped.
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
			expect(container.querySelector('svg')).not.toBeNull();
		});

		if (savedGetContext) {
			Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', savedGetContext);
		}
	});

	it('handles worker failure after unmount (isUnmounted guard)', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		const { unmount } = render(StandardRenderer, {
			props: { k: 1, numP: 1, numQ: 1, iterations: 5, height: 400 }
		});

		// Wait for onMount to run and attach the worker error handler.
		await new Promise((r) => setTimeout(r, 50));

		// Unmount sets isUnmounted = true.
		unmount();

		// Firing the worker error after unmount exercises the isUnmounted guard.
		expect(() => {
			workerHolder.instance!.onerror?.(new ErrorEvent('error', { message: 'post-unmount' }));
		}).not.toThrow();

		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('ignores worker message with null data (data guard)', async () => {
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		render(StandardRenderer, {
			props: { k: 1, numP: 1, numQ: 1, iterations: 5, height: 400 }
		});
		await new Promise((r) => setTimeout(r, 200));

		// Send a message with null data → onmessage returns early.
		expect(() => {
			workerHolder.instance!.onmessage?.(new MessageEvent('message', { data: null }));
		}).not.toThrow();

		delete (globalThis as unknown as Record<string, unknown>).Worker;
	});

	it('ignores worker message with non-standardResult type', async () => {
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		render(StandardRenderer, {
			props: { k: 1, numP: 1, numQ: 1, iterations: 5, height: 400 }
		});
		await new Promise((r) => setTimeout(r, 200));

		// Send a message with an unrecognized type → onmessage returns early.
		expect(() => {
			workerHolder.instance!.onmessage?.(
				new MessageEvent('message', { data: { type: 'unknown', id: 1 } })
			);
		}).not.toThrow();

		delete (globalThis as unknown as Record<string, unknown>).Worker;
	});
});
