/**
 * Config-loading tests for the Standard Map visualization page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import StandardPage from './standard/+page.svelte';

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
		url: new URL('http://localhost/standard') as Page['url'],
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
vi.mock('$lib/components/visualizations/StandardRenderer.svelte', async () => {
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

const stdParams = { type: 'standard', k: 1.5, numP: 15, numQ: 15, iterations: 10000 };

describe('standard page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
		setPageUrl('http://localhost/standard');
	});

	afterEach(() => cleanup());

	it('loads config from configId and applies parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...stdParams, k: 1.5 },
			source: 'api'
		});

		setPageUrl('http://localhost/standard?configId=std-id-1');
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'std-id-1', mapType: 'standard' })
			);
		});

		await waitFor(() => {
			const kInput = document.querySelector<HTMLInputElement>('#k');
			expect(kInput?.value).toBe('1.5');
		});
	});

	it('loads config from share code and applies parameters', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...stdParams, k: 2.5 },
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/standard?share=std-share-1');
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'std-share-1', mapType: 'standard' })
			);
		});

		await waitFor(() => {
			const kInput = document.querySelector<HTMLInputElement>('#k');
			expect(kInput?.value).toBe('2.5');
		});
	});

	it('shows config error alert when configId load fails (ok:false)', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		});

		setPageUrl('http://localhost/standard?configId=bad-id');
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows config error alert when configId load returns null', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce(
			null as unknown as Parameters<typeof loadSavedConfigParametersMock>[0]
		);

		setPageUrl('http://localhost/standard?configId=null-id');
		render(StandardPage, { props: pageProps });

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

		setPageUrl('http://localhost/standard?share=expired-code');
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies config from inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: { ...stdParams, k: 0.5 }
		});

		setPageUrl('http://localhost/standard?config=some-encoded-data');
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'standard', configParam: 'some-encoded-data' })
			);
		});

		await waitFor(() => {
			const kInput = document.querySelector<HTMLInputElement>('#k');
			expect(kInput?.value).toBe('0.5');
		});
	});

	it('shows error when inline config param is invalid', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Invalid parameters',
			errors: ['Bad standard params'],
			logMessage: 'err',
			logDetails: {}
		});

		setPageUrl('http://localhost/standard?config=bad-data');
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows error when config loading throws an exception', async () => {
		loadSavedConfigParametersMock.mockRejectedValueOnce(new Error('Network error'));

		setPageUrl('http://localhost/standard?configId=error-id');
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('does not reload the same config when the URL key is unchanged', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: stdParams,
			source: 'api'
		});

		setPageUrl('http://localhost/standard?configId=dup-id');
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
		});

		setPageUrl('http://localhost/standard?configId=dup-id');
		await new Promise((r) => setTimeout(r, 50));
		expect(loadSavedConfigParametersMock).toHaveBeenCalledTimes(1);
	});

	it('shows stability warning when loaded config has out-of-range parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { ...stdParams, k: 99 },
			source: 'api'
		});

		setPageUrl('http://localhost/standard?configId=unstable-id');
		render(StandardPage, { props: pageProps });

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

		setPageUrl('http://localhost/standard?configId=late-id');
		const { unmount } = render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalled();
		});

		unmount();
		expect(() => resolveLoad({ ok: true, parameters: stdParams })).not.toThrow();
	});

	it('handles AbortError when config load is aborted', async () => {
		const abortError = new Error('Aborted');
		abortError.name = 'AbortError';
		loadSavedConfigParametersMock.mockRejectedValueOnce(abortError);

		setPageUrl('http://localhost/standard?configId=abort-id');
		render(StandardPage, { props: pageProps });

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

		setPageUrl('http://localhost/standard?configId=late-reject-id');
		const { unmount } = render(StandardPage, { props: pageProps });

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

		setPageUrl('http://localhost/standard?config=crash-data');
		render(StandardPage, { props: pageProps });

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

		setPageUrl('http://localhost/standard?configId=dismiss-id');
		render(StandardPage, { props: pageProps });

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
			parameters: { ...stdParams, k: 99 },
			source: 'api'
		});

		setPageUrl('http://localhost/standard?configId=warn-dismiss-id');
		render(StandardPage, { props: pageProps });

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
			render(StandardPage, { props: pageProps });

			await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
			await fireEvent.click(screen.getByTestId('dialog-save-standard'));

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
			render(StandardPage, { props: pageProps });

			await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
			await fireEvent.click(screen.getByTestId('dialog-save-standard'));

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
		render(StandardPage, { props: pageProps });

		await fireEvent.click(screen.getByRole('button', { name: /Share/i }));
		expect(screen.getByTestId('dialog-stub-standard')).toBeInTheDocument();

		await fireEvent.click(screen.getByTestId('dialog-close-standard'));
		expect(screen.queryByTestId('dialog-stub-standard')).not.toBeInTheDocument();
	});
});
