/**
 * Config-loading tests for the Gumowski–Mira visualization page.
 * Covers the configId / share / config URL-param load paths, error handling,
 * and stability warnings — the branches excluded by the renderer-stubbed
 * interaction test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import {
	setMockPageUrl,
	createUnauthedPageData,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import GumowskiMiraPage from './gumowski-mira/+page.svelte';

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
// NOTE: VisualizationAlerts is NOT mocked — we need the real component to
// assert that config-error / stability-warning alerts render.
vi.mock('$lib/components/visualizations/GumowskiMiraRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

// --- Helpers ---
const unauthedData = createUnauthedPageData();

function setPageUrl(url: string) {
	setMockPageUrl(url, unauthedData);
}

describe('gumowski-mira page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
		// Reset to a clean URL between tests so the $effect config-key guard
		// doesn't skip the load.
		setPageUrl('http://localhost/gumowski-mira');
	});

	afterEach(() => cleanup());

	it('loads config from configId and applies parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'gumowski-mira',
				mu: -0.4,
				a: 0.008,
				b: 0.5,
				x0: 0.1,
				y0: 0,
				iterations: 12000,
				burnIn: 500
			},
			source: 'api'
		});

		setPageUrl('http://localhost/gumowski-mira?configId=gm-id-1');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'gm-id-1', mapType: 'gumowski-mira' })
			);
		});

		await waitFor(() => {
			const muSlider = screen.getByTestId('slider-mu') as HTMLInputElement;
			expect(muSlider.value).toBe('-0.4');
		});
	});

	it('loads config from share code and applies parameters', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'gumowski-mira',
				mu: 0.55,
				a: 0.05,
				b: 0.05,
				x0: 0.1,
				y0: 0,
				iterations: 18000,
				burnIn: 500
			},
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/gumowski-mira?share=gm-share-1');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'gm-share-1', mapType: 'gumowski-mira' })
			);
		});

		await waitFor(() => {
			const muSlider = screen.getByTestId('slider-mu') as HTMLInputElement;
			expect(muSlider.value).toBe('0.55');
		});
	});

	it('shows config error alert when configId load fails (ok:false)', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		});

		setPageUrl('http://localhost/gumowski-mira?configId=bad-id');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows config error alert when configId load returns null', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce(
			null as unknown as Parameters<typeof loadSavedConfigParametersMock>[0]
		);

		setPageUrl('http://localhost/gumowski-mira?configId=null-id');
		render(GumowskiMiraPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/gumowski-mira?share=expired-code');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies config from inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'gumowski-mira',
				mu: -0.827,
				a: 0.008,
				b: 0.05,
				x0: 0.1,
				y0: 0,
				iterations: 15000,
				burnIn: 500
			}
		});

		setPageUrl('http://localhost/gumowski-mira?config=some-encoded-data');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({
					mapType: 'gumowski-mira',
					configParam: 'some-encoded-data'
				})
			);
		});

		await waitFor(() => {
			const muSlider = screen.getByTestId('slider-mu') as HTMLInputElement;
			expect(muSlider.value).toBe('-0.827');
		});
	});

	it('shows error when inline config param is invalid', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Invalid parameters',
			errors: ['Bad gumowski-mira params'],
			logMessage: 'err',
			logDetails: {}
		});

		setPageUrl('http://localhost/gumowski-mira?config=bad-data');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows error when config loading throws an exception', async () => {
		loadSavedConfigParametersMock.mockRejectedValueOnce(new Error('Network error'));

		setPageUrl('http://localhost/gumowski-mira?configId=error-id');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('does not reload the same config when the URL key is unchanged', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'gumowski-mira',
				mu: -0.4,
				a: 0.008,
				b: 0.5,
				x0: 0.1,
				y0: 0,
				iterations: 12000,
				burnIn: 500
			},
			source: 'api'
		});

		setPageUrl('http://localhost/gumowski-mira?configId=dup-id');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
		});

		// Re-setting the same URL should NOT trigger a second load (config-key guard).
		setPageUrl('http://localhost/gumowski-mira?configId=dup-id');
		await new Promise((r) => setTimeout(r, 50));
		expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
	});

	it('shows stability warning when loaded config has out-of-range parameters', async () => {
		// mu=99 is outside the stable range [-1, 1] — validateParameters accepts
		// it (it's a finite number) but checkParameterStability flags it.
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'gumowski-mira',
				mu: 99,
				a: 0.008,
				b: 0.05,
				x0: 0.1,
				y0: 0,
				iterations: 15000,
				burnIn: 500
			},
			source: 'api'
		});

		setPageUrl('http://localhost/gumowski-mira?configId=unstable-id');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});
	});

	it('does not update state when unmounted before async config load resolves', async () => {
		// Create a promise that we control so it never resolves during the test.
		let resolveLoad: (value: unknown) => void = () => {};
		loadSavedConfigParametersMock.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveLoad = resolve;
			})
		);

		setPageUrl('http://localhost/gumowski-mira?configId=late-id');
		const { unmount } = render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalled();
		});

		// Unmount before the load resolves — the isUnmounted guard should
		// prevent any state updates when the promise resolves later.
		unmount();

		// Verify unmount aborted the loader's AbortController (the observable
		// post-unmount effect): the signal embedded in fetchFn is now aborted.
		const { fetchFn } = loadSavedConfigParametersMock.mock.calls[0][0] as {
			fetchFn: typeof fetch;
		};
		const fetchSpy = vi.fn(async () => new Response('{}'));
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchSpy as unknown as typeof fetch;
		try {
			await fetchFn('http://test');
			expect(
				(fetchSpy.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit])[1]?.signal
					?.aborted
			).toBe(true);
		} finally {
			globalThis.fetch = originalFetch;
		}
		// Settling the pending load after unmount is a no-op via the isUnmounted guard.
		resolveLoad({
			ok: true,
			parameters: {
				type: 'gumowski-mira',
				mu: -0.4,
				a: 0.008,
				b: 0.5,
				x0: 0.1,
				y0: 0,
				iterations: 12000,
				burnIn: 500
			}
		});
	});

	it('handles AbortError when config load is aborted', async () => {
		const abortError = new Error('Aborted');
		abortError.name = 'AbortError';
		loadSavedConfigParametersMock.mockRejectedValueOnce(abortError);

		setPageUrl('http://localhost/gumowski-mira?configId=abort-id');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		// The AbortError is caught silently — no config error alert should appear.
		await new Promise((r) => setTimeout(r, 100));
		expect(screen.queryByText('INVALID_CONFIGURATION')).not.toBeInTheDocument();
	});

	it('does not update state when unmounted before rejected config load resolves', async () => {
		// Create a rejectable promise that we control so it rejects after unmount.
		let rejectLoad: (reason: unknown) => void = () => {};
		loadSavedConfigParametersMock.mockReturnValueOnce(
			new Promise((_, reject) => {
				rejectLoad = reject;
			})
		);

		setPageUrl('http://localhost/gumowski-mira?configId=late-reject-id');
		const { unmount } = render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalled();
		});

		// Unmount before the load rejects — the isUnmounted guard in the catch
		// block should prevent any state updates.
		unmount();
		// Verify unmount aborted the loader's AbortController (the observable
		// post-unmount effect): the signal embedded in fetchFn is now aborted.
		const { fetchFn } = loadSavedConfigParametersMock.mock.calls[0][0] as {
			fetchFn: typeof fetch;
		};
		const fetchSpy = vi.fn(async () => new Response('{}'));
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchSpy as unknown as typeof fetch;
		try {
			await fetchFn('http://test');
			expect(
				(fetchSpy.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit])[1]?.signal
					?.aborted
			).toBe(true);
		} finally {
			globalThis.fetch = originalFetch;
		}
		// Settling the pending load after unmount is a no-op via the isUnmounted guard.
		rejectLoad(new Error('Late network error'));
	});

	it('shows error when inline config param parsing throws an exception', async () => {
		parseConfigParamMock.mockImplementationOnce(() => {
			throw new Error('Parse explosion');
		});

		setPageUrl('http://localhost/gumowski-mira?config=crash-data');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		// Standardized via useConfigLoader: a throw from parseConfigParam is
		// caught and surfaced as the INVALID_CONFIGURATION alert heading. Matches
		// the rossler/lozi/standard/clifford/ikeda migrated-page precedent.
		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('dismisses config error alert when the dismiss button is clicked', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		});

		setPageUrl('http://localhost/gumowski-mira?configId=dismiss-id');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});

		// Click the dismiss button on the config error alert.
		const dismissBtn = screen.getByRole('button', { name: /Dismiss config error/i });
		await fireEvent.click(dismissBtn);
		expect(screen.queryByText('INVALID_CONFIGURATION')).not.toBeInTheDocument();
	});

	it('dismisses stability warning alert when the dismiss button is clicked', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'gumowski-mira',
				mu: 99,
				a: 0.008,
				b: 0.05,
				x0: 0.1,
				y0: 0,
				iterations: 15000,
				burnIn: 500
			},
			source: 'api'
		});

		setPageUrl('http://localhost/gumowski-mira?configId=warn-dismiss-id');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});

		const dismissBtn = screen.getByRole('button', { name: /Dismiss warning/i });
		await fireEvent.click(dismissBtn);
		expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).not.toBeInTheDocument();
	});

	it('dismisses save error alert when the dismiss button is clicked', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn(
			async () => new Response(JSON.stringify({ error: 'Save failed' }), { status: 500 })
		) as unknown as typeof fetch;

		try {
			render(GumowskiMiraPage, { props: unauthedPageProps });

			// Open the save dialog and trigger a save that fails.
			await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
			const dialogSaveBtn = screen.getByTestId('dialog-save-gumowski-mira');
			await fireEvent.click(dialogSaveBtn);

			await waitFor(() => {
				expect(
					screen.getByRole('button', { name: /Dismiss save error/i })
				).toBeInTheDocument();
			});

			// Dismiss the save error alert.
			await fireEvent.click(screen.getByRole('button', { name: /Dismiss save error/i }));
			expect(
				screen.queryByRole('button', { name: /Dismiss save error/i })
			).not.toBeInTheDocument();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('dismisses save success alert when the dismiss button is clicked', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn(
			async () => new Response(JSON.stringify({ id: 'test-id' }), { status: 200 })
		) as unknown as typeof fetch;

		try {
			render(GumowskiMiraPage, { props: unauthedPageProps });

			// Open the save dialog and trigger a save that succeeds.
			await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
			const dialogSaveBtn = screen.getByTestId('dialog-save-gumowski-mira');
			await fireEvent.click(dialogSaveBtn);

			await waitFor(() => {
				expect(
					screen.getByRole('button', { name: /Dismiss success/i })
				).toBeInTheDocument();
			});

			// Dismiss the save success alert.
			await fireEvent.click(screen.getByRole('button', { name: /Dismiss success/i }));
			expect(
				screen.queryByRole('button', { name: /Dismiss success/i })
			).not.toBeInTheDocument();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('ignores config load result when config key changes during async load', async () => {
		// Start a config load with configId=id1, then change the URL to
		// configId=id2 before the first load resolves. The first load's
		// result should be ignored (the config-key guard at line 212).
		let resolveFirst: (value: unknown) => void = () => {};
		loadSavedConfigParametersMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveFirst = resolve;
				})
		);
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'gumowski-mira',
				mu: 0.55,
				a: 0.05,
				b: 0.05,
				x0: 0.1,
				y0: 0,
				iterations: 18000,
				burnIn: 500
			},
			source: 'api'
		});

		setPageUrl('http://localhost/gumowski-mira?configId=first-id');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
		});

		// Change the URL to a different configId — this changes the config key
		// and starts a new load. The first load's result should be ignored.
		setPageUrl('http://localhost/gumowski-mira?configId=second-id');

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(2);
		});

		// Now resolve the first (stale) load — the config-key guard should
		// prevent its result from being applied.
		resolveFirst({
			ok: true,
			parameters: {
				type: 'gumowski-mira',
				mu: -0.4,
				a: 0.008,
				b: 0.5,
				x0: 0.1,
				y0: 0,
				iterations: 12000,
				burnIn: 500
			}
		});

		// Wait for the second load to resolve and apply its params.
		await waitFor(() => {
			const muSlider = screen.getByTestId('slider-mu') as HTMLInputElement;
			// The second load's mu (0.55) should be applied, not the first's (-0.4).
			expect(muSlider.value).toBe('0.55');
		});
	});

	it('ignores rejected config load when config key changes during async load', async () => {
		// Start a config load that will reject, then change the URL before
		// the rejection resolves. The catch block's config-key guard (line 231)
		// should prevent the error from being shown.
		let rejectFirst: (reason: unknown) => void = () => {};
		loadSavedConfigParametersMock.mockImplementationOnce(
			() =>
				new Promise((_, reject) => {
					rejectFirst = reject;
				})
		);

		setPageUrl('http://localhost/gumowski-mira?configId=stale-reject-id');
		render(GumowskiMiraPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
		});

		// Change the URL to a clean URL (no config params) — this changes
		// the config key to null, so the stale rejection is ignored.
		setPageUrl('http://localhost/gumowski-mira');

		// Now reject the stale load — the config-key guard should prevent
		// the error from being shown.
		rejectFirst(new Error('Stale network error'));

		// No config error should appear because the config key changed.
		await new Promise((r) => setTimeout(r, 100));
		expect(screen.queryByText('INVALID_CONFIGURATION')).not.toBeInTheDocument();
	});
});
