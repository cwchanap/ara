import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { base } from '$app/paths';
import { getSafeRedirectPath } from '$lib/auth/redirects';
import { applyNeonSetCookieHeaders, startGoogleOAuth } from '$lib/auth/neon.server';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();
	const redirectTo = getSafeRedirectPath(url.searchParams.get('redirect'), base || '/');

	if (session) {
		throw redirect(303, redirectTo);
	}

	return { redirectTo };
};

export const actions: Actions = {
	default: async ({ cookies, request, url }) => {
		const redirectTo = getSafeRedirectPath(url.searchParams.get('redirect'), base || '/');
		const result = await startGoogleOAuth({ request, callbackURL: redirectTo });

		applyNeonSetCookieHeaders(cookies, result.setCookieHeaders);
		const providerUrl = result.providerUrl;

		if (!result.ok || !providerUrl) {
			return fail(400, { error: 'Google sign-in failed. Please try again.' });
		}

		throw redirect(303, providerUrl);
	}
};
