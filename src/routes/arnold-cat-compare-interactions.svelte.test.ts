/**
 * Compare-page interaction tests for the Arnold Cat Map comparison route.
 * Covers URL decoding, parameter clamping, slider interactions, swap, and
 * debounced URL updates via goto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import ArnoldCatComparePage from './arnold-cat/compare/+page.svelte';

const mockGoto = vi.hoisted(() => vi.fn());

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/arnold-cat/compare?compare=true') as Page['url'],
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

vi.mock('$lib/components/visualizations/ArnoldCatRenderer.svelte', async () => {
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

describe('Arnold Cat Map compare page interactions', () => {
	beforeEach(() => {
		setPageUrl('http://localhost/arnold-cat/compare?compare=true');
	});

	afterEach(() => {
		cleanup();
		mockGoto.mockClear();
		vi.useRealTimers();
	});

	// ── Basic rendering ────────────────────────────────────────────────────

	it('renders left and right parameter panels with default URL', () => {
		render(ArnoldCatComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders left and right pointCount and speed sliders', () => {
		const { container } = render(ArnoldCatComparePage);
		expect(container.querySelector('#left-pointCount')).not.toBeNull();
		expect(container.querySelector('#left-speed')).not.toBeNull();
		expect(container.querySelector('#right-pointCount')).not.toBeNull();
		expect(container.querySelector('#right-speed')).not.toBeNull();
	});

	it('renders the recurrence equations in both panels', () => {
		render(ArnoldCatComparePage);
		const equations = screen.getAllByText(/x' = \(x \+ y\) mod 1/i);
		expect(equations.length).toBeGreaterThanOrEqual(2);
	});

	it('displays default pointCount (3000) and speed (5) for both panels', () => {
		const { container } = render(ArnoldCatComparePage);
		const leftPointCount = container.querySelector('#left-pointCount') as HTMLInputElement;
		const rightPointCount = container.querySelector('#right-pointCount') as HTMLInputElement;
		const leftSpeed = container.querySelector('#left-speed') as HTMLInputElement;
		const rightSpeed = container.querySelector('#right-speed') as HTMLInputElement;
		expect(Number(leftPointCount.value)).toBe(3000);
		expect(Number(rightPointCount.value)).toBe(3000);
		expect(Number(leftSpeed.value)).toBe(5);
		expect(Number(rightSpeed.value)).toBe(5);
	});

	// ── Encoded URL parameters ─────────────────────────────────────────────

	it('renders with encoded URL parameters without throwing', () => {
		const leftParams = encodeParams({ pointCount: 5000, speed: 3 });
		const rightParams = encodeParams({ pointCount: 1000, speed: 7 });
		setPageUrl(
			`http://localhost/arnold-cat/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);
		const { container } = render(ArnoldCatComparePage);
		const leftPointCount = container.querySelector('#left-pointCount') as HTMLInputElement;
		const rightPointCount = container.querySelector('#right-pointCount') as HTMLInputElement;
		expect(Number(leftPointCount.value)).toBe(5000);
		expect(Number(rightPointCount.value)).toBe(1000);
	});

	it('clamps out-of-range URL parameters to stable ranges', () => {
		const leftParams = encodeParams({ pointCount: 99999, speed: 50 });
		const rightParams = encodeParams({ pointCount: 10, speed: 0 });
		setPageUrl(
			`http://localhost/arnold-cat/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);
		const { container } = render(ArnoldCatComparePage);
		const leftPointCount = container.querySelector('#left-pointCount') as HTMLInputElement;
		const leftSpeed = container.querySelector('#left-speed') as HTMLInputElement;
		const rightPointCount = container.querySelector('#right-pointCount') as HTMLInputElement;
		const rightSpeed = container.querySelector('#right-speed') as HTMLInputElement;
		// pointCount 99999 → clamped to 10000; speed 50 → clamped to 30
		expect(Number(leftPointCount.value)).toBeLessThanOrEqual(10000);
		expect(Number(leftSpeed.value)).toBeLessThanOrEqual(30);
		// pointCount 10 → clamped to 100; speed 0 → clamped to 1
		expect(Number(rightPointCount.value)).toBeGreaterThanOrEqual(100);
		expect(Number(rightSpeed.value)).toBeGreaterThanOrEqual(1);
	});

	it('falls back to defaults when encoded params fail validation', () => {
		// Non-numeric pointCount should fail validation and fall back to defaults
		const leftParams = encodeParams({ pointCount: 'not-a-number', speed: 3 });
		setPageUrl(`http://localhost/arnold-cat/compare?compare=true&left=${leftParams}`);
		const { container } = render(ArnoldCatComparePage);
		const leftPointCount = container.querySelector('#left-pointCount') as HTMLInputElement;
		// Default pointCount is 3000
		expect(Number(leftPointCount.value)).toBe(3000);
	});

	it('renders without compare param (falls back to defaults)', () => {
		setPageUrl('http://localhost/arnold-cat/compare');
		const { container } = render(ArnoldCatComparePage);
		expect(container.querySelector('#left-pointCount')).not.toBeNull();
		expect(container.querySelector('#right-pointCount')).not.toBeNull();
	});

	// ── Slider interactions ───────────────────────────────────────────────

	it('updates left pointCount slider value on input', async () => {
		const { container } = render(ArnoldCatComparePage);
		const leftPointCount = container.querySelector('#left-pointCount') as HTMLInputElement;
		await fireEvent.input(leftPointCount, { target: { value: '5000' } });
		expect(Number(leftPointCount.value)).toBe(5000);
	});

	it('updates right speed slider value on input', async () => {
		const { container } = render(ArnoldCatComparePage);
		const rightSpeed = container.querySelector('#right-speed') as HTMLInputElement;
		await fireEvent.input(rightSpeed, { target: { value: '7' } });
		expect(Number(rightSpeed.value)).toBe(7);
	});

	it('updates left speed slider value on input', async () => {
		const { container } = render(ArnoldCatComparePage);
		const leftSpeed = container.querySelector('#left-speed') as HTMLInputElement;
		await fireEvent.input(leftSpeed, { target: { value: '9' } });
		expect(Number(leftSpeed.value)).toBe(9);
	});

	it('updates URL via goto when a left parameter changes', async () => {
		vi.useFakeTimers();
		const { container } = render(ArnoldCatComparePage);
		const leftPointCount = container.querySelector('#left-pointCount') as HTMLInputElement;
		await fireEvent.input(leftPointCount, { target: { value: '5000' } });
		vi.advanceTimersByTime(400);
		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('updates URL via goto when a right parameter changes', async () => {
		vi.useFakeTimers();
		const { container } = render(ArnoldCatComparePage);
		const rightSpeed = container.querySelector('#right-speed') as HTMLInputElement;
		await fireEvent.input(rightSpeed, { target: { value: '8' } });
		vi.advanceTimersByTime(400);
		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	// ── Swap ──────────────────────────────────────────────────────────────

	it('swaps left and right parameters via the Swap button', async () => {
		const leftParams = encodeParams({ pointCount: 5000, speed: 3 });
		const rightParams = encodeParams({ pointCount: 1000, speed: 7 });
		setPageUrl(
			`http://localhost/arnold-cat/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);
		const { container } = render(ArnoldCatComparePage);
		const leftPointCount = container.querySelector('#left-pointCount') as HTMLInputElement;
		const rightPointCount = container.querySelector('#right-pointCount') as HTMLInputElement;
		// Before swap: left=5000, right=1000
		expect(Number(leftPointCount.value)).toBe(5000);
		expect(Number(rightPointCount.value)).toBe(1000);

		await fireEvent.click(screen.getByRole('button', { name: /Swap/i }));

		// After swap: left=1000, right=5000
		await waitFor(() => {
			expect(
				Number((container.querySelector('#left-pointCount') as HTMLInputElement).value)
			).toBe(1000);
			expect(
				Number((container.querySelector('#right-pointCount') as HTMLInputElement).value)
			).toBe(5000);
		});
	});

	// ── Reactive URL updates ───────────────────────────────────────────────

	it('updates slider values when $page.url changes after mount', async () => {
		const { container } = render(ArnoldCatComparePage);
		const leftPointCount = container.querySelector('#left-pointCount') as HTMLInputElement;
		// Default render: left pointCount is 3000
		expect(Number(leftPointCount.value)).toBe(3000);

		// Simulate browser back/forward or same-route navigation
		const leftParams = encodeParams({ pointCount: 7000, speed: 12 });
		const rightParams = encodeParams({ pointCount: 2000, speed: 8 });
		setPageUrl(
			`http://localhost/arnold-cat/compare?compare=true&left=${leftParams}&right=${rightParams}`
		);

		await waitFor(() => {
			expect(
				Number((container.querySelector('#left-pointCount') as HTMLInputElement).value)
			).toBe(7000);
			expect(Number((container.querySelector('#left-speed') as HTMLInputElement).value)).toBe(
				12
			);
			expect(
				Number((container.querySelector('#right-pointCount') as HTMLInputElement).value)
			).toBe(2000);
			expect(
				Number((container.querySelector('#right-speed') as HTMLInputElement).value)
			).toBe(8);
		});
	});

	it('clamps out-of-range params when $page.url changes after mount', async () => {
		const { container } = render(ArnoldCatComparePage);

		const leftParams = encodeParams({ pointCount: 99999, speed: 50 });
		setPageUrl(`http://localhost/arnold-cat/compare?compare=true&left=${leftParams}`);

		await waitFor(() => {
			const leftPointCount = container.querySelector('#left-pointCount') as HTMLInputElement;
			const leftSpeed = container.querySelector('#left-speed') as HTMLInputElement;
			expect(Number(leftPointCount.value)).toBe(10000);
			expect(Number(leftSpeed.value)).toBe(30);
		});
	});

	// ── Cleanup ───────────────────────────────────────────────────────────

	it('cleans up on unmount without throwing', () => {
		const { unmount } = render(ArnoldCatComparePage);
		expect(() => unmount()).not.toThrow();
	});
});
