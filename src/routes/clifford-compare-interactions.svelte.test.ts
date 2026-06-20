import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import CliffordComparePage from './clifford/compare/+page.svelte';

const mockGoto = vi.hoisted(() => vi.fn());

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/clifford/compare?compare=true') as Page['url'],
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

vi.mock('$lib/components/visualizations/CliffordRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
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

function encodeParams(params: Record<string, unknown>): string {
	return btoa(JSON.stringify(params));
}

describe('Clifford compare page interactions', () => {
	beforeEach(() => {
		setPageUrl('http://localhost/clifford/compare?compare=true');
	});

	afterEach(() => {
		cleanup();
		mockGoto.mockClear();
	});

	it('renders left and right parameter panels with default URL', () => {
		render(CliffordComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders left and right shape sliders (a, b, c, d)', () => {
		const { container } = render(CliffordComparePage);
		for (const id of ['left-a', 'left-b', 'left-c', 'left-d']) {
			expect(container.querySelector(`#${id}`)).not.toBeNull();
		}
		for (const id of ['right-a', 'right-b', 'right-c', 'right-d']) {
			expect(container.querySelector(`#${id}`)).not.toBeNull();
		}
	});

	it('renders left and right iterations sliders', () => {
		const { container } = render(CliffordComparePage);
		expect(container.querySelector('#left-iterations')).not.toBeNull();
		expect(container.querySelector('#right-iterations')).not.toBeNull();
	});

	it('renders the recurrence equations in both panels', () => {
		render(CliffordComparePage);
		// The equations snippet is rendered twice (left + right).
		const equations = screen.getAllByText(/sin\(a/i);
		expect(equations.length).toBeGreaterThanOrEqual(2);
	});

	it('renders with encoded URL parameters without throwing', () => {
		const leftParams = encodeParams({
			a: 1.5,
			b: -1.2,
			c: 0.8,
			d: -0.5,
			iterations: 50000
		});
		const rightParams = encodeParams({
			a: -1.4,
			b: 1.6,
			c: 1.0,
			d: 0.7,
			iterations: 120000
		});
		setPageUrl(
			`http://localhost/clifford/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);
		const { container } = render(CliffordComparePage);
		expect(container.querySelector('#left-a')).not.toBeNull();
		expect(container.querySelector('#right-a')).not.toBeNull();
	});

	it('clamps out-of-range URL parameters to the stable ranges', () => {
		// a, b, c, d ∈ [-3, 3]; iterations ∈ [1, 250000].
		// Encode values outside the allowed range; the page should clamp them.
		const leftParams = encodeParams({
			a: 99,
			b: -99,
			c: 50,
			d: -50,
			iterations: 999999999
		});
		const rightParams = encodeParams({
			a: -99,
			b: 99,
			c: -50,
			d: 50,
			iterations: -1
		});
		setPageUrl(
			`http://localhost/clifford/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);
		const { container } = render(CliffordComparePage);
		const leftA = container.querySelector('#left-a') as HTMLInputElement;
		const leftIterations = container.querySelector('#left-iterations') as HTMLInputElement;
		const rightA = container.querySelector('#right-a') as HTMLInputElement;
		const rightIterations = container.querySelector('#right-iterations') as HTMLInputElement;
		// Clamped to range max/min.
		expect(Number(leftA.value)).toBeLessThanOrEqual(3);
		expect(Number(leftA.value)).toBeGreaterThanOrEqual(-3);
		expect(Number(leftIterations.value)).toBeLessThanOrEqual(250000);
		expect(Number(rightA.value)).toBeLessThanOrEqual(3);
		expect(Number(rightA.value)).toBeGreaterThanOrEqual(-3);
		// iterations fallback for invalid (-1): clampValue returns 1 (the min),
		// and the range input (min=10000) floors it to its own min attribute.
		expect(Number(rightIterations.value)).toBeGreaterThanOrEqual(1);
		expect(Number(rightIterations.value)).toBeLessThanOrEqual(250000);
	});

	it('falls back to defaults when encoded params fail validation', () => {
		// Non-numeric a should fail validation and fall back to defaults.
		const leftParams = encodeParams({
			a: 'not-a-number',
			b: 1.6,
			c: 1.0,
			d: 0.7,
			iterations: 120000
		});
		setPageUrl(`http://localhost/clifford/compare?compare=true&left=${leftParams}`);
		const { container } = render(CliffordComparePage);
		const leftA = container.querySelector('#left-a') as HTMLInputElement;
		// Default a is -1.4.
		expect(Number(leftA.value)).toBeCloseTo(-1.4, 5);
	});

	it('updates URL via goto when a left shape slider changes', async () => {
		vi.useFakeTimers();
		const { container } = render(CliffordComparePage);
		const leftA = container.querySelector('#left-a') as HTMLInputElement;
		expect(leftA).not.toBeNull();
		await fireEvent.input(leftA, { target: { value: '1.5' } });
		// Advance past the 300ms debounce.
		vi.advanceTimersByTime(400);
		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('updates URL via goto when a right iterations slider changes', async () => {
		vi.useFakeTimers();
		const { container } = render(CliffordComparePage);
		const rightIterations = container.querySelector('#right-iterations') as HTMLInputElement;
		expect(rightIterations).not.toBeNull();
		await fireEvent.input(rightIterations, { target: { value: '50000' } });
		// Advance past the 300ms debounce.
		vi.advanceTimersByTime(400);
		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('preserves styling params (colorMode/zoom/pointSize/opacity) from URL-decoded left state', () => {
		const leftParams = encodeParams({
			a: -1.4,
			b: 1.6,
			c: 1.0,
			d: 0.7,
			iterations: 120000,
			colorMode: 'iteration',
			zoom: 2.5,
			pointSize: 3.0,
			opacity: 0.8
		});
		const rightParams = encodeParams({
			a: 1.7,
			b: 1.7,
			c: 0.6,
			d: 1.2,
			iterations: 120000
		});
		setPageUrl(
			`http://localhost/clifford/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);
		// Should render without throwing — styling params flow through to the
		// renderer stub instead of crashing the page.
		const { container } = render(CliffordComparePage);
		expect(container.querySelector('#left-a')).not.toBeNull();
		expect(container.querySelector('#right-a')).not.toBeNull();
	});

	it('renders without compare param (decodeComparisonState returns null → defaults)', () => {
		setPageUrl('http://localhost/clifford/compare');
		const { container } = render(CliffordComparePage);
		// Even without ?compare=true, the page falls back to default params.
		expect(container.querySelector('#left-a')).not.toBeNull();
		expect(container.querySelector('#right-a')).not.toBeNull();
	});

	it('cleans up on unmount without throwing', () => {
		const { unmount } = render(CliffordComparePage);
		expect(() => unmount()).not.toThrow();
	});
});
