/**
 * Shared dialog-dismiss tests for all visualization pages.
 *
 * Consolidates the three near-identical dialog/alert-dismiss test blocks that
 * were previously duplicated across 15 *-config-loading.svelte.test.ts files
 * (~700 lines of copy-pasted code).  These tests verify page-level integration
 * with SaveConfigDialog/ShareDialog stubs — not config-loading behavior — so
 * they belong in a single parameterized file.
 *
 * Tests per page:
 *  1. Dismiss save error toast
 *  2. Dismiss save success toast
 *  3. Close share dialog via onClose callback
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import {
	setMockPageUrl,
	createUnauthedPageData,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';

import LorenzPage from './lorenz/+page.svelte';
import RosslerPage from './rossler/+page.svelte';
import HenonPage from './henon/+page.svelte';
import LoziPage from './lozi/+page.svelte';
import LogisticPage from './logistic/+page.svelte';
import NewtonPage from './newton/+page.svelte';
import StandardPage from './standard/+page.svelte';
import BifurcationLogisticPage from './bifurcation-logistic/+page.svelte';
import BifurcationHenonPage from './bifurcation-henon/+page.svelte';
import ChaosEsthetiquePage from './chaos-esthetique/+page.svelte';
import LyapunovPage from './lyapunov/+page.svelte';
import ChuaPage from './chua/+page.svelte';
import CliffordPage from './clifford/+page.svelte';
import DoublePendulumPage from './double-pendulum/+page.svelte';
import IkedaPage from './ikeda/+page.svelte';

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

// Mock all renderers with BindableAllStub so pages mount without real canvases
vi.mock('$lib/components/visualizations/LorenzRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/RosslerRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/HenonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LoziRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LogisticRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/NewtonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/StandardRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/BifurcationLogisticRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/BifurcationHenonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/ChaosEsthetiqueRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LyapunovRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/ChuaRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/CliffordRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/DoublePendulumRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/IkedaRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

type PageEntry = {
	component: typeof LorenzPage;
	mapType: string;
	path: string;
};

const pages: PageEntry[] = [
	{ component: LorenzPage, mapType: 'lorenz', path: '/lorenz' },
	{ component: RosslerPage, mapType: 'rossler', path: '/rossler' },
	{ component: HenonPage, mapType: 'henon', path: '/henon' },
	{ component: LoziPage, mapType: 'lozi', path: '/lozi' },
	{ component: LogisticPage, mapType: 'logistic', path: '/logistic' },
	{ component: NewtonPage, mapType: 'newton', path: '/newton' },
	{ component: StandardPage, mapType: 'standard', path: '/standard' },
	{
		component: BifurcationLogisticPage,
		mapType: 'bifurcation-logistic',
		path: '/bifurcation-logistic'
	},
	{ component: BifurcationHenonPage, mapType: 'bifurcation-henon', path: '/bifurcation-henon' },
	{ component: ChaosEsthetiquePage, mapType: 'chaos-esthetique', path: '/chaos-esthetique' },
	{ component: LyapunovPage, mapType: 'lyapunov', path: '/lyapunov' },
	{ component: ChuaPage, mapType: 'chua', path: '/chua' },
	{ component: CliffordPage, mapType: 'clifford', path: '/clifford' },
	{ component: DoublePendulumPage, mapType: 'double-pendulum', path: '/double-pendulum' },
	{ component: IkedaPage, mapType: 'ikeda', path: '/ikeda' }
];

const unauthedData = createUnauthedPageData();

describe('shared dialog-dismiss behavior across visualization pages', () => {
	afterEach(() => cleanup());

	for (const { component, mapType, path } of pages) {
		describe(`${mapType} page`, () => {
			it('dismisses save error toast when the dismiss button is clicked', async () => {
				const originalFetch = globalThis.fetch;
				globalThis.fetch = vi.fn().mockResolvedValue({
					ok: false,
					json: () => Promise.resolve({ error: 'Save failed' })
				}) as unknown as typeof globalThis.fetch;

				try {
					setMockPageUrl(`http://localhost${path}`, unauthedData);
					render(component, { props: unauthedPageProps });

					await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
					await fireEvent.click(screen.getByTestId(`dialog-save-${mapType}`));

					await waitFor(() => {
						expect(
							screen.getByRole('button', { name: /Dismiss save error/i })
						).toBeInTheDocument();
					});

					await fireEvent.click(
						screen.getByRole('button', { name: /Dismiss save error/i })
					);
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
					setMockPageUrl(`http://localhost${path}`, unauthedData);
					render(component, { props: unauthedPageProps });

					await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
					await fireEvent.click(screen.getByTestId(`dialog-save-${mapType}`));

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
				setMockPageUrl(`http://localhost${path}`, unauthedData);
				render(component, { props: unauthedPageProps });

				await fireEvent.click(screen.getByRole('button', { name: /Share/i }));
				expect(screen.getByTestId(`dialog-stub-${mapType}`)).toBeInTheDocument();

				await fireEvent.click(screen.getByTestId(`dialog-close-${mapType}`));
				expect(screen.queryByTestId(`dialog-stub-${mapType}`)).not.toBeInTheDocument();
			});
		});
	}
});
