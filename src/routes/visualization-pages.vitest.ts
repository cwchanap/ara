import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import BifurcationHenonPage from './bifurcation-henon/+page.svelte';
import BifurcationLogisticPage from './bifurcation-logistic/+page.svelte';
import ChaosEsthetiquePage from './chaos-esthetique/+page.svelte';
import HenonPage from './henon/+page.svelte';
import LogisticPage from './logistic/+page.svelte';
import LorenzPage from './lorenz/+page.svelte';
import LorenzComparePage from './lorenz/compare/+page.svelte';
import LoziPage from './lozi/+page.svelte';
import LyapunovPage from './lyapunov/+page.svelte';
import NewtonPage from './newton/+page.svelte';
import RosslerPage from './rossler/+page.svelte';
import StandardPage from './standard/+page.svelte';

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
			subscribers.forEach((subscriber) => subscriber(value));
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
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/ui/ShareDialog.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
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
		pageStore.set(createPage('http://localhost/lorenz/compare?compare=true'));
		render(LorenzComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
	});
});
