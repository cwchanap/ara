/**
 * Config-loading tests for the newton visualization page (uses useConfigLoader hook).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import {
	setMockPageUrl,
	createUnauthedPageData,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import NewtonPage from './newton/+page.svelte';

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
vi.mock('$lib/components/visualizations/NewtonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

const unauthedData = createUnauthedPageData();

function setPageUrl(url: string) {
	setMockPageUrl(url, unauthedData);
}

const baseParams = {
	type: 'newton',
	xMin: -0.01,
	xMax: 0.01,
	yMin: -0.01,
	yMax: 0.01,
	maxIterations: 50
};

describe('newton page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
		setPageUrl('http://localhost/newton');
	});

	afterEach(() => cleanup());

	it('loads config from configId and applies parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...baseParams, maxIterations: 75 },
			source: 'api'
		});

		setPageUrl('http://localhost/newton?configId=newton-id-1');
		render(NewtonPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'newton-id-1', mapType: 'newton' })
			);
		});

		await waitFor(() => {
			const slider = document.getElementById('maxIterations') as HTMLInputElement;
			expect(slider.value).toBe('75');
		});
	});

	it('loads config from share code and applies parameters', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...baseParams, maxIterations: 80 },
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/newton?share=newton-share-1');
		render(NewtonPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'newton-share-1', mapType: 'newton' })
			);
		});

		await waitFor(() => {
			const slider = document.getElementById('maxIterations') as HTMLInputElement;
			expect(slider.value).toBe('80');
		});
	});

	it('shows config error alert when configId load fails (ok:false)', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		});

		setPageUrl('http://localhost/newton?configId=bad-id');
		render(NewtonPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/newton?share=expired-code');
		render(NewtonPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies config from inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: { ...baseParams, maxIterations: 75 }
		});

		setPageUrl('http://localhost/newton?config=some-encoded-data');
		render(NewtonPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'newton', configParam: 'some-encoded-data' })
			);
		});

		await waitFor(() => {
			const slider = document.getElementById('maxIterations') as HTMLInputElement;
			expect(slider.value).toBe('75');
		});
	});

	it('shows error when inline config param is invalid', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Invalid parameters',
			errors: ['Bad newton params'],
			logMessage: 'err',
			logDetails: {}
		});

		setPageUrl('http://localhost/newton?config=bad-data');
		render(NewtonPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows error when config loading throws an exception', async () => {
		loadSavedConfigParametersMock.mockRejectedValueOnce(new Error('Network error'));

		setPageUrl('http://localhost/newton?configId=error-id');
		render(NewtonPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('does not reload the same config when the URL key is unchanged', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...baseParams, maxIterations: 75 },
			source: 'api'
		});

		setPageUrl('http://localhost/newton?configId=dup-id');
		render(NewtonPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
		});

		setPageUrl('http://localhost/newton?configId=dup-id');
		await new Promise((r) => setTimeout(r, 50));
		expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
	});

	it('shows stability warning when loaded config has out-of-range parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...baseParams, maxIterations: 999 },
			source: 'api'
		});

		setPageUrl('http://localhost/newton?configId=unstable-id');
		render(NewtonPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/newton?configId=late-id');
		const { unmount } = render(NewtonPage, { props: unauthedPageProps });

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
		resolveLoad({ ok: true, parameters: baseParams });
	});

	it('handles AbortError when config load is aborted', async () => {
		const abortError = new Error('Aborted');
		abortError.name = 'AbortError';
		loadSavedConfigParametersMock.mockRejectedValueOnce(abortError);

		setPageUrl('http://localhost/newton?configId=abort-id');
		render(NewtonPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/newton?configId=late-reject-id');
		const { unmount } = render(NewtonPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/newton?config=crash-data');
		render(NewtonPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/newton?configId=dismiss-id');
		render(NewtonPage, { props: unauthedPageProps });

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
			parameters: { ...baseParams, maxIterations: 999 },
			source: 'api'
		});

		setPageUrl('http://localhost/newton?configId=warn-dismiss-id');
		render(NewtonPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});

		const dismissBtn = screen.getByRole('button', { name: /Dismiss warning/i });
		await fireEvent.click(dismissBtn);
		expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).not.toBeInTheDocument();
	});
});
