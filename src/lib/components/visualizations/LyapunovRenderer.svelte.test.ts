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
});
