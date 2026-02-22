import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import LyapunovRenderer from './LyapunovRenderer.svelte';

afterEach(() => {
	cleanup();
});

describe('LyapunovRenderer (smoke)', () => {
	it('renders without throwing with default props', () => {
		expect(() =>
			render(LyapunovRenderer, {
				props: {
					rMin: 2.5,
					rMax: 4.0,
					iterations: 50,
					transientIterations: 25,
					height: 200
				}
			})
		).not.toThrow();
	});

	it('renders a div container element', () => {
		const { container } = render(LyapunovRenderer, {
			props: { rMin: 2.5, rMax: 4.0, iterations: 50, transientIterations: 25, height: 200 }
		});
		expect(container.querySelector('div')).not.toBeNull();
	});
});
