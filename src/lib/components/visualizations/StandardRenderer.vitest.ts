import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import StandardRenderer from './StandardRenderer.svelte';

beforeAll(() => {
	const ctx = {
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		fillStyle: '',
		globalAlpha: 1
	};
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () => ctx
	});
});

describe('StandardRenderer', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('renders with fallback computation when worker is unavailable', async () => {
		vi.useFakeTimers();
		const { container } = render(StandardRenderer, {
			props: {
				K: 1,
				numP: 1,
				numQ: 1,
				iterations: 5,
				height: 200
			}
		});

		await vi.advanceTimersByTimeAsync(200);

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
			expect(container.querySelector('svg')).not.toBeNull();
		});
	});
});
