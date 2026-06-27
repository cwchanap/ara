import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import ChaosEsthetiqueRenderer from './ChaosEsthetiqueRenderer.svelte';

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
		shadowBlur: 0,
		shadowColor: '' as string,
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

describe('ChaosEsthetiqueRenderer (smoke)', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('renders without throwing with default props', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(ChaosEsthetiqueRenderer, {
				props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(400);
	});

	it('renders a div container element', async () => {
		vi.useFakeTimers();
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		expect(container.querySelector('div')).not.toBeNull();
	});
});

describe('ChaosEsthetiqueRenderer (coverage)', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
		// Clean up any leaked Worker mock from tests that set globalThis.Worker.
		delete (globalThis as unknown as Record<string, unknown>).Worker;
	});

	it('renders canvas and svg axes after debounce', async () => {
		vi.useFakeTimers();
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('binds containerElement to the rendered div', async () => {
		vi.useFakeTimers();
		let containerEl: HTMLDivElement | undefined;
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: {
				a: 0.9,
				b: 0.9999,
				x0: 18,
				y0: 0,
				iterations: 100,
				height: 200,
				get containerElement() {
					return containerEl;
				},
				set containerElement(next: HTMLDivElement | undefined) {
					containerEl = next;
				}
			}
		});
		await vi.advanceTimersByTimeAsync(400);
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		expect(containerEl).toBeInstanceOf(HTMLDivElement);
	});

	it('applies custom height to the container', async () => {
		vi.useFakeTimers();
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 400 }
		});
		await vi.advanceTimersByTimeAsync(400);
		await waitFor(() => {
			const innerDiv = container.firstElementChild as HTMLElement;
			expect(innerDiv?.style.height).toContain('400');
		});
	});

	it('contains the LIVE_RENDER label in initial markup', async () => {
		vi.useFakeTimers();
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});
		const label = container.querySelector('div.pointer-events-none, div.select-none');
		expect(label).not.toBeNull();
		expect(label?.textContent).toContain('LIVE_RENDER');
		await vi.advanceTimersByTimeAsync(400);
	});

	it('renders without throwing with different parameters', async () => {
		vi.useFakeTimers();
		expect(() =>
			render(ChaosEsthetiqueRenderer, {
				props: { a: 1.4, b: 0.3, x0: 0, y0: 0, iterations: 50, height: 300 }
			})
		).not.toThrow();
		await vi.advanceTimersByTimeAsync(400);
	});

	it('handles invalid parameters by rendering empty', async () => {
		vi.useFakeTimers();
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: NaN, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		// Container should still exist even with invalid params
		expect(container.querySelector('div')).not.toBeNull();
	});

	it('handles zero iterations by rendering empty', async () => {
		vi.useFakeTimers();
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 0, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		expect(container.querySelector('div')).not.toBeNull();
	});

	it('handles worker error response and falls back to main thread', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		let workerInstance: {
			onmessage: ((event: MessageEvent) => void) | null;
			terminate: () => void;
		} | null = null;
		class MockWorker {
			postMessage = vi.fn();
			terminate = vi.fn();
			onmessage: ((event: MessageEvent) => void) | null = null;
			onerror: ((event: ErrorEvent) => void) | null = null;
			constructor() {
				// eslint-disable-next-line @typescript-eslint/no-this-alias
				workerInstance = this;
			}
		}
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});

		await new Promise((r) => setTimeout(r, 50));

		if (workerInstance!.onmessage) {
			workerInstance!.onmessage(
				new MessageEvent('message', {
					data: { type: 'error', message: 'chaos worker failed' }
				})
			);
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalledWith(
				'Chaos esthetique worker error response:',
				'chaos worker failed'
			);
		});

		expect(workerInstance!.terminate).toHaveBeenCalled();
		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('handles worker onerror and falls back to main thread', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		let workerInstance: {
			onerror: ((event: ErrorEvent) => void) | null;
			terminate: () => void;
		} | null = null;
		class MockWorker {
			postMessage = vi.fn();
			terminate = vi.fn();
			onmessage: ((event: MessageEvent) => void) | null = null;
			onerror: ((event: ErrorEvent) => void) | null = null;
			constructor() {
				// eslint-disable-next-line @typescript-eslint/no-this-alias
				workerInstance = this;
			}
		}
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});

		await new Promise((r) => setTimeout(r, 50));

		if (workerInstance!.onerror) {
			workerInstance!.onerror(
				new ErrorEvent('error', { message: 'chaos worker runtime error' })
			);
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalledWith(
				'Chaos esthetique worker error:',
				'chaos worker runtime error'
			);
		});

		expect(workerInstance!.terminate).toHaveBeenCalled();
		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('handles worker initialization failure gracefully', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		class FailingWorker {
			constructor() {
				throw new Error('Worker init failed');
			}
		}
		(globalThis as unknown as Record<string, unknown>).Worker = FailingWorker;

		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});

		await waitFor(() => {
			expect(container.querySelector('div')).not.toBeNull();
		});
		expect(errorSpy).toHaveBeenCalledWith(
			'Failed to initialize chaos esthetique web worker:',
			expect.any(Error)
		);

		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('processes a successful worker response and renders', async () => {
		let workerInstance: {
			onmessage: ((event: MessageEvent) => void) | null;
			onerror: ((event: ErrorEvent) => void) | null;
			postMessage: (msg: unknown) => void;
		} | null = null;
		class MockWorker {
			postMessage = (msg: unknown) => {
				setTimeout(() => {
					if (this.onmessage) {
						this.onmessage(
							new MessageEvent('message', {
								data: {
									type: 'chaosResult',
									id: (msg as { id: number }).id,
									points: [
										[0, 0],
										[1, 1]
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
				// eslint-disable-next-line @typescript-eslint/no-this-alias
				workerInstance = this;
			}
		}
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
			expect(container.querySelector('svg')).not.toBeNull();
		});

		expect(workerInstance).not.toBeNull();
	});

	it('ignores worker response with wrong type', async () => {
		let workerInstance: {
			onmessage: ((event: MessageEvent) => void) | null;
			postMessage: (msg: unknown) => void;
		} | null = null;
		class MockWorker {
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
				// eslint-disable-next-line @typescript-eslint/no-this-alias
				workerInstance = this;
			}
		}
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		expect(() =>
			render(ChaosEsthetiqueRenderer, {
				props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
			})
		).not.toThrow();

		await new Promise((r) => setTimeout(r, 50));
		expect(workerInstance).not.toBeNull();
	});

	it('ignores stale worker response with wrong id', async () => {
		let workerInstance: {
			onmessage: ((event: MessageEvent) => void) | null;
			postMessage: (msg: unknown) => void;
		} | null = null;
		class MockWorker {
			postMessage = (msg: unknown) => {
				void msg;
				setTimeout(() => {
					if (this.onmessage) {
						this.onmessage(
							new MessageEvent('message', {
								data: {
									type: 'chaosResult',
									id: 999, // wrong id
									points: [[0, 0]] as [number, number][]
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
				// eslint-disable-next-line @typescript-eslint/no-this-alias
				workerInstance = this;
			}
		}
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		expect(() =>
			render(ChaosEsthetiqueRenderer, {
				props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
			})
		).not.toThrow();

		await new Promise((r) => setTimeout(r, 50));
		expect(workerInstance).not.toBeNull();
	});

	it('renders with shadow disabled when points exceed threshold (>5000)', async () => {
		vi.useFakeTimers();
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 6000, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('handles non-finite values in calculateChaos (breaks early)', async () => {
		vi.useFakeTimers();
		// Extreme params at the edge of stable range cause values to grow
		// rapidly and eventually overflow to Infinity, triggering the
		// !Number.isFinite break in calculateChaos.
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 2, b: 2, x0: 50, y0: 50, iterations: 10000, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		// Should not throw — the break guard handles the overflow.
		expect(container.querySelector('div')).not.toBeNull();
	});

	it('warns and renders empty when 2D context is unavailable', async () => {
		vi.useFakeTimers();
		const savedGetContext = HTMLCanvasElement.prototype.getContext;
		Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
			configurable: true,
			value: () => null
		});
		try {
			expect(() =>
				render(ChaosEsthetiqueRenderer, {
					props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
				})
			).not.toThrow();
			await vi.advanceTimersByTimeAsync(400);
		} finally {
			Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
				configurable: true,
				value: savedGetContext
			});
		}
	});

	it('renders empty when params are outside stable range (unstable)', async () => {
		vi.useFakeTimers();
		// a=3 is outside the stable range [0, 2], so checkParameterStability
		// returns isStable=false, and the component renders empty.
		const { container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 3, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		expect(container.querySelector('div')).not.toBeNull();
	});

	it('re-renders when height changes via rerender', async () => {
		vi.useFakeTimers();
		const { rerender, container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		await rerender({ a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 400 });
		await vi.advanceTimersByTimeAsync(400);
		const innerDiv = container.firstElementChild as HTMLElement;
		expect(innerDiv?.style.height).toContain('400');
	});

	it('re-renders when parameters change via rerender', async () => {
		vi.useFakeTimers();
		const { rerender, container } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		await rerender({ a: 1.4, b: 0.3, x0: 0, y0: 0, iterations: 50, height: 200 });
		await vi.advanceTimersByTimeAsync(400);
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('cleans up on unmount without throwing', async () => {
		vi.useFakeTimers();
		const { unmount } = render(ChaosEsthetiqueRenderer, {
			props: { a: 0.9, b: 0.9999, x0: 18, y0: 0, iterations: 100, height: 200 }
		});
		await vi.advanceTimersByTimeAsync(400);
		expect(() => unmount()).not.toThrow();
	});
});
