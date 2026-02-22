import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import LogisticRenderer from './LogisticRenderer.svelte';

afterEach(() => {
	cleanup();
});

describe('LogisticRenderer (smoke)', () => {
	it('renders without throwing with default props', () => {
		expect(() =>
			render(LogisticRenderer, { props: { r: 3.9, x0: 0.1, iterations: 100, height: 200 } })
		).not.toThrow();
	});

	it('renders a div container element', () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 100, height: 200 }
		});
		expect(container.querySelector('div')).not.toBeNull();
	});
});
