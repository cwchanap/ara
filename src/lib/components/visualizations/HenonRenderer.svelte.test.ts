import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import HenonRenderer from './HenonRenderer.svelte';

afterEach(() => {
	cleanup();
});

describe('HenonRenderer', () => {
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

	it('renders with zero iterations', () => {
		expect(() =>
			render(HenonRenderer, { props: { a: 1.4, b: 0.3, iterations: 0, height: 200 } })
		).not.toThrow();
	});

	it('renders with minimal height', () => {
		expect(() =>
			render(HenonRenderer, { props: { a: 1.4, b: 0.3, iterations: 100, height: 50 } })
		).not.toThrow();
	});

	it('renders with different parameter combinations', () => {
		expect(() =>
			render(HenonRenderer, { props: { a: 1.0, b: 0.2, iterations: 500, height: 300 } })
		).not.toThrow();
	});

	it('renders with extreme parameter values', () => {
		expect(() =>
			render(HenonRenderer, { props: { a: 2.0, b: 0.5, iterations: 10000, height: 800 } })
		).not.toThrow();
	});

	it('renders with negative parameters', () => {
		expect(() =>
			render(HenonRenderer, { props: { a: -1.0, b: -0.3, iterations: 100, height: 200 } })
		).not.toThrow();
	});

	it('handles container element binding', () => {
		const { container } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 100, height: 200 }
		});
		const div = container.querySelector('div');
		expect(div).not.toBeNull();
		expect(div?.classList.contains('bg-black/40')).toBe(true);
	});

	it('has proper styling classes', () => {
		const { container } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 100, height: 200 }
		});
		const div = container.querySelector('div');
		expect(div).not.toBeNull();
		expect(div?.classList.contains('bg-black/40')).toBe(true);
		expect(div?.classList.contains('border-primary/30')).toBe(true);
	});

	it('renders with large iterations count', () => {
		expect(() =>
			render(HenonRenderer, { props: { a: 1.4, b: 0.3, iterations: 100000, height: 200 } })
		).not.toThrow();
	});

	it('renders with very small a parameter', () => {
		expect(() =>
			render(HenonRenderer, { props: { a: 0.01, b: 0.3, iterations: 100, height: 200 } })
		).not.toThrow();
	});

	it('renders with very large a parameter', () => {
		expect(() =>
			render(HenonRenderer, { props: { a: 3.0, b: 0.3, iterations: 100, height: 200 } })
		).not.toThrow();
	});
});
