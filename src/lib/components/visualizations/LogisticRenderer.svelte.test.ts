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

describe('LogisticRenderer edge cases', () => {
	it('produces SVG with correct width from clientWidth mock', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 400 }
		});

		await waitFor(() => {
			const svg = container.querySelector('svg');
			expect(svg).not.toBeNull();
			// clientWidth is mocked to 400 in beforeEach
			expect(svg?.getAttribute('width')).toBe('400');
			expect(svg?.getAttribute('height')).toBe('400');
		});
	});

	it('renders circles with correct radius and opacity', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 400 }
		});

		await waitFor(() => {
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(10);
			circles.forEach((c) => {
				expect(c.getAttribute('r')).toBe('3');
				expect(c.getAttribute('opacity')).toBe('0.8');
			});
		});
	});

	it('renders a line path with stroke and filter', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 400 }
		});

		await waitFor(() => {
			const path = container.querySelector('path');
			expect(path).not.toBeNull();
			expect(path?.getAttribute('stroke')).toBe('#00f3ff');
			expect(path?.getAttribute('fill')).toBe('none');
			expect(path?.getAttribute('stroke-width')).toBe('1.5');
		});
	});

	it('renders axis groups with ticks', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 400 }
		});

		await waitFor(() => {
			const axisGroups = container.querySelectorAll('svg > g > g');
			expect(axisGroups.length).toBeGreaterThanOrEqual(2);
		});
	});

	it('renders zero circles with zero iterations (empty points)', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 0, height: 400 }
		});

		await waitFor(() => {
			// With 0 iterations, calculateLogistic returns [] — SVG is created
			// but no circles and no path data points
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelectorAll('circle').length).toBe(0);
		});
	});

	it('handles NaN r parameter without crashing (non-finite guard)', () => {
		expect(() =>
			render(LogisticRenderer, { props: { r: NaN, x0: 0.1, iterations: 10, height: 400 } })
		).not.toThrow();
	});

	it('handles Infinity r parameter without crashing (large-magnitude guard)', () => {
		expect(() =>
			render(LogisticRenderer, {
				props: { r: Infinity, x0: 0.1, iterations: 10, height: 400 }
			})
		).not.toThrow();
	});

	it('handles NaN x0 parameter without crashing', () => {
		expect(() =>
			render(LogisticRenderer, { props: { r: 3.9, x0: NaN, iterations: 10, height: 400 } })
		).not.toThrow();
	});

	it('handles minimal height (chartHeight === 0) without throwing', () => {
		// margin top 20 + bottom 50 = 70; height 70 => chartHeight 0
		expect(() =>
			render(LogisticRenderer, { props: { r: 3.9, x0: 0.1, iterations: 10, height: 70 } })
		).not.toThrow();
	});

	it('re-renders when r parameter changes (parameter change re-render)', async () => {
		const { container, rerender } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 400 }
		});

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBe(10);
		});

		// Re-render with different r — should produce 5 circles
		rerender({ r: 2.5, x0: 0.5, iterations: 5, height: 400 });

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBe(5);
		});
	});

	it('re-renders when iterations parameter changes', async () => {
		const { container, rerender } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 400 }
		});

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBe(10);
		});

		rerender({ r: 3.9, x0: 0.1, iterations: 20, height: 400 });

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBe(20);
		});
	});

	it('re-renders when height parameter changes', async () => {
		const { container, rerender } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 400 }
		});

		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});

		rerender({ r: 3.9, x0: 0.1, iterations: 10, height: 300 });

		await waitFor(() => {
			const svg = container.querySelector('svg');
			expect(svg?.getAttribute('height')).toBe('300');
		});
	});

	it('binds containerElement prop to the internal container div', async () => {
		let containerEl: HTMLDivElement | undefined;
		render(LogisticRenderer, {
			props: {
				r: 3.9,
				x0: 0.1,
				iterations: 10,
				height: 400,
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

	it('renders with x0 at boundary value 0', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0, iterations: 10, height: 400 }
		});

		await waitFor(() => {
			// x0=0 => x = r*0*(1-0) = 0 for all iterations => all points at y=0
			expect(container.querySelectorAll('circle').length).toBe(10);
		});
	});

	it('renders with x0 at boundary value 1', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 1, iterations: 10, height: 400 }
		});

		await waitFor(() => {
			// x0=1 => x = r*1*(1-1) = 0 => then stays at 0
			expect(container.querySelectorAll('circle').length).toBe(10);
		});
	});

	it('uses the logistic-svg class on the SVG root', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 400 }
		});

		await waitFor(() => {
			const svg = container.querySelector('svg.logistic-svg');
			expect(svg).not.toBeNull();
		});
	});
});

describe('LogisticRenderer ResizeObserver paths (clientWidth 0)', () => {
	let originalResizeObserver: typeof ResizeObserver;
	let prevClientWidth: PropertyDescriptor | undefined;
	let roCallback: (() => void) | null = null;

	beforeEach(() => {
		originalResizeObserver = globalThis.ResizeObserver;
		prevClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
		roCallback = null;
		class CapturingResizeObserver {
			constructor(cb: () => void) {
				roCallback = cb;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		}
		globalThis.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;
		// Force clientWidth to 0 so render() sets up a ResizeObserver.
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			value: 0
		});
	});

	afterEach(() => {
		globalThis.ResizeObserver = originalResizeObserver;
		if (prevClientWidth) {
			Object.defineProperty(HTMLElement.prototype, 'clientWidth', prevClientWidth);
		}
		cleanup();
	});

	it('creates a ResizeObserver when clientWidth is 0 and re-renders when width becomes positive', async () => {
		const { container } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 400 }
		});
		// clientWidth 0 → render() creates a ResizeObserver and observes the container.
		expect(roCallback).not.toBeNull();

		// Simulate the container gaining layout (width becomes positive).
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			value: 400
		});
		// Fire the captured ResizeObserver callback → disconnect, null, render().
		roCallback!();

		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelectorAll('circle').length).toBe(10);
		});
	});

	it('disconnects existing ResizeObserver when width becomes positive via param change', async () => {
		// clientWidth 0 initially → render() creates a ResizeObserver.
		const { container, rerender } = render(LogisticRenderer, {
			props: { r: 3.9, x0: 0.1, iterations: 10, height: 400 }
		});
		expect(roCallback).not.toBeNull();

		// Width becomes positive on a subsequent render triggered by a param change.
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			value: 400
		});
		rerender({ r: 2.5, x0: 0.5, iterations: 5, height: 400 });

		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelectorAll('circle').length).toBe(5);
		});
	});
});
