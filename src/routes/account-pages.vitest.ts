import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import SignupPage from './signup/+page.svelte';
import ProfilePage from './profile/+page.svelte';

vi.mock('$app/paths', () => ({ base: '' }));
vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => ({ destroy: vi.fn() }))
}));

afterEach(() => {
	cleanup();
});

// ── Signup page ───────────────────────────────────────────────────────────────

describe('signup page', () => {
	it('renders the signup heading', () => {
		render(SignupPage, { props: { form: null } });
		expect(screen.getByText('CREATE_ACCOUNT')).toBeInTheDocument();
	});

	it('renders email, username and password fields', () => {
		render(SignupPage, { props: { form: null } });
		expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
		expect(screen.getByLabelText('Username')).toBeInTheDocument();
		expect(screen.getByLabelText('Password')).toBeInTheDocument();
		expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
	});

	it('shows server error message when form has error', () => {
		render(SignupPage, {
			props: { form: { error: 'Username taken', email: '', username: '' } }
		});
		expect(screen.getByText('Username taken')).toBeInTheDocument();
	});

	it('pre-fills email from form data', () => {
		render(SignupPage, {
			props: { form: { error: 'Invalid', email: 'test@example.com', username: 'chaos' } }
		});
		const emailInput = screen.getByLabelText('Email Address') as HTMLInputElement;
		expect(emailInput.value).toBe('test@example.com');
	});

	it('pre-fills username from form data', () => {
		render(SignupPage, {
			props: { form: { error: 'Invalid', email: 'test@example.com', username: 'chaos_user' } }
		});
		const usernameInput = screen.getByLabelText('Username') as HTMLInputElement;
		expect(usernameInput.value).toBe('chaos_user');
	});

	it('shows email validation error after typing invalid email', async () => {
		render(SignupPage, { props: { form: null } });
		const emailInput = screen.getByLabelText('Email Address');
		await fireEvent.input(emailInput, { target: { value: 'notanemail' } });
		expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
	});

	it('shows username validation error for short username', async () => {
		render(SignupPage, { props: { form: null } });
		const usernameInput = screen.getByLabelText('Username');
		await fireEvent.input(usernameInput, { target: { value: 'ab' } });
		expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
	});

	it('renders the create account button', () => {
		render(SignupPage, { props: { form: null } });
		expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
	});

	it('renders login link', () => {
		render(SignupPage, { props: { form: null } });
		expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
	});
});

// ── Profile page ──────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeProfileData(overrides?: {
	profile?: { id: string; username: string } | null;
	user?: { id: string; email: string } | null;
}): any {
	const profile = overrides?.profile
		? { createdAt: '', updatedAt: '', ...overrides.profile }
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

	it('renders the Change Password heading as h2', () => {
		render(ProfilePage, { props: { data: makeProfileData(), form: null } });
		expect(
			screen.getByRole('heading', { level: 2, name: /change password/i })
		).toBeInTheDocument();
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

	it('shows password success message when form has passwordSuccess', () => {
		render(ProfilePage, {
			props: { data: makeProfileData(), form: { passwordSuccess: true } }
		});
		expect(screen.getByText('Password changed successfully!')).toBeInTheDocument();
	});

	it('shows password error when form has passwordError', () => {
		render(ProfilePage, {
			props: {
				data: makeProfileData(),
				form: { passwordError: 'Current password incorrect' }
			}
		});
		expect(screen.getByText('Current password incorrect')).toBeInTheDocument();
	});

	it('shows password warning when form has passwordWarning', () => {
		render(ProfilePage, {
			props: {
				data: makeProfileData(),
				form: {
					passwordSuccess: true,
					passwordWarning: 'Password change may not have fully propagated'
				}
			}
		});
		expect(
			screen.getByText('Password change may not have fully propagated')
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
