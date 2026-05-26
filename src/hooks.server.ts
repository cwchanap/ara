import { type Handle } from '@sveltejs/kit';
import { normalizeSession } from '$lib/auth/neon';
import {
	NEON_AUTH_SESSION_VERIFIER_PARAM,
	buildAuthEndpoint,
	createNeonAuthClient,
	exchangeOAuthVerifier,
	getNeonAuthUrl,
	getProxyRequestHeaders
} from '$lib/auth/neon.server';
import type {
	CreateNeonAuthClientOptions,
	NeonAuthClient,
	NeonOAuthExchangeResult
} from '$lib/auth/neon.server';

type CreateNeonAuthClient = (options?: CreateNeonAuthClientOptions) => NeonAuthClient;
type ExchangeOAuthVerifier = (options: { request: Request }) => Promise<NeonOAuthExchangeResult>;
type ServerSessionFetcher = (request: Request) => Promise<{ data: unknown; ok: boolean }>;

type CreateHandleDependencies = {
	createNeonAuthClient: CreateNeonAuthClient;
	exchangeOAuthVerifier: ExchangeOAuthVerifier;
	fetchServerSession: ServerSessionFetcher;
};

export async function fetchServerSession(
	request: Request
): Promise<{ data: unknown; ok: boolean }> {
	const authUrl = getNeonAuthUrl();
	const headers = getProxyRequestHeaders(request);

	const response = await fetch(buildAuthEndpoint(authUrl, '/get-session'), {
		method: 'GET',
		headers
	});

	if (!response.ok) {
		return { data: null, ok: false };
	}

	const data = await response.json();
	return { data, ok: true };
}

export function createHandle({
	createNeonAuthClient,
	exchangeOAuthVerifier,
	fetchServerSession: fetchSession
}: CreateHandleDependencies): Handle {
	return async ({ event, resolve }) => {
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
			const cookieHeader = event.request.headers.get('cookie');
			const hasNeonSessionCookie =
				cookieHeader !== null && cookieHeader.includes('__Secure-neon-auth');

			if (!hasNeonSessionCookie) {
				return { session: null, user: null };
			}

			try {
				const { data, ok } = await fetchSession(event.request);

				if (!ok) {
					return { session: null, user: null };
				}

				return normalizeSession(data);
			} catch {
				return { session: null, user: null };
			}
		};

		return resolve(event);
	};
}

export const handle: Handle = createHandle({
	createNeonAuthClient,
	exchangeOAuthVerifier,
	fetchServerSession
});
