import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import StandardRenderer from './StandardRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

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
});

afterAll(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: originalGetContext
	});
});

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

	it('handles worker error response via handleWorkerFailure', async () => {
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
			onmessageerror: ((event: MessageEvent) => void) | null = null;
			constructor() {
				// eslint-disable-next-line @typescript-eslint/no-this-alias
				workerInstance = this;
			}
		}
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

		if (workerInstance?.onmessage) {
			workerInstance.onmessage(
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

		expect(workerInstance?.terminate).toHaveBeenCalled();
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
			onmessageerror: ((event: MessageEvent) => void) | null = null;
			constructor() {
				// eslint-disable-next-line @typescript-eslint/no-this-alias
				workerInstance = this;
			}
		}
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

		if (workerInstance?.onerror) {
			workerInstance.onerror(
				new ErrorEvent('error', { message: 'standard worker runtime error' })
			);
		}

		await waitFor(() => {
			expect(errorSpy).toHaveBeenCalledWith(
				'Standard map worker failure:',
				'standard worker runtime error'
			);
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
