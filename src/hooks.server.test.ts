import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { RequestEvent } from '@sveltejs/kit';
import { createNeonAuthClientWithFactory } from '$lib/auth/neon.server';

const getSession = mock(async () => ({ data: null, error: null }));
const authClientFactory = mock(() => ({ getSession }));

const createNeonAuthClient = mock((options: { headers?: HeadersInit } = {}) =>
	createNeonAuthClientWithFactory(authClientFactory, {
		...options,
		authUrl: 'https://auth.example.test/auth'
	})
);

const exchangeOAuthVerifier = mock(async ({ request }: { request: Request }) => {
	const requestUrl = new URL(request.url);
	expect(requestUrl.searchParams.get('neon_auth_session_verifier')).toBe('verifier-123');

	const redirectUrl = new URL(request.url);
	redirectUrl.searchParams.delete('neon_auth_session_verifier');

	return {
		ok: true,
		status: 200,
		redirectUrl: redirectUrl.toString(),
		setCookieHeaders: [
			'__Secure-neon-auth.session=session-value; Path=/; HttpOnly; Secure; SameSite=Lax'
		]
	};
});

let fetchSessionResult: { data: unknown; ok: boolean } = {
	data: { user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' } },
	ok: true
};

const fetchServerSession = mock(async (request: Request) => {
	void request;
	return fetchSessionResult;
});

mock.module('$lib/auth/neon', () => ({
	normalizeSession: (data: unknown) => {
		const session = data as { user?: { id: string; email?: string; name?: string } };
		return session?.user?.id ? { session, user: session.user } : { session: null, user: null };
	}
}));

mock.module('$env/dynamic/private', () => ({
	env: { NEON_AUTH_BASE_URL: 'https://auth.example.test' }
}));

mock.module('$env/dynamic/public', () => ({
	env: { PUBLIC_NEON_AUTH_URL: 'https://auth.example.test' }
}));

const { createHandle, fetchServerSession: actualFetchServerSession } = await import(
	'./hooks.server'
);
const handle = createHandle({ createNeonAuthClient, exchangeOAuthVerifier, fetchServerSession });

describe('hooks.server', () => {
	beforeEach(() => {
		fetchSessionResult = {
			data: { user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' } },
			ok: true
		};
		getSession.mockClear();
		createNeonAuthClient.mockClear();
		authClientFactory.mockClear();
		exchangeOAuthVerifier.mockClear();
		fetchServerSession.mockClear();
	});

	test('exchanges OAuth verifier before resolving protected routes', async () => {
		const request = new Request(
			'http://localhost/profile?neon_auth_session_verifier=verifier-123&redirect=%2Fsaved-configs',
			{ headers: { cookie: '__Secure-neon-auth.challenge=abc' } }
		);
		const event = { locals: {}, request, url: new URL(request.url) } as RequestEvent;
		const resolve = mock(async () => new Response('should not resolve'));

		const response = await handle({ event, resolve });

		expect(exchangeOAuthVerifier).toHaveBeenCalledWith({ request });
		expect(resolve).not.toHaveBeenCalled();
		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe(
			'http://localhost/profile?redirect=%2Fsaved-configs'
		);
		expect(response.headers.get('set-cookie')).toBe(
			'__Secure-neon-auth.session=session-value; Path=/; HttpOnly; Secure; SameSite=Lax'
		);
	});

	test('continues normal setup when no OAuth verifier is present', async () => {
		const request = new Request('http://localhost/profile');
		const event = { locals: {}, request, url: new URL(request.url) } as RequestEvent;
		const resolve = mock(async () => new Response('ok'));

		const response = await handle({ event, resolve });

		expect(exchangeOAuthVerifier).not.toHaveBeenCalled();
		expect(authClientFactory).toHaveBeenCalledWith('https://auth.example.test/auth', {
			fetchOptions: {
				headers: undefined
			}
		});
		expect(resolve).toHaveBeenCalledWith(event);
		expect(await response.text()).toBe('ok');
	});

	test('sets neonAuth and safeGetSession on locals', async () => {
		const request = new Request('http://localhost', {
			headers: {
				authorization: 'Bearer app-token',
				cookie: 'auth=value; __Secure-neon-auth.session=session-value; analytics=tracking-value'
			}
		});
		const event = { locals: {}, request } as RequestEvent;
		const resolve = mock(async () => new Response('ok'));

		await handle({ event, resolve });

		expect(authClientFactory).toHaveBeenCalledWith('https://auth.example.test/auth', {
			fetchOptions: {
				headers: {
					cookie: '__Secure-neon-auth.session=session-value'
				}
			}
		});
		expect(event.locals.neonAuth).toBeDefined();
		expect(resolve).toHaveBeenCalledWith(event);

		const result = await event.locals.safeGetSession();
		expect(fetchServerSession).toHaveBeenCalledWith(request);
		expect(result.user?.id).toBe('user-1');
		expect(result.session).toEqual({
			user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' }
		});
	});

	test('safeGetSession returns null session and user when Neon Auth returns an error', async () => {
		fetchSessionResult = { data: null, ok: false };
		const request = new Request('http://localhost', {
			headers: { cookie: '__Secure-neon-auth.session=abc' }
		});
		const event = { locals: {}, request } as RequestEvent;
		const resolve = mock(async () => new Response('ok'));

		await handle({ event, resolve });

		await expect(event.locals.safeGetSession()).resolves.toEqual({
			session: null,
			user: null
		});
	});

	test('safeGetSession returns null when direct fetch throws', async () => {
		fetchServerSession.mockImplementationOnce(async () => {
			throw new Error('Network error');
		});
		const request = new Request('http://localhost', {
			headers: { cookie: '__Secure-neon-auth.session=abc' }
		});
		const event = { locals: {}, request } as RequestEvent;
		const resolve = mock(async () => new Response('ok'));

		await handle({ event, resolve });

		await expect(event.locals.safeGetSession()).resolves.toEqual({
			session: null,
			user: null
		});
	});

	test('safeGetSession returns null when no Neon Auth cookie is present', async () => {
		const request = new Request('http://localhost');
		const event = { locals: {}, request } as RequestEvent;
		const resolve = mock(async () => new Response('ok'));

		await handle({ event, resolve });

		await expect(event.locals.safeGetSession()).resolves.toEqual({
			session: null,
			user: null
		});
		expect(fetchServerSession).not.toHaveBeenCalled();
	});

	test('failed OAuth exchange logs error and continues to normal setup', async () => {
		exchangeOAuthVerifier.mockImplementationOnce(async () => ({
			ok: false,
			status: 500,
			redirectUrl: 'http://localhost/profile',
			setCookieHeaders: [],
			error: 'OAuth exchange failed'
		}));

		const consoleErrorSpy = mock(() => {});
		const originalConsoleError = console.error;
		console.error = consoleErrorSpy;

		const request = new Request(
			'http://localhost/profile?neon_auth_session_verifier=verifier-123'
		);
		const event = {
			locals: {},
			request,
			url: new URL(request.url)
		} as RequestEvent;
		const resolve = mock(async () => new Response('ok'));

		const response = await handle({ event, resolve });

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Error exchanging Neon Auth OAuth verifier:',
			'OAuth exchange failed'
		);
		expect(resolve).toHaveBeenCalledWith(event);
		expect(await response.text()).toBe('ok');

		console.error = originalConsoleError;
	});

	test('fetchServerSession returns session data for successful auth response', async () => {
		const originalFetch = globalThis.fetch;
		const sessionData = { user: { id: 'user-1', email: 'test@example.com' } };
		globalThis.fetch = mock(
			async () =>
				new Response(JSON.stringify(sessionData), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
		);

		const request = new Request('http://localhost', {
			headers: { cookie: '__Secure-neon-auth.session=abc' }
		});

		const result = await actualFetchServerSession(request);

		expect(result.ok).toBe(true);
		expect(result.data).toEqual(sessionData);

		globalThis.fetch = originalFetch;
	});

	test('fetchServerSession returns null data for non-ok auth response', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = mock(async () => new Response('Unauthorized', { status: 401 }));

		const request = new Request('http://localhost', {
			headers: { cookie: '__Secure-neon-auth.session=abc' }
		});

		const result = await actualFetchServerSession(request);

		expect(result.ok).toBe(false);
		expect(result.data).toBeNull();

		globalThis.fetch = originalFetch;
	});
});
