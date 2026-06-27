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
});
