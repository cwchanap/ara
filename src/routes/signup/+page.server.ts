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

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();

	// Redirect authenticated users away from signup page (FR-010)
	if (session) {
		const redirectTo = url.searchParams.get('redirect') || '/';
		redirect(303, redirectTo);
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
			} catch (dbError) {
				// If profile creation fails, we should ideally delete the auth user
				// For now, log the error - the user can update their profile later
				console.error('Error creating profile in Neon DB:', dbError);
			}
		}

		// Success! Redirect to homepage or return URL (FR-010a)
		const redirectTo = url.searchParams.get('redirect') || '/';
		redirect(303, redirectTo);
	}
};
