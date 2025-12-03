import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getErrorMessage,
	validateEmail,
	validateUsername,
	validatePassword
} from '$lib/auth-errors';
import { db, profiles } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { base } from '$app/paths';

/**
 * Validates a redirect URL to prevent open redirect attacks.
 * Only allows same-origin paths (starting with '/').
 * Falls back to the configured base path for non-root deployments.
 */
function getSafeRedirectUrl(redirectParam: string | null): string {
	// Default to base path (or '/' if base is empty) for non-root deployments
	const defaultPath = base || '/';
	if (!redirectParam) return defaultPath;
	// Only allow relative paths starting with '/' to prevent open redirects
	if (redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
		return redirectParam;
	}
	return defaultPath;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();

	// Redirect authenticated users away from signup page (FR-010)
	if (session) {
		const redirectTo = getSafeRedirectUrl(url.searchParams.get('redirect'));
		throw redirect(303, redirectTo);
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;
		const username = formData.get('username') as string;

		// Server-side validation
		const emailError = validateEmail(email);
		if (emailError) {
			return fail(400, { error: emailError, email, username });
		}

		const usernameError = validateUsername(username);
		if (usernameError) {
			return fail(400, { error: usernameError, email, username });
		}

		const passwordError = validatePassword(password);
		if (passwordError) {
			return fail(400, { error: passwordError, email, username });
		}

		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match', email, username });
		}

		// Check if username is already taken in Neon DB
		let existingProfile;
		try {
			existingProfile = await db
				.select({ id: profiles.id })
				.from(profiles)
				.where(eq(profiles.username, username))
				.limit(1);
		} catch (dbError) {
			console.error('Database error checking username:', dbError);
			return fail(400, { error: 'Database error. Please try again.', email, username });
		}

		if (existingProfile.length > 0) {
			return fail(400, {
				error: 'This username is already taken',
				email,
				username
			});
		}

		// Attempt signup with Supabase Auth
		// Pass username in user_metadata for reference
		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					username
				}
			}
		});

		if (error) {
			// Handle duplicate email error (FR-014)
			if (
				error.message.toLowerCase().includes('already registered') ||
				error.message.toLowerCase().includes('already exists')
			) {
				return fail(400, {
					error: 'An account with this email already exists',
					email,
					username
				});
			}

			return fail(400, {
				error: getErrorMessage(error),
				email,
				username
			});
		}

		// Check if user was created (auto-confirmed since email verification is disabled)
		if (data.user && !data.user.email_confirmed_at && data.session === null) {
			// Email confirmation is required but shouldn't happen per FR-002
			// This indicates email verification wasn't disabled in Supabase dashboard
			return fail(400, {
				error: 'Email verification is enabled. Please disable it in Supabase Dashboard → Authentication → Settings → Email.',
				email,
				username
			});
		}

		// Create profile in Neon PostgreSQL
		if (data.user) {
			try {
				await db.insert(profiles).values({
					id: data.user.id,
					username
				});
			} catch (dbError: unknown) {
				// Profile creation failed - log the error
				console.error('Error creating profile in Neon DB:', dbError);

				// Check if this is a unique constraint violation (race condition on username)
				const isUniqueViolation =
					dbError instanceof Error &&
					(dbError.message.includes('unique') ||
						dbError.message.includes('duplicate') ||
						(dbError as { code?: string }).code === '23505');

				// Sign out the user to prevent them from being stuck in a broken authenticated state
				// The auth user will remain orphaned but signing out allows them to retry
				try {
					await locals.supabase.auth.signOut();
				} catch (signOutError) {
					console.error(
						'Failed to sign out user after profile creation failure:',
						signOutError
					);
				}

				console.warn(
					`Orphaned auth user ${data.user.id} (${email}) exists. Manual cleanup via Supabase Dashboard required.`
				);

				// Return user-friendly error based on the failure type
				if (isUniqueViolation) {
					return fail(400, {
						error: 'This username was just taken. Please choose a different username and try signing up again.',
						email,
						username
					});
				}

				return fail(500, {
					error: 'Account setup failed. Please try signing up again or contact support if the problem persists.',
					email,
					username
				});
			}
		}

		// Success! Redirect to homepage or return URL (FR-010a)
		const redirectTo = getSafeRedirectUrl(url.searchParams.get('redirect'));
		throw redirect(303, redirectTo);
	}
};
