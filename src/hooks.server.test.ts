import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { RequestEvent } from '@sveltejs/kit';

let getSessionResult: { data: unknown; error: unknown } = {
	data: { user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' } },
	error: null
};

const getSession = mock(async () => getSessionResult);
const createNeonAuthClient = mock((options: unknown) => {
	void options;
	return { getSession };
});

const upstreamFetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
	void init;
	const url = new URL(String(input));
	expect(url.origin + url.pathname).toBe('https://auth.example.test/auth/get-session');
	expect(url.searchParams.get('neon_auth_session_verifier')).toBe('verifier-123');

	return new Response('{}', {
		status: 200,
		headers: {
			'set-cookie':
				'__Secure-neon-auth.session=session-value; Path=/; HttpOnly; Secure; SameSite=Lax'
		}
	});
});

mock.module('@neondatabase/auth', () => ({
	createAuthClient: createNeonAuthClient
}));

mock.module('$env/dynamic/private', () => ({
	env: { NEON_AUTH_BASE_URL: 'https://auth.example.test/auth' }
}));

mock.module('$env/dynamic/public', () => ({
	env: {}
}));

mock.module('$lib/auth/neon', () => ({
	normalizeSession: (data: unknown) => {
		const session = data as { user?: { id: string; email?: string; name?: string } };
		return session?.user?.id ? { session, user: session.user } : { session: null, user: null };
	}
}));

const { handle } = await import('./hooks.server');

describe('hooks.server', () => {
	beforeEach(() => {
		getSessionResult = {
			data: { user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' } },
			error: null
		};
		getSession.mockClear();
		createNeonAuthClient.mockClear();
		upstreamFetch.mockClear();
		globalThis.fetch = upstreamFetch as unknown as typeof fetch;
	});

	test('exchanges OAuth verifier before resolving protected routes', async () => {
		const request = new Request(
			'http://localhost/profile?neon_auth_session_verifier=verifier-123&redirect=%2Fsaved-configs',
			{ headers: { cookie: '__Secure-neon-auth.challenge=abc' } }
		);
		const event = { locals: {}, request, url: new URL(request.url) } as RequestEvent;
		const resolve = mock(async () => new Response('should not resolve'));

		const response = await handle({ event, resolve });

		expect(upstreamFetch).toHaveBeenCalled();
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

		expect(upstreamFetch).not.toHaveBeenCalled();
		expect(createNeonAuthClient).toHaveBeenCalledWith('https://auth.example.test/auth', {
			fetchOptions: {
				headers: undefined
			}
		});
		expect(resolve).toHaveBeenCalledWith(event);
		expect(await response.text()).toBe('ok');
	});

	test('sets neonAuth and safeGetSession on locals', async () => {
		const request = new Request('http://localhost', { headers: { cookie: 'auth=value' } });
		const event = { locals: {}, request } as RequestEvent;
		const resolve = mock(async () => new Response('ok'));

		await handle({ event, resolve });

		expect(createNeonAuthClient).toHaveBeenCalledWith('https://auth.example.test/auth', {
			fetchOptions: {
				headers: {
					cookie: 'auth=value'
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
