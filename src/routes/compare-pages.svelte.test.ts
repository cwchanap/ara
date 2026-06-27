/**
 * Tests for compare/side-by-side visualization pages that are not yet covered.
 * Covers: bifurcation-henon, bifurcation-logistic, chaos-esthetique,
 *         henon, logistic, lyapunov, newton, rossler compare pages.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';

import BifurcationHenonComparePage from './bifurcation-henon/compare/+page.svelte';
import BifurcationLogisticComparePage from './bifurcation-logistic/compare/+page.svelte';
import ChaosEsthetiqueComparePage from './chaos-esthetique/compare/+page.svelte';
import HenonComparePage from './henon/compare/+page.svelte';
import LogisticComparePage from './logistic/compare/+page.svelte';
import LyapunovComparePage from './lyapunov/compare/+page.svelte';
import NewtonComparePage from './newton/compare/+page.svelte';
import RosslerComparePage from './rossler/compare/+page.svelte';

const pageStore = vi.hoisted(() => {
	const baseData = { session: null, user: null, profile: null };
	let value: Page = {
		url: new URL('http://localhost/') as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: baseData,
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
			subscribers.forEach((subscriber) => subscriber(value));
		}
	};
});

vi.mock('$app/stores', () => ({
	page: { subscribe: pageStore.subscribe }
}));

vi.mock('$app/paths', () => ({ base: '' }));

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
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/BifurcationLogisticRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/ChaosEsthetiqueRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/HenonRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/LogisticRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/LyapunovRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/NewtonRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/RosslerRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

const baseData = { session: null, user: null, profile: null } satisfies App.PageData;

function setPageUrl(url: string) {
	pageStore.set({
		url: new URL(url) as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: baseData,
		form: null,
		state: {}
	});
}

describe('compare pages rendering', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders bifurcation-henon compare page', () => {
		setPageUrl('http://localhost/bifurcation-henon/compare?compare=true');
		render(BifurcationHenonComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders bifurcation-logistic compare page', () => {
		setPageUrl('http://localhost/bifurcation-logistic/compare?compare=true');
		render(BifurcationLogisticComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders chaos-esthetique compare page', () => {
		setPageUrl('http://localhost/chaos-esthetique/compare?compare=true');
		render(ChaosEsthetiqueComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders henon compare page', () => {
		setPageUrl('http://localhost/henon/compare?compare=true');
		render(HenonComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders logistic compare page', () => {
		setPageUrl('http://localhost/logistic/compare?compare=true');
		render(LogisticComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders lyapunov compare page', () => {
		setPageUrl('http://localhost/lyapunov/compare?compare=true');
		render(LyapunovComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders newton compare page', () => {
		setPageUrl('http://localhost/newton/compare?compare=true');
		render(NewtonComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});

	it('renders rossler compare page', () => {
		setPageUrl('http://localhost/rossler/compare?compare=true');
		render(RosslerComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
	});
});
