import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import BifurcationHenonPage from './bifurcation-henon/+page.svelte';

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/bifurcation-henon') as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: {
			session: { user: { id: 'test' } },
			user: { id: 'test' },
			profile: {
				id: 'test',
				username: 'testuser',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-01'
			}
		},
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

vi.mock('$app/paths', () => ({
	base: '/app'
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

function setPageUrl(url: string) {
	pageStore.set({
		url: new URL(url) as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: {
			session: { user: { id: 'test' } },
			user: { id: 'test' },
			profile: {
				id: 'test',
				username: 'testuser',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-01'
			}
		},
		form: null,
		state: {}
	});
}

const pageProps = {
	data: {
		session: { user: { id: 'test' } },
		user: { id: 'test' },
		profile: {
			id: 'test',
			username: 'testuser',
			createdAt: '2024-01-01',
			updatedAt: '2024-01-01'
		}
	}
};

const originalFetch = global.fetch;

describe('Bifurcation Henon page interactions', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		global.fetch = vi.fn().mockImplementation(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						success: true,
						shareUrl: 'http://loc/shared',
						expiresAt: '2026-06-03'
					})
			} as Response)
		) as unknown as typeof global.fetch;
	});

	afterEach(() => {
		vi.useRealTimers();
		global.fetch = originalFetch;
		cleanup();
	});

	it('renders correctly and has title', () => {
		setPageUrl('http://localhost/bifurcation-henon');
		render(BifurcationHenonPage, { props: pageProps });
		expect(screen.getByText('HÉNON_BIFURCATION')).toBeInTheDocument();
	});

	it('handles slider parameter updates (aMin, aMax, b, maxIterations)', async () => {
		setPageUrl('http://localhost/bifurcation-henon');
		render(BifurcationHenonPage, { props: pageProps });

		const aMinSlider = screen.getByLabelText(/a min/i);
		await fireEvent.input(aMinSlider, { target: { value: '1.2' } });
		expect(screen.getAllByText('1.200')).toHaveLength(1);

		const aMaxSlider = screen.getByLabelText(/a max/i);
		await fireEvent.input(aMaxSlider, { target: { value: '1.3' } });
		expect(screen.getAllByText('1.300')).toHaveLength(1);

		const bSlider = screen.getByLabelText(/b/i);
		await fireEvent.input(bSlider, { target: { value: '0.4' } });
		expect(screen.getByText('0.400')).toBeInTheDocument();

		const iterationsSlider = screen.getByLabelText(/Iterations/i);
		await fireEvent.input(iterationsSlider, { target: { value: '500' } });
		expect(screen.getByText('500')).toBeInTheDocument();
	});

	it('shows save and share dialogs, calls handleSave and handleShare callbacks', async () => {
		setPageUrl('http://localhost/bifurcation-henon');
		render(BifurcationHenonPage, { props: pageProps });

		const saveTriggerBtn = screen.getByRole('button', { name: /Save/i });
		await fireEvent.click(saveTriggerBtn);

		const dialogSaveBtn = screen.getByTestId('dialog-save-bifurcation-henon');
		await fireEvent.click(dialogSaveBtn);
		expect(global.fetch).toHaveBeenCalledWith('/app/api/save-config', expect.any(Object));

		const shareTriggerBtn = screen.getByRole('button', { name: /Share/i });
		await fireEvent.click(shareTriggerBtn);

		const dialogShareBtn = screen.getByTestId('dialog-share-bifurcation-henon');
		await fireEvent.click(dialogShareBtn);
		expect(global.fetch).toHaveBeenCalledWith('/app/api/share', expect.any(Object));
	});
});
