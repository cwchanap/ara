import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import IkedaRenderer from './IkedaRenderer.svelte';

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
		expect(() =>
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
			})
		).not.toThrow();
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
		vi.mocked(calculateIkedaMultiSeed).mockReturnValueOnce({ points, seedIndices });

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
});
