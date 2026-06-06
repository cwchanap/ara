import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import HenonRenderer from './HenonRenderer.svelte';

afterEach(() => {
	cleanup();
});

describe('HenonRenderer (smoke)', () => {
	it('renders without throwing with default props', () => {
		expect(() =>
			render(HenonRenderer, { props: { a: 1.4, b: 0.3, iterations: 100, height: 200 } })
		).not.toThrow();
	});

	it('renders a div container element', () => {
		const { container } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 100, height: 200 }
		});
		expect(container.querySelector('div')).not.toBeNull();
	});
});
