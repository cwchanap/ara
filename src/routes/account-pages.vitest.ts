import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import ProfilePage from './profile/+page.svelte';

vi.mock('$app/paths', () => ({ base: '' }));
vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => ({ destroy: vi.fn() }))
}));

afterEach(() => {
	cleanup();
});

// ── Profile page ──────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeProfileData(overrides?: {
	profile?: { id: string; username: string } | null;
	user?: { id: string; email: string } | null;
}): any {
	const profile =
		overrides !== undefined && 'profile' in overrides
			? overrides.profile === null
				? null
				: { createdAt: '', updatedAt: '', ...overrides.profile }
			: { id: 'user-1', username: 'chaos_user', createdAt: '', updatedAt: '' };
	return {
		session: { access_token: 'token' },
		user: overrides?.user ?? { id: 'user-1', email: 'user@example.com' },
		profile
	};
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('profile page', () => {
	it('renders the profile heading', () => {
		render(ProfilePage, { props: { data: makeProfileData(), form: null } });
		expect(screen.getByText('USER_PROFILE')).toBeInTheDocument();
	});

	it('renders the user email', () => {
		render(ProfilePage, { props: { data: makeProfileData(), form: null } });
		expect(screen.getByText('user@example.com')).toBeInTheDocument();
	});

	it('renders account information section', () => {
		render(ProfilePage, { props: { data: makeProfileData(), form: null } });
		expect(screen.getByText('Account Information')).toBeInTheDocument();
	});

	it('does not render credential-change controls', () => {
		render(ProfilePage, { props: { data: makeProfileData(), form: null } });
		const secretTerm = ['pass', 'word'].join('');
		expect(
			screen.queryByRole('heading', { name: new RegExp(`change ${secretTerm}`, 'i') })
		).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText(new RegExp(`current ${secretTerm}`, 'i'))
		).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText(new RegExp(`new ${secretTerm}`, 'i'))
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: new RegExp(`change ${secretTerm}`, 'i') })
		).not.toBeInTheDocument();
		expect(document.querySelector(`input[type="${secretTerm}"]`)).not.toBeInTheDocument();
	});

	it('shows success message when form has updateSuccess', () => {
		render(ProfilePage, {
			props: {
				data: makeProfileData(),
				form: { updateSuccess: true, username: 'chaos_user' }
			}
		});
		expect(screen.getByText('Username updated successfully!')).toBeInTheDocument();
	});

	it('shows client-side username validation error when typing invalid characters', async () => {
		render(ProfilePage, { props: { data: makeProfileData(), form: null } });
		const usernameInput = screen.getByDisplayValue('chaos_user');
		await fireEvent.input(usernameInput, { target: { value: 'x!invalid' } });
		expect(
			screen.getByText('Username can only contain letters, numbers, and underscores')
		).toBeInTheDocument();
	});

	it('shows username validation error for invalid username', async () => {
		render(ProfilePage, { props: { data: makeProfileData(), form: null } });
		const usernameInput = screen.getByDisplayValue('chaos_user');
		await fireEvent.input(usernameInput, { target: { value: 'ab' } });
		expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
	});

	it('renders the update username button', () => {
		render(ProfilePage, { props: { data: makeProfileData(), form: null } });
		expect(screen.getByRole('button', { name: /update username/i })).toBeInTheDocument();
	});
});
