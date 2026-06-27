/**
 * Config-loading tests for the Clifford visualization page.
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
vi.mock('$lib/components/visualizations/CliffordRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

// --- Helpers ---
const unauthedData = createUnauthedPageData();

function setPageUrl(url: string) {
	setMockPageUrl(url, unauthedData);
}

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
		render(CliffordPage, { props: unauthedPageProps });

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
		render(CliffordPage, { props: unauthedPageProps });

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
		render(CliffordPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows config error alert when configId load returns null', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce(
			null as unknown as Parameters<typeof loadSavedConfigParametersMock>[0]
		);

		setPageUrl('http://localhost/clifford?configId=null-id');
		render(CliffordPage, { props: unauthedPageProps });

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
		render(CliffordPage, { props: unauthedPageProps });

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
		render(CliffordPage, { props: unauthedPageProps });

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
		render(CliffordPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows error when config loading throws an exception', async () => {
		loadSavedConfigParametersMock.mockRejectedValueOnce(new Error('Network error'));

		setPageUrl('http://localhost/clifford?configId=error-id');
		render(CliffordPage, { props: unauthedPageProps });

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
		render(CliffordPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
		});

		// Re-setting the same URL should NOT trigger a second load (config-key guard).
		setPageUrl('http://localhost/clifford?configId=dup-id');
		await new Promise((r) => setTimeout(r, 50));
		expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
	});

	it('shows stability warning when loaded config has out-of-range parameters', async () => {
		// a=99 is outside the stable range [-3, 3] — validateParameters accepts
		// it (it's a finite number) but checkParameterStability flags it.
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'clifford',
				a: 99,
				b: 1.6,
				c: 1.0,
				d: 0.7,
				iterations: 120000
			},
			source: 'api'
		});

		setPageUrl('http://localhost/clifford?configId=unstable-id');
		render(CliffordPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/clifford?configId=late-id');
		const { unmount } = render(CliffordPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalled();
		});

		// Unmount before the load resolves — the isUnmounted guard should
		// prevent any state updates when the promise resolves later.
		unmount();

		// Now resolve the load — should not throw because isUnmounted is true.
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
			parameters: { type: 'clifford', a: 1, b: 1, c: 1, d: 1, iterations: 50000 }
		});
	});

	it('handles AbortError when config load is aborted', async () => {
		const abortError = new Error('Aborted');
		abortError.name = 'AbortError';
		loadSavedConfigParametersMock.mockRejectedValueOnce(abortError);

		setPageUrl('http://localhost/clifford?configId=abort-id');
		render(CliffordPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/clifford?configId=late-reject-id');
		const { unmount } = render(CliffordPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/clifford?config=crash-data');
		render(CliffordPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(
				screen.getByText('Failed to parse configuration parameters')
			).toBeInTheDocument();
		});
	});

	it('dismisses config error alert when the dismiss button is clicked', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		});

		setPageUrl('http://localhost/clifford?configId=dismiss-id');
		render(CliffordPage, { props: unauthedPageProps });

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
				type: 'clifford',
				a: 99,
				b: 1.6,
				c: 1.0,
				d: 0.7,
				iterations: 120000
			},
			source: 'api'
		});

		setPageUrl('http://localhost/clifford?configId=warn-dismiss-id');
		render(CliffordPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});

		const dismissBtn = screen.getByRole('button', { name: /Dismiss warning/i });
		await fireEvent.click(dismissBtn);
		expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).not.toBeInTheDocument();
	});
});
