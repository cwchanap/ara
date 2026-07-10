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

	it('ignores a loaded config whose type is not tinkerbell', async () => {
		// onExtraParametersLoaded guards on p.type !== 'tinkerbell' and returns
		// early, leaving the page state at the default classic preset.
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'lorenz',
				sigma: 99,
				rho: 99,
				beta: 99
			}
		});
		setPageUrl('http://localhost/tinkerbell?config=wrong-type');
		render(TinkerbellPage, { data: unauthedData });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalled();
		});
		// The default a=0.9 must remain unchanged (wrong type was ignored).
		expect(screen.getByTestId('value-a').textContent).toBe('0.90');
	});

	it('applies a preset when its button is clicked', async () => {
		render(TinkerbellPage, { data: unauthedData });
		// Default is 'classic' (a=0.9). Click the 'delicate' preset (a=-0.71).
		const delicateBtn = screen.getByRole('button', { name: 'Delicate' });
		await fireEvent.click(delicateBtn);
		await waitFor(() => {
			expect(screen.getByTestId('value-a').textContent).toBe('-0.71');
		});
		// The active preset label should update to the preset's label.
		expect(screen.getByTestId('active-preset').textContent).toContain('Delicate');
	});

	it('marks the active preset button as pressed', async () => {
		render(TinkerbellPage, { data: unauthedData });
		const classicBtn = screen.getByRole('button', { name: 'Classic' });
		expect(classicBtn).toHaveAttribute('aria-pressed', 'true');
	});

	it('disables point size and opacity sliders in density color mode', async () => {
		render(TinkerbellPage, { data: unauthedData });
		// Default colorMode is density → both sliders disabled.
		expect(screen.getByTestId('slider-pointSize')).toBeDisabled();
		expect(screen.getByTestId('slider-opacity')).toBeDisabled();

		// Switch to iteration mode → both sliders enabled.
		const select = screen.getByTestId('select-color-mode') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'iteration' } });
		expect(screen.getByTestId('slider-pointSize')).toBeEnabled();
		expect(screen.getByTestId('slider-opacity')).toBeEnabled();
	});

	it('changes the color mode via the select control', async () => {
		render(TinkerbellPage, { data: unauthedData });
		const select = screen.getByTestId('select-color-mode') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'radius' } });
		expect(select.value).toBe('radius');
	});

	it('keeps current styling when a loaded config omits colorMode/zoom/pointSize/opacity', async () => {
		// Exercises the ?? fallbacks in onExtraParametersLoaded: a legacy config
		// that only carries shape params must keep the page's current (default)
		// styling rather than setting them to undefined.
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'tinkerbell',
				a: -0.5,
				b: 0.8,
				c: 1.2,
				d: -0.2,
				iterations: 50000
			}
		});
		setPageUrl('http://localhost/tinkerbell?config=partial-config');
		render(TinkerbellPage, { data: unauthedData });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalled();
		});
		// Shape param from config is applied.
		await waitFor(() => {
			expect(screen.getByTestId('value-a').textContent).toBe('-0.50');
		});
		// Styling keeps the default values — colorMode stays 'density', not
		// undefined from the missing config field.
		const select = screen.getByTestId('select-color-mode') as HTMLSelectElement;
		expect(select.value).toBe('density');
		expect(screen.getByTestId('slider-pointSize')).toBeDisabled();
	});

	it('shows CUSTOM preset label after randomize produces a non-preset state', async () => {
		// Exercises the activePresetLabel derived value's false branch
		// (activePresetId is null → 'CUSTOM').
		render(TinkerbellPage, { data: unauthedData });
		expect(screen.getByTestId('active-preset').textContent).toContain('Classic');

		// Randomize until the state no longer matches any preset.
		let label = 'Classic';
		for (let i = 0; i < 20 && !label.includes('CUSTOM'); i++) {
			await fireEvent.click(screen.getByTestId('btn-randomize'));
			label = screen.getByTestId('active-preset').textContent ?? '';
		}
		expect(label).toContain('CUSTOM');
	});

	it('fires the debounced stability check on mount (exercises getParams callback)', async () => {
		// The page registers a reactive stability reporter whose getParams
		// callback (line 78: () => buildParameters()) is only called when
		// the debounced check runs. Wait past the 300ms debounce so the
		// callback is exercised.
		render(TinkerbellPage, { data: unauthedData });
		// Wait for the DEBOUNCE_MS (300) stability debounce to fire.
		await new Promise((r) => setTimeout(r, 400));
		// The page should still be rendered correctly after the check.
		expect(screen.getByText('TINKERBELL_MAP')).toBeTruthy();
	});
});
