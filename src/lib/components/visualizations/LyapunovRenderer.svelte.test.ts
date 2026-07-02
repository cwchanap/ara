import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import LyapunovRenderer from './LyapunovRenderer.svelte';

afterEach(() => {
	cleanup();
});

describe('LyapunovRenderer (smoke)', () => {
	it('renders an SVG chart element (not just a no-throw)', async () => {
		const { container } = render(LyapunovRenderer, {
			props: {
				rMin: 2.5,
				rMax: 4.0,
				iterations: 50,
				transientIterations: 25,
				height: 200
			}
		});
		// LyapunovRenderer builds its plot with D3 — assert the SVG actually mounts.
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('renders D3 axis groups and a path for the exponent curve', async () => {
		const { container } = render(LyapunovRenderer, {
			props: { rMin: 2.5, rMax: 4.0, iterations: 50, transientIterations: 25, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			// At least x and y axis groups.
			expect(container.querySelectorAll('svg g g').length).toBeGreaterThanOrEqual(2);
			// The exponent curve is drawn as a path.
			expect(container.querySelector('path')).not.toBeNull();
		});
	});

	it('applies the container height from props', async () => {
		const { container } = render(LyapunovRenderer, {
			props: { rMin: 2.5, rMax: 4.0, iterations: 50, transientIterations: 25, height: 300 }
		});
		await waitFor(() => {
			expect(container.querySelector('svg')?.getAttribute('height')).toBe('300');
		});
	});

	it('expands range with epsilon when rMin and rMax are nearly equal', async () => {
		const { container } = render(LyapunovRenderer, {
			props: { rMin: 3.5, rMax: 3.5, iterations: 50, transientIterations: 25, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelector('path')).not.toBeNull();
		});
	});

	it('renders "No valid Lyapunov values" when all exponents are null (iterations=0)', async () => {
		const { container } = render(LyapunovRenderer, {
			props: { rMin: 2.5, rMax: 4.0, iterations: 0, transientIterations: 25, height: 200 }
		});
		await waitFor(() => {
			expect(container.textContent).toContain('No valid Lyapunov values');
		});
	});

	it('binds containerElement to the rendered div', async () => {
		let containerEl: HTMLDivElement | undefined;
		render(LyapunovRenderer, {
			props: {
				rMin: 2.5,
				rMax: 4.0,
				iterations: 50,
				transientIterations: 25,
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
			expect(containerEl).toBeInstanceOf(HTMLDivElement);
		});
	});

	it('renders with zero transientIterations', async () => {
		const { container } = render(LyapunovRenderer, {
			props: { rMin: 2.5, rMax: 4.0, iterations: 50, transientIterations: 0, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelector('path')).not.toBeNull();
		});
	});

	it('renders a zero line when yExtent spans zero (chaos threshold)', async () => {
		const { container } = render(LyapunovRenderer, {
			props: { rMin: 2.5, rMax: 4.0, iterations: 100, transientIterations: 50, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			// The zero line is a <line> element with stroke '#ff00ff'
			const lines = container.querySelectorAll('line');
			expect(lines.length).toBeGreaterThan(0);
		});
	});

	it('re-renders when parameters change via rerender', async () => {
		const { rerender, container } = render(LyapunovRenderer, {
			props: { rMin: 2.5, rMax: 4.0, iterations: 50, transientIterations: 25, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
		await rerender({
			rMin: 3.0,
			rMax: 4.0,
			iterations: 50,
			transientIterations: 25,
			height: 200
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('swaps a reversed rMin/rMax so the x-axis runs forward (low→high left→right)', async () => {
		// A loaded config (or manual slider entry) with rMin > rMax must not
		// render a backwards axis. The renderer normalizes to rMin <= rMax.
		// Use endpoints that both yield valid exponents at low iteration counts
		// (r=2 and r=4 return null with iterations=50; 2.5 and 3.9 do not).
		const { container } = render(LyapunovRenderer, {
			props: { rMin: 3.9, rMax: 2.5, iterations: 50, transientIterations: 25, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelector('path')).not.toBeNull();
		});
		// The first axis group is the x-axis (translate(0,chartHeight)). Its
		// ticks are <g transform="translate(X,0)"><text>label</text></g>. Reading
		// them in ascending pixel-X order must yield ascending numeric labels.
		const xAxisG = container.querySelector('svg > g > g');
		expect(xAxisG).not.toBeNull();
		const ticks = Array.from(xAxisG!.querySelectorAll('g')).map((g) => {
			const transform = g.getAttribute('transform') ?? '';
			const x = Number.parseFloat((transform.match(/translate\(([^,]+)/) ?? [])[1] ?? 'NaN');
			const label = Number.parseFloat(g.querySelector('text')?.textContent ?? 'NaN');
			return { x, label };
		});
		expect(ticks.length).toBeGreaterThan(1);
		const byX = [...ticks].sort((a, b) => a.x - b.x);
		for (let i = 1; i < byX.length; i++) {
			expect(byX[i].label).toBeGreaterThanOrEqual(byX[i - 1].label);
		}
		// And the leftmost label must be the smaller bound (2), not 4.
		expect(byX[0].label).toBeLessThan(byX[byX.length - 1].label);
	});
});
