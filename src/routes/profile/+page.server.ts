import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getErrorMessage, validateUsername } from '$lib/auth-errors';
import { db, profiles } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { base } from '$app/paths';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	// Redirect unauthenticated users to login (FR-009)
	if (!session || !user) {
		const redirectUrl = `${base}/login?redirect=${encodeURIComponent(url.pathname)}`;
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

		// Update or create profile in Neon DB (upsert pattern)
		// This handles the case where a profile might be missing due to a failed signup
		try {
			const result = await db
				.update(profiles)
				.set({ username })
				.where(eq(profiles.id, user.id))
				.returning({ id: profiles.id });

			// If no row was updated, the profile doesn't exist - create it
			if (result.length === 0) {
				await db.insert(profiles).values({
					id: user.id,
					username
				});
			}
		} catch (error) {
			return fail(400, { updateError: getErrorMessage(error), username });
		}

		return { updateSuccess: true, username };
	},

	// Sign out action
	signout: async ({ locals }) => {
		const result = await locals.neonAuth.signOut();

		if (result && typeof result === 'object' && 'error' in result && result.error) {
			console.error('Error signing out:', result.error);
		}

		throw redirect(303, `${base}/login`);
	}
};
