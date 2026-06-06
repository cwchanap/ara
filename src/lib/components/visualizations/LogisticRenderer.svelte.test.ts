import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import LogisticRenderer from './LogisticRenderer.svelte';

let originalClientWidth: PropertyDescriptor | undefined;

beforeEach(() => {
	originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
		configurable: true,
		value: 400
	});
});

afterEach(() => {
	cleanup();
	if (originalClientWidth) {
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
	}
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

describe('LogisticRenderer SVG rendering', () => {
	it('creates an SVG element', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 200 }
		});

		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('renders circle data points', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 200 }
		});

		await waitFor(() => {
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(10);
		});
	});

	it('renders a line path', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 200 }
		});

		await waitFor(() => {
			expect(container.querySelector('path')).not.toBeNull();
		});
	});

	it('renders axis groups', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 200 }
		});

		await waitFor(() => {
			const axisGroups = container.querySelectorAll('svg g g');
			expect(axisGroups.length).toBeGreaterThanOrEqual(2);
		});
	});

	it('displays LIVE_RENDER label', () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 200 }
		});
		expect(container.textContent).toContain('LIVE_RENDER');
	});

	it('sets container height from props', () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 350 }
		});
		const wrapper = container.querySelector('div');
		expect(wrapper?.getAttribute('style')).toContain('350px');
	});

	it('renders with different r values', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 2.5, x0: 0.5, iterations: 5, height: 200 }
		});

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBe(5);
		});
	});

	it('renders with different x0 values', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.8, iterations: 10, height: 200 }
		});

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBe(10);
		});
	});

	it('sets SVG height from props', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 250 }
		});

		await waitFor(() => {
			const svg = container.querySelector('svg');
			expect(svg?.getAttribute('height')).toBe('250');
		});
	});
});
