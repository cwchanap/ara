import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import LoziRenderer from './LoziRenderer.svelte';

vi.mock('$lib/lozi', () => ({
	calculateLoziTuples: vi.fn(() => [
		[0, 0],
		[1, 1]
	])
}));

describe('LoziRenderer', () => {
	afterEach(() => {
		cleanup();
	});

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
	afterEach(() => {
		cleanup();
	});

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

	it('renders with different parameters', async () => {
		const { container } = render(LoziRenderer, {
			props: { a: 0.1, b: 0.1, iterations: 5, height: 150 }
		});

		await waitFor(() => {
			expect(container.querySelectorAll('circle')).toHaveLength(2);
		});
	});
});

describe('LoziRenderer error handling', () => {
	afterEach(() => {
		cleanup();
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
