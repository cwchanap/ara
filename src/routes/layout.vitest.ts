/**
 * Tests for the root +layout.svelte component.
 * Covers: auth state change handling, session expiry notification, logout form.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import type { Page } from '@sveltejs/kit';

const childrenStub = createRawSnippet(() => ({ render: () => '<span></span>' }));

// --- Supabase mock -------------------------------------------------------
type AuthStateChangeCallback = (event: string, session: unknown) => void;

const onAuthStateChangeMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() =>
	vi.fn(() => ({
		auth: {
			onAuthStateChange: onAuthStateChangeMock
		}
	}))
);

vi.mock('$lib/supabase', () => ({
	createClient: createClientMock
}));

// --- App mocks -----------------------------------------------------------
const invalidateMock = vi.hoisted(() => vi.fn());
const gotoMock = vi.hoisted(() => vi.fn());

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/dashboard') as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: {},
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
	invalidate: invalidateMock,
	goto: gotoMock
}));

vi.mock('$app/paths', () => ({ base: '' }));

vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => ({ destroy: vi.fn() }))
}));

vi.mock('$lib/assets/favicon.svg', () => ({ default: '/favicon.svg' }));

// --- Layout component ----------------------------------------------------
import LayoutComponent from './+layout.svelte';

// --- Helpers -------------------------------------------------------------
function makeData(authenticated = false) {
	return {
		session: authenticated ? { access_token: 'tok', expires_at: 9999999999 } : null,
		user: authenticated ? { id: 'user-1', email: 'user@example.com' } : null,
		profile: null
	};
}

function renderLayout(authenticated = false) {
	// Set up the auth mock to capture the callback and return an unsubscribe fn
	let capturedCallback: AuthStateChangeCallback | null = null;
	const unsubscribeMock = vi.fn();
	onAuthStateChangeMock.mockImplementation((cb: AuthStateChangeCallback) => {
		capturedCallback = cb;
		return { data: { subscription: { unsubscribe: unsubscribeMock } } };
	});

	const result = render(LayoutComponent, {
		props: {
			data: makeData(authenticated),
			children: childrenStub
		}
	});

	return { ...result, getCallback: () => capturedCallback, unsubscribeMock };
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

	it('shows Login and Sign Up links when not authenticated', () => {
		renderLayout(false);
		expect(screen.getByText('Login')).toBeInTheDocument();
		expect(screen.getByText('Sign Up')).toBeInTheDocument();
	});

	it('shows My Configs, Profile, and Logout when authenticated', () => {
		renderLayout(true);
		expect(screen.getByText('My Configs')).toBeInTheDocument();
		expect(screen.getByText('Profile')).toBeInTheDocument();
		expect(screen.getByText('Logout')).toBeInTheDocument();
	});

	it('creates a Supabase client on mount', () => {
		renderLayout();
		expect(createClientMock).toHaveBeenCalled();
	});

	it('subscribes to onAuthStateChange on mount', () => {
		renderLayout();
		expect(onAuthStateChangeMock).toHaveBeenCalledWith(expect.any(Function));
	});

	it('unsubscribes on destroy', () => {
		const { unmount, unsubscribeMock } = renderLayout();
		unmount();
		expect(unsubscribeMock).toHaveBeenCalled();
	});
});

// =========================================================================
describe('layout – auth state change handling', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		invalidateMock.mockResolvedValue(undefined);
		gotoMock.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
		vi.clearAllMocks();
	});

	it('calls invalidate on any auth state change', async () => {
		const { getCallback } = renderLayout(true);
		const cb = getCallback()!;

		cb('SIGNED_IN', { access_token: 'new-tok' });
		expect(invalidateMock).toHaveBeenCalledWith('supabase:auth');
	});

	it('handles SIGNED_IN event without showing session expired notification', async () => {
		const { getCallback } = renderLayout(false);
		const cb = getCallback()!;

		cb('SIGNED_IN', { access_token: 'tok' });

		expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument();
	});

	it('handles TOKEN_REFRESHED event', async () => {
		const { getCallback } = renderLayout(true);
		const cb = getCallback()!;

		cb('TOKEN_REFRESHED', { access_token: 'refreshed-tok' });
		expect(invalidateMock).toHaveBeenCalledWith('supabase:auth');
	});

	it('shows session expired notification on unexpected SIGNED_OUT when was authenticated', async () => {
		const { getCallback } = renderLayout(true);
		const cb = getCallback()!;

		// First mark as authenticated via SIGNED_IN
		cb('SIGNED_IN', { access_token: 'tok' });

		// Then trigger unexpected sign-out (no session)
		cb('SIGNED_OUT', null);

		await waitFor(() => {
			expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
		});
	});

	it('does NOT show session expired notification on user-initiated logout', async () => {
		const { getCallback } = renderLayout(true);
		const cb = getCallback()!;

		cb('SIGNED_IN', { access_token: 'tok' });

		// Simulate user clicking logout (which calls handleLogoutSubmit)
		const logoutBtn = screen.getByText('Logout');
		// The form submit sets userInitiatedLogout = true
		const form = logoutBtn.closest('form')!;
		await fireEvent.submit(form);

		cb('SIGNED_OUT', null);

		// Should NOT show notification for user-initiated logout
		expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument();
	});

	it('redirects to login after 3 seconds when session expires on non-auth page', async () => {
		pageStore.set({
			url: new URL('http://localhost/dashboard') as Page['url'],
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: {},
			form: null,
			state: {}
		});

		const { getCallback } = renderLayout(true);
		const cb = getCallback()!;

		cb('SIGNED_IN', { access_token: 'tok' });
		cb('SIGNED_OUT', null);

		// Before timeout: no navigation yet
		expect(gotoMock).not.toHaveBeenCalled();

		// After 3s: should redirect to login
		vi.advanceTimersByTime(3000);

		expect(gotoMock).toHaveBeenCalledWith(expect.stringContaining('/login'));
	});

	it('does NOT redirect to login when session expires on login page', async () => {
		pageStore.set({
			url: new URL('http://localhost/login') as Page['url'],
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: {},
			form: null,
			state: {}
		});

		const { getCallback } = renderLayout(true);
		const cb = getCallback()!;

		cb('SIGNED_IN', { access_token: 'tok' });
		cb('SIGNED_OUT', null);

		vi.advanceTimersByTime(3000);

		// Should not redirect when already on login page
		expect(gotoMock).not.toHaveBeenCalled();
	});

	it('clears expiry timer on destroy before it fires', () => {
		const { getCallback, unmount } = renderLayout(true);
		const cb = getCallback()!;

		cb('SIGNED_IN', { access_token: 'tok' });
		cb('SIGNED_OUT', null);

		// Unmount before timer fires
		unmount();

		// Timer should be cleared – advancing time should not trigger goto
		vi.advanceTimersByTime(3000);
		expect(gotoMock).not.toHaveBeenCalled();
	});

	it('does not redirect after unmount even if timer already fired', async () => {
		const { getCallback, unmount } = renderLayout(true);
		const cb = getCallback()!;

		cb('SIGNED_IN', { access_token: 'tok' });
		cb('SIGNED_OUT', null);

		// Advance to just before the timer fires, then unmount
		vi.advanceTimersByTime(2999);
		unmount();
		vi.advanceTimersByTime(1);

		expect(gotoMock).not.toHaveBeenCalled();
	});
});
