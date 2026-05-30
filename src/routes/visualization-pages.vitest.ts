import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import BifurcationHenonPage from './bifurcation-henon/+page.svelte';
import BifurcationLogisticPage from './bifurcation-logistic/+page.svelte';
import ChaosEsthetiquePage from './chaos-esthetique/+page.svelte';
import ChuaPage from './chua/+page.svelte';
import ChuaComparePage from './chua/compare/+page.svelte';
import HenonPage from './henon/+page.svelte';
import LogisticPage from './logistic/+page.svelte';
import LorenzPage from './lorenz/+page.svelte';
import LorenzComparePage from './lorenz/compare/+page.svelte';
import LoziPage from './lozi/+page.svelte';
import LoziComparePage from './lozi/compare/+page.svelte';
import LyapunovPage from './lyapunov/+page.svelte';
import NewtonPage from './newton/+page.svelte';
import RosslerPage from './rossler/+page.svelte';
import StandardPage from './standard/+page.svelte';
import StandardComparePage from './standard/compare/+page.svelte';

const pageData = {
	session: null,
	user: null,
	profile: null
} satisfies App.PageData;

const pageProps = {
	data: pageData
};

function createPage(url: string): Page {
	return {
		url: new URL(url) as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: pageData,
		form: null,
		state: {}
	};
}

type PageStore = {
	subscribe: (run: (value: Page) => void) => () => void;
	set: (value: Page) => void;
};

const pageStore: PageStore = vi.hoisted(() => {
	const baseData = { session: null, user: null, profile: null };
	const createInitialPage = (url: string): Page => ({
		url: new URL(url) as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: baseData,
		form: null,
		state: {}
	});
	let value = createInitialPage('http://localhost/');
	const subscribers = new Set<(value: Page) => void>();
	return {
		subscribe(run) {
			run(value);
			subscribers.add(run);
			return () => subscribers.delete(run);
		},
		set(next) {
			value = next;
			subscribers.forEach((subscriber) => {
				subscriber(value);
			});
		}
	};
});

vi.mock('$app/stores', () => ({
	page: {
		subscribe: pageStore.subscribe
	}
}));

vi.mock('$app/paths', () => ({
	base: ''
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/components/ui/SaveConfigDialog.svelte', async () => {
	const module = await import('$lib/components/testing/DialogStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/ui/ShareDialog.svelte', async () => {
	const module = await import('$lib/components/testing/DialogStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/ui/SnapshotButton.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/BifurcationHenonRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/BifurcationLogisticRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/ChaosEsthetiqueRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/HenonRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/LogisticRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/LorenzRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/LoziRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/LyapunovRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/NewtonRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/RosslerRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/StandardRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/ChuaRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

function setPageUrl(url: string) {
	pageStore.set(createPage(url));
}

describe('visualization pages', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders lorenz page', () => {
		setPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: pageProps });
		expect(screen.getByText('LORENZ_ATTRACTOR')).toBeInTheDocument();
	});

	it('renders rossler page', () => {
		setPageUrl('http://localhost/rossler');
		render(RosslerPage, { props: pageProps });
		expect(screen.getByText(/R.SSLER_ATTRACTOR/)).toBeInTheDocument();
	});

	it('renders henon page', () => {
		setPageUrl('http://localhost/henon');
		render(HenonPage, { props: pageProps });
		expect(screen.getByRole('heading', { level: 1, name: /H.NON_MAP/ })).toBeInTheDocument();
	});

	it('renders lozi page', () => {
		setPageUrl('http://localhost/lozi');
		render(LoziPage, { props: pageProps });
		expect(screen.getByText('LOZI_MAP')).toBeInTheDocument();
	});

	it('renders logistic page', () => {
		setPageUrl('http://localhost/logistic');
		render(LogisticPage, { props: pageProps });
		expect(screen.getByText('LOGISTIC_MAP')).toBeInTheDocument();
	});

	it('renders standard page', () => {
		setPageUrl('http://localhost/standard');
		render(StandardPage, { props: pageProps });
		expect(screen.getByText('STANDARD_MAP')).toBeInTheDocument();
	});

	it('renders newton page', () => {
		setPageUrl('http://localhost/newton');
		render(NewtonPage, { props: pageProps });
		expect(screen.getByText('NEWTON_FRACTAL')).toBeInTheDocument();
	});

	it('renders lyapunov page', () => {
		setPageUrl('http://localhost/lyapunov');
		render(LyapunovPage, { props: pageProps });
		expect(screen.getByText('LYAPUNOV_EXPONENTS')).toBeInTheDocument();
	});

	it('renders chaos esthetique page', () => {
		setPageUrl('http://localhost/chaos-esthetique');
		render(ChaosEsthetiquePage, { props: pageProps });
		expect(screen.getByText('CHAOS_ESTHETIQUE')).toBeInTheDocument();
	});

	it('renders chua page', () => {
		setPageUrl('http://localhost/chua');
		render(ChuaPage, { props: pageProps });
		expect(screen.getByText('CHUA_CIRCUIT')).toBeInTheDocument();
	});

	it('renders bifurcation logistic page', () => {
		setPageUrl('http://localhost/bifurcation-logistic');
		render(BifurcationLogisticPage, { props: pageProps });
		expect(screen.getByText('LOGISTIC_BIFURCATION')).toBeInTheDocument();
	});

	it('renders bifurcation henon page', () => {
		setPageUrl('http://localhost/bifurcation-henon');
		render(BifurcationHenonPage, { props: pageProps });
		expect(
			screen.getByRole('heading', { level: 1, name: /H.NON_BIFURCATION/ })
		).toBeInTheDocument();
	});

	it('renders lorenz compare page', () => {
		setPageUrl('http://localhost/lorenz/compare?compare=true');
		// Note: pageProps are intentionally omitted because LorenzComparePage uses the $page
		// store directly and doesn't export a data prop like other pages
		render(LorenzComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders lozi compare page', () => {
		setPageUrl('http://localhost/lozi/compare?compare=true');
		render(LoziComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders standard compare page', () => {
		setPageUrl('http://localhost/standard/compare?compare=true');
		render(StandardComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders chua compare page', () => {
		setPageUrl('http://localhost/chua/compare?compare=true');
		render(ChuaComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	type DialogAction = 'save' | 'share';

	const dialogTestCases: Array<{
		action: DialogAction;
		pageName: string;
		url: string;
		dialogTestId: string;
		renderPage: () => void;
	}> = [
		{
			action: 'save',
			pageName: 'lorenz',
			url: 'http://localhost/lorenz',
			dialogTestId: 'dialog-close-lorenz',
			renderPage: () => render(LorenzPage, { props: pageProps })
		},
		{
			action: 'share',
			pageName: 'lorenz',
			url: 'http://localhost/lorenz',
			dialogTestId: 'dialog-close-lorenz',
			renderPage: () => render(LorenzPage, { props: pageProps })
		},
		{
			action: 'save',
			pageName: 'henon',
			url: 'http://localhost/henon',
			dialogTestId: 'dialog-close-henon',
			renderPage: () => render(HenonPage, { props: pageProps })
		},
		{
			action: 'save',
			pageName: 'logistic',
			url: 'http://localhost/logistic',
			dialogTestId: 'dialog-close-logistic',
			renderPage: () => render(LogisticPage, { props: pageProps })
		},
		{
			action: 'save',
			pageName: 'rossler',
			url: 'http://localhost/rossler',
			dialogTestId: 'dialog-close-rossler',
			renderPage: () => render(RosslerPage, { props: pageProps })
		},
		{
			action: 'save',
			pageName: 'lozi',
			url: 'http://localhost/lozi',
			dialogTestId: 'dialog-close-lozi',
			renderPage: () => render(LoziPage, { props: pageProps })
		},
		{
			action: 'save',
			pageName: 'newton',
			url: 'http://localhost/newton',
			dialogTestId: 'dialog-close-newton',
			renderPage: () => render(NewtonPage, { props: pageProps })
		},
		{
			action: 'save',
			pageName: 'standard',
			url: 'http://localhost/standard',
			dialogTestId: 'dialog-close-standard',
			renderPage: () => render(StandardPage, { props: pageProps })
		},
		{
			action: 'save',
			pageName: 'lyapunov',
			url: 'http://localhost/lyapunov',
			dialogTestId: 'dialog-close-lyapunov',
			renderPage: () => render(LyapunovPage, { props: pageProps })
		},
		{
			action: 'save',
			pageName: 'chaos-esthetique',
			url: 'http://localhost/chaos-esthetique',
			dialogTestId: 'dialog-close-chaos-esthetique',
			renderPage: () => render(ChaosEsthetiquePage, { props: pageProps })
		},
		{
			action: 'save',
			pageName: 'bifurcation-logistic',
			url: 'http://localhost/bifurcation-logistic',
			dialogTestId: 'dialog-close-bifurcation-logistic',
			renderPage: () => render(BifurcationLogisticPage, { props: pageProps })
		},
		{
			action: 'save',
			pageName: 'bifurcation-henon',
			url: 'http://localhost/bifurcation-henon',
			dialogTestId: 'dialog-close-bifurcation-henon',
			renderPage: () => render(BifurcationHenonPage, { props: pageProps })
		},
		{
			action: 'save',
			pageName: 'chua',
			url: 'http://localhost/chua',
			dialogTestId: 'dialog-close-chua',
			renderPage: () => render(ChuaPage, { props: pageProps })
		},
		{
			action: 'share',
			pageName: 'chua',
			url: 'http://localhost/chua',
			dialogTestId: 'dialog-close-chua',
			renderPage: () => render(ChuaPage, { props: pageProps })
		}
	];

	it.each(dialogTestCases)(
		'opens and closes the $action dialog on $pageName page',
		async ({ action, url, dialogTestId, renderPage }) => {
			setPageUrl(url);
			renderPage();
			const actionBtn = screen.getByRole('button', { name: new RegExp(action, 'i') });
			await fireEvent.click(actionBtn);
			const dialogActionTestId = dialogTestId.replace('dialog-close-', `dialog-${action}-`);
			expect(await screen.findByTestId(dialogActionTestId)).toBeInTheDocument();
			const closeBtn = await screen.findByTestId(dialogTestId);
			await fireEvent.click(closeBtn);
			expect(screen.queryByTestId(dialogTestId)).not.toBeInTheDocument();
		}
	);
});
