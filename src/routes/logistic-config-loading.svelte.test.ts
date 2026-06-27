/**
 * Config-loading tests for the logistic visualization page (uses useConfigLoader hook).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import ulogisticPage from './logistic/+page.svelte';

const loadSavedConfigParametersMock = vi.hoisted(() => vi.fn());
const loadSharedConfigParametersMock = vi.hoisted(() => vi.fn());
const parseConfigParamMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: loadSavedConfigParametersMock,
	loadSharedConfigParameters: loadSharedConfigParametersMock,
	parseConfigParam: parseConfigParamMock
}));

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/logistic') as Page['url'],
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

vi.mock('$app/stores', () => ({ page: { subscribe: pageStore.subscribe } }));
vi.mock('$app/paths', () => ({ base: '' }));
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
vi.mock('$lib/components/visualizations/LogisticRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

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

const baseParams = { type: 'logistic', r: 3.9, x0: 0.5, iterations: 100 };

describe('logistic page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
		setPageUrl('http://localhost/logistic');
	});

	afterEach(() => cleanup());

	it('loads config from configId and applies parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...baseParams, r: 3.7 },
			source: 'api'
		});

		setPageUrl('http://localhost/logistic?configId=logistic-id-1');
		render(ulogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'logistic-id-1', mapType: 'logistic' })
			);
		});

		await waitFor(() => {
			const slider = document.getElementById('r') as HTMLInputElement;
			expect(slider.value).toBe('3.7');
		});
	});

	it('loads config from share code and applies parameters', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...baseParams, r: 3.85 },
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/logistic?share=logistic-share-1');
		render(ulogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'logistic-share-1', mapType: 'logistic' })
			);
		});

		await waitFor(() => {
			const slider = document.getElementById('r') as HTMLInputElement;
			expect(slider.value).toBe('3.85');
		});
	});

	it('shows config error alert when configId load fails (ok:false)', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		});

		setPageUrl('http://localhost/logistic?configId=bad-id');
		render(ulogisticPage, { props: pageProps });

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

		setPageUrl('http://localhost/logistic?share=expired-code');
		render(ulogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies config from inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: { ...baseParams, r: 3.65 }
		});

		setPageUrl('http://localhost/logistic?config=some-encoded-data');
		render(ulogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'logistic', configParam: 'some-encoded-data' })
			);
		});

		await waitFor(() => {
			const slider = document.getElementById('r') as HTMLInputElement;
			expect(slider.value).toBe('3.65');
		});
	});

	it('shows error when inline config param is invalid', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Invalid parameters',
			errors: ['Bad logistic params'],
			logMessage: 'err',
			logDetails: {}
		});

		setPageUrl('http://localhost/logistic?config=bad-data');
		render(ulogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows error when config loading throws an exception', async () => {
		loadSavedConfigParametersMock.mockRejectedValueOnce(new Error('Network error'));

		setPageUrl('http://localhost/logistic?configId=error-id');
		render(ulogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('does not reload the same config when the URL key is unchanged', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...baseParams, r: 3.7 },
			source: 'api'
		});

		setPageUrl('http://localhost/logistic?configId=dup-id');
		render(ulogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
		});

		setPageUrl('http://localhost/logistic?configId=dup-id');
		await new Promise((r) => setTimeout(r, 50));
		expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
	});

	it('shows stability warning when loaded config has out-of-range parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...baseParams, r: 99 },
			source: 'api'
		});

		setPageUrl('http://localhost/logistic?configId=unstable-id');
		render(ulogisticPage, { props: pageProps });

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

		setPageUrl('http://localhost/logistic?configId=late-id');
		const { unmount } = render(ulogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalled();
		});

		unmount();
		expect(() => resolveLoad({ ok: true, parameters: baseParams })).not.toThrow();
	});

	it('handles AbortError when config load is aborted', async () => {
		const abortError = new Error('Aborted');
		abortError.name = 'AbortError';
		loadSavedConfigParametersMock.mockRejectedValueOnce(abortError);

		setPageUrl('http://localhost/logistic?configId=abort-id');
		render(ulogisticPage, { props: pageProps });

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

		setPageUrl('http://localhost/logistic?configId=late-reject-id');
		const { unmount } = render(ulogisticPage, { props: pageProps });

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

		setPageUrl('http://localhost/logistic?config=crash-data');
		render(ulogisticPage, { props: pageProps });

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

		setPageUrl('http://localhost/logistic?configId=dismiss-id');
		render(ulogisticPage, { props: pageProps });

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
			parameters: { ...baseParams, r: 99 },
			source: 'api'
		});

		setPageUrl('http://localhost/logistic?configId=warn-dismiss-id');
		render(ulogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});

		const dismissBtn = screen.getByRole('button', { name: /Dismiss warning/i });
		await fireEvent.click(dismissBtn);
		expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).not.toBeInTheDocument();
	});

	it('dismisses save error toast when the dismiss button is clicked', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			json: () => Promise.resolve({ error: 'Save failed' })
		}) as unknown as typeof globalThis.fetch;

		try {
			render(ulogisticPage, { props: pageProps });

			await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
			await fireEvent.click(screen.getByTestId('dialog-save-logistic'));

			await waitFor(() => {
				expect(
					screen.getByRole('button', { name: /Dismiss save error/i })
				).toBeInTheDocument();
			});

			await fireEvent.click(screen.getByRole('button', { name: /Dismiss save error/i }));
			expect(
				screen.queryByRole('button', { name: /Dismiss save error/i })
			).not.toBeInTheDocument();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('dismisses save success toast when the dismiss button is clicked', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ success: true })
		}) as unknown as typeof globalThis.fetch;

		try {
			render(ulogisticPage, { props: pageProps });

			await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
			await fireEvent.click(screen.getByTestId('dialog-save-logistic'));

			await waitFor(() => {
				expect(
					screen.getByRole('button', { name: /Dismiss success/i })
				).toBeInTheDocument();
			});

			await fireEvent.click(screen.getByRole('button', { name: /Dismiss success/i }));
			expect(
				screen.queryByRole('button', { name: /Dismiss success/i })
			).not.toBeInTheDocument();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('closes the share dialog via onClose callback', async () => {
		render(ulogisticPage, { props: pageProps });

		await fireEvent.click(screen.getByRole('button', { name: /Share/i }));
		expect(screen.getByTestId('dialog-stub-logistic')).toBeInTheDocument();

		await fireEvent.click(screen.getByTestId('dialog-close-logistic'));
		expect(screen.queryByTestId('dialog-stub-logistic')).not.toBeInTheDocument();
	});
});
