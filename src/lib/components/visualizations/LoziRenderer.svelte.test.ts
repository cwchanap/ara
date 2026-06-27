import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import LoziRenderer from './LoziRenderer.svelte';

vi.mock('$lib/lozi', () => ({
	calculateLoziTuples: vi.fn(() => [
		[0, 0],
		[1, 1]
	])
}));

// Store the original clientWidth descriptor so we can restore it.
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

beforeEach(() => {
	// jsdom reports clientWidth as 0 (no layout engine). Give the container a
	// non-zero width so the renderer's dimension calculations produce valid scales.
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

describe('LoziRenderer', () => {
	it('renders points from calculated tuples', async () => {
		const { container } = render(LoziRenderer, {
			props: {
				a: 0.5,
				b: 0.3,
				iterations: 2,
				height: 200
			}
		});

		await waitFor(() => {
			expect(container.querySelectorAll('circle')).toHaveLength(2);
		});
	});
});

describe('LoziRenderer SVG structure', () => {
	it('creates an SVG element', async () => {
		const { container } = render(LoziRenderer, {
			props: { a: 1.7, b: 0.5, iterations: 2, height: 200 }
		});

		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});

	it('renders axis groups', async () => {
		const { container } = render(LoziRenderer, {
			props: { a: 1.7, b: 0.5, iterations: 2, height: 200 }
		});

		await waitFor(() => {
			const axisGroups = container.querySelectorAll('svg g g');
			expect(axisGroups.length).toBeGreaterThanOrEqual(2);
		});
	});

	it('renders circles with correct fill attribute', async () => {
		const { container } = render(LoziRenderer, {
			props: { a: 1.7, b: 0.5, iterations: 2, height: 200 }
		});

		await waitFor(() => {
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(2);
			circles.forEach((c) => {
				expect(c.getAttribute('fill')).not.toBeNull();
			});
		});
	});

	it('sets container height from props', async () => {
		const { container } = render(LoziRenderer, {
			props: { a: 1.7, b: 0.5, iterations: 2, height: 300 }
		});

		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
		});

		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('height')).toBe('300');
	});

	it('does not throw with different parameters', async () => {
		const { container } = render(LoziRenderer, {
			props: { a: 0.1, b: 0.1, iterations: 5, height: 150 }
		});

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(0);
		});
	});
});

describe('LoziRenderer error handling', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('handles calculateLoziTuples throwing an error', async () => {
		const { calculateLoziTuples } = await import('$lib/lozi');
		vi.mocked(calculateLoziTuples).mockImplementationOnce(() => {
			throw new Error('calculation error');
		});

		expect(() =>
			render(LoziRenderer, {
				props: { a: 1.7, b: 0.5, iterations: 2, height: 200 }
			})
		).not.toThrow();
	});
});

describe('LoziRenderer full render path', () => {
	it('produces SVG with correct width from clientWidth', async () => {
		const { container } = render(LoziRenderer, {
			props: { a: 1.7, b: 0.5, iterations: 2, height: 400 }
		});

		await waitFor(() => {
			const svg = container.querySelector('svg');
			expect(svg).not.toBeNull();
			expect(svg?.getAttribute('width')).toBe('500');
			expect(svg?.getAttribute('height')).toBe('400');
		});
	});

	it('renders circles with opacity 0.7', async () => {
		const { container } = render(LoziRenderer, {
			props: { a: 1.7, b: 0.5, iterations: 2, height: 400 }
		});

		await waitFor(() => {
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(2);
			circles.forEach((c) => {
				expect(c.getAttribute('opacity')).toBe('0.7');
				expect(c.getAttribute('r')).toBe('1.5');
			});
		});
	});

	it('renders axis groups with translate transform for x-axis', async () => {
		const { container } = render(LoziRenderer, {
			props: { a: 1.7, b: 0.5, iterations: 2, height: 400 }
		});

		await waitFor(() => {
			const axisGroups = container.querySelectorAll('svg > g > g');
			expect(axisGroups.length).toBeGreaterThanOrEqual(2);
			// The x-axis group should have a translate transform
			const xAxisGroup = Array.from(axisGroups).find((g) =>
				g.getAttribute('transform')?.startsWith('translate(0,')
			);
			expect(xAxisGroup).toBeDefined();
		});
	});

	it('handles zero iterations (empty points)', async () => {
		const { calculateLoziTuples } = await import('$lib/lozi');
		vi.mocked(calculateLoziTuples).mockReturnValueOnce([]);

		const { container } = render(LoziRenderer, {
			props: { a: 1.7, b: 0.5, iterations: 0, height: 400 }
		});

		await waitFor(() => {
			// SVG is still created (Lozi has no empty-points guard), but no circles
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelectorAll('circle').length).toBe(0);
		});
	});

	it('handles NaN parameters without crashing (non-finite guard)', async () => {
		expect(() =>
			render(LoziRenderer, {
				props: { a: NaN, b: 0.5, iterations: 2, height: 400 }
			})
		).not.toThrow();
	});

	it('handles Infinity parameters without crashing (large-magnitude guard)', async () => {
		expect(() =>
			render(LoziRenderer, {
				props: { a: Infinity, b: 0.5, iterations: 2, height: 400 }
			})
		).not.toThrow();
	});

	it('handles minimal height (chartHeight near 0) without throwing', () => {
		// margin top 20 + bottom 50 = 70; height 70 => chartHeight 0
		expect(() =>
			render(LoziRenderer, {
				props: { a: 1.7, b: 0.5, iterations: 2, height: 70 }
			})
		).not.toThrow();
	});

	it('re-renders when parameters change (parameter change re-render)', async () => {
		const { container, rerender } = render(LoziRenderer, {
			props: { a: 1.7, b: 0.5, iterations: 2, height: 400 }
		});

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBe(2);
		});

		// Re-render with different parameters
		expect(() => rerender({ a: 1.5, b: 0.4, iterations: 2, height: 400 })).not.toThrow();

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBe(2);
		});
	});

	it('binds containerElement prop to the internal container div', async () => {
		let containerEl: HTMLDivElement | undefined;
		render(LoziRenderer, {
			props: {
				a: 1.7,
				b: 0.5,
				iterations: 2,
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

	it('renders with custom x0 and y0 initial conditions', async () => {
		const { container } = render(LoziRenderer, {
			props: { a: 1.7, b: 0.5, x0: 0.1, y0: 0.1, iterations: 2, height: 400 }
		});

		await waitFor(() => {
			expect(container.querySelectorAll('circle').length).toBe(2);
		});
	});
});
