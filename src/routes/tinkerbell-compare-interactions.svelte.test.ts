import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import TinkerbellComparePage from './tinkerbell/compare/+page.svelte';

const mockGoto = vi.hoisted(() => vi.fn());

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/tinkerbell/compare?compare=true') as Page['url'],
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

vi.mock('$app/stores', () => ({ page: { subscribe: pageStore.subscribe } }));
vi.mock('$app/paths', () => ({ base: '' }));
vi.mock('$app/navigation', () => ({ goto: mockGoto }));
vi.mock('$lib/components/visualizations/TinkerbellRenderer.svelte', async () => {
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

describe('Tinkerbell compare page interactions', () => {
	beforeEach(() => {
		setPageUrl('http://localhost/tinkerbell/compare?compare=true');
	});

	afterEach(() => {
		cleanup();
		mockGoto.mockClear();
	});

	it('renders both parameter panels with defaults when no encoded state', () => {
		render(TinkerbellComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeTruthy();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeTruthy();
	});

	it('encodes a comparison URL when a left slider changes', async () => {
		const { fireEvent, waitFor } = await import('@testing-library/svelte');
		render(TinkerbellComparePage);
		// The left-a slider; fall back to id lookup if display-value match is ambiguous.
		let slider: HTMLInputElement;
		try {
			slider = screen.getByDisplayValue('0.9') as HTMLInputElement;
		} catch {
			slider = document.getElementById('left-a') as HTMLInputElement;
		}
		await fireEvent.input(slider, { target: { value: '1.5' } });
		await waitFor(() => expect(mockGoto).toHaveBeenCalled());
		const call = mockGoto.mock.calls[0][0] as string;
		expect(call).toContain('/tinkerbell/compare?');
	});

	it('decodes an encoded left side into the left panel', () => {
		const left = encodeParams({
			type: 'tinkerbell',
			a: -1.2,
			b: 0.4,
			c: 1.9,
			d: 0.3,
			iterations: 100000
		});
		setPageUrl(`http://localhost/tinkerbell/compare?compare=true&left=${left}`);
		render(TinkerbellComparePage);
		expect(mockGoto).not.toHaveBeenCalled();
		// Verify the decoded a=-1.2 actually reaches the left-a slider, not just
		// that no navigation occurred.
		const leftA = document.getElementById('left-a') as HTMLInputElement;
		expect(leftA).toBeTruthy();
		expect(leftA.value).toBe('-1.2');
	});

	it('decodes an encoded right side into the right panel', () => {
		const right = encodeParams({
			type: 'tinkerbell',
			a: 1.7,
			b: -0.3,
			c: 0.9,
			d: -0.4,
			iterations: 80000
		});
		setPageUrl(`http://localhost/tinkerbell/compare?compare=true&right=${right}`);
		render(TinkerbellComparePage);
		const rightA = document.getElementById('right-a') as HTMLInputElement;
		expect(rightA).toBeTruthy();
		expect(rightA.value).toBe('1.7');
	});

	it('encodes a comparison URL when a right slider changes', async () => {
		const { fireEvent, waitFor } = await import('@testing-library/svelte');
		render(TinkerbellComparePage);
		const slider = document.getElementById('right-a') as HTMLInputElement;
		expect(slider).toBeTruthy();
		await fireEvent.input(slider, { target: { value: '-2.1' } });
		await waitFor(() => expect(mockGoto).toHaveBeenCalled());
		const call = mockGoto.mock.calls[0][0] as string;
		expect(call).toContain('/tinkerbell/compare?');
	});

	it('clamps an out-of-range decoded left value back into the stable range', () => {
		// a stable range is [-3, 3]; send 50 → clamped to 3.
		const left = encodeParams({
			type: 'tinkerbell',
			a: 50,
			b: 0.4,
			c: 1.9,
			d: 0.3,
			iterations: 100000
		});
		setPageUrl(`http://localhost/tinkerbell/compare?compare=true&left=${left}`);
		render(TinkerbellComparePage);
		const leftA = document.getElementById('left-a') as HTMLInputElement;
		expect(leftA.value).toBe('3');
	});

	it('falls back to default when a decoded value is non-finite', () => {
		// Non-finite a → clampValue returns the default (0.9).
		const left = encodeParams({
			type: 'tinkerbell',
			a: 'not-a-number',
			b: 0.4,
			c: 1.9,
			d: 0.3,
			iterations: 100000
		});
		setPageUrl(`http://localhost/tinkerbell/compare?compare=true&left=${left}`);
		render(TinkerbellComparePage);
		const leftA = document.getElementById('left-a') as HTMLInputElement;
		expect(leftA.value).toBe('0.9');
	});

	it('renders the equation snippet in both panels', () => {
		render(TinkerbellComparePage);
		// The Tinkerbell map equations appear once per panel.
		const equations = screen.getAllByText(/x\(n\+1\) = x\(n\)²/);
		expect(equations.length).toBe(2);
	});
});
