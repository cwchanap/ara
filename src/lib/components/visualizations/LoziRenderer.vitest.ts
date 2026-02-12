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
