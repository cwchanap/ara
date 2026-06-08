import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import IkedaComparePage from './ikeda/compare/+page.svelte';

const pageStore = vi.hoisted(() => {
	const value = {
		url: new URL('http://localhost/ikeda/compare') as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: { session: null, user: null, profile: null },
		form: null,
		state: {}
	} as Page;
	return {
		subscribe(run: (value: Page) => void) {
			run(value);
			return () => {};
		}
	};
});

vi.mock('$app/stores', () => ({ page: { subscribe: pageStore.subscribe } }));
vi.mock('$app/paths', () => ({ base: '' }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/components/visualizations/IkedaRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});

describe('Ikeda compare page', () => {
	afterEach(() => cleanup());

	it('renders left and right feedback controls', () => {
		const { container } = render(IkedaComparePage);
		// The `u` label text is just "u"; the left/right context comes from the
		// input ids, so query those directly (per plan note).
		expect(container.querySelector('#left-u')).not.toBeNull();
		expect(container.querySelector('#right-u')).not.toBeNull();
	});
});
