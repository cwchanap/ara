import { type Handle } from '@sveltejs/kit';
import { normalizeSession } from '$lib/auth/neon';
import { createNeonAuthClient } from '$lib/auth/neon.server';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.neonAuth = createNeonAuthClient({ headers: event.request.headers });

	event.locals.safeGetSession = async () => {
		const { data, error } = await event.locals.neonAuth.getSession();

		if (error) {
			return { session: null, user: null };
		}

		return normalizeSession(data);
	};

	return resolve(event);
};
