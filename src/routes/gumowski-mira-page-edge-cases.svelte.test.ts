/**
 * Edge-case tests for the Gumowski–Mira visualization page.
 * Covers branches that require mocking checkParameterStability or getPreset:
 * - applyPreset with an invalid preset id (line 90 guard)
 * - applyPreset with unstable parameters (lines 118-119)
 * - randomize producing unstable parameters (lines 141-142)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	createUnauthedPageData,
	resetMockPageStore,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import GumowskiMiraPage from './gumowski-mira/+page.svelte';

// Mock checkParameterStability so we can force the "unstable" branch.
const checkParameterStabilityMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/chaos-validation', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/chaos-validation')>();
	return {
		...actual,
		checkParameterStability: checkParameterStabilityMock
	};
});

// Mock getPreset so we can force the "preset not found" branch.
const getPresetMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/gumowski-mira-presets', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/gumowski-mira-presets')>();
	return {
		...actual,
		getPreset: getPresetMock
	};
});

vi.mock('$app/stores', async () => {
	const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
	return { page: mockPageStore };
});

vi.mock('$app/paths', async () => {
	const { BASE_PATH } = await import('$lib/components/testing/page-test-helpers');
	return { base: BASE_PATH };
});

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

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
// NOTE: VisualizationAlerts is intentionally NOT mocked here. These edge-case
// tests verify the full stabilityReporter → VisualizationShell →
// VisualizationAlerts forwarding path, so the real component must render the
// warning text into the DOM.
vi.mock('$lib/components/visualizations/GumowskiMiraRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

describe('gumowski-mira page – edge cases', () => {
	beforeEach(() => {
		resetMockPageStore('http://localhost/gumowski-mira', createUnauthedPageData());
		checkParameterStabilityMock.mockReset();
		getPresetMock.mockReset();

		// Default: use the real presets for getPreset (passthrough).
		// We import the real module to get the actual preset data.
	});

	afterEach(() => cleanup());

	it('applyPreset returns early when preset id is not found', async () => {
		// Import the real presets so the page can initialize with the default.
		const { GUMOWSKI_MIRA_PRESETS, DEFAULT_GUMOWSKI_MIRA_PRESET_ID } = await import(
			'$lib/gumowski-mira-presets'
		);
		// getPreset returns the real preset for the default id (needed for init),
		// but returns undefined for 'ordered-curves' to exercise the guard.
		getPresetMock.mockImplementation((id: string) => {
			if (id === DEFAULT_GUMOWSKI_MIRA_PRESET_ID) {
				return GUMOWSKI_MIRA_PRESETS.find((p) => p.id === id);
			}
			return undefined;
		});
		// checkParameterStability returns stable by default.
		checkParameterStabilityMock.mockReturnValue({ isStable: true, warnings: [] });

		render(GumowskiMiraPage, { props: unauthedPageProps });

		// Click the "Ordered Curves" preset button — getPreset returns undefined,
		// so applyPreset should return early without changing any parameters.
		const btn = screen.getByRole('button', { name: /Ordered Curves/i });
		await fireEvent.click(btn);

		// The active preset should still be the default (Island Structure),
		// not "Ordered Curves", because applyPreset returned early.
		expect(screen.getByTestId('active-preset').textContent).toMatch(/island structure/i);
	});

	it('applyPreset shows stability warning when preset parameters are unstable', async () => {
		const { GUMOWSKI_MIRA_PRESETS } = await import('$lib/gumowski-mira-presets');
		getPresetMock.mockImplementation((id: string) =>
			GUMOWSKI_MIRA_PRESETS.find((p) => p.id === id)
		);

		// checkParameterStability returns unstable for all calls.
		// The reactive stability effect calls it (debounced) after the
		// preset mutates the page-owned $state.
		checkParameterStabilityMock.mockReturnValue({
			isStable: false,
			warnings: ['mu out of range']
		});

		vi.useFakeTimers();
		try {
			render(GumowskiMiraPage, { props: unauthedPageProps });

			// Click a preset — the reactive effect triggers the debounced
			// stability check.
			const btn = screen.getByRole('button', { name: /Ordered Curves/i });
			await fireEvent.click(btn);
			await vi.advanceTimersByTimeAsync(300);

			// The preset should be applied (active preset changes)...
			expect(screen.getByTestId('active-preset').textContent).toMatch(/ordered curves/i);
			// ...and checkParameterStability should have been called.
			expect(checkParameterStabilityMock).toHaveBeenCalled();
			// ...and the mocked warning text must flow through the stabilityReporter
			// → VisualizationShell → VisualizationAlerts path into the DOM.
			expect(screen.getByRole('alert')).toBeTruthy();
			expect(screen.getByText('mu out of range')).toBeTruthy();
		} finally {
			vi.useRealTimers();
		}
	});

	it('randomize shows stability warning when random params are unstable', async () => {
		const { GUMOWSKI_MIRA_PRESETS } = await import('$lib/gumowski-mira-presets');
		getPresetMock.mockImplementation((id: string) =>
			GUMOWSKI_MIRA_PRESETS.find((p) => p.id === id)
		);

		// checkParameterStability returns unstable for all calls.
		// The reactive stability effect calls it (debounced) after randomize
		// mutates the page-owned $state.
		checkParameterStabilityMock.mockReturnValue({
			isStable: false,
			warnings: ['Parameters unstable']
		});

		vi.useFakeTimers();
		try {
			render(GumowskiMiraPage, { props: unauthedPageProps });

			// Click the Randomize button — the reactive effect triggers the
			// debounced stability check.
			await fireEvent.click(screen.getByTestId('randomize-button'));
			await vi.advanceTimersByTimeAsync(300);

			// checkParameterStability should have been called.
			expect(checkParameterStabilityMock).toHaveBeenCalled();
			// ...and the mocked warning text must flow through the stabilityReporter
			// → VisualizationShell → VisualizationAlerts path into the DOM.
			expect(screen.getByRole('alert')).toBeTruthy();
			expect(screen.getByText('Parameters unstable')).toBeTruthy();
		} finally {
			vi.useRealTimers();
		}
	});
});
