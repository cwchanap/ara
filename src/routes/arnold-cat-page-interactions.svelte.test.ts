/**
 * Page-interaction and config-loading tests for the Arnold Cat Map visualization page.
 * Covers slider/button interactions, stability reporting, and config loading
 * (onExtraParametersLoaded) — the branches excluded by the renderer-stubbed
 * interaction test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import {
	createUnauthedPageData,
	resetMockPageStore,
	setMockPageUrl,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import ArnoldCatPage from './arnold-cat/+page.svelte';

// --- Mocks for saved-config-loader ---
const loadSavedConfigParametersMock = vi.hoisted(() => vi.fn());
const loadSharedConfigParametersMock = vi.hoisted(() => vi.fn());
const parseConfigParamMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: loadSavedConfigParametersMock,
	loadSharedConfigParameters: loadSharedConfigParametersMock,
	parseConfigParam: parseConfigParamMock
}));

vi.mock('$app/stores', async () => {
	const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
	return { page: mockPageStore };
});

vi.mock('$app/paths', async () => {
	const { BASE_PATH } = await import('$lib/components/testing/page-test-helpers');
	return { base: BASE_PATH };
});

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

// --- Dialog / UI stubs ---
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
vi.mock('$lib/components/ui/VisualizationAlerts.svelte', async () => {
	const m = await import('$lib/components/testing/VisualizationAlertsStub.svelte');
	return { default: m.default };
});

vi.mock('$lib/components/visualizations/ArnoldCatRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

const unauthedData = createUnauthedPageData();

function setPageUrl(url: string) {
	setMockPageUrl(url, unauthedData);
}

describe('Arnold Cat Map page interactions', () => {
	beforeEach(() => {
		resetMockPageStore('http://localhost/arnold-cat', unauthedData);
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => cleanup());

	// ── Basic rendering ────────────────────────────────────────────────────

	it('renders the ARNOLD_CAT_MAP header', () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		expect(screen.getByRole('heading', { level: 1, name: /ARNOLD_CAT_MAP/i })).toBeTruthy();
	});

	it('renders the pointCount and speed sliders', () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		expect(screen.getByTestId('slider-pointCount')).toBeTruthy();
		expect(screen.getByTestId('slider-speed')).toBeTruthy();
	});

	it('displays default pointCount value of 3000', () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		expect(screen.getByTestId('value-pointCount').textContent).toBe('3000');
	});

	it('displays default speed value of 5', () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		expect(screen.getByTestId('value-speed').textContent).toBe('5');
	});

	it('renders the control buttons', () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		expect(screen.getByTestId('btn-pause')).toBeTruthy();
		expect(screen.getByTestId('btn-step')).toBeTruthy();
		expect(screen.getByTestId('btn-reset')).toBeTruthy();
		expect(screen.getByTestId('btn-randomize')).toBeTruthy();
	});

	it('renders the recurrence equations and data log', () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		expect(screen.getByText(/x' = \(x \+ y\) mod 1/i)).toBeTruthy();
		expect(screen.getByText(/DATA_LOG: ARNOLD_CAT_MAP/i)).toBeTruthy();
	});

	it('renders Compare / Return links and Share / Save buttons', () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		expect(screen.getByRole('link', { name: /Compare/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /Return/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Share/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Save/i })).toBeTruthy();
	});

	// ── Slider interactions ───────────────────────────────────────────────

	it('updates pointCount when the slider changes', async () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		const slider = screen.getByTestId('slider-pointCount') as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '5000' } });
		expect(screen.getByTestId('value-pointCount').textContent).toBe('5000');
	});

	it('updates speed when the slider changes', async () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		const slider = screen.getByTestId('slider-speed') as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '7' } });
		expect(screen.getByTestId('value-speed').textContent).toBe('7');
	});

	// ── Button interactions ───────────────────────────────────────────────

	it('toggles paused state when Pause button is clicked', async () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		const pauseBtn = screen.getByTestId('btn-pause');
		expect(pauseBtn.textContent).toMatch(/Pause/i);
		await fireEvent.click(pauseBtn);
		expect(pauseBtn.textContent).toMatch(/Resume/i);
		// Click again to resume
		await fireEvent.click(pauseBtn);
		expect(pauseBtn.textContent).toMatch(/Pause/i);
	});

	it('disables Step button when not paused', () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		const stepBtn = screen.getByTestId('btn-step') as HTMLButtonElement;
		expect(stepBtn.disabled).toBe(true);
	});

	it('enables Step button when paused', async () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByTestId('btn-pause'));
		const stepBtn = screen.getByTestId('btn-step') as HTMLButtonElement;
		expect(stepBtn.disabled).toBe(false);
	});

	it('clicks Step button without crashing when paused', async () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByTestId('btn-pause'));
		const stepBtn = screen.getByTestId('btn-step');
		await fireEvent.click(stepBtn);
		// No crash = pass
	});

	it('clicks Reset button without crashing', async () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByTestId('btn-reset'));
		// No crash = pass
	});

	it('clicks Randomize button without crashing', async () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByTestId('btn-randomize'));
		// No crash = pass
	});

	// ── Dialog interactions ───────────────────────────────────────────────

	it('opens and closes the save dialog', async () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
		expect(screen.getByTestId('dialog-stub-arnold-cat')).toBeTruthy();
		await fireEvent.click(screen.getByTestId('dialog-close-arnold-cat'));
		expect(screen.queryByTestId('dialog-stub-arnold-cat')).toBeNull();
	});

	it('opens the share dialog when Share button is clicked', async () => {
		render(ArnoldCatPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByRole('button', { name: /Share/i }));
		expect(screen.getByTestId('dialog-stub-arnold-cat')).toBeTruthy();
	});

	// ── Cleanup ───────────────────────────────────────────────────────────

	it('cleans up on unmount without throwing', () => {
		const { unmount } = render(ArnoldCatPage, { props: unauthedPageProps });
		expect(() => unmount()).not.toThrow();
	});
});

describe('Arnold Cat Map page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
		setPageUrl('http://localhost/arnold-cat');
	});

	afterEach(() => cleanup());

	it('loads config from configId and applies arnold-cat parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'arnold-cat',
				pointCount: 7000,
				speed: 12
			},
			source: 'api'
		});

		setPageUrl('http://localhost/arnold-cat?configId=arnold-cat-id-1');
		render(ArnoldCatPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'arnold-cat-id-1', mapType: 'arnold-cat' })
			);
		});

		// The loaded parameters should be applied to the sliders
		await waitFor(() => {
			expect(screen.getByTestId('value-pointCount').textContent).toBe('7000');
			expect(screen.getByTestId('value-speed').textContent).toBe('12');
		});
	});

	it('loads config from config URL param and applies parameters', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'arnold-cat',
				pointCount: 4000,
				speed: 8
			}
		});

		setPageUrl('http://localhost/arnold-cat?config=encoded-config-data');
		render(ArnoldCatPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith({
				mapType: 'arnold-cat',
				configParam: 'encoded-config-data'
			});
		});

		await waitFor(() => {
			expect(screen.getByTestId('value-pointCount').textContent).toBe('4000');
			expect(screen.getByTestId('value-speed').textContent).toBe('8');
		});
	});

	it('clamps out-of-range config parameters to stable ranges', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'arnold-cat',
				pointCount: 99999,
				speed: 50
			},
			source: 'api'
		});

		setPageUrl('http://localhost/arnold-cat?configId=arnold-cat-id-2');
		render(ArnoldCatPage, { props: unauthedPageProps });

		// pointCount 99999 → clamped to 10000; speed 50 → clamped to 30
		await waitFor(() => {
			expect(screen.getByTestId('value-pointCount').textContent).toBe('10000');
			expect(screen.getByTestId('value-speed').textContent).toBe('30');
		});
	});

	it('clamps below-range config parameters to stable ranges', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'arnold-cat',
				pointCount: 10,
				speed: 0
			},
			source: 'api'
		});

		setPageUrl('http://localhost/arnold-cat?configId=arnold-cat-id-3');
		render(ArnoldCatPage, { props: unauthedPageProps });

		// pointCount 10 → clamped to 100; speed 0 → clamped to 1
		await waitFor(() => {
			expect(screen.getByTestId('value-pointCount').textContent).toBe('100');
			expect(screen.getByTestId('value-speed').textContent).toBe('1');
		});
	});

	it('handles NaN config parameters by falling back to min', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'arnold-cat',
				pointCount: NaN,
				speed: NaN
			},
			source: 'api'
		});

		setPageUrl('http://localhost/arnold-cat?configId=arnold-cat-id-4');
		render(ArnoldCatPage, { props: unauthedPageProps });

		// NaN → clampInt returns min: pointCount 100, speed 1
		await waitFor(() => {
			expect(screen.getByTestId('value-pointCount').textContent).toBe('100');
			expect(screen.getByTestId('value-speed').textContent).toBe('1');
		});
	});

	it('ignores config parameters for a different map type', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'lorenz',
				sigma: 10,
				rho: 28,
				beta: 2.667
			},
			source: 'api'
		});

		setPageUrl('http://localhost/arnold-cat?configId=arnold-cat-id-5');
		render(ArnoldCatPage, { props: unauthedPageProps });

		// onExtraParametersLoaded checks p.type !== 'arnold-cat' and returns early.
		// Default values should remain.
		await waitFor(() => {
			expect(screen.getByTestId('value-pointCount').textContent).toBe('3000');
			expect(screen.getByTestId('value-speed').textContent).toBe('5');
		});
	});

	it('renders without crashing when config load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Config not found'
		});

		setPageUrl('http://localhost/arnold-cat?configId=nonexistent');
		render(ArnoldCatPage, { props: unauthedPageProps });

		// Default values should remain
		await waitFor(() => {
			expect(screen.getByTestId('value-pointCount').textContent).toBe('3000');
		});
	});
});
