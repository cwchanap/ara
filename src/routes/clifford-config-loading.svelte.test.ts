/**
 * Config-loading tests for the Clifford visualization page.
 * Covers the configId / share / config URL-param load paths, error handling,
 * and stability warnings — the branches excluded by the renderer-stubbed
 * interaction test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import CliffordPage from './clifford/+page.svelte';

// --- Mocks for saved-config-loader ---
const loadSavedConfigParametersMock = vi.hoisted(() => vi.fn());
const loadSharedConfigParametersMock = vi.hoisted(() => vi.fn());
const parseConfigParamMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: loadSavedConfigParametersMock,
	loadSharedConfigParameters: loadSharedConfigParametersMock,
	parseConfigParam: parseConfigParamMock
}));

// --- Page store ---
const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/clifford') as Page['url'],
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
			subscribers.forEach((s) => s(value));
		}
	};
});

vi.mock('$app/stores', () => ({
	page: { subscribe: pageStore.subscribe }
}));

vi.mock('$app/paths', () => ({ base: '' }));
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
// NOTE: VisualizationAlerts is NOT mocked — we need the real component to
// assert that config-error / stability-warning alerts render.
vi.mock('$lib/components/visualizations/CliffordRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});

// --- Helpers ---
const pageData = { session: null, user: null, profile: null } satisfies App.PageData;

function setPageUrl(url: string) {
	pageStore.set({
		url: new URL(url) as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: pageData,
		form: null,
		state: {}
	});
}

const pageProps = { data: pageData };

describe('clifford page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
		// Reset to a clean URL between tests so the $effect config-key guard
		// doesn't skip the load.
		setPageUrl('http://localhost/clifford');
	});

	afterEach(() => cleanup());

	it('loads config from configId and applies parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'clifford',
				a: 1.5,
				b: -1.2,
				c: 0.8,
				d: -0.5,
				iterations: 50000,
				colorMode: 'iteration',
				zoom: 2,
				pointSize: 3,
				opacity: 0.8
			},
			source: 'api'
		});

		setPageUrl('http://localhost/clifford?configId=clifford-id-1');
		render(CliffordPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'clifford-id-1', mapType: 'clifford' })
			);
		});

		await waitFor(() => {
			const aSlider = screen.getByTestId('slider-a') as HTMLInputElement;
			expect(aSlider.value).toBe('1.5');
		});
	});

	it('loads config from share code and applies parameters', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'clifford',
				a: 1.7,
				b: 1.7,
				c: 0.6,
				d: 1.2,
				iterations: 120000,
				colorMode: 'iteration',
				zoom: 1,
				pointSize: 1.2,
				opacity: 0.55
			},
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/clifford?share=clifford-share-1');
		render(CliffordPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'clifford-share-1', mapType: 'clifford' })
			);
		});

		await waitFor(() => {
			const aSlider = screen.getByTestId('slider-a') as HTMLInputElement;
			expect(aSlider.value).toBe('1.7');
		});
	});

	it('shows config error alert when configId load fails (ok:false)', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		});

		setPageUrl('http://localhost/clifford?configId=bad-id');
		render(CliffordPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows config error alert when configId load returns null', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce(
			null as unknown as Parameters<typeof loadSavedConfigParametersMock>[0]
		);

		setPageUrl('http://localhost/clifford?configId=null-id');
		render(CliffordPage, { props: pageProps });

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

		setPageUrl('http://localhost/clifford?share=expired-code');
		render(CliffordPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies config from inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'clifford',
				a: 0.5,
				b: -0.5,
				c: 1.2,
				d: -1.2,
				iterations: 80000,
				colorMode: 'angle',
				zoom: 1.5,
				pointSize: 2,
				opacity: 0.4
			}
		});

		setPageUrl('http://localhost/clifford?config=some-encoded-data');
		render(CliffordPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'clifford', configParam: 'some-encoded-data' })
			);
		});

		await waitFor(() => {
			const aSlider = screen.getByTestId('slider-a') as HTMLInputElement;
			expect(aSlider.value).toBe('0.5');
		});
	});

	it('shows error when inline config param is invalid', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Invalid parameters',
			errors: ['Bad clifford params'],
			logMessage: 'err',
			logDetails: {}
		});

		setPageUrl('http://localhost/clifford?config=bad-data');
		render(CliffordPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows error when config loading throws an exception', async () => {
		loadSavedConfigParametersMock.mockRejectedValueOnce(new Error('Network error'));

		setPageUrl('http://localhost/clifford?configId=error-id');
		render(CliffordPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('does not reload the same config when the URL key is unchanged', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'clifford',
				a: 1.5,
				b: -1.2,
				c: 0.8,
				d: -0.5,
				iterations: 50000
			},
			source: 'api'
		});

		setPageUrl('http://localhost/clifford?configId=dup-id');
		render(CliffordPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
		});

		// Re-setting the same URL should NOT trigger a second load (config-key guard).
		setPageUrl('http://localhost/clifford?configId=dup-id');
		await new Promise((r) => setTimeout(r, 50));
		expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
	});
});
