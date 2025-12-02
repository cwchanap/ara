import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getErrorMessage, validateEmail } from '$lib/auth-errors';
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

	// Redirect authenticated users away from login page (FR-010)
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
		const redirectTo = getSafeRedirectUrl(url.searchParams.get('redirect'));
		throw redirect(303, redirectTo);
	}
};
