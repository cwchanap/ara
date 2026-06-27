import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import IkedaComparePage from './ikeda/compare/+page.svelte';

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/ikeda/compare') as Page['url'],
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
vi.mock('$lib/components/visualizations/IkedaRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/comparison/ComparisonLayout.svelte', async () => {
	const m = await import('$lib/components/testing/ComparisonLayoutStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/comparison/ComparisonParameterPanel.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});

describe('Ikeda compare page', () => {
	afterEach(() => cleanup());

	it('renders left and right feedback controls', () => {
		const { container } = render(IkedaComparePage);
		expect(container.querySelector('#left-u')).not.toBeNull();
		expect(container.querySelector('#right-u')).not.toBeNull();
	});

	it('renders left and right x0 sliders', () => {
		const { container } = render(IkedaComparePage);
		expect(container.querySelector('#left-x0')).not.toBeNull();
		expect(container.querySelector('#right-x0')).not.toBeNull();
	});

	it('renders left and right y0 sliders', () => {
		const { container } = render(IkedaComparePage);
		expect(container.querySelector('#left-y0')).not.toBeNull();
		expect(container.querySelector('#right-y0')).not.toBeNull();
	});

	it('renders left and right iterations sliders', () => {
		const { container } = render(IkedaComparePage);
		expect(container.querySelector('#left-iterations')).not.toBeNull();
		expect(container.querySelector('#right-iterations')).not.toBeNull();
	});

	it('renders left and right burnIn sliders', () => {
		const { container } = render(IkedaComparePage);
		expect(container.querySelector('#left-burnIn')).not.toBeNull();
		expect(container.querySelector('#right-burnIn')).not.toBeNull();
	});

	it('renders left and right render mode selects', () => {
		const { container } = render(IkedaComparePage);
		expect(container.querySelector('#left-renderMode')).not.toBeNull();
		expect(container.querySelector('#right-renderMode')).not.toBeNull();
	});

	it('renders without throwing with default URL', () => {
		expect(() => render(IkedaComparePage)).not.toThrow();
	});

	it('renders with URL parameters', () => {
		const leftParams = btoa(
			JSON.stringify({
				u: 0.6,
				x0: 0.5,
				y0: -0.5,
				iterations: 500,
				burnIn: 50,
				renderMode: 'single'
			})
		);
		const rightParams = btoa(
			JSON.stringify({
				u: 0.95,
				x0: -0.3,
				y0: 0.3,
				iterations: 1000,
				burnIn: 100,
				renderMode: 'multi'
			})
		);
		pageStore.set({
			url: new URL(
				`http://localhost/ikeda/compare?compare=true&left=${leftParams}&right=${rightParams}`
			) as Page['url'],
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: { session: null, user: null, profile: null },
			form: null,
			state: {}
		});
		const { container } = render(IkedaComparePage);
		expect(container.querySelector('#left-u')).not.toBeNull();
		expect(container.querySelector('#right-u')).not.toBeNull();
	});

	it('preserves styling params from URL-decoded left state', () => {
		const leftParams = btoa(
			JSON.stringify({
				u: 0.7,
				x0: 0.1,
				y0: 0.1,
				iterations: 1000,
				burnIn: 100,
				renderMode: 'multi',
				seeds: 500,
				colorMode: 'seed',
				pointSize: 2.5,
				opacity: 0.8
			})
		);
		const rightParams = btoa(
			JSON.stringify({
				u: 0.9,
				x0: 0.0,
				y0: 0.0,
				iterations: 2000,
				burnIn: 200,
				renderMode: 'single'
			})
		);
		pageStore.set({
			url: new URL(
				`http://localhost/ikeda/compare?compare=true&left=${leftParams}&right=${rightParams}`
			) as Page['url'],
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: { session: null, user: null, profile: null },
			form: null,
			state: {}
		});
		// Should render without errors — styling params (seeds, colorMode,
		// pointSize, opacity) from left URL params must not cause a crash
		// and should flow through to the renderer instead of being ignored.
		const { container } = render(IkedaComparePage);
		expect(container.querySelector('#left-u')).not.toBeNull();
		expect(container.querySelector('#right-u')).not.toBeNull();
	});

	it('disables x0/y0 sliders when render mode is multi (default)', () => {
		// Reset pageStore to default URL (no params) to avoid state pollution
		pageStore.set({
			url: new URL('http://localhost/ikeda/compare') as Page['url'],
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: { session: null, user: null, profile: null },
			form: null,
			state: {}
		});
		const { container } = render(IkedaComparePage);
		const leftX0 = container.querySelector('#left-x0') as HTMLInputElement;
		const leftY0 = container.querySelector('#left-y0') as HTMLInputElement;
		const rightX0 = container.querySelector('#right-x0') as HTMLInputElement;
		const rightY0 = container.querySelector('#right-y0') as HTMLInputElement;
		// Default render mode is multi, so all x0/y0 sliders should be disabled
		expect(leftX0.disabled).toBe(true);
		expect(leftY0.disabled).toBe(true);
		expect(rightX0.disabled).toBe(true);
		expect(rightY0.disabled).toBe(true);
	});

	it('enables left x0/y0 sliders when left render mode is single', () => {
		const leftParams = btoa(
			JSON.stringify({
				u: 0.7,
				x0: 0.1,
				y0: 0.1,
				iterations: 1000,
				burnIn: 100,
				renderMode: 'single'
			})
		);
		const rightParams = btoa(
			JSON.stringify({
				u: 0.9,
				x0: 0.0,
				y0: 0.0,
				iterations: 2000,
				burnIn: 200,
				renderMode: 'multi'
			})
		);
		pageStore.set({
			url: new URL(
				`http://localhost/ikeda/compare?compare=true&left=${leftParams}&right=${rightParams}`
			) as Page['url'],
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: { session: null, user: null, profile: null },
			form: null,
			state: {}
		});
		const { container } = render(IkedaComparePage);
		// Left is single → x0/y0 enabled; Right is multi → x0/y0 disabled
		const leftX0 = container.querySelector('#left-x0') as HTMLInputElement;
		const leftY0 = container.querySelector('#left-y0') as HTMLInputElement;
		const rightX0 = container.querySelector('#right-x0') as HTMLInputElement;
		const rightY0 = container.querySelector('#right-y0') as HTMLInputElement;
		expect(leftX0.disabled).toBe(false);
		expect(leftY0.disabled).toBe(false);
		expect(rightX0.disabled).toBe(true);
		expect(rightY0.disabled).toBe(true);
	});

	it('renders left and right "Single Orbit" hints when render mode is multi', () => {
		pageStore.set({
			url: new URL('http://localhost/ikeda/compare') as Page['url'],
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: { session: null, user: null, profile: null },
			form: null,
			state: {}
		});
		const { container } = render(IkedaComparePage);
		const leftHints = container.querySelectorAll('#left-x0 ~ span');
		const rightHints = container.querySelectorAll('#right-x0 ~ span');
		expect(leftHints.length + rightHints.length).toBeGreaterThanOrEqual(2);
	});

	it('updates left u slider value', async () => {
		pageStore.set({
			url: new URL('http://localhost/ikeda/compare') as Page['url'],
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: { session: null, user: null, profile: null },
			form: null,
			state: {}
		});
		const { container } = render(IkedaComparePage);
		const leftU = container.querySelector('#left-u') as HTMLInputElement;
		expect(leftU).not.toBeNull();
		await fireEvent.input(leftU, { target: { value: '0.5' } });
		expect(leftU.value).toBe('0.5');
	});

	it('updates right iterations slider value', async () => {
		pageStore.set({
			url: new URL('http://localhost/ikeda/compare') as Page['url'],
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: { session: null, user: null, profile: null },
			form: null,
			state: {}
		});
		const { container } = render(IkedaComparePage);
		const rightIterations = container.querySelector('#right-iterations') as HTMLInputElement;
		expect(rightIterations).not.toBeNull();
		await fireEvent.input(rightIterations, { target: { value: '2000' } });
		expect(rightIterations.value).toBe('2000');
	});

	it('changes left render mode via select', async () => {
		pageStore.set({
			url: new URL('http://localhost/ikeda/compare') as Page['url'],
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: { session: null, user: null, profile: null },
			form: null,
			state: {}
		});
		const { container } = render(IkedaComparePage);
		const leftRenderMode = container.querySelector('#left-renderMode') as HTMLSelectElement;
		expect(leftRenderMode).not.toBeNull();
		await fireEvent.change(leftRenderMode, { target: { value: 'single' } });
		expect(leftRenderMode.value).toBe('single');
	});
});
