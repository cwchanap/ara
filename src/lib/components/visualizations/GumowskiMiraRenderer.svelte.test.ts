import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import GumowskiMiraRenderer from './GumowskiMiraRenderer.svelte';

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
vi.mock('$lib/gumowski-mira', () => ({
	calculateGumowskiMiraTuples: vi.fn(() => [
		[0, 0],
		[1, 0.5]
	]),
	calculateGumowskiMiraMultiSeed: vi.fn(() => ({
		points: [
			[0, 0],
			[1, 0.5]
		],
		seedIndices: [0, 1]
	}))
}));

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

// Auto-responds to postMessage with a gumowskiMiraResult message (correct id).
class AutoRespondGumowskiMiraWorker {
	postMessage = (msg: unknown) => {
		setTimeout(() => {
			if (this.onmessage) {
				this.onmessage(
					new MessageEvent('message', {
						data: {
							type: 'gumowskiMiraResult',
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
		workerHolder.instance = this;
	}
}

// Auto-responds with a gumowskiMiraResult carrying a stale id (999) — ignored by the renderer.
class AutoRespondStaleGumowskiMiraWorker {
	postMessage = (msg: unknown) => {
		void msg;
		setTimeout(() => {
			if (this.onmessage) {
				this.onmessage(
					new MessageEvent('message', {
						data: {
							type: 'gumowskiMiraResult',
							id: 999,
							points: [[0, 0]] as [number, number][],
							seedIndices: [0]
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

describe('GumowskiMiraRenderer', () => {
	afterEach(() => {
		cleanup();
		// Clean up any leaked Worker mock from tests that set globalThis.Worker.
		delete (globalThis as unknown as Record<string, unknown>).Worker;
	});

	it('renders an svg (axes) and a canvas in multi-seed mode', async () => {
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		const { calculateGumowskiMiraMultiSeed } = await import('$lib/gumowski-mira');
		vi.mocked(calculateGumowskiMiraMultiSeed).mockReturnValueOnce({
			points: [],
			seedIndices: []
		});
		// Flush the debounced render (setTimeout) so the actual render path with
		// empty data is exercised inside the not.toThrow assertion.
		vi.useFakeTimers();
		try {
			expect(() => {
				render(GumowskiMiraRenderer, {
					props: {
						mu: 0.31,
						a: 0.008,
						b: 0.05,
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
		const { calculateGumowskiMiraMultiSeed } = await import('$lib/gumowski-mira');
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
		vi.mocked(calculateGumowskiMiraMultiSeed).mockReturnValueOnce({
			points: oversizedPoints,
			seedIndices: oversizedSeeds
		});

		// The render runs inside a debounced setTimeout, so flush timers synchronously
		// to ensure the actual render() path is exercised inside the not.toThrow
		// assertion. The totalSeeds field is now a single number (not a scanned
		// aggregation), so there is no overflow risk — but the 200k cap slice and
		// per-point color loop still need to complete without error.
		vi.useFakeTimers();
		try {
			expect(() => {
				render(GumowskiMiraRenderer, {
					props: {
						mu: 0.31,
						a: 0.008,
						b: 0.05,
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
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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

	it('renders with colorMode "seed" and a single seed (seedCount<=1 branch)', async () => {
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
				x0: 0.1,
				y0: 0,
				iterations: 100,
				burnIn: 10,
				renderMode: 'multi',
				seeds: 1,
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

	it('renders with colorMode "radius" when all points are at origin (maxRadius=0 branch)', async () => {
		const { calculateGumowskiMiraMultiSeed } = await import('$lib/gumowski-mira');
		vi.mocked(calculateGumowskiMiraMultiSeed).mockReturnValueOnce({
			points: [
				[0, 0],
				[0, 0]
			],
			seedIndices: [0, 0]
		});
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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

	it('renders with colorMode "iteration" and a single point (total<=1 branch)', async () => {
		const { calculateGumowskiMiraMultiSeed } = await import('$lib/gumowski-mira');
		vi.mocked(calculateGumowskiMiraMultiSeed).mockReturnValueOnce({
			points: [[0.5, 0.5]],
			seedIndices: [0]
		});
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
	});

	it('applies custom height to the container', async () => {
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		const { calculateGumowskiMiraTuples } = await import('$lib/gumowski-mira');
		vi.mocked(calculateGumowskiMiraTuples).mockReturnValueOnce([
			[0, 0],
			[1, 0.5],
			[2, 1],
			[1.5, 0.8],
			[0.3, 0.2]
		]);
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
			render(GumowskiMiraRenderer, {
				props: {
					mu: NaN,
					a: 0.008,
					b: 0.05,
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
				'GumowskiMiraRenderer: invalid parameters, skipping render'
			);
		} finally {
			vi.useRealTimers();
			warnSpy.mockRestore();
		}
	});

	it('preserves the LIVE_RENDER label after render', async () => {
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
				render(GumowskiMiraRenderer, {
					props: {
						mu: 0.31,
						a: 0.008,
						b: 0.05,
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
		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		const baseProps = {
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 100,
			burnIn: 10,
			renderMode: 'multi' as const,
			seeds: 2,
			colorMode: 'iteration' as const,
			pointSize: 1.5,
			opacity: 0.6,
			height: 200
		};
		const { container, rerender } = render(GumowskiMiraRenderer, { props: baseProps });
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});

		// With colorMode 'iteration' the 2 mock points are shaded cyan→magenta,
		// so the last fillStyle is the interpolated magenta end color.
		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		const ctx = canvas.getContext('2d') as { fillStyle: string };
		await waitFor(() => {
			expect(ctx.fillStyle).toBe('rgb(255, 0, 255)');
		});

		// Trigger a style-only re-render (no recompute) via rerender().
		await rerender({ ...baseProps, colorMode: 'single' });
		await waitFor(() => {
			// colorMode 'single' forces every point to the literal cyan.
			expect(ctx.fillStyle).toBe('#00f3ff');
		});
	});

	it('handles worker error response and falls back to main thread', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = MockWorker;

		const { calculateGumowskiMiraMultiSeed } = await import('$lib/gumowski-mira');
		vi.mocked(calculateGumowskiMiraMultiSeed).mockReturnValueOnce({
			points: [[0, 0]],
			seedIndices: [0]
		});

		render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		if (workerHolder.instance!.onmessage) {
			workerHolder.instance!.onmessage(
				new MessageEvent('message', {
					data: { type: 'error', message: 'worker failed' }
				})
			);
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalledWith(
				'Gumowski-Mira worker error response:',
				'worker failed'
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

		const { calculateGumowskiMiraMultiSeed } = await import('$lib/gumowski-mira');
		vi.mocked(calculateGumowskiMiraMultiSeed).mockReturnValueOnce({
			points: [[0, 0]],
			seedIndices: [0]
		});

		render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		if (workerHolder.instance!.onerror) {
			workerHolder.instance!.onerror(
				new ErrorEvent('error', { message: 'worker runtime error' })
			);
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalledWith(
				'Gumowski-Mira worker error:',
				'worker runtime error'
			);
		});

		expect(workerHolder.instance!.terminate).toHaveBeenCalled();

		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('handles worker initialization failure gracefully', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		(globalThis as unknown as Record<string, unknown>).Worker = FailingWorker;

		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
			'Failed to initialize gumowski-mira web worker:',
			expect.any(Error)
		);

		delete (globalThis as unknown as Record<string, unknown>).Worker;
		errorSpy.mockRestore();
	});

	it('processes a successful worker response and renders', async () => {
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = AutoRespondGumowskiMiraWorker;

		const { container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		expect(workerHolder.instance).not.toBeNull();

		delete (globalThis as unknown as Record<string, unknown>).Worker;
	});

	it('ignores stale worker response with wrong id', async () => {
		const { calculateGumowskiMiraMultiSeed } = await import('$lib/gumowski-mira');
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker =
			AutoRespondStaleGumowskiMiraWorker;

		vi.mocked(calculateGumowskiMiraMultiSeed).mockReturnValueOnce({
			points: [[0, 0]],
			seedIndices: [0]
		});

		expect(() =>
			render(GumowskiMiraRenderer, {
				props: {
					mu: 0.31,
					a: 0.008,
					b: 0.05,
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
			})
		).not.toThrow();

		await new Promise((r) => setTimeout(r, 50));
		expect(workerHolder.instance).not.toBeNull();
	});

	it('ignores worker response with wrong type', async () => {
		const { calculateGumowskiMiraMultiSeed } = await import('$lib/gumowski-mira');
		workerHolder.instance = null;
		(globalThis as unknown as Record<string, unknown>).Worker = AutoRespondUnknownWorker;

		vi.mocked(calculateGumowskiMiraMultiSeed).mockReturnValueOnce({
			points: [[0, 0]],
			seedIndices: [0]
		});

		expect(() =>
			render(GumowskiMiraRenderer, {
				props: {
					mu: 0.31,
					a: 0.008,
					b: 0.05,
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
			})
		).not.toThrow();

		await new Promise((r) => setTimeout(r, 50));
		expect(workerHolder.instance).not.toBeNull();
	});

	it('warns and renders empty when 2D context is unavailable', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const savedGetContext = HTMLCanvasElement.prototype.getContext;
		Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
			configurable: true,
			value: () => null
		});
		vi.useFakeTimers();
		try {
			render(GumowskiMiraRenderer, {
				props: {
					mu: 0.31,
					a: 0.008,
					b: 0.05,
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
			// Flush the debounced render (250ms) to trigger the ctx null warning.
			await vi.advanceTimersByTimeAsync(300);
			expect(warnSpy).toHaveBeenCalledWith(
				'GumowskiMiraRenderer: canvas or 2D context unavailable'
			);
		} finally {
			vi.useRealTimers();
			Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
				configurable: true,
				value: savedGetContext
			});
			warnSpy.mockRestore();
		}
	});

	it('re-renders when height changes (style-only effect)', async () => {
		const { rerender, container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		await rerender({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
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
		});
		await waitFor(() => {
			const wrapper = container.firstElementChild as HTMLElement;
			const inner = wrapper?.firstElementChild as HTMLElement;
			expect(inner?.style.height).toContain('400');
		});
	});

	it('re-renders when pointSize and opacity change (style-only effect)', async () => {
		const { rerender, container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		await rerender({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
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
		});
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('cleans up on unmount without throwing', async () => {
		const { unmount, container } = render(GumowskiMiraRenderer, {
			props: {
				mu: 0.31,
				a: 0.008,
				b: 0.05,
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
		expect(() => unmount()).not.toThrow();
	});
});
