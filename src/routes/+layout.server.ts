import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	// Register dependency so invalidate('supabase:auth') in +layout.svelte
	// triggers this load to re-run when auth state changes (T046/T047)
	depends('supabase:auth');

	const { session, user } = await locals.safeGetSession();

	return {
		session,
		user
	};
};
