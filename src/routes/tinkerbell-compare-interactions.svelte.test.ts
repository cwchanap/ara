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
});
