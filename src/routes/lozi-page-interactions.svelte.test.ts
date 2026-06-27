import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	authedPageProps,
	resetMockPageStore,
	restoreFetch,
	setMockPageUrl,
	setupApiFetchMock
} from '$lib/components/testing/page-test-helpers';
import LoziPage from './lozi/+page.svelte';

vi.mock('$app/stores', async () => {
	const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
	return { page: mockPageStore };
});

vi.mock('$app/paths', async () => {
	const { BASE_PATH } = await import('$lib/components/testing/page-test-helpers');
	return { base: BASE_PATH };
});

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/components/ui/SaveConfigDialog.svelte', async () => {
	const module = await import('$lib/components/testing/DialogStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/ui/ShareDialog.svelte', async () => {
	const module = await import('$lib/components/testing/DialogStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/ui/SnapshotButton.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/LoziRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});
vi.mock('$lib/components/ui/VisualizationAlerts.svelte', async () => {
	const module = await import('$lib/components/testing/VisualizationAlertsStub.svelte');
	return { default: module.default };
});

describe('Lozi page interactions', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setupApiFetchMock();
	});

	afterEach(() => {
		vi.useRealTimers();
		restoreFetch();
		resetMockPageStore();
		cleanup();
	});

	it('renders correctly and has title', () => {
		setMockPageUrl('http://localhost/lozi');
		render(LoziPage, { props: authedPageProps });
		expect(screen.getByText('LOZI_MAP')).toBeInTheDocument();
	});

	it('handles slider parameter updates (a, b, iterations)', async () => {
		setMockPageUrl('http://localhost/lozi');
		const { container } = render(LoziPage, { props: authedPageProps });

		const aSlider = container.querySelector('input[id="a"]') as HTMLInputElement;
		await fireEvent.input(aSlider, { target: { value: '1.5' } });
		expect(screen.getByText('1.500')).toBeInTheDocument();

		const bSlider = container.querySelector('input[id="b"]') as HTMLInputElement;
		await fireEvent.input(bSlider, { target: { value: '0.4' } });
		expect(screen.getByText('0.400')).toBeInTheDocument();

		const iterationsSlider = container.querySelector(
			'input[id="iterations"]'
		) as HTMLInputElement;
		await fireEvent.input(iterationsSlider, { target: { value: '5000' } });
		expect(screen.getByText('5000')).toBeInTheDocument();
	});

	it('shows save and share dialogs, calls handleSave and handleShare callbacks', async () => {
		setMockPageUrl('http://localhost/lozi');
		render(LoziPage, { props: authedPageProps });

		const saveTriggerBtn = screen.getByRole('button', { name: /Save/i });
		await fireEvent.click(saveTriggerBtn);

		const dialogSaveBtn = screen.getByTestId('dialog-save-lozi');
		await fireEvent.click(dialogSaveBtn);
		expect(global.fetch).toHaveBeenCalledWith('/api/save-config', expect.any(Object));

		const shareTriggerBtn = screen.getByRole('button', { name: /Share/i });
		await fireEvent.click(shareTriggerBtn);

		const dialogShareBtn = screen.getByTestId('dialog-share-lozi');
		await fireEvent.click(dialogShareBtn);
		expect(global.fetch).toHaveBeenCalledWith('/api/share', expect.any(Object));
	});
});
