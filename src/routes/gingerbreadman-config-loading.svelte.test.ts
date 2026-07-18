/**
 * Config-loading tests for the Gingerbreadman visualization page.
 * Covers configId / share / inline ?config= load paths, type guard, clamping
 * of out-of-range x0/y0/iterations, partial styling fallbacks, error handling,
 * and stability warnings.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import {
	setMockPageUrl,
	createUnauthedPageData,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import GingerbreadmanPage from './gingerbreadman/+page.svelte';

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
// NOTE: VisualizationAlerts is NOT mocked — assert config-error / stability alerts.
vi.mock('$lib/components/visualizations/GingerbreadmanRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

const unauthedData = createUnauthedPageData();

function setPageUrl(url: string) {
	setMockPageUrl(url, unauthedData);
}

describe('gingerbreadman page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
		setPageUrl('http://localhost/gingerbreadman');
	});

	afterEach(() => cleanup());

	it('renders the shell with the GINGERBREADMAN_MAP title', () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		expect(screen.getByText('GINGERBREADMAN_MAP')).toBeTruthy();
	});

	it('loads config from configId and applies parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'gingerbreadman',
				x0: -0.75,
				y0: 0.1,
				iterations: 120000,
				colorMode: 'radius',
				zoom: 2,
				pointSize: 3,
				opacity: 0.8
			},
			source: 'api'
		});

		setPageUrl('http://localhost/gingerbreadman?configId=gbm-id-1');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'gbm-id-1', mapType: 'gingerbreadman' })
			);
		});

		await waitFor(() => {
			const x0 = screen.getByTestId('slider-x0') as HTMLInputElement;
			expect(x0.value).toBe('-0.75');
		});
		expect(screen.getByTestId('value-x0').textContent).toBe('-0.75');
		expect(screen.getByTestId('value-y0').textContent).toBe('0.10');
		expect((screen.getByTestId('slider-iterations') as HTMLInputElement).value).toBe('120000');
	});

	it('loads config from share code and applies parameters', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'gingerbreadman',
				x0: -2.13,
				y0: 0.47,
				iterations: 100000,
				colorMode: 'angle',
				zoom: 1,
				pointSize: 1.5,
				opacity: 0.6
			},
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/gingerbreadman?share=gbm-share-1');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'gbm-share-1', mapType: 'gingerbreadman' })
			);
		});

		await waitFor(() => {
			expect((screen.getByTestId('slider-x0') as HTMLInputElement).value).toBe('-2.13');
		});
	});

	it('applies an inline ?config= payload via onExtraParametersLoaded', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'gingerbreadman',
				x0: 1.5,
				y0: -1.5,
				iterations: 80000,
				colorMode: 'density',
				zoom: 1.5,
				pointSize: 2,
				opacity: 0.4
			}
		});
		setPageUrl('http://localhost/gingerbreadman?config=encoded-payload');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({
					mapType: 'gingerbreadman',
					configParam: 'encoded-payload'
				})
			);
		});
		await waitFor(() => {
			expect((screen.getByTestId('slider-x0') as HTMLInputElement).value).toBe('1.5');
		});
		expect(screen.getByTestId('value-x0').textContent).toBe('1.50');
		expect((screen.getByTestId('select-color-mode') as HTMLSelectElement).value).toBe(
			'density'
		);
	});

	it('clamps out-of-range x0 and iterations from a loaded config', async () => {
		// onExtraParametersLoaded clamps x0/y0 to [-10,10] and iterations to [1, 250000].
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'gingerbreadman',
				x0: 99,
				y0: -50,
				iterations: 999999,
				colorMode: 'iteration'
			}
		});
		setPageUrl('http://localhost/gingerbreadman?config=clamped-payload');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalled();
		});
		await waitFor(() => {
			expect((screen.getByTestId('slider-x0') as HTMLInputElement).value).toBe('10');
		});
		expect(screen.getByTestId('value-x0').textContent).toBe('10.00');
		expect((screen.getByTestId('slider-y0') as HTMLInputElement).value).toBe('-10');
		expect(screen.getByTestId('value-y0').textContent).toBe('-10.00');
		expect((screen.getByTestId('slider-iterations') as HTMLInputElement).value).toBe('250000');
		expect(screen.getByTestId('value-iterations').textContent).toBe('250000');
	});

	it('clamps undersized iterations up to the minimum of 1 (stable-range floor, not slider UI floor)', async () => {
		// clamp min is 1 (STABLE_Ranges, matches compare page); the slider UI
		// floor remains 10000, but the committed state preserves low-iteration
		// shared URLs. ParameterSlider's value label reflects the committed
		// state, not the browser-clamped slider thumb position.
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'gingerbreadman',
				x0: -0.1,
				y0: 0,
				iterations: -5
			}
		});
		setPageUrl('http://localhost/gingerbreadman?config=undersized-iters');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalled();
		});
		// After clamp to 1, ParameterSlider display reflects the committed value.
		await waitFor(() => {
			expect(screen.getByTestId('value-iterations').textContent).toBe('1');
		});
	});

	it('floors non-integer iterations from a loaded config before committing', async () => {
		// The renderer floors iterations in calculateGingerbreadmanTuples and
		// the compare route floors in clampParams, so the page must also floor
		// when applying a loaded config — otherwise the same configuration
		// renders one iteration count while being persisted/shared/compared
		// with another (e.g. 12345.7 renders 12345 but saves as 12345.7).
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'gingerbreadman',
				x0: -0.1,
				y0: 0,
				iterations: 12345.7
			}
		});
		setPageUrl('http://localhost/gingerbreadman?config=fractional-iters');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalled();
		});
		await waitFor(() => {
			expect(screen.getByTestId('value-iterations').textContent).toBe('12345');
		});
	});

	it('ignores a loaded config whose type is not gingerbreadman', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'lorenz',
				sigma: 99,
				rho: 99,
				beta: 99
			}
		});
		setPageUrl('http://localhost/gingerbreadman?config=wrong-type');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalled();
		});
		// Default classic x0=-0.1 must remain unchanged.
		expect(screen.getByTestId('value-x0').textContent).toBe('-0.10');
	});

	it('keeps current styling when a loaded config omits colorMode/zoom/pointSize/opacity', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'gingerbreadman',
				x0: 0.5,
				y0: -0.5,
				iterations: 50000
			}
		});
		setPageUrl('http://localhost/gingerbreadman?config=partial-config');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalled();
		});
		await waitFor(() => {
			expect(screen.getByTestId('value-x0').textContent).toBe('0.50');
		});
		// Classic defaults: colorMode=iteration, pointSize enabled.
		const select = screen.getByTestId('select-color-mode') as HTMLSelectElement;
		expect(select.value).toBe('iteration');
		expect((screen.getByTestId('slider-pointSize') as HTMLInputElement).disabled).toBe(false);
	});

	it('shows config error alert when configId load fails (ok:false)', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		});

		setPageUrl('http://localhost/gingerbreadman?configId=bad-id');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows config error alert when share load fails', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Share expired',
			errors: ['Share link has expired']
		});

		setPageUrl('http://localhost/gingerbreadman?share=expired-code');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows error when inline config param is invalid', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Invalid parameters',
			errors: ['Bad gingerbreadman params'],
			logMessage: 'err',
			logDetails: {}
		});

		setPageUrl('http://localhost/gingerbreadman?config=bad-data');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows error when config loading throws an exception', async () => {
		loadSavedConfigParametersMock.mockRejectedValueOnce(new Error('Network error'));

		setPageUrl('http://localhost/gingerbreadman?configId=error-id');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('does not reload the same config when the URL key is unchanged', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'gingerbreadman',
				x0: -0.3,
				y0: 0,
				iterations: 100000
			},
			source: 'api'
		});

		setPageUrl('http://localhost/gingerbreadman?configId=dup-id');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
		});

		setPageUrl('http://localhost/gingerbreadman?configId=dup-id');
		await new Promise((r) => setTimeout(r, 50));
		expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
	});

	it('handles AbortError when config load is aborted', async () => {
		const abortError = new Error('Aborted');
		abortError.name = 'AbortError';
		loadSavedConfigParametersMock.mockRejectedValueOnce(abortError);

		setPageUrl('http://localhost/gingerbreadman?configId=abort-id');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await new Promise((r) => setTimeout(r, 100));
		expect(screen.queryByText('INVALID_CONFIGURATION')).not.toBeInTheDocument();
	});

	it('clamps non-finite config values to the minimum', async () => {
		// clamp(n, min, max) returns min when n is non-finite (NaN/Infinity).
		// This covers the `if (!Number.isFinite(n)) return min;` guard.
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'gingerbreadman',
				x0: Number.NaN,
				y0: Number.POSITIVE_INFINITY,
				iterations: Number.NaN
			},
			source: 'api'
		});

		setPageUrl('http://localhost/gingerbreadman?configId=non-finite-id');
		render(GingerbreadmanPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalled();
		});
		// x0=NaN → clamp returns min (-10); y0=∞ → clamp returns min (-10);
		// iterations=NaN → clamp returns min (1).
		await waitFor(() => {
			expect(screen.getByTestId('value-x0').textContent).toBe('-10.00');
			expect(screen.getByTestId('value-y0').textContent).toBe('-10.00');
			expect(screen.getByTestId('value-iterations').textContent).toBe('1');
		});
	});
});
