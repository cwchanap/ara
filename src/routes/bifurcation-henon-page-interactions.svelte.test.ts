import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	authedPageProps,
	resetMockPageStore,
	restoreFetch,
	setMockPageUrl,
	setupApiFetchMock
} from '$lib/components/testing/page-test-helpers';
import BifurcationHenonPage from './bifurcation-henon/+page.svelte';

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

vi.mock('$lib/components/visualizations/BifurcationHenonRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

describe('Bifurcation Henon page interactions', () => {
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
		setMockPageUrl('http://localhost/bifurcation-henon');
		render(BifurcationHenonPage, { props: authedPageProps });
		expect(screen.getByText('HÉNON_BIFURCATION')).toBeInTheDocument();
	});

	it('handles slider parameter updates (aMin, aMax, b, maxIterations)', async () => {
		setMockPageUrl('http://localhost/bifurcation-henon');
		render(BifurcationHenonPage, { props: authedPageProps });

		const aMinSlider = screen.getByLabelText(/a min/i);
		await fireEvent.input(aMinSlider, { target: { value: '1.2' } });
		expect(screen.getAllByText('1.200')).toHaveLength(1);

		const aMaxSlider = screen.getByLabelText(/a max/i);
		await fireEvent.input(aMaxSlider, { target: { value: '1.3' } });
		expect(screen.getAllByText('1.300')).toHaveLength(1);

		const bSlider = screen.getByLabelText(/b/i);
		await fireEvent.input(bSlider, { target: { value: '0.4' } });
		expect(screen.getByText('0.400')).toBeInTheDocument();

		const iterationsSlider = screen.getByLabelText(/Iterations/i);
		await fireEvent.input(iterationsSlider, { target: { value: '500' } });
		expect(screen.getByText('500')).toBeInTheDocument();
	});

	it('shows save and share dialogs, calls handleSave and handleShare callbacks', async () => {
		setMockPageUrl('http://localhost/bifurcation-henon');
		render(BifurcationHenonPage, { props: authedPageProps });

		const saveTriggerBtn = screen.getByRole('button', { name: /Save/i });
		await fireEvent.click(saveTriggerBtn);

		const dialogSaveBtn = screen.getByTestId('dialog-save-bifurcation-henon');
		await fireEvent.click(dialogSaveBtn);
		expect(global.fetch).toHaveBeenCalledWith('/api/save-config', expect.any(Object));

		const shareTriggerBtn = screen.getByRole('button', { name: /Share/i });
		await fireEvent.click(shareTriggerBtn);

		const dialogShareBtn = screen.getByTestId('dialog-share-bifurcation-henon');
		await fireEvent.click(dialogShareBtn);
		expect(global.fetch).toHaveBeenCalledWith('/api/share', expect.any(Object));
	});
});
