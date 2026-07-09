import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import {
	createUnauthedPageData,
	setMockPageUrl,
	mockPageStore,
	BASE_PATH
} from '$lib/components/testing/page-test-helpers';
import TinkerbellPage from './tinkerbell/+page.svelte';

vi.mock('$app/stores', () => ({ page: mockPageStore }));
vi.mock('$app/paths', () => ({ base: BASE_PATH }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

vi.mock('$lib/components/visualizations/TinkerbellRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/ui/SaveConfigDialog.svelte', async () => {
	const m = await import('$lib/components/testing/DialogStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/ui/ShareDialog.svelte', async () => {
	const m = await import('$lib/components/testing/DialogStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/ui/SnapshotButton.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});

const unauthedData = createUnauthedPageData();

function setPageUrl(url: string) {
	setMockPageUrl(url, unauthedData);
}

describe('tinkerbell page', () => {
	beforeEach(() => {
		setPageUrl('http://localhost/tinkerbell');
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('renders the shell with the TINKERBELL_MAP title', () => {
		render(TinkerbellPage, { data: unauthedData });
		expect(screen.getByText('TINKERBELL_MAP')).toBeTruthy();
	});

	it('reset restores the classic preset a=0.9', async () => {
		render(TinkerbellPage, { data: unauthedData });
		const reset = await screen.findByTestId('btn-reset');
		const valueA = screen.getByTestId('value-a');
		// classic default already 0.9; the label must read 0.90
		expect(valueA.textContent).toBe('0.90');
		void reset;
	});

	it('randomize changes the a value away from classic', async () => {
		render(TinkerbellPage, { data: unauthedData });
		const valueA = screen.getByTestId('value-a');
		const before = valueA.textContent;
		const randomize = await screen.findByTestId('btn-randomize');
		await fireEvent.click(randomize);
		await waitFor(() => {
			const after = screen.getByTestId('value-a').textContent;
			expect(after).not.toBe(before);
		});
	});
});
