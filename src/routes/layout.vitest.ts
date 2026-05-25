/**
 * Tests for the root +layout.svelte component.
 * Covers: server-derived auth navigation and logout form.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import type { Page } from '@sveltejs/kit';

const childrenStub = createRawSnippet(() => ({ render: () => '<span></span>' }));

// --- App mocks -----------------------------------------------------------
const invalidateMock = vi.hoisted(() => vi.fn());

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/dashboard') as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: { session: null, user: null },
		form: null,
		state: {}
	};
	const subscribers = new Set<(v: Page) => void>();
	return {
		subscribe(run: (v: Page) => void) {
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

vi.mock('$app/stores', () => ({
	page: { subscribe: pageStore.subscribe }
}));

vi.mock('$app/navigation', () => ({
	invalidate: invalidateMock
}));

vi.mock('$app/paths', () => ({ base: '' }));

vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => ({ destroy: vi.fn() }))
}));

vi.mock('$lib/assets/favicon.svg', () => ({ default: '/favicon.svg' }));

// --- Layout component ----------------------------------------------------
import LayoutComponent from './+layout.svelte';

// --- Helpers -------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeData(authenticated = false): any {
	return {
		session: authenticated
			? {
					access_token: 'tok',
					refresh_token: 'ref',
					expires_in: 3600,
					expires_at: 9999999999,
					token_type: 'bearer',
					user: { id: 'user-1', email: 'user@example.com' }
				}
			: null,
		user: authenticated ? { id: 'user-1', email: 'user@example.com' } : null,
		profile: null
	};
}

function renderLayout(authenticated = false) {
	const result = render(LayoutComponent, {
		props: {
			data: makeData(authenticated),
			children: childrenStub
		}
	});

	return result;
}

// =========================================================================
describe('layout – basic rendering', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('renders the CHAOS_THEORY nav link', () => {
		renderLayout();
		expect(screen.getByText('CHAOS_THEORY')).toBeInTheDocument();
	});

	it('shows one Sign In link and no Sign Up link when not authenticated', () => {
		renderLayout(false);
		expect(screen.getAllByRole('link', { name: 'Sign In' })).toHaveLength(1);
		expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument();
	});

	it('shows My Configs, Profile, and Logout when authenticated', () => {
		renderLayout(true);
		expect(screen.getByText('My Configs')).toBeInTheDocument();
		expect(screen.getByText('Profile')).toBeInTheDocument();
		expect(screen.getByText('Logout')).toBeInTheDocument();
	});

	it('refreshes the Neon auth dependency after logout submit', async () => {
		renderLayout(true);
		const logoutBtn = screen.getByText('Logout');
		const form = logoutBtn.closest('form')!;
		await fireEvent.submit(form);

		expect(invalidateMock).toHaveBeenCalledWith('neon:auth');
	});
});
