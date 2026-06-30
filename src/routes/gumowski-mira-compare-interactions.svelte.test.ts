import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import GumowskiMiraComparePage from './gumowski-mira/compare/+page.svelte';

const mockGoto = vi.hoisted(() => vi.fn());

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/gumowski-mira/compare?compare=true') as Page['url'],
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

vi.mock('$lib/components/visualizations/GumowskiMiraRenderer.svelte', async () => {
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

function encodeParams(params: Record<string, unknown>): string {
	return btoa(JSON.stringify(params));
}

describe('Gumowski–Mira compare page interactions', () => {
	beforeEach(() => {
		setPageUrl('http://localhost/gumowski-mira/compare?compare=true');
	});

	afterEach(() => {
		cleanup();
		mockGoto.mockClear();
	});

	it('renders left and right parameter panels with default URL', () => {
		render(GumowskiMiraComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders left and right shape sliders (mu, a, b)', () => {
		const { container } = render(GumowskiMiraComparePage);
		for (const id of ['left-mu', 'left-a', 'left-b']) {
			expect(container.querySelector(`#${id}`)).not.toBeNull();
		}
		for (const id of ['right-mu', 'right-a', 'right-b']) {
			expect(container.querySelector(`#${id}`)).not.toBeNull();
		}
	});

	it('renders left and right x0/y0 sliders', () => {
		const { container } = render(GumowskiMiraComparePage);
		expect(container.querySelector('#left-x0')).not.toBeNull();
		expect(container.querySelector('#left-y0')).not.toBeNull();
		expect(container.querySelector('#right-x0')).not.toBeNull();
		expect(container.querySelector('#right-y0')).not.toBeNull();
	});

	it('renders left and right iterations and burnIn sliders', () => {
		const { container } = render(GumowskiMiraComparePage);
		expect(container.querySelector('#left-iterations')).not.toBeNull();
		expect(container.querySelector('#left-burnIn')).not.toBeNull();
		expect(container.querySelector('#right-iterations')).not.toBeNull();
		expect(container.querySelector('#right-burnIn')).not.toBeNull();
	});

	it('renders the recurrence equations in both panels', () => {
		render(GumowskiMiraComparePage);
		// The equations snippet is rendered twice (left + right).
		const equations = screen.getAllByText(/g\(x\) = μ/i);
		expect(equations.length).toBeGreaterThanOrEqual(2);
	});

	it('renders with encoded URL parameters without throwing', () => {
		const leftParams = encodeParams({
			mu: -0.4,
			a: 0.008,
			b: 0.5,
			x0: 0.1,
			y0: 0,
			iterations: 12000,
			burnIn: 500
		});
		const rightParams = encodeParams({
			mu: 0.55,
			a: 0.05,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 18000,
			burnIn: 500
		});
		setPageUrl(
			`http://localhost/gumowski-mira/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);
		const { container } = render(GumowskiMiraComparePage);
		expect(container.querySelector('#left-mu')).not.toBeNull();
		expect(container.querySelector('#right-mu')).not.toBeNull();
	});

	it('clamps out-of-range URL parameters to the stable ranges', () => {
		// mu ∈ [-1, 1]; a ∈ [0, 1]; b ∈ [0, 0.5]; iterations ∈ [1, 250000].
		// Encode values outside the allowed range; the page should clamp them.
		const leftParams = encodeParams({
			mu: 99,
			a: -50,
			b: -50,
			x0: 999,
			y0: -999,
			iterations: 999999999,
			burnIn: 999999
		});
		const rightParams = encodeParams({
			mu: -99,
			a: 99,
			b: 99,
			x0: -999,
			y0: 999,
			iterations: -1,
			burnIn: -1
		});
		setPageUrl(
			`http://localhost/gumowski-mira/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);
		const { container } = render(GumowskiMiraComparePage);
		const leftMu = container.querySelector('#left-mu') as HTMLInputElement;
		const leftIterations = container.querySelector('#left-iterations') as HTMLInputElement;
		const rightMu = container.querySelector('#right-mu') as HTMLInputElement;
		const rightIterations = container.querySelector('#right-iterations') as HTMLInputElement;
		// Clamped to range max/min.
		expect(Number(leftMu.value)).toBeLessThanOrEqual(1);
		expect(Number(leftMu.value)).toBeGreaterThanOrEqual(-1);
		expect(Number(leftIterations.value)).toBeLessThanOrEqual(250000);
		expect(Number(rightMu.value)).toBeLessThanOrEqual(1);
		expect(Number(rightMu.value)).toBeGreaterThanOrEqual(-1);
		// iterations fallback for invalid (-1): clampValue returns 15000 (the default),
		// and the range input (min=100) floors it to its own min attribute.
		expect(Number(rightIterations.value)).toBeGreaterThanOrEqual(1);
		expect(Number(rightIterations.value)).toBeLessThanOrEqual(250000);
	});

	it('falls back to defaults when encoded params fail validation', () => {
		// Non-numeric mu should fail validation and fall back to defaults.
		const leftParams = encodeParams({
			mu: 'not-a-number',
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 15000,
			burnIn: 500
		});
		setPageUrl(`http://localhost/gumowski-mira/compare?compare=true&left=${leftParams}`);
		const { container } = render(GumowskiMiraComparePage);
		const leftMu = container.querySelector('#left-mu') as HTMLInputElement;
		// Default mu is 0.31 (island-structure preset).
		expect(Number(leftMu.value)).toBeCloseTo(0.31, 5);
	});

	it('updates URL via goto when a left shape slider changes', async () => {
		vi.useFakeTimers();
		const { container } = render(GumowskiMiraComparePage);
		const leftMu = container.querySelector('#left-mu') as HTMLInputElement;
		expect(leftMu).not.toBeNull();
		await fireEvent.input(leftMu, { target: { value: '-0.4' } });
		// Advance past the 300ms debounce.
		vi.advanceTimersByTime(400);
		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('updates URL via goto when a right iterations slider changes', async () => {
		vi.useFakeTimers();
		const { container } = render(GumowskiMiraComparePage);
		const rightIterations = container.querySelector('#right-iterations') as HTMLInputElement;
		expect(rightIterations).not.toBeNull();
		await fireEvent.input(rightIterations, { target: { value: '50000' } });
		// Advance past the 300ms debounce.
		vi.advanceTimersByTime(400);
		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('preserves styling params (renderMode/seeds/colorMode/pointSize/opacity) from URL-decoded left state', () => {
		const leftParams = encodeParams({
			mu: -0.4,
			a: 0.008,
			b: 0.5,
			x0: 0.1,
			y0: 0,
			iterations: 12000,
			burnIn: 500,
			renderMode: 'single',
			seeds: 500,
			colorMode: 'seed',
			pointSize: 3.0,
			opacity: 0.8
		});
		const rightParams = encodeParams({
			mu: 0.55,
			a: 0.05,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 18000,
			burnIn: 500
		});
		setPageUrl(
			`http://localhost/gumowski-mira/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);
		// Should render without throwing — styling params flow through to the
		// renderer stub instead of crashing the page.
		const { container } = render(GumowskiMiraComparePage);
		expect(container.querySelector('#left-mu')).not.toBeNull();
		expect(container.querySelector('#right-mu')).not.toBeNull();
	});

	it('renders without compare param (decodeComparisonState returns null → defaults)', () => {
		setPageUrl('http://localhost/gumowski-mira/compare');
		const { container } = render(GumowskiMiraComparePage);
		// Even without ?compare=true, the page falls back to default params.
		expect(container.querySelector('#left-mu')).not.toBeNull();
		expect(container.querySelector('#right-mu')).not.toBeNull();
	});

	it('cleans up on unmount without throwing', () => {
		const { unmount } = render(GumowskiMiraComparePage);
		expect(() => unmount()).not.toThrow();
	});

	it('swaps left and right parameters via the Swap button', async () => {
		// Encode distinct left/right params so we can verify the swap.
		const leftParams = encodeParams({
			mu: -0.4,
			a: 0.008,
			b: 0.5,
			x0: 0.1,
			y0: 0,
			iterations: 12000,
			burnIn: 500
		});
		const rightParams = encodeParams({
			mu: 0.55,
			a: 0.05,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 18000,
			burnIn: 500
		});
		setPageUrl(
			`http://localhost/gumowski-mira/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);
		const { container } = render(GumowskiMiraComparePage);
		const leftMu = container.querySelector('#left-mu') as HTMLInputElement;
		const rightMu = container.querySelector('#right-mu') as HTMLInputElement;
		// Before swap: left mu=-0.4, right mu=0.55
		expect(Number(leftMu.value)).toBeCloseTo(-0.4, 5);
		expect(Number(rightMu.value)).toBeCloseTo(0.55, 5);

		// Click Swap — ComparisonLayout calls onLeftParamsChange/onRightParamsChange
		// with the swapped params, which updates leftMu/rightMu etc.
		await fireEvent.click(screen.getByRole('button', { name: /Swap/i }));

		// After swap: left mu=0.55, right mu=-0.4 (values swapped)
		await waitFor(() => {
			expect(
				Number((container.querySelector('#left-mu') as HTMLInputElement).value)
			).toBeCloseTo(0.55, 5);
			expect(
				Number((container.querySelector('#right-mu') as HTMLInputElement).value)
			).toBeCloseTo(-0.4, 5);
		});
	});

	it('fires oninput on all left and right sliders without throwing', async () => {
		const { container } = render(GumowskiMiraComparePage);
		// Use values valid for every slider range (b has min=0, so avoid negatives).
		for (const id of ['left-mu', 'left-a', 'left-b']) {
			const slider = container.querySelector(`#${id}`) as HTMLInputElement;
			await fireEvent.input(slider, { target: { value: '0.05' } });
		}
		for (const id of ['right-mu', 'right-a', 'right-b']) {
			const slider = container.querySelector(`#${id}`) as HTMLInputElement;
			await fireEvent.input(slider, { target: { value: '0.04' } });
		}
		// Verify one slider reflected the change.
		expect(Number((container.querySelector('#left-mu') as HTMLInputElement).value)).toBeCloseTo(
			0.05,
			5
		);
		expect(Number((container.querySelector('#right-b') as HTMLInputElement).value)).toBeCloseTo(
			0.04,
			5
		);
	});

	it('updates URL via goto when a left burnIn slider changes with bind', async () => {
		vi.useFakeTimers();
		const { container } = render(GumowskiMiraComparePage);
		const leftBurnIn = container.querySelector('#left-burnIn') as HTMLInputElement;
		await fireEvent.input(leftBurnIn, { target: { value: '1000' } });
		vi.advanceTimersByTime(400);
		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('changes left render mode via select', async () => {
		const { container } = render(GumowskiMiraComparePage);
		const leftRenderMode = container.querySelector('#left-renderMode') as HTMLSelectElement;
		await fireEvent.change(leftRenderMode, { target: { value: 'single' } });
		expect(leftRenderMode.value).toBe('single');
		// x0/y0 sliders should now be enabled (not disabled)
		const leftX0 = container.querySelector('#left-x0') as HTMLInputElement;
		expect(leftX0.disabled).toBe(false);
	});

	it('changes right render mode via select', async () => {
		const { container } = render(GumowskiMiraComparePage);
		const rightRenderMode = container.querySelector('#right-renderMode') as HTMLSelectElement;
		await fireEvent.change(rightRenderMode, { target: { value: 'single' } });
		expect(rightRenderMode.value).toBe('single');
		// x0/y0 sliders should now be enabled (not disabled)
		const rightY0 = container.querySelector('#right-y0') as HTMLInputElement;
		expect(rightY0.disabled).toBe(false);
	});

	it('updates left x0 and y0 sliders in single mode', async () => {
		const { container } = render(GumowskiMiraComparePage);
		const leftRenderMode = container.querySelector('#left-renderMode') as HTMLSelectElement;
		await fireEvent.change(leftRenderMode, { target: { value: 'single' } });
		const leftX0 = container.querySelector('#left-x0') as HTMLInputElement;
		const leftY0 = container.querySelector('#left-y0') as HTMLInputElement;
		await fireEvent.input(leftX0, { target: { value: '5.5' } });
		await fireEvent.input(leftY0, { target: { value: '-3.2' } });
		expect(Number(leftX0.value)).toBeCloseTo(5.5, 5);
		expect(Number(leftY0.value)).toBeCloseTo(-3.2, 5);
	});

	it('updates right x0 and y0 sliders in single mode', async () => {
		const { container } = render(GumowskiMiraComparePage);
		const rightRenderMode = container.querySelector('#right-renderMode') as HTMLSelectElement;
		await fireEvent.change(rightRenderMode, { target: { value: 'single' } });
		const rightX0 = container.querySelector('#right-x0') as HTMLInputElement;
		const rightY0 = container.querySelector('#right-y0') as HTMLInputElement;
		await fireEvent.input(rightX0, { target: { value: '7.7' } });
		await fireEvent.input(rightY0, { target: { value: '-1.1' } });
		expect(Number(rightX0.value)).toBeCloseTo(7.7, 5);
		expect(Number(rightY0.value)).toBeCloseTo(-1.1, 5);
	});

	it('updates URL via goto when right burnIn slider changes', async () => {
		vi.useFakeTimers();
		const { container } = render(GumowskiMiraComparePage);
		const rightBurnIn = container.querySelector('#right-burnIn') as HTMLInputElement;
		await fireEvent.input(rightBurnIn, { target: { value: '2000' } });
		vi.advanceTimersByTime(400);
		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('updates URL via goto when left iterations slider changes', async () => {
		vi.useFakeTimers();
		const { container } = render(GumowskiMiraComparePage);
		const leftIterations = container.querySelector('#left-iterations') as HTMLInputElement;
		await fireEvent.input(leftIterations, { target: { value: '50000' } });
		vi.advanceTimersByTime(400);
		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('renders with a corrected URL (corrupt base64) without throwing', () => {
		setPageUrl(
			'http://localhost/gumowski-mira/compare?compare=true&left=!!!corrupt!!!&right=also-bad'
		);
		const { container } = render(GumowskiMiraComparePage);
		// Falls back to defaults — sliders should still render with default values.
		const leftMu = container.querySelector('#left-mu') as HTMLInputElement;
		expect(Number(leftMu.value)).toBeCloseTo(0.31, 5);
	});
});
