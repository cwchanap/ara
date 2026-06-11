/**
 * Tests for config loading paths in visualization pages.
 * Covers: rossler, lozi, standard, lyapunov config loading via configId, share, and config URL params.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';

import RosslerPage from './rossler/+page.svelte';
import LoziPage from './lozi/+page.svelte';
import StandardPage from './standard/+page.svelte';
import LyapunovPage from './lyapunov/+page.svelte';
import BifurcationLogisticPage from './bifurcation-logistic/+page.svelte';
import BifurcationHenonPage from './bifurcation-henon/+page.svelte';
import ChaosEsthetiquePage from './chaos-esthetique/+page.svelte';
import HenonPage from './henon/+page.svelte';
import LogisticPage from './logistic/+page.svelte';
import NewtonPage from './newton/+page.svelte';
import IkedaPage from './ikeda/+page.svelte';

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
		url: new URL('http://localhost/') as Page['url'],
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

// --- Renderer stubs ---
vi.mock('$lib/components/visualizations/RosslerRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LoziRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/StandardRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LyapunovRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/BifurcationLogisticRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/HenonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LogisticRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/BifurcationHenonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/ChaosEsthetiqueRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/NewtonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/IkedaRenderer.svelte', async () => {
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

// ============================================================
// ROSSLER – uses onMount() for config loading
// ============================================================
describe('rossler page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it('loads config from configId and applies parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { type: 'rossler', a: 0.3, b: 0.5, c: 10.0 },
			source: 'api'
		});

		setPageUrl('http://localhost/rossler?configId=test-id-1');
		render(RosslerPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'test-id-1', mapType: 'rossler' })
			);
		});

		// Parameter slider values should reflect loaded config
		await waitFor(() => {
			const aInput = document.querySelector<HTMLInputElement>('#param-a');
			expect(aInput?.value).toBe('0.3');
		});
	});

	it('loads config from share code and applies parameters', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { type: 'rossler', a: 0.2, b: 0.3, c: 7.5 },
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/rossler?share=abc123');
		render(RosslerPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'abc123', mapType: 'rossler' })
			);
		});

		await waitFor(() => {
			const bInput = document.querySelector<HTMLInputElement>('#param-b');
			expect(bInput?.value).toBe('0.3');
		});
	});

	it('shows config error alert when configId load returns error', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		});

		setPageUrl('http://localhost/rossler?configId=bad-id');
		render(RosslerPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
		expect(screen.getByText('Configuration not found')).toBeInTheDocument();
	});

	it('shows stability warning when loaded config has out-of-range parameters', async () => {
		// rossler stable range for a: [0.126, 0.43295] — use 0.5 to trigger warning
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { type: 'rossler', a: 0.5, b: 0.2, c: 5.7 },
			source: 'api'
		});

		setPageUrl('http://localhost/rossler?configId=unstable-id');
		render(RosslerPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});
	});

	it('applies config from inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: { type: 'rossler', a: 0.2, b: 0.8, c: 12.0 }
		});

		const encoded = encodeURIComponent(
			JSON.stringify({ type: 'rossler', a: 0.2, b: 0.8, c: 12.0 })
		);
		setPageUrl(`http://localhost/rossler?config=${encoded}`);
		render(RosslerPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'rossler' })
			);
		});

		await waitFor(() => {
			const cInput = document.querySelector<HTMLInputElement>('#param-c');
			expect(cInput?.value).toBe('12');
		});
	});

	it('shows error when inline config param is invalid', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Invalid parameters structure',
			errors: ['Invalid parameters structure'],
			logMessage: 'err',
			logDetails: {}
		});

		setPageUrl('http://localhost/rossler?config=invalid-data');
		render(RosslerPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});
});

// ============================================================
// LOZI – uses $effect() for config loading
// ============================================================
describe('lozi page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it('loads config from configId and applies parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { type: 'lozi', a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 3000 },
			source: 'api'
		});

		setPageUrl('http://localhost/lozi?configId=lozi-id-1');
		render(LoziPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'lozi-id-1', mapType: 'lozi' })
			);
		});
	});

	it('loads config from share code', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { type: 'lozi', a: 1.5, b: 0.3, x0: 0, y0: 0, iterations: 2000 },
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/lozi?share=lozi-share-1');
		render(LoziPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'lozi-share-1', mapType: 'lozi' })
			);
		});
	});

	it('shows error when configId load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Config not found',
			errors: ['Config not found']
		});

		setPageUrl('http://localhost/lozi?configId=bad-lozi-id');
		render(LoziPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies config from inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: { type: 'lozi', a: 1.2, b: 0.4, x0: 0.1, y0: 0.1, iterations: 1500 }
		});

		const encoded = encodeURIComponent(
			JSON.stringify({ type: 'lozi', a: 1.2, b: 0.4, x0: 0.1, y0: 0.1, iterations: 1500 })
		);
		setPageUrl(`http://localhost/lozi?config=${encoded}`);
		render(LoziPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'lozi' })
			);
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
		render(LoziPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows stability warning when loaded config has out-of-range parameters', async () => {
		// lozi stable range for b: [0, 1] — use 1.5 to trigger warning
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { type: 'lozi', a: 1.7, b: 1.5, x0: 0, y0: 0, iterations: 2000 },
			source: 'api'
		});

		setPageUrl('http://localhost/lozi?configId=unstable-lozi');
		render(LoziPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});
	});
});

// ============================================================
// STANDARD – uses $effect() for config loading
// ============================================================
describe('standard page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it('loads config from configId', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { type: 'standard', k: 2.5, numP: 15, numQ: 15, iterations: 10000 },
			source: 'api'
		});

		setPageUrl('http://localhost/standard?configId=std-id-1');
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'std-id-1', mapType: 'standard' })
			);
		});
	});

	it('loads config from share code', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { type: 'standard', k: 1.0, numP: 20, numQ: 20, iterations: 5000 },
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/standard?share=std-share');
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'std-share', mapType: 'standard' })
			);
		});
	});

	it('shows error when configId load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Standard config not found']
		});

		setPageUrl('http://localhost/standard?configId=bad-std-id');
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: { type: 'standard', k: 0.5, numP: 5, numQ: 5, iterations: 1000 }
		});

		const encoded = encodeURIComponent(
			JSON.stringify({ type: 'standard', k: 0.5, numP: 5, numQ: 5, iterations: 1000 })
		);
		setPageUrl(`http://localhost/standard?config=${encoded}`);
		render(StandardPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'standard' })
			);
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
});

// ============================================================
// LYAPUNOV – uses useConfigLoader() inside $effect()
// ============================================================
describe('lyapunov page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it('loads config from configId', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'lyapunov',
				rMin: 2.8,
				rMax: 3.8,
				iterations: 500,
				transientIterations: 200
			},
			source: 'api'
		});

		setPageUrl('http://localhost/lyapunov?configId=lyap-id-1');
		render(LyapunovPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'lyap-id-1', mapType: 'lyapunov' })
			);
		});
	});

	it('loads config from share code', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'lyapunov',
				rMin: 3.0,
				rMax: 4.0,
				iterations: 800,
				transientIterations: 300
			},
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/lyapunov?share=lyap-share');
		render(LyapunovPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'lyap-share', mapType: 'lyapunov' })
			);
		});
	});

	it('shows error when configId load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Lyapunov config not found']
		});

		setPageUrl('http://localhost/lyapunov?configId=bad-lyap-id');
		render(LyapunovPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'lyapunov',
				rMin: 2.6,
				rMax: 3.9,
				iterations: 600,
				transientIterations: 250
			}
		});

		const encoded = encodeURIComponent(
			JSON.stringify({
				type: 'lyapunov',
				rMin: 2.6,
				rMax: 3.9,
				iterations: 600,
				transientIterations: 250
			})
		);
		setPageUrl(`http://localhost/lyapunov?config=${encoded}`);
		render(LyapunovPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'lyapunov' })
			);
		});
	});
});

// ============================================================
// BIFURCATION-LOGISTIC – config loading
// ============================================================
describe('bifurcation-logistic page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it('loads config from configId', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { type: 'bifurcation-logistic', rMin: 2.5, rMax: 4.0, maxIterations: 800 },
			source: 'api'
		});

		setPageUrl('http://localhost/bifurcation-logistic?configId=biflog-id');
		render(BifurcationLogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'biflog-id', mapType: 'bifurcation-logistic' })
			);
		});
	});

	it('shows error when configId load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Config not found']
		});

		setPageUrl('http://localhost/bifurcation-logistic?configId=bad-id');
		render(BifurcationLogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: { type: 'bifurcation-logistic', rMin: 3.0, rMax: 4.0, maxIterations: 500 }
		});

		const encoded = encodeURIComponent(
			JSON.stringify({
				type: 'bifurcation-logistic',
				rMin: 3.0,
				rMax: 4.0,
				maxIterations: 500
			})
		);
		setPageUrl(`http://localhost/bifurcation-logistic?config=${encoded}`);
		render(BifurcationLogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'bifurcation-logistic' })
			);
		});
	});
});

// ============================================================
// HENON – config loading
// ============================================================
describe('henon page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it('loads config from configId', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { type: 'henon', a: 1.4, b: 0.3, iterations: 10000 },
			source: 'api'
		});

		setPageUrl('http://localhost/henon?configId=henon-id');
		render(HenonPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'henon-id', mapType: 'henon' })
			);
		});
	});

	it('shows error when load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Henon config not found']
		});

		setPageUrl('http://localhost/henon?configId=bad-henon-id');
		render(HenonPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies inline config param', async () => {
		parseConfigParamMock.mockReturnValue({
			ok: true,
			parameters: { type: 'henon', a: 1.2, b: 0.4, iterations: 5000 }
		});

		const encoded = encodeURIComponent(
			JSON.stringify({ type: 'henon', a: 1.2, b: 0.4, iterations: 5000 })
		);
		setPageUrl(`http://localhost/henon?config=${encoded}`);
		render(HenonPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'henon' })
			);
		});
	});
});

// ============================================================
// LOGISTIC – config loading
// ============================================================
describe('logistic page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it('loads config from configId', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: { type: 'logistic', r: 3.5, x0: 0.5, iterations: 200 },
			source: 'api'
		});

		setPageUrl('http://localhost/logistic?configId=log-id');
		render(LogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'log-id', mapType: 'logistic' })
			);
		});
	});

	it('shows error when load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Logistic config not found']
		});

		setPageUrl('http://localhost/logistic?configId=bad-log-id');
		render(LogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies inline config param', async () => {
		parseConfigParamMock.mockReturnValue({
			ok: true,
			parameters: { type: 'logistic', r: 3.8, x0: 0.3, iterations: 100 }
		});

		const encoded = encodeURIComponent(
			JSON.stringify({ type: 'logistic', r: 3.8, x0: 0.3, iterations: 100 })
		);
		setPageUrl(`http://localhost/logistic?config=${encoded}`);
		render(LogisticPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'logistic' })
			);
		});
	});
});

// ============================================================
// BIFURCATION-HENON – uses $effect() for config loading
// ============================================================
describe('bifurcation-henon page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it('loads config from configId', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'bifurcation-henon',
				aMin: 1.05,
				aMax: 1.09,
				b: 0.3,
				maxIterations: 800
			},
			source: 'api'
		});

		setPageUrl('http://localhost/bifurcation-henon?configId=bh-id-1');
		render(BifurcationHenonPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'bh-id-1', mapType: 'bifurcation-henon' })
			);
		});
	});

	it('loads config from share code', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'bifurcation-henon',
				aMin: 1.06,
				aMax: 1.08,
				b: 0.28,
				maxIterations: 600
			},
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/bifurcation-henon?share=bh-share-1');
		render(BifurcationHenonPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'bh-share-1', mapType: 'bifurcation-henon' })
			);
		});
	});

	it('shows error when configId load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Bifurcation-henon config not found']
		});

		setPageUrl('http://localhost/bifurcation-henon?configId=bad-bh-id');
		render(BifurcationHenonPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'bifurcation-henon',
				aMin: 1.04,
				aMax: 1.1,
				b: 0.3,
				maxIterations: 1000
			}
		});

		const encoded = encodeURIComponent(
			JSON.stringify({
				type: 'bifurcation-henon',
				aMin: 1.04,
				aMax: 1.1,
				b: 0.3,
				maxIterations: 1000
			})
		);
		setPageUrl(`http://localhost/bifurcation-henon?config=${encoded}`);
		render(BifurcationHenonPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'bifurcation-henon' })
			);
		});
	});

	it('shows error when inline config param is invalid', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Invalid parameters',
			errors: ['Bad bifurcation-henon params'],
			logMessage: 'err',
			logDetails: {}
		});

		setPageUrl('http://localhost/bifurcation-henon?config=bad-data');
		render(BifurcationHenonPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows stability warning when loaded params are out of range', async () => {
		// bifurcation-henon aMin range: [0, 2], aMax range: [0, 2]
		// trigger by making aMin >= aMax
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'bifurcation-henon',
				aMin: 1.1,
				aMax: 1.04,
				b: 0.3,
				maxIterations: 500
			},
			source: 'api'
		});

		setPageUrl('http://localhost/bifurcation-henon?configId=unstable-bh');
		render(BifurcationHenonPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});
	});
});

// ============================================================
// CHAOS-ESTHETIQUE – uses $effect() for config loading
// ============================================================
describe('chaos-esthetique page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it('loads config from configId', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'chaos-esthetique',
				a: 0.8,
				b: 0.95,
				x0: 10,
				y0: 5,
				iterations: 8000
			},
			source: 'api'
		});

		setPageUrl('http://localhost/chaos-esthetique?configId=ce-id-1');
		render(ChaosEsthetiquePage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'ce-id-1', mapType: 'chaos-esthetique' })
			);
		});
	});

	it('loads config from share code', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'chaos-esthetique',
				a: 0.7,
				b: 0.999,
				x0: 15,
				y0: 0,
				iterations: 5000
			},
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/chaos-esthetique?share=ce-share-1');
		render(ChaosEsthetiquePage, { props: pageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'ce-share-1', mapType: 'chaos-esthetique' })
			);
		});
	});

	it('shows error when configId load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Chaos esthetique config not found']
		});

		setPageUrl('http://localhost/chaos-esthetique?configId=bad-ce-id');
		render(ChaosEsthetiquePage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'chaos-esthetique',
				a: 0.9,
				b: 0.9999,
				x0: 18,
				y0: 0,
				iterations: 10000
			}
		});

		const encoded = encodeURIComponent(
			JSON.stringify({
				type: 'chaos-esthetique',
				a: 0.9,
				b: 0.9999,
				x0: 18,
				y0: 0,
				iterations: 10000
			})
		);
		setPageUrl(`http://localhost/chaos-esthetique?config=${encoded}`);
		render(ChaosEsthetiquePage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'chaos-esthetique' })
			);
		});
	});

	it('shows error when inline config param is invalid', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Invalid parameters',
			errors: ['Bad chaos-esthetique params'],
			logMessage: 'err',
			logDetails: {}
		});

		setPageUrl('http://localhost/chaos-esthetique?config=bad-data');
		render(ChaosEsthetiquePage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});
});

// ============================================================
// NEWTON – config loading (uses onMount)
// ============================================================
describe('newton page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it('loads config from configId', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'newton',
				xMin: -1.5,
				xMax: 1.5,
				yMin: -1.5,
				yMax: 1.5,
				maxIterations: 50
			},
			source: 'api'
		});

		setPageUrl('http://localhost/newton?configId=newton-id-1');
		render(NewtonPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'newton-id-1', mapType: 'newton' })
			);
		});
	});

	it('loads config from share code', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'newton',
				xMin: -2,
				xMax: 2,
				yMin: -2,
				yMax: 2,
				maxIterations: 100
			},
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/newton?share=newton-share');
		render(NewtonPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'newton-share', mapType: 'newton' })
			);
		});
	});

	it('shows error when configId load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Newton config not found']
		});

		setPageUrl('http://localhost/newton?configId=bad-newton-id');
		render(NewtonPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('applies inline config param', async () => {
		parseConfigParamMock.mockReturnValue({
			ok: true,
			parameters: { type: 'newton', xMin: -1, xMax: 1, yMin: -1, yMax: 1, maxIterations: 30 }
		});

		const encoded = encodeURIComponent(
			JSON.stringify({
				type: 'newton',
				xMin: -1,
				xMax: 1,
				yMin: -1,
				yMax: 1,
				maxIterations: 30
			})
		);
		setPageUrl(`http://localhost/newton?config=${encoded}`);
		render(NewtonPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'newton' })
			);
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
		render(NewtonPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});
});

// ============================================================
// IKEDA – uses $effect() for config loading
// ============================================================
describe('ikeda page – config loading', () => {
	beforeEach(() => {
		loadSavedConfigParametersMock.mockReset();
		loadSharedConfigParametersMock.mockReset();
		parseConfigParamMock.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it('loads config from configId and applies parameters', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'ikeda',
				u: 0.6,
				x0: 0.5,
				y0: -0.5,
				iterations: 500,
				burnIn: 50,
				renderMode: 'single',
				seeds: 100,
				colorMode: 'seed',
				pointSize: 2,
				opacity: 0.8
			},
			source: 'api'
		});

		setPageUrl('http://localhost/ikeda?configId=ikeda-id-1');
		render(IkedaPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSavedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ configId: 'ikeda-id-1', mapType: 'ikeda' })
			);
		});

		await waitFor(() => {
			const uSlider = screen.getByTestId('slider-u') as HTMLInputElement;
			expect(uSlider.value).toBe('0.6');
		});
	});

	it('loads config from share code and applies parameters', async () => {
		loadSharedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'ikeda',
				u: 0.7,
				x0: 0.2,
				y0: 0.1,
				iterations: 1000,
				burnIn: 100,
				renderMode: 'multi',
				seeds: 500,
				colorMode: 'iteration',
				pointSize: 1.5,
				opacity: 0.6
			},
			source: 'sharedApi'
		});

		setPageUrl('http://localhost/ikeda?share=ikeda-share-1');
		render(IkedaPage, { props: pageProps });

		await waitFor(() => {
			expect(loadSharedConfigParametersMock).toHaveBeenCalledWith(
				expect.objectContaining({ shareCode: 'ikeda-share-1', mapType: 'ikeda' })
			);
		});

		await waitFor(() => {
			const uSlider = screen.getByTestId('slider-u') as HTMLInputElement;
			expect(uSlider.value).toBe('0.7');
		});
	});

	it('shows config error alert when configId load fails', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: false,
			error: 'Not found',
			errors: ['Configuration not found']
		});

		setPageUrl('http://localhost/ikeda?configId=bad-id');
		render(IkedaPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows config error alert when configId load returns null', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce(
			null as unknown as Parameters<typeof loadSavedConfigParametersMock>[0]
		);

		setPageUrl('http://localhost/ikeda?configId=null-id');
		render(IkedaPage, { props: pageProps });

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
		render(IkedaPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows stability warning when loaded config has burnIn >= iterations', async () => {
		loadSavedConfigParametersMock.mockResolvedValueOnce({
			ok: true,
			parameters: {
				type: 'ikeda',
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 50,
				burnIn: 100
			},
			source: 'api'
		});

		setPageUrl('http://localhost/ikeda?configId=unstable-ikeda');
		render(IkedaPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});
	});

	it('applies config from inline config param', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'ikeda',
				u: 0.8,
				x0: 0.3,
				y0: 0.1,
				iterations: 2000,
				burnIn: 200,
				renderMode: 'single',
				seeds: 100,
				colorMode: 'radius',
				pointSize: 3,
				opacity: 0.4
			}
		});

		setPageUrl('http://localhost/ikeda?config=some-encoded-data');
		render(IkedaPage, { props: pageProps });

		await waitFor(() => {
			expect(parseConfigParamMock).toHaveBeenCalledWith(
				expect.objectContaining({ mapType: 'ikeda', configParam: 'some-encoded-data' })
			);
		});

		await waitFor(() => {
			const uSlider = screen.getByTestId('slider-u') as HTMLInputElement;
			expect(uSlider.value).toBe('0.8');
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
		render(IkedaPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('shows error when config loading throws an exception', async () => {
		loadSavedConfigParametersMock.mockRejectedValueOnce(new Error('Network error'));

		setPageUrl('http://localhost/ikeda?configId=error-id');
		render(IkedaPage, { props: pageProps });

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});
});
