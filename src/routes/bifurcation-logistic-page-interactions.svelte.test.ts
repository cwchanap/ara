import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	authedPageProps,
	resetMockPageStore,
	restoreFetch,
	setMockPageUrl,
	setupApiFetchMock
} from '$lib/components/testing/page-test-helpers';
import BifurcationLogisticPage from './bifurcation-logistic/+page.svelte';

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

vi.mock('$lib/components/visualizations/BifurcationLogisticRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});
vi.mock('$lib/components/ui/VisualizationAlerts.svelte', async () => {
	const module = await import('$lib/components/testing/VisualizationAlertsStub.svelte');
	return { default: module.default };
});

describe('Bifurcation Logistic page interactions', () => {
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
		setMockPageUrl('http://localhost/bifurcation-logistic');
		render(BifurcationLogisticPage, { props: authedPageProps });
		expect(screen.getByText('LOGISTIC_BIFURCATION')).toBeInTheDocument();
	});

	it('handles slider parameter updates (rMin, rMax, maxIterations)', async () => {
		setMockPageUrl('http://localhost/bifurcation-logistic');
		render(BifurcationLogisticPage, { props: authedPageProps });

		const rMinSlider = screen.getByLabelText(/r min/i);
		await fireEvent.input(rMinSlider, { target: { value: '3.6' } });
		expect(screen.getByText('3.600')).toBeInTheDocument();

		const rMaxSlider = screen.getByLabelText(/r max/i);
		await fireEvent.input(rMaxSlider, { target: { value: '3.9' } });
		expect(screen.getByText('3.900')).toBeInTheDocument();

		const iterationsSlider = screen.getByLabelText(/Iterations/i);
		await fireEvent.input(iterationsSlider, { target: { value: '500' } });
		expect(screen.getByText('500')).toBeInTheDocument();
	});

	it('shows save and share dialogs, calls handleSave and handleShare callbacks', async () => {
		setMockPageUrl('http://localhost/bifurcation-logistic');
		render(BifurcationLogisticPage, { props: authedPageProps });

		const saveTriggerBtn = screen.getByRole('button', { name: /Save/i });
		await fireEvent.click(saveTriggerBtn);

		const dialogSaveBtn = screen.getByTestId('dialog-save-bifurcation-logistic');
		await fireEvent.click(dialogSaveBtn);
		expect(global.fetch).toHaveBeenCalledWith('/api/save-config', expect.any(Object));

		const shareTriggerBtn = screen.getByRole('button', { name: /Share/i });
		await fireEvent.click(shareTriggerBtn);

		const dialogShareBtn = screen.getByTestId('dialog-share-bifurcation-logistic');
		await fireEvent.click(dialogShareBtn);
		expect(global.fetch).toHaveBeenCalledWith('/api/share', expect.any(Object));
	});
});
