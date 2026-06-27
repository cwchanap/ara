import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import HenonRenderer from './HenonRenderer.svelte';

// Store the original clientWidth descriptor so we can restore it.
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

beforeEach(() => {
	// jsdom reports clientWidth as 0 (no layout engine). Give the container a
	// non-zero width so the renderer's dimension guard doesn't skip rendering.
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
		configurable: true,
		get() {
			return 500;
		}
	});
});

afterEach(() => {
	if (originalClientWidth) {
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
	} else {
		delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
	}
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
			render(HenonRenderer, { props: { a: 1.4, b: 0.3, iterations: 10000, height: 200 } })
		).not.toThrow();
	}, 30000);

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

describe('HenonRenderer full render path', () => {
	it('produces SVG circles for valid parameters', async () => {
		const { container } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 100, height: 400 }
		});

		await waitFor(() => {
			const svg = container.querySelector('svg');
			expect(svg).not.toBeNull();
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(100);
		});
	});

	it('creates an SVG element with correct dimensions', async () => {
		const { container } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 50, height: 400 }
		});

		await waitFor(() => {
			const svg = container.querySelector('svg');
			expect(svg).not.toBeNull();
			expect(svg?.getAttribute('width')).toBe('500');
			expect(svg?.getAttribute('height')).toBe('400');
		});
	});

	it('renders axis groups (grid-lines)', async () => {
		const { container } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 50, height: 400 }
		});

		await waitFor(() => {
			const gridLines = container.querySelectorAll('.grid-lines');
			expect(gridLines.length).toBeGreaterThanOrEqual(2);
		});
	});

	it('renders X and Y axis labels', async () => {
		const { container } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 50, height: 400 }
		});

		await waitFor(() => {
			const texts = container.querySelectorAll('svg g text');
			const textContents = Array.from(texts).map((t) => t.textContent);
			expect(textContents).toContain('X_AXIS');
			expect(textContents).toContain('Y_AXIS');
		});
	});

	it('renders circles with gradient fill colors', async () => {
		const { container } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 10, height: 400 }
		});

		await waitFor(() => {
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(10);
			circles.forEach((c) => {
				expect(c.getAttribute('fill')).not.toBeNull();
				expect(c.getAttribute('opacity')).toBe('0.8');
			});
		});
	});

	it('produces no circles with zero iterations (empty points guard)', async () => {
		const { container } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 0, height: 400 }
		});

		// With 0 iterations, calculateHenon returns [] and the empty-points
		// guard removes all SVG content. No svg/circles should remain.
		await waitFor(() => {
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(0);
		});
	});

	it('handles NaN parameters without crashing (non-finite guard)', () => {
		expect(() =>
			render(HenonRenderer, { props: { a: NaN, b: 0.3, iterations: 100, height: 400 } })
		).not.toThrow();
	});

	it('handles Infinity parameters without crashing (large-magnitude guard)', () => {
		expect(() =>
			render(HenonRenderer, { props: { a: Infinity, b: 0.3, iterations: 100, height: 400 } })
		).not.toThrow();
	});

	it('produces only one circle when parameters diverge (large-magnitude guard)', async () => {
		// a=1e10: first iteration yields [1,0] (finite, within 1e6), but the
		// second iteration produces |xNew| > 1e6, breaking the loop early.
		const { container } = render(HenonRenderer, {
			props: { a: 1e10, b: 0.3, iterations: 100, height: 400 }
		});

		await waitFor(() => {
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(1);
		});
	});

	it('produces no circles with NaN parameters (non-finite guard)', async () => {
		// a=NaN: xNew = 1 - NaN = NaN → !isFinite → break immediately, 0 points.
		const { container } = render(HenonRenderer, {
			props: { a: NaN, b: 0.3, iterations: 100, height: 400 }
		});

		await waitFor(() => {
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(0);
		});
	});

	it('handles chartHeight === 0 (minimal height guard) without throwing', () => {
		// margin top 20 + bottom 50 = 70; height 70 => chartHeight 0 => early return
		expect(() =>
			render(HenonRenderer, { props: { a: 1.4, b: 0.3, iterations: 100, height: 70 } })
		).not.toThrow();
	});

	it('produces no svg when chartHeight is 0', async () => {
		const { container } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 100, height: 70 }
		});

		await waitFor(() => {
			const svg = container.querySelector('svg');
			expect(svg).toBeNull();
		});
	});

	it('re-renders when parameters change (parameter change re-render)', async () => {
		const { container, rerender } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 50, height: 400 }
		});

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBe(50);
		});

		// Re-render with more iterations
		rerender({ a: 1.4, b: 0.3, iterations: 100, height: 400 });

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBe(100);
		});
	});

	it('binds containerElement prop to the internal container div', async () => {
		let containerEl: HTMLDivElement | undefined;
		render(HenonRenderer, {
			props: {
				a: 1.4,
				b: 0.3,
				iterations: 50,
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
});
