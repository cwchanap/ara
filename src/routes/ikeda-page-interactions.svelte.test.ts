import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import IkedaPage from './ikeda/+page.svelte';

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/ikeda') as Page['url'],
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
vi.mock('$lib/components/ui/VisualizationAlerts.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/IkedaRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});

const pageProps = { data: { session: null, user: null, profile: null } };

describe('Ikeda page interactions', () => {
	afterEach(() => cleanup());

	it('renders the IKEDA_MAP header and feedback control', () => {
		render(IkedaPage, { props: pageProps });
		expect(screen.getByRole('heading', { level: 1, name: /IKEDA_MAP/i })).toBeTruthy();
		expect(screen.getByTestId('slider-u')).toBeTruthy();
	});

	it('shows the default active preset as Classic Ikeda', () => {
		render(IkedaPage, { props: pageProps });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/classic ikeda/i);
	});

	it('applies a preset when clicked', async () => {
		render(IkedaPage, { props: pageProps });
		const btn = screen.getByRole('button', { name: /Low Feedback/i });
		await fireEvent.click(btn);
		expect(screen.getByTestId('active-preset').textContent).toMatch(/low feedback/i);
		expect((screen.getByTestId('slider-u') as HTMLInputElement).value).toBe('0.6');
	});

	it('switches to CUSTOM when the feedback slider is changed', async () => {
		render(IkedaPage, { props: pageProps });
		const slider = screen.getByTestId('slider-u') as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '0.42' } });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/custom/i);
	});
});
