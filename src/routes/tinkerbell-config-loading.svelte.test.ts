import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import {
	createUnauthedPageData,
	setMockPageUrl,
	mockPageStore,
	BASE_PATH
} from '$lib/components/testing/page-test-helpers';
import TinkerbellPage from './tinkerbell/+page.svelte';

// Mock parseConfigParam so an inline ?config= payload exercises the shell's
// onExtraParametersLoaded callback (the path at +page.svelte:98-109).
const parseConfigParamMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/saved-config-loader', () => ({
	parseConfigParam: parseConfigParamMock
}));

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
		parseConfigParamMock.mockReset();
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
		const randomize = await screen.findByTestId('btn-randomize');
		await fireEvent.click(randomize);
		const reset = await screen.findByTestId('btn-reset');
		await fireEvent.click(reset);
		const valueA = screen.getByTestId('value-a');
		expect(valueA.textContent).toBe('0.90');
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

	it('applies an inline ?config= payload via onExtraParametersLoaded', async () => {
		// Exercises the onExtraParametersLoaded path (+page.svelte:98-109):
		// the shell parses the ?config= param and calls the page's callback,
		// which must push the loaded shape + styling params into page $state.
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'tinkerbell',
				a: -1.5,
				b: -0.5,
				c: 1.8,
				d: -0.6,
				iterations: 200000,
				colorMode: 'angle',
				zoom: 2,
				pointSize: 3,
				opacity: 0.3
			}
		});
		setPageUrl('http://localhost/tinkerbell?config=encoded-payload');
		render(TinkerbellPage, { data: unauthedData });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'tinkerbell', configParam: 'encoded-payload' })
			);
		});
		// The loaded a=-1.5 must reach the slider and value label.
		await waitFor(() => {
			const slider = screen.getByTestId('slider-a') as HTMLInputElement;
			expect(slider.value).toBe('-1.5');
		});
		expect(screen.getByTestId('value-a').textContent).toBe('-1.50');
	});
});
