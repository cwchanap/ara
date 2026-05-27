import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { normalizeSession } from './types';

const createAuthClient = mock((url: string, config?: unknown) => ({
	url,
	config,
	signIn: {
		social: mock(async () => ({ data: { url: 'https://oauth.example.test' }, error: null }))
	},
	signOut: mock(async () => ({ data: null, error: null })),
	getSession: mock(async () => ({ data: null, error: null }))
}));

describe('neon auth wrapper', () => {
	beforeEach(() => {
		createAuthClient.mockClear();
	});

	test('creates an auth client from NEON_AUTH_BASE_URL', async () => {
		const { createNeonAuthClientWithFactory } = await import('./neon.server');
		const client = createNeonAuthClientWithFactory(createAuthClient, {
			authUrl: 'https://auth.example.test/auth'
		});

		expect(createAuthClient).toHaveBeenCalledWith('https://auth.example.test/auth', {
			fetchOptions: {
				headers: undefined
			}
		});
		expect(client).toHaveProperty('getSession');
	});

	test('passes only safe auth headers to the auth client fetch options', async () => {
		const headers = new Headers({
			authorization: 'Bearer test-token',
			'accept-encoding': 'gzip',
			'content-length': '123',
			'content-type': 'application/json',
			cookie: [
				'session=test-session',
				'__Secure-neon-auth.session=auth-session',
				'analytics=tracking-value',
				'__Secure-neon-auth.challenge=auth-challenge',
				'neon-auth-insecure=ignored'
			].join('; '),
			host: 'app.example.test',
			origin: 'https://app.example.test',
			'x-custom': 'internal-value'
		});

		const { createNeonAuthClientWithFactory } = await import('./neon.server');
		createNeonAuthClientWithFactory(createAuthClient, {
			authUrl: 'https://auth.example.test/auth',
			headers
		});

		expect(createAuthClient).toHaveBeenCalledWith('https://auth.example.test/auth', {
			fetchOptions: {
				headers: {
					cookie: '__Secure-neon-auth.session=auth-session; __Secure-neon-auth.challenge=auth-challenge',
					origin: 'https://app.example.test'
				}
			}
		});
	});

	test('uses PUBLIC_NEON_AUTH_URL as public fallback', async () => {
		const { resolveNeonAuthUrl } = await import('./neon.server');
		expect(
			resolveNeonAuthUrl({
				PUBLIC_NEON_AUTH_URL: 'https://public.example.test/auth'
			})
		).toBe('https://public.example.test/auth');
	});

	test('throws when auth URL is missing', async () => {
		const { resolveNeonAuthUrl } = await import('./neon.server');
		expect(() => resolveNeonAuthUrl({})).toThrow(
			'NEON_AUTH_BASE_URL, VITE_NEON_AUTH_URL, or PUBLIC_NEON_AUTH_URL is required'
		);
	});

	test('starts Google OAuth with direct Better Auth fetch and captures provider URL plus cookies', async () => {
		const fetcher = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
			expect(String(input)).toBe('https://auth.example.test/auth/sign-in/social');
			expect(init?.method).toBe('POST');
			expect(JSON.parse(String(init?.body))).toEqual({
				provider: 'google',
				callbackURL: '/saved-configs',
				disableRedirect: true
			});

			const headers = new Headers(init?.headers);
			expect(headers.get('cookie')).toBe(
				'__Secure-neon-auth.challenge=abc; __Secure-neon-auth.session=def'
			);
			expect(headers.get('origin')).toBe('https://app.example.test');
			expect(headers.get('user-agent')).toBe('bun-test');
			expect(headers.get('referer')).toBe('https://app.example.test/login');
			expect(headers.has('authorization')).toBe(false);
			expect(headers.has('host')).toBe(false);
			expect(headers.has('x-forwarded-for')).toBe(false);

			return new Response(
				JSON.stringify({ redirect: true, url: 'https://accounts.google.example/oauth' }),
				{
					status: 200,
					headers: {
						'content-type': 'application/json',
						'set-cookie':
							'__Secure-neon-auth.challenge=abc; Path=/; HttpOnly; Secure; SameSite=Lax'
					}
				}
			);
		});

		const { startGoogleOAuth } = await import('./neon.server');
		const result = await startGoogleOAuth({
			authUrl: 'https://auth.example.test/auth',
			callbackURL: '/saved-configs',
			fetch: fetcher,
			request: new Request('https://app.example.test/login', {
				headers: {
					authorization: 'Bearer test-token',
					cookie: [
						'other=value',
						'__Secure-neon-auth.challenge=abc',
						'__Secure-neon-auth.session=def',
						'neon-auth-insecure=ignored'
					].join('; '),
					host: 'app.example.test',
					origin: 'https://app.example.test',
					referer: 'https://app.example.test/login',
					'user-agent': 'bun-test',
					'x-forwarded-for': '127.0.0.1'
				}
			})
		});

		expect(result).toEqual({
			ok: true,
			status: 200,
			providerUrl: 'https://accounts.google.example/oauth',
			setCookieHeaders: [
				'__Secure-neon-auth.challenge=abc; Path=/; HttpOnly; Secure; SameSite=Lax'
			]
		});
	});

	test('tolerates nested direct OAuth response data URL', async () => {
		const { startGoogleOAuth } = await import('./neon.server');
		const result = await startGoogleOAuth({
			authUrl: 'https://auth.example.test/auth',
			callbackURL: '/',
			fetch: async () =>
				new Response(
					JSON.stringify({ data: { url: 'https://accounts.google.example/nested' } })
				),
			request: new Request('https://app.example.test/login')
		});

		expect(result.providerUrl).toBe('https://accounts.google.example/nested');
	});

	test('exchanges OAuth verifier, preserves search params, and returns clean redirect URL plus cookies', async () => {
		const fetcher = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(String(input));
			expect(url.origin + url.pathname).toBe('https://auth.example.test/auth/get-session');
			expect(url.searchParams.get('neon_auth_session_verifier')).toBe('verifier-123');
			expect(url.searchParams.get('redirect')).toBe('/saved-configs');
			expect(new Headers(init?.headers).get('cookie')).toBe(
				'__Secure-neon-auth.challenge=abc'
			);

			return new Response(JSON.stringify({ user: { id: 'user-1' } }), {
				headers: {
					'set-cookie':
						'__Secure-neon-auth.session=session-value; Path=/; HttpOnly; Secure; SameSite=Lax'
				}
			});
		});

		const { exchangeOAuthVerifier } = await import('./neon.server');
		const result = await exchangeOAuthVerifier({
			authUrl: 'https://auth.example.test/auth',
			fetch: fetcher,
			request: new Request(
				'https://app.example.test/profile?neon_auth_session_verifier=verifier-123&redirect=%2Fsaved-configs',
				{
					headers: {
						cookie: '__Secure-neon-auth.challenge=abc; other=value'
					}
				}
			)
		});

		expect(result).toEqual({
			ok: true,
			status: 200,
			redirectUrl: 'https://app.example.test/profile?redirect=%2Fsaved-configs',
			setCookieHeaders: [
				'__Secure-neon-auth.session=session-value; Path=/; HttpOnly; Secure; SameSite=Lax'
			]
		});
	});

	test('signs out through direct Better Auth fetch and captures clearing cookies', async () => {
		const fetcher = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
			expect(String(input)).toBe('https://auth.example.test/auth/sign-out');
			expect(init?.method).toBe('POST');
			expect(new Headers(init?.headers).get('cookie')).toBe('__Secure-neon-auth.session=abc');
			expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
			expect(init?.body).toBe('{}');

			return new Response('{}', {
				status: 204,
				headers: {
					'set-cookie':
						'__Secure-neon-auth.session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
				}
			});
		});

		const { signOutWithNeonAuth } = await import('./neon.server');
		const result = await signOutWithNeonAuth({
			authUrl: 'https://auth.example.test/auth',
			fetch: fetcher,
			request: new Request('https://app.example.test/profile', {
				headers: { cookie: '__Secure-neon-auth.session=abc; other=value' }
			})
		});

		expect(result).toEqual({
			ok: true,
			status: 204,
			setCookieHeaders: [
				'__Secure-neon-auth.session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
			]
		});
	});

	test('returns defensive clearing cookies when direct Better Auth signout fetch throws', async () => {
		const error = new Error('upstream unavailable');
		const fetcher = mock(async () => {
			throw error;
		});

		const { signOutWithNeonAuth } = await import('./neon.server');
		const result = await signOutWithNeonAuth({
			authUrl: 'https://auth.example.test/auth',
			fetch: fetcher,
			request: new Request('https://app.example.test/profile', {
				headers: {
					cookie: '__Secure-neon-auth.session=abc; other=value; __Secure-neon-auth.refresh=def'
				}
			})
		});

		expect(result).toEqual({
			ok: false,
			status: 0,
			error,
			setCookieHeaders: [
				'__Secure-neon-auth.session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
				'__Secure-neon-auth.refresh=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
			]
		});
	});

	test('uses defensive clearing cookies when direct Better Auth signout fails without Set-Cookie', async () => {
		const fetcher = mock(async () => {
			return new Response(JSON.stringify({ error: 'unavailable' }), { status: 502 });
		});

		const { signOutWithNeonAuth } = await import('./neon.server');
		const result = await signOutWithNeonAuth({
			authUrl: 'https://auth.example.test/auth',
			fetch: fetcher,
			request: new Request('https://app.example.test/profile', {
				headers: { cookie: '__Secure-neon-auth.session=abc; other=value' }
			})
		});

		expect(result).toEqual({
			ok: false,
			status: 502,
			error: { error: 'unavailable' },
			setCookieHeaders: [
				'__Secure-neon-auth.session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
			]
		});
	});

	test('applies parsed Set-Cookie headers to SvelteKit cookies using raw value encoding', async () => {
		const setCalls: unknown[][] = [];
		const cookies = {
			set: (...args: unknown[]) => setCalls.push(args)
		};

		const { applyNeonSetCookieHeaders } = await import('./neon.server');
		applyNeonSetCookieHeaders(cookies, [
			'__Secure-neon-auth.session=raw%2Fvalue; Path=/; HttpOnly; Secure; SameSite=Lax',
			'__Secure-neon-auth.challenge=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None'
		]);

		expect(setCalls).toHaveLength(2);
		expect(setCalls[0][0]).toBe('__Secure-neon-auth.session');
		expect(setCalls[0][1]).toBe('raw%2Fvalue');
		expect(setCalls[0][2]).toMatchObject({
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});
		expect(
			(setCalls[0][2] as { encode: (value: string) => string }).encode('raw%2Fvalue')
		).toBe('raw%2Fvalue');
		expect(setCalls[1][0]).toBe('__Secure-neon-auth.challenge');
		expect(setCalls[1][1]).toBe('');
		expect(setCalls[1][2]).toMatchObject({
			path: '/',
			maxAge: 0,
			httpOnly: true,
			secure: true,
			sameSite: 'none'
		});
	});
});

describe('normalizeSession', () => {
	test('returns session and user for a valid session', () => {
		const rawSession = {
			user: {
				id: 'user-123',
				email: 'user@example.test'
			},
			accessToken: 'token'
		};

		expect(normalizeSession(rawSession)).toEqual({
			session: rawSession,
			user: rawSession.user
		});
	});

	test('returns nulls when user is missing', () => {
		expect(normalizeSession({ accessToken: 'token' })).toEqual({ session: null, user: null });
	});

	test('returns nulls when user id is missing', () => {
		expect(normalizeSession({ user: { email: 'user@example.test' } })).toEqual({
			session: null,
			user: null
		});
	});

	test('returns nulls for malformed raw response', () => {
		expect(normalizeSession(null)).toEqual({ session: null, user: null });
		expect(normalizeSession('not-a-session')).toEqual({ session: null, user: null });
	});
});
