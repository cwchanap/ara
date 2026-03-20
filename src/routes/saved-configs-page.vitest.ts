import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import SavedConfigsPage from './saved-configs/+page.svelte';
import type { SavedConfiguration } from '$lib/types';

const gotoMock = vi.hoisted(() => vi.fn());
const invalidateAllMock = vi.hoisted(() => vi.fn());

vi.mock('$app/paths', () => ({ base: '' }));

vi.mock('$app/navigation', () => ({
	goto: gotoMock,
	invalidateAll: invalidateAllMock
}));

vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => ({ destroy: vi.fn() }))
}));

const defaultConfig: SavedConfiguration = {
	id: 'cfg-1',
	userId: 'user-1',
	name: 'Lorenz Default',
	mapType: 'lorenz',
	parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 },
	createdAt: '2026-03-01T10:00:00.000Z',
	updatedAt: '2026-03-01T10:00:00.000Z'
};

function makeActionResponse(response: {
	ok: boolean;
	result?: { type: string; data?: { deleteError?: string } };
}): typeof fetch {
	return vi.fn(async () => ({
		ok: response.ok,
		json: async () => response.result ?? null
	})) as unknown as typeof fetch;
}

function renderPage(
	configurations: SavedConfiguration[] = [defaultConfig],
	form: Record<string, unknown> | null = null
) {
	return render(SavedConfigsPage, {
		props: {
			data: { configurations },
			form
		}
	});
}

describe('saved-configs page', () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
			this.setAttribute('open', '');
		});
		HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
			this.removeAttribute('open');
		});
		originalFetch = globalThis.fetch;
		sessionStorage.clear();
		gotoMock.mockReset();
		invalidateAllMock.mockReset();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		cleanup();
	});

	it('stores parameters in sessionStorage and navigates when load is clicked', async () => {
		renderPage();

		await fireEvent.click(screen.getByRole('button', { name: 'LOAD' }));

		expect(sessionStorage.getItem('saved-config:cfg-1')).toBe(
			JSON.stringify(defaultConfig.parameters)
		);
		expect(gotoMock).toHaveBeenCalledWith('/lorenz?configId=cfg-1');
	});

	it('still navigates when saving parameters to session storage fails', async () => {
		const circularParameters: Record<string, unknown> = { type: 'lorenz' };
		circularParameters.self = circularParameters;

		renderPage([
			{
				...defaultConfig,
				parameters: circularParameters as SavedConfiguration['parameters']
			}
		]);

		await fireEvent.click(screen.getByRole('button', { name: 'LOAD' }));

		expect(sessionStorage.getItem('saved-config:cfg-1')).toBeNull();
		expect(gotoMock).toHaveBeenCalledWith('/lorenz?configId=cfg-1');
	});

	it('renders the empty state when no configurations exist', () => {
		renderPage([]);

		expect(screen.getByText('NO_CONFIGURATIONS_FOUND')).toBeInTheDocument();
		expect(
			screen.getByText("You haven't saved any chaos map configurations yet.")
		).toBeInTheDocument();
	});

	it('submits delete requests and refreshes the page on success', async () => {
		globalThis.fetch = makeActionResponse({
			ok: true,
			result: { type: 'success' }
		});
		invalidateAllMock.mockResolvedValue(undefined);

		renderPage();

		await fireEvent.click(screen.getByTitle('Delete'));
		await fireEvent.click(screen.getByRole('button', { name: 'DELETE' }));

		await waitFor(() => expect(invalidateAllMock).toHaveBeenCalledTimes(1));

		expect(globalThis.fetch).toHaveBeenCalledWith(
			'?/delete',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					accept: 'application/json',
					'x-sveltekit-action': 'true'
				}),
				body: expect.any(FormData)
			})
		);
		expect(screen.getByText('Configuration deleted successfully!')).toBeInTheDocument();
	});

	it('shows delete errors returned by the action response', async () => {
		globalThis.fetch = makeActionResponse({
			ok: false,
			result: {
				type: 'failure',
				data: { deleteError: 'Delete failed on server' }
			}
		});

		renderPage();

		await fireEvent.click(screen.getByTitle('Delete'));
		await fireEvent.click(screen.getByRole('button', { name: 'DELETE' }));

		await waitFor(() =>
			expect(screen.getByText('Delete failed on server')).toBeInTheDocument()
		);
		expect(invalidateAllMock).not.toHaveBeenCalled();
	});

	it('shows rename success feedback from form results', () => {
		renderPage([defaultConfig], { renameSuccess: true });

		expect(screen.getByText('Configuration renamed successfully!')).toBeInTheDocument();
	});
});
