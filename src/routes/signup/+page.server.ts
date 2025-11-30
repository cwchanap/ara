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
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Create admin client for user cleanup operations (requires service role key)
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
	? createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		})
	: null;

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();

	// Redirect authenticated users away from signup page (FR-010)
	if (session) {
		const redirectTo = url.searchParams.get('redirect') || '/';
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
				// Profile creation failed - clean up orphaned Supabase auth user
				console.error('Error creating profile in Neon DB:', dbError);

				// Check if this is a unique constraint violation (race condition on username)
				const isUniqueViolation =
					dbError instanceof Error &&
					(dbError.message.includes('unique') ||
						dbError.message.includes('duplicate') ||
						(dbError as { code?: string }).code === '23505');

				// Attempt to delete the orphaned auth user using admin client
				if (supabaseAdmin) {
					try {
						const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
							data.user.id
						);
						if (deleteError) {
							console.error(
								`Failed to delete orphaned auth user ${data.user.id}:`,
								deleteError
							);
						} else {
							console.log(`Successfully deleted orphaned auth user ${data.user.id}`);
						}
					} catch (cleanupError) {
						console.error(
							`Exception while deleting orphaned auth user ${data.user.id}:`,
							cleanupError
						);
					}
				} else {
					console.warn(
						`Cannot delete orphaned auth user ${data.user.id}: SUPABASE_SERVICE_ROLE_KEY not configured. ` +
							'Manual cleanup required via Supabase Dashboard.'
					);
				}

				// Return user-friendly error based on the failure type
				if (isUniqueViolation) {
					return fail(400, {
						error: 'This username was just taken. Please choose a different username.',
						email,
						username
					});
				}

				return fail(500, {
					error: 'Account created but profile setup failed. Please try again or contact support.',
					email,
					username
				});
			}
		}

		// Success! Redirect to homepage or return URL (FR-010a)
		const redirectTo = url.searchParams.get('redirect') || '/';
		throw redirect(303, redirectTo);
	}
};
