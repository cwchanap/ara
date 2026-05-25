import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { RequestEvent } from '@sveltejs/kit';
import { createNeonAuthClientWithFactory } from '$lib/auth/neon.server';

let getSessionResult: { data: unknown; error: unknown } = {
	data: { user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' } },
	error: null
};

const getSession = mock(async () => getSessionResult);
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

mock.module('$lib/auth/neon', () => ({
	normalizeSession: (data: unknown) => {
		const session = data as { user?: { id: string; email?: string; name?: string } };
		return session?.user?.id ? { session, user: session.user } : { session: null, user: null };
	}
}));

const { createHandle } = await import('./hooks.server');
const handle = createHandle({ createNeonAuthClient, exchangeOAuthVerifier });

describe('hooks.server', () => {
	beforeEach(() => {
		getSessionResult = {
			data: { user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' } },
			error: null
		};
		getSession.mockClear();
		createNeonAuthClient.mockClear();
		authClientFactory.mockClear();
		exchangeOAuthVerifier.mockClear();
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
		expect(getSession).toHaveBeenCalled();
		expect(result.user?.id).toBe('user-1');
		expect(result.session).toEqual({
			user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' }
		});
	});

	test('safeGetSession returns null session and user when Neon Auth returns an error', async () => {
		getSessionResult = { data: null, error: { message: 'Invalid session' } };
		const request = new Request('http://localhost');
		const event = { locals: {}, request } as RequestEvent;
		const resolve = mock(async () => new Response('ok'));

		await handle({ event, resolve });

		await expect(event.locals.safeGetSession()).resolves.toEqual({
			session: null,
			user: null
		});
	});
});
