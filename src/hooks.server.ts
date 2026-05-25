import { type Handle } from '@sveltejs/kit';
import { normalizeSession } from '$lib/auth/neon';
import {
	NEON_AUTH_SESSION_VERIFIER_PARAM,
	createNeonAuthClient,
	exchangeOAuthVerifier
} from '$lib/auth/neon.server';

export const handle: Handle = async ({ event, resolve }) => {
	const requestUrl = new URL(event.request.url);
	if (requestUrl.searchParams.has(NEON_AUTH_SESSION_VERIFIER_PARAM)) {
		const exchangeResult = await exchangeOAuthVerifier({ request: event.request });

		if (exchangeResult.ok) {
			const response = new Response(null, {
				status: 303,
				headers: {
					location: exchangeResult.redirectUrl
				}
			});

			for (const setCookieHeader of exchangeResult.setCookieHeaders) {
				response.headers.append('set-cookie', setCookieHeader);
			}

			return response;
		}

		console.error('Error exchanging Neon Auth OAuth verifier:', exchangeResult.error);
	}

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
