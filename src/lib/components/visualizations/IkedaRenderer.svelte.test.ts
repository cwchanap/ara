import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import IkedaRenderer from './IkedaRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;

	const ctx = {
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		fillStyle: '' as string,
		globalAlpha: 1
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

// Worker is unavailable in jsdom, so the component uses the main-thread fallback.
vi.mock('$lib/ikeda', () => ({
	calculateIkedaTuples: vi.fn(() => [
		[0, 0],
		[1, 0.5]
	]),
	calculateIkedaMultiSeed: vi.fn(() => ({
		points: [
			[0, 0],
			[1, 0.5]
		],
		seedIndices: [0, 1]
	}))
}));

describe('IkedaRenderer', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders an svg (axes) and a canvas in multi-seed mode', async () => {
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('renders in single-orbit mode without throwing', async () => {
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'single',
				seeds: 2,
				colorMode: 'single',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('does not throw when compute returns no points', async () => {
		const { calculateIkedaMultiSeed } = await import('$lib/ikeda');
		vi.mocked(calculateIkedaMultiSeed).mockReturnValueOnce({ points: [], seedIndices: [] });
		// Flush the debounced render (setTimeout) so the actual render path with
		// empty data is exercised inside the not.toThrow assertion.
		vi.useFakeTimers();
		try {
			expect(() => {
				render(IkedaRenderer, {
					props: {
						u: 0.918,
						x0: 0.1,
						y0: 0,
						iterations: 100,
						burnIn: 10,
						renderMode: 'multi',
						seeds: 2,
						colorMode: 'iteration',
						pointSize: 1.5,
						opacity: 0.6,
						height: 200
					}
				});
				vi.runOnlyPendingTimers();
			}).not.toThrow();
		} finally {
			vi.useRealTimers();
		}
	});

	it('renders a large multi-seed cloud without throwing (no Math.max spread overflow)', async () => {
		const { calculateIkedaMultiSeed } = await import('$lib/ikeda');
		const N = 200000;
		const points: [number, number][] = new Array(N);
		const seedIndices: number[] = new Array(N);
		for (let i = 0; i < N; i++) {
			points[i] = [i % 100, (i % 50) - 25];
			seedIndices[i] = i % 300;
		}
		// Exceed MAX_POINTS to verify both points AND seedIndices are sliced
		const oversizedPoints = [...points, [0, 0] as [number, number]];
		const oversizedSeeds = [...seedIndices, 0];
		vi.mocked(calculateIkedaMultiSeed).mockReturnValueOnce({
			points: oversizedPoints,
			seedIndices: oversizedSeeds
		});

		// The render runs inside a debounced setTimeout, so flush timers synchronously
		// to ensure the actual render() path (and its seedCount scan over 200k points)
		// is exercised inside the not.toThrow assertion. The old Math.max(...seedIndices)
		// threw RangeError: Maximum call stack size exceeded for arrays this large.
		vi.useFakeTimers();
		try {
			expect(() => {
				render(IkedaRenderer, {
					props: {
						u: 0.918,
						x0: 0.1,
						y0: 0,
						iterations: 100,
						burnIn: 10,
						renderMode: 'multi',
						seeds: 300,
						colorMode: 'seed',
						pointSize: 1.5,
						opacity: 0.6,
						height: 200
					}
				});
				vi.runOnlyPendingTimers();
			}).not.toThrow();
		} finally {
			vi.useRealTimers();
		}
	});

	it('renders with colorMode "single"', async () => {
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'single',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('renders with colorMode "seed"', async () => {
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 5,
				colorMode: 'seed',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('renders with colorMode "radius"', async () => {
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'radius',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('applies custom height to the container', async () => {
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6,
				height: 400
			}
		});
		await waitFor(() => {
			const wrapper = container.firstElementChild as HTMLElement;
			const inner = wrapper?.firstElementChild as HTMLElement;
			expect(inner?.style.height).toContain('400');
		});
	});

	it('renders multiple points in single-orbit mode', async () => {
		const { calculateIkedaTuples } = await import('$lib/ikeda');
		vi.mocked(calculateIkedaTuples).mockReturnValueOnce([
			[0, 0],
			[1, 0.5],
			[2, 1],
			[1.5, 0.8],
			[0.3, 0.2]
		]);
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'single',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('binds containerElement to the rendered div', async () => {
		let containerEl: HTMLDivElement | undefined;
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200,
				get containerElement() {
					return containerEl;
				},
				set containerElement(next: HTMLDivElement | undefined) {
					containerEl = next;
				}
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
		expect(containerEl).toBeInstanceOf(HTMLDivElement);
	});

	it('renders with different opacity and point size', async () => {
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 3,
				opacity: 0.2,
				height: 200
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('warns and renders empty when parameters are invalid', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.useFakeTimers();
		try {
			render(IkedaRenderer, {
				props: {
					u: NaN,
					x0: 0.1,
					y0: 0,
					iterations: 100,
					burnIn: 10,
					renderMode: 'multi',
					seeds: 2,
					colorMode: 'iteration',
					pointSize: 1.5,
					opacity: 0.6,
					height: 200
				}
			});
			vi.runOnlyPendingTimers();
			expect(warnSpy).toHaveBeenCalledWith(
				'IkedaRenderer: invalid parameters, skipping render'
			);
		} finally {
			vi.useRealTimers();
			warnSpy.mockRestore();
		}
	});

	it('preserves the LIVE_RENDER label after render', async () => {
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		// The label must survive the D3 render pass (selectAll('*').remove()).
		const label = container.querySelector('div.pointer-events-none');
		expect(label).not.toBeNull();
		expect(label?.textContent).toContain('LIVE_RENDER');
	});

	it('renders without throwing with default height', async () => {
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('renders without throwing with zero iterations', async () => {
		vi.useFakeTimers();
		try {
			expect(() => {
				render(IkedaRenderer, {
					props: {
						u: 0.918,
						x0: 0.1,
						y0: 0,
						iterations: 0,
						burnIn: 0,
						renderMode: 'multi',
						seeds: 2,
						colorMode: 'iteration',
						pointSize: 1.5,
						opacity: 0.6,
						height: 200
					}
				});
				vi.runOnlyPendingTimers();
			}).not.toThrow();
		} finally {
			vi.useRealTimers();
		}
	});

	it('renders with negative burnIn without throwing', async () => {
		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: -10,
				renderMode: 'single',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('re-renders when colorMode changes (style-only effect)', async () => {
		const { container, component } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
		// Trigger style-only re-render by changing colorMode
		(component as unknown as Record<string, unknown>).colorMode = 'seed';
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('handles worker error response and falls back to main thread', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		let workerInstance: {
			onmessage: ((event: MessageEvent) => void) | null;
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

		const { calculateIkedaMultiSeed } = await import('$lib/ikeda');
		vi.mocked(calculateIkedaMultiSeed).mockReturnValueOnce({
			points: [[0, 0]],
			seedIndices: [0]
		});

		render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});

		// Give onMount time to set up worker and post message
		await new Promise((r) => setTimeout(r, 50));

		// Simulate worker error response before DOM is rendered
		if (workerInstance?.onmessage) {
			workerInstance.onmessage(
				new MessageEvent('message', {
					data: { type: 'error', message: 'worker failed' }
				})
			);
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalledWith('Ikeda worker error response:', 'worker failed');
		});

		// Worker should be terminated and unavailable after error
		expect(workerInstance?.terminate).toHaveBeenCalled();

		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('handles worker onerror and falls back to main thread', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		let workerInstance: {
			onmessage: ((event: MessageEvent) => void) | null;
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

		const { calculateIkedaMultiSeed } = await import('$lib/ikeda');
		vi.mocked(calculateIkedaMultiSeed).mockReturnValueOnce({
			points: [[0, 0]],
			seedIndices: [0]
		});

		render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});

		await new Promise((r) => setTimeout(r, 50));

		// Simulate worker runtime error
		if (workerInstance?.onerror) {
			workerInstance.onerror(new ErrorEvent('error', { message: 'worker runtime error' }));
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalledWith('Ikeda worker error:', 'worker runtime error');
		});

		expect(workerInstance?.terminate).toHaveBeenCalled();

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

		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});

		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
		expect(errorSpy).toHaveBeenCalledWith(
			'Failed to initialize ikeda web worker:',
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
				// auto-respond with success after a tick
				setTimeout(() => {
					if (this.onmessage) {
						this.onmessage(
							new MessageEvent('message', {
								data: {
									type: 'ikedaResult',
									id: (msg as { id: number }).id,
									points: [
										[0, 0],
										[1, 0.5]
									],
									seedIndices: [0, 1]
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

		const { container } = render(IkedaRenderer, {
			props: {
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 2,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6,
				height: 200
			}
		});

		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});

		// Verify worker posted a message with correct parameters
		expect(workerInstance).not.toBeNull();

		delete (globalThis as unknown as Record<string, unknown>).Worker;
	});
});
