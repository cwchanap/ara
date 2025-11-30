import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getErrorMessage, validateEmail } from '$lib/auth-errors';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();

	// Redirect authenticated users away from login page (FR-010)
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

		// Server-side validation
		const emailError = validateEmail(email);
		if (emailError) {
			return fail(400, { error: emailError, email });
		}

		if (!password) {
			return fail(400, { error: 'Password is required', email });
		}

		// Attempt login with Supabase Auth
		const { error } = await locals.supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) {
			// Handle invalid credentials (FR-021)
			return fail(400, {
				error: getErrorMessage(error),
				email
			});
		}

		// Success! Redirect to homepage or return URL (FR-010a)
		const redirectTo = url.searchParams.get('redirect') || '/';
		throw redirect(303, redirectTo);
	}
};
