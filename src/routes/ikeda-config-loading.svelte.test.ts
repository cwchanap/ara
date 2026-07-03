/**
 * Config-loading tests for the Ikeda visualization page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import {
	setMockPageUrl,
	createUnauthedPageData,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import IkedaPage from './ikeda/+page.svelte';

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
vi.mock('$lib/components/visualizations/IkedaRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

const unauthedData = createUnauthedPageData();

function setPageUrl(url: string) {
	setMockPageUrl(url, unauthedData);
}

const ikedaParams = {
	type: 'ikeda',
	u: 0.5,
	x0: 0.1,
	y0: -0.1,
	iterations: 1000,
	burnIn: 100
};

describe('ikeda page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
		setPageUrl('http://localhost/ikeda');
	});

	afterEach(() => cleanup());

	it('loads config from configId and applies parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...ikedaParams, u: 0.5 },
			source: 'api'
		});

		setPageUrl('http://localhost/ikeda?configId=ikeda-id-1');
		render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'ikeda-id-1', mapType: 'ikeda' })
			);
		});

		await waitFor(() => {
			const uSlider = screen.getByTestId('slider-u') as HTMLInputElement;
			expect(uSlider.value).toBe('0.5');
		});
	});

	it('loads config from share code and applies parameters', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...ikedaParams, u: 0.8 },
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/ikeda?share=ikeda-share-1');
		render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'ikeda-share-1', mapType: 'ikeda' })
			);
		});

		await waitFor(() => {
			const uSlider = screen.getByTestId('slider-u') as HTMLInputElement;
			expect(uSlider.value).toBe('0.8');
		});
	});

	it('shows config error alert when configId load fails (ok:false)', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		});

		setPageUrl('http://localhost/ikeda?configId=bad-id');
		render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows config error alert when configId load returns null', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce(
			null as unknown as Parameters<typeof loadSavedConfigParametersMock>[0]
		);

		setPageUrl('http://localhost/ikeda?configId=null-id');
		render(IkedaPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/ikeda?share=expired-code');
		render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies config from inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: { ...ikedaParams, u: 0.3 }
		});

		setPageUrl('http://localhost/ikeda?config=some-encoded-data');
		render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'ikeda', configParam: 'some-encoded-data' })
			);
		});

		await waitFor(() => {
			const uSlider = screen.getByTestId('slider-u') as HTMLInputElement;
			expect(uSlider.value).toBe('0.3');
		});
	});

	it('shows error when inline config param is invalid', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Invalid parameters',
			errors: ['Bad ikeda params'],
			logMessage: 'err',
			logDetails: {}
		});

		setPageUrl('http://localhost/ikeda?config=bad-data');
		render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows error when config loading throws an exception', async () => {
		loadSavedConfigParametersMock.mockRejectedValueOnce(new Error('Network error'));

		setPageUrl('http://localhost/ikeda?configId=error-id');
		render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('does not reload the same config when the URL key is unchanged', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: ikedaParams,
			source: 'api'
		});

		setPageUrl('http://localhost/ikeda?configId=dup-id');
		render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
		});

		setPageUrl('http://localhost/ikeda?configId=dup-id');
		await new Promise((r) => setTimeout(r, 50));
		expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
	});

	it('shows stability warning when loaded config has out-of-range parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...ikedaParams, u: 99 },
			source: 'api'
		});

		setPageUrl('http://localhost/ikeda?configId=unstable-id');
		render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});
	});

	it('does not update state when unmounted before async config load resolves', async () => {
		let resolveLoad: (value: unknown) => void = () => {};
		loadSavedConfigParametersMock.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveLoad = resolve;
			})
		);

		setPageUrl('http://localhost/ikeda?configId=late-id');
		const { unmount } = render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalled();
		});

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
		resolveLoad({ ok: true, parameters: ikedaParams });
	});

	it('handles AbortError when config load is aborted', async () => {
		const abortError = new Error('Aborted');
		abortError.name = 'AbortError';
		loadSavedConfigParametersMock.mockRejectedValueOnce(abortError);

		setPageUrl('http://localhost/ikeda?configId=abort-id');
		render(IkedaPage, { props: unauthedPageProps });

		await new Promise((r) => setTimeout(r, 100));
		expect(screen.queryByText('INVALID_CONFIGURATION')).not.toBeInTheDocument();
	});

	it('does not update state when unmounted before rejected config load resolves', async () => {
		let rejectLoad: (reason: unknown) => void = () => {};
		loadSavedConfigParametersMock.mockReturnValueOnce(
			new Promise((_, reject) => {
				rejectLoad = reject;
			})
		);

		setPageUrl('http://localhost/ikeda?configId=late-reject-id');
		const { unmount } = render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalled();
		});

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

		setPageUrl('http://localhost/ikeda?config=crash-data');
		render(IkedaPage, { props: unauthedPageProps });

		// Standardized via useConfigLoader: a throw from parseConfigParam is
		// caught and surfaced as the INVALID_CONFIGURATION alert heading. Matches
		// the rossler/lozi/standard/clifford migrated-page precedent.
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

		setPageUrl('http://localhost/ikeda?configId=dismiss-id');
		render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});

		const dismissBtn = screen.getByRole('button', { name: /Dismiss config error/i });
		await fireEvent.click(dismissBtn);
		expect(screen.queryByText('INVALID_CONFIGURATION')).not.toBeInTheDocument();
	});

	it('dismisses stability warning alert when the dismiss button is clicked', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...ikedaParams, u: 99 },
			source: 'api'
		});

		setPageUrl('http://localhost/ikeda?configId=warn-dismiss-id');
		render(IkedaPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});

		const dismissBtn = screen.getByRole('button', { name: /Dismiss warning/i });
		await fireEvent.click(dismissBtn);
		expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).not.toBeInTheDocument();
	});
});
