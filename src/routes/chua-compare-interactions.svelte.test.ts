import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import ChuaComparePage from './chua/compare/+page.svelte';

const mockGoto = vi.hoisted(() => vi.fn());

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/chua/compare?compare=true') as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: { session: null, user: null, profile: null },
		form: null,
		state: {}
	};
	const subscribers = new Set<(value: Page) => void>();
	return {
		subscribe(run: (value: Page) => void) {
			run(value);
			subscribers.add(run);
			return () => subscribers.delete(run);
		},
		set(next: Page) {
			value = next;
			subscribers.forEach((subscriber) => subscriber(value));
		}
	};
});

vi.mock('$app/stores', () => ({
	page: { subscribe: pageStore.subscribe }
}));

vi.mock('$app/paths', () => ({
	base: ''
}));

vi.mock('$app/navigation', () => ({
	goto: mockGoto
}));

vi.mock('$lib/chua', () => ({
	calculateChua: vi.fn(() => ({
		points: [
			{ x: 1, y: 2, z: 3 },
			{ x: 4, y: 5, z: 6 }
		],
		diverged: false
	})),
	computePoincareSection: vi.fn(() => [{ u: 1, v: 2 }])
}));

vi.mock('$lib/components/visualizations/ChuaRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

function setPageUrl(url: string) {
	pageStore.set({
		url: new URL(url) as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: { session: null, user: null, profile: null },
		form: null,
		state: {}
	});
}

describe('Chua compare page interactions', () => {
	afterEach(() => {
		cleanup();
		mockGoto.mockClear();
	});

	it('renders with default URL parameters', () => {
		setPageUrl('http://localhost/chua/compare?compare=true');
		render(ChuaComparePage);

		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders without compare param and redirects', () => {
		setPageUrl('http://localhost/chua/compare');
		render(ChuaComparePage);

		expect(mockGoto).toHaveBeenCalled();
	});

	it('swaps left and right parameters', async () => {
		setPageUrl('http://localhost/chua/compare?compare=true');
		render(ChuaComparePage);

		// Get initial left and right alpha values
		const alphaLabels = screen.getAllByText(/α \(alpha\)/i);
		expect(alphaLabels.length).toBeGreaterThanOrEqual(2);

		// Click swap button
		const swapBtn = screen.getByRole('button', { name: /Swap/i });
		await fireEvent.click(swapBtn);

		// goto should be called for URL update
		expect(mockGoto).toHaveBeenCalled();
	});

	it('updates URL when a left parameter changes', async () => {
		vi.useFakeTimers();
		setPageUrl('http://localhost/chua/compare?compare=true');
		render(ChuaComparePage);

		const alphaSliders = screen.getAllByLabelText('α (alpha)');
		expect(alphaSliders.length).toBe(2);

		// Change left alpha
		await fireEvent.input(alphaSliders[0], { target: { value: '20' } });

		// Advance past debounce
		vi.advanceTimersByTime(400);

		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('updates URL when a right parameter changes', async () => {
		vi.useFakeTimers();
		setPageUrl('http://localhost/chua/compare?compare=true');
		render(ChuaComparePage);

		const alphaSliders = screen.getAllByLabelText('α (alpha)');
		expect(alphaSliders.length).toBe(2);

		// Change right alpha
		await fireEvent.input(alphaSliders[1], { target: { value: '22' } });

		// Advance past debounce
		vi.advanceTimersByTime(400);

		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('renders with encoded URL parameters', () => {
		const leftParams = btoa(JSON.stringify({ alpha: 10, beta: 20, gamma: 0, a: -1, b: -0.5 }));
		const rightParams = btoa(
			JSON.stringify({ alpha: 15, beta: 30, gamma: 0.1, a: -1.2, b: -0.6 })
		);
		setPageUrl(
			`http://localhost/chua/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);
		render(ChuaComparePage);

		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});
});
