import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { base } from '$app/paths';
import { getSafeRedirectPath, withRedirectParam } from '$lib/auth/redirects';

export const load: PageServerLoad = async ({ url }) => {
	const redirectTo = getSafeRedirectPath(url.searchParams.get('redirect'), base || '/');
	throw redirect(303, `${base}/login${withRedirectParam('', redirectTo)}`);
};
