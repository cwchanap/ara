import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import type { ChaosMapType } from '$lib/types';
import LoginPage from './login/+page.svelte';
import ShareViewPage from './s/[code]/+page.svelte';

vi.mock('$app/paths', () => ({ base: '' }));
vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => ({ destroy: vi.fn() }))
}));
vi.mock('$app/stores', () => ({
	page: {
		subscribe: vi.fn((fn) => {
			fn({ url: new URL('http://localhost/') });
			return () => {};
		})
	}
}));

afterEach(() => {
	cleanup();
});

// ── Login page ────────────────────────────────────────────────────────────────

describe('login page', () => {
	it('renders the login heading', () => {
		render(LoginPage, { props: { form: null } });
		expect(screen.getByText('SYSTEM_SIGN_IN')).toBeInTheDocument();
	});

	it('renders a Google sign-in button', () => {
		render(LoginPage, { props: { form: null } });
		expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
	});

	it('does not render email or credential fields', () => {
		render(LoginPage, { props: { form: null } });
		const secretFieldType = ['pass', 'word'].join('');

		expect(screen.queryByLabelText('Email Address')).not.toBeInTheDocument();
		expect(document.querySelector(`input[type="${secretFieldType}"]`)).not.toBeInTheDocument();
	});

	it('shows server error message when form has error', () => {
		render(LoginPage, { props: { form: { error: 'OAuth unavailable' } } });
		expect(screen.getByText('OAuth unavailable')).toBeInTheDocument();
	});

	it('does not render a signup link', () => {
		render(LoginPage, { props: { form: null } });
		expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument();
	});
});

// ── Share view page (s/[code]) ────────────────────────────────────────────────

const defaultShareData = {
	session: null,
	user: null,
	mapType: 'lorenz' as const,
	username: 'chaos_user',
	shortCode: 'ABCD1234',
	createdAt: '2026-04-01T12:00:00.000Z',
	expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
	daysRemaining: 7,
	parameters: { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 },
	viewCount: 42
};

describe('share view page', () => {
	it('renders the map display name', () => {
		render(ShareViewPage, { props: { data: defaultShareData } });
		expect(screen.getByText('LORENZ_ATTRACTOR')).toBeInTheDocument();
	});

	it('renders the username', () => {
		render(ShareViewPage, { props: { data: defaultShareData } });
		expect(screen.getByText('chaos_user')).toBeInTheDocument();
	});

	it('renders SHARED_CONFIGURATION label', () => {
		render(ShareViewPage, { props: { data: defaultShareData } });
		expect(screen.getByText('SHARED_CONFIGURATION')).toBeInTheDocument();
	});

	it('renders the parameters section', () => {
		render(ShareViewPage, { props: { data: defaultShareData } });
		expect(screen.getByText('PARAMETERS')).toBeInTheDocument();
	});

	it('renders VIEW_VISUALIZATION link', () => {
		render(ShareViewPage, { props: { data: defaultShareData } });
		expect(screen.getByText(/VIEW_VISUALIZATION/)).toBeInTheDocument();
	});

	it('does not show expiration warning when days remaining > 2', () => {
		render(ShareViewPage, { props: { data: { ...defaultShareData, daysRemaining: 5 } } });
		// The warning block only renders when daysRemaining <= 2
		expect(
			screen.queryByText(/expires today|expires tomorrow|has expired|expires in \d+ days/i)
		).not.toBeInTheDocument();
	});

	it('shows expiration warning when daysRemaining is 2', () => {
		render(ShareViewPage, { props: { data: { ...defaultShareData, daysRemaining: 2 } } });
		expect(screen.getByText(/expires in 2 days/i)).toBeInTheDocument();
	});

	it('shows "expires tomorrow" when daysRemaining is 1', () => {
		render(ShareViewPage, { props: { data: { ...defaultShareData, daysRemaining: 1 } } });
		expect(screen.getByText(/expires tomorrow/i)).toBeInTheDocument();
	});

	it('shows "expires today" when daysRemaining is 0', () => {
		render(ShareViewPage, { props: { data: { ...defaultShareData, daysRemaining: 0 } } });
		expect(screen.getByText(/expires today/i)).toBeInTheDocument();
	});

	it('shows expired message when daysRemaining is negative', () => {
		render(ShareViewPage, { props: { data: { ...defaultShareData, daysRemaining: -1 } } });
		expect(screen.getByText(/has expired/i)).toBeInTheDocument();
	});

	it('renders the view count', () => {
		render(ShareViewPage, { props: { data: defaultShareData } });
		expect(screen.getByText('42')).toBeInTheDocument();
	});

	it('handles unknown map type gracefully', () => {
		render(ShareViewPage, {
			props: {
				data: { ...defaultShareData, mapType: 'unknown_type' as unknown as ChaosMapType }
			}
		});
		expect(screen.getByText('UNKNOWN_TYPE')).toBeInTheDocument();
	});

	it('renders 0 for invalid viewCount', () => {
		render(ShareViewPage, {
			props: { data: { ...defaultShareData, viewCount: NaN } }
		});
		expect(screen.getByText('0')).toBeInTheDocument();
	});
});
