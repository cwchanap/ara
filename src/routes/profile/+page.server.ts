import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getErrorMessage, validateUsername, validatePassword } from '$lib/auth-errors';
import { db, profiles } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	// Redirect unauthenticated users to login (FR-009)
	if (!session || !user) {
		const redirectUrl = `/login?redirect=${encodeURIComponent(url.pathname)}`;
		throw redirect(303, redirectUrl);
	}

	// Fetch user's profile from Neon DB
	const profileResults = await db
		.select()
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.limit(1);

	const profile = profileResults[0] || null;

	return {
		session,
		user,
		profile
	};
};

export const actions: Actions = {
	// Update username action
	update: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();

		if (!session || !user) {
			return fail(401, { updateError: 'You must be logged in to update your profile' });
		}

		const formData = await request.formData();
		const username = formData.get('username') as string;

		// Validate username
		const usernameError = validateUsername(username);
		if (usernameError) {
			return fail(400, { updateError: usernameError, username });
		}

		// Check if username is already taken by another user
		const existingProfile = await db
			.select({ id: profiles.id })
			.from(profiles)
			.where(eq(profiles.username, username))
			.limit(1);

		if (existingProfile.length > 0 && existingProfile[0].id !== user.id) {
			return fail(400, { updateError: 'This username is already taken', username });
		}

		// Update profile in Neon DB
		try {
			await db
				.update(profiles)
				.set({ username, updatedAt: new Date().toISOString() })
				.where(eq(profiles.id, user.id));
		} catch (error) {
			return fail(400, { updateError: getErrorMessage(error), username });
		}

		return { updateSuccess: true, username };
	},

	// Change password action
	changePassword: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();

		if (!session || !user) {
			return fail(401, { passwordError: 'You must be logged in to change your password' });
		}

		const formData = await request.formData();
		const currentPassword = formData.get('currentPassword') as string;
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		// Validate inputs
		if (!currentPassword) {
			return fail(400, { passwordError: 'Current password is required' });
		}

		const passwordError = validatePassword(newPassword);
		if (passwordError) {
			return fail(400, { passwordError });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { passwordError: 'New passwords do not match' });
		}

		// Verify current password by attempting to sign in
		// NOTE: This creates a new session as a side effect. Supabase doesn't provide a
		// password verification API without session creation. The trade-off is acceptable
		// because: 1) The user is already authenticated, 2) The new session replaces the
		// current one rather than proliferating sessions, 3) This is the recommended
		// approach per Supabase documentation for password change flows.
		const { error: verifyError } = await locals.supabase.auth.signInWithPassword({
			email: user.email!,
			password: currentPassword
		});

		if (verifyError) {
			return fail(400, { passwordError: 'Current password is incorrect' });
		}

		// Update password
		const { error: updateError } = await locals.supabase.auth.updateUser({
			password: newPassword
		});

		if (updateError) {
			return fail(400, { passwordError: getErrorMessage(updateError) });
		}

		return { passwordSuccess: true };
	},

	// Sign out action
	signout: async ({ locals }) => {
		const { error } = await locals.supabase.auth.signOut();

		if (error) {
			console.error('Error signing out:', error);
		}

		throw redirect(303, '/login');
	}
};
