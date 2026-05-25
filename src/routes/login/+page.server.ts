import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { base } from '$app/paths';
import { getSafeRedirectPath } from '$lib/auth/redirects';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();
	const redirectTo = getSafeRedirectPath(url.searchParams.get('redirect'), base || '/');

	if (session) {
		throw redirect(303, redirectTo);
	}

	return { redirectTo };
};

export const actions: Actions = {
	default: async ({ locals, url }) => {
		const redirectTo = getSafeRedirectPath(url.searchParams.get('redirect'), base || '/');
		const result = await locals.neonAuth.signIn.social({
			provider: 'google',
			callbackURL: redirectTo,
			disableRedirect: true
		});

		const providerUrl = result.data?.url;

		if (result.error || !providerUrl) {
			return fail(400, { error: 'Google sign-in failed. Please try again.' });
		}

		throw redirect(303, providerUrl);
	}
};
