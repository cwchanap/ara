import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import StandardPage from './standard/+page.svelte';

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/standard') as Page['url'],
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

vi.mock('$lib/components/visualizations/StandardRenderer.svelte', async () => {
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

describe('Standard page interactions', () => {
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
		setPageUrl('http://localhost/standard');
		render(StandardPage, { props: pageProps });
		expect(screen.getByText('STANDARD_MAP')).toBeInTheDocument();
	});

	it('handles slider parameter updates (k, iterations)', async () => {
		setPageUrl('http://localhost/standard');
		const { container } = render(StandardPage, { props: pageProps });

		const kSlider = container.querySelector('input[id="k"]') as HTMLInputElement;
		expect(kSlider).not.toBeNull();
		await fireEvent.input(kSlider, { target: { value: '0.8' } });

		const iterationsSlider = container.querySelector(
			'input[id="iterations"]'
		) as HTMLInputElement;
		expect(iterationsSlider).not.toBeNull();
		await fireEvent.input(iterationsSlider, { target: { value: '5000' } });
	});

	it('shows save and share dialogs, calls handleSave and handleShare callbacks', async () => {
		setPageUrl('http://localhost/standard');
		render(StandardPage, { props: pageProps });

		const saveTriggerBtn = screen.getByRole('button', { name: /Save/i });
		await fireEvent.click(saveTriggerBtn);

		const dialogSaveBtn = screen.getByTestId('dialog-save-standard');
		await fireEvent.click(dialogSaveBtn);
		expect(global.fetch).toHaveBeenCalledWith('/app/api/save-config', expect.any(Object));

		const shareTriggerBtn = screen.getByRole('button', { name: /Share/i });
		await fireEvent.click(shareTriggerBtn);

		const dialogShareBtn = screen.getByTestId('dialog-share-standard');
		await fireEvent.click(dialogShareBtn);
		expect(global.fetch).toHaveBeenCalledWith('/app/api/share', expect.any(Object));
	});
});
