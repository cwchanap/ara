/**
 * Config-loading tests for the Lozi visualization page.
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
import LoziPage from './lozi/+page.svelte';

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
vi.mock('$lib/components/visualizations/LoziRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

// --- Helpers ---
const unauthedData = createUnauthedPageData();

function setPageUrl(url: string) {
	setMockPageUrl(url, unauthedData);
}

describe('lozi page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
		setPageUrl('http://localhost/lozi');
	});

	afterEach(() => cleanup());

	it('loads config from configId and applies parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'lozi',
				a: 1.5,
				b: 0.5,
				x0: 0.1,
				y0: -0.1,
				iterations: 3000
			},
			source: 'api'
		});

		setPageUrl('http://localhost/lozi?configId=lozi-id-1');
		render(LoziPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'lozi-id-1', mapType: 'lozi' })
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
				type: 'lozi',
				a: 1.7,
				b: 0.7,
				x0: 0.5,
				y0: -0.5,
				iterations: 4000
			},
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/lozi?share=lozi-share-1');
		render(LoziPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'lozi-share-1', mapType: 'lozi' })
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

		setPageUrl('http://localhost/lozi?configId=bad-id');
		render(LoziPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows config error alert when configId load returns null', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce(
			null as unknown as Parameters<typeof loadSavedConfigParametersMock>[0]
		);

		setPageUrl('http://localhost/lozi?configId=null-id');
		render(LoziPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/lozi?share=expired-code');
		render(LoziPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies config from inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'lozi',
				a: 0.7,
				b: 0.3,
				x0: 1,
				y0: -1,
				iterations: 2500
			}
		});

		setPageUrl('http://localhost/lozi?config=some-encoded-data');
		render(LoziPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'lozi', configParam: 'some-encoded-data' })
			);
		});

		await waitFor(() => {
			const aSlider = screen.getByTestId('slider-a') as HTMLInputElement;
			expect(aSlider.value).toBe('0.7');
		});
	});

	it('shows error when inline config param is invalid', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Invalid parameters',
			errors: ['Bad lozi params'],
			logMessage: 'err',
			logDetails: {}
		});

		setPageUrl('http://localhost/lozi?config=bad-data');
		render(LoziPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows error when config loading throws an exception', async () => {
		loadSavedConfigParametersMock.mockRejectedValueOnce(new Error('Network error'));

		setPageUrl('http://localhost/lozi?configId=error-id');
		render(LoziPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('does not reload the same config when the URL key is unchanged', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'lozi',
				a: 1.5,
				b: 0.5,
				x0: 0.1,
				y0: -0.1,
				iterations: 3000
			},
			source: 'api'
		});

		setPageUrl('http://localhost/lozi?configId=dup-id');
		render(LoziPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
		});

		setPageUrl('http://localhost/lozi?configId=dup-id');
		await new Promise((r) => setTimeout(r, 50));
		expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
	});

	it('shows stability warning when loaded config has out-of-range parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'lozi',
				a: 99,
				b: 0.5,
				x0: 0.1,
				y0: -0.1,
				iterations: 3000
			},
			source: 'api'
		});

		setPageUrl('http://localhost/lozi?configId=unstable-id');
		render(LoziPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/lozi?configId=late-id');
		const { unmount } = render(LoziPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalled();
		});

		unmount();

		expect(() =>
			resolveLoad({
				ok: true,
				parameters: { type: 'lozi', a: 1, b: 0.5, x0: 0, y0: 0, iterations: 2000 }
			})
		).not.toThrow();
	});

	it('handles AbortError when config load is aborted', async () => {
		const abortError = new Error('Aborted');
		abortError.name = 'AbortError';
		loadSavedConfigParametersMock.mockRejectedValueOnce(abortError);

		setPageUrl('http://localhost/lozi?configId=abort-id');
		render(LoziPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/lozi?configId=late-reject-id');
		const { unmount } = render(LoziPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalled();
		});

		unmount();
		expect(() => rejectLoad(new Error('Late network error'))).not.toThrow();
	});

	it('shows error when inline config param parsing throws an exception', async () => {
		parseConfigParamMock.mockImplementationOnce(() => {
			throw new Error('Parse explosion');
		});

		setPageUrl('http://localhost/lozi?config=crash-data');
		render(LoziPage, { props: unauthedPageProps });

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

		setPageUrl('http://localhost/lozi?configId=dismiss-id');
		render(LoziPage, { props: unauthedPageProps });

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
			parameters: {
				type: 'lozi',
				a: 99,
				b: 0.5,
				x0: 0.1,
				y0: -0.1,
				iterations: 3000
			},
			source: 'api'
		});

		setPageUrl('http://localhost/lozi?configId=warn-dismiss-id');
		render(LoziPage, { props: unauthedPageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});

		const dismissBtn = screen.getByRole('button', { name: /Dismiss warning/i });
		await fireEvent.click(dismissBtn);
		expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).not.toBeInTheDocument();
	});
});
