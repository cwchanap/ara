import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import BifurcationHenonPage from './bifurcation-henon/+page.svelte';
import BifurcationLogisticPage from './bifurcation-logistic/+page.svelte';
import ChaosEsthetiquePage from './chaos-esthetique/+page.svelte';
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

	it('opens and closes the save dialog on lorenz page', async () => {
		setPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: pageProps });
		// Open the save dialog
		const saveBtn = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveBtn);
		// Dialog stub renders with close button when open
		const closeBtn = await screen.findByTestId('dialog-close-lorenz');
		// Close via the stub's close button (covers the onClose callback)
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-lorenz')).not.toBeInTheDocument();
	});

	it('opens and closes the share dialog on lorenz page', async () => {
		setPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: pageProps });
		const shareBtn = screen.getByRole('button', { name: /share/i });
		await fireEvent.click(shareBtn);
		const closeBtn = await screen.findByTestId('dialog-close-lorenz');
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-lorenz')).not.toBeInTheDocument();
	});

	it('opens and closes save dialog on henon page', async () => {
		setPageUrl('http://localhost/henon');
		render(HenonPage, { props: pageProps });
		const saveBtn = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = await screen.findByTestId('dialog-close-henon');
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-henon')).not.toBeInTheDocument();
	});

	it('opens and closes save dialog on logistic page', async () => {
		setPageUrl('http://localhost/logistic');
		render(LogisticPage, { props: pageProps });
		const saveBtn = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = await screen.findByTestId('dialog-close-logistic');
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-logistic')).not.toBeInTheDocument();
	});

	it('opens and closes save dialog on rossler page', async () => {
		setPageUrl('http://localhost/rossler');
		render(RosslerPage, { props: pageProps });
		const saveBtn = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = await screen.findByTestId('dialog-close-rossler');
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-rossler')).not.toBeInTheDocument();
	});

	it('opens and closes save dialog on lozi page', async () => {
		setPageUrl('http://localhost/lozi');
		render(LoziPage, { props: pageProps });
		const saveBtn = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = await screen.findByTestId('dialog-close-lozi');
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-lozi')).not.toBeInTheDocument();
	});

	it('opens and closes save dialog on newton page', async () => {
		setPageUrl('http://localhost/newton');
		render(NewtonPage, { props: pageProps });
		const saveBtn = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = await screen.findByTestId('dialog-close-newton');
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-newton')).not.toBeInTheDocument();
	});

	it('opens and closes save dialog on standard page', async () => {
		setPageUrl('http://localhost/standard');
		render(StandardPage, { props: pageProps });
		const saveBtn = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = await screen.findByTestId('dialog-close-standard');
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-standard')).not.toBeInTheDocument();
	});

	it('opens and closes save dialog on lyapunov page', async () => {
		setPageUrl('http://localhost/lyapunov');
		render(LyapunovPage, { props: pageProps });
		const saveBtn = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = await screen.findByTestId('dialog-close-lyapunov');
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-lyapunov')).not.toBeInTheDocument();
	});

	it('opens and closes save dialog on chaos-esthetique page', async () => {
		setPageUrl('http://localhost/chaos-esthetique');
		render(ChaosEsthetiquePage, { props: pageProps });
		const saveBtn = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = await screen.findByTestId('dialog-close-chaos-esthetique');
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-chaos-esthetique')).not.toBeInTheDocument();
	});

	it('opens and closes save dialog on bifurcation-logistic page', async () => {
		setPageUrl('http://localhost/bifurcation-logistic');
		render(BifurcationLogisticPage, { props: pageProps });
		const saveBtn = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = await screen.findByTestId('dialog-close-bifurcation-logistic');
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-bifurcation-logistic')).not.toBeInTheDocument();
	});

	it('opens and closes save dialog on bifurcation-henon page', async () => {
		setPageUrl('http://localhost/bifurcation-henon');
		render(BifurcationHenonPage, { props: pageProps });
		const saveBtn = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = await screen.findByTestId('dialog-close-bifurcation-henon');
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-close-bifurcation-henon')).not.toBeInTheDocument();
	});
});
