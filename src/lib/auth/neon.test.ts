import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { normalizeSession } from './types';

const createAuthClient = mock((url: string, config?: unknown) => ({
	url,
	config,
	signIn: {
		social: mock(async () => ({ data: null, error: null }))
	},
	signOut: mock(async () => ({ data: null, error: null })),
	getSession: mock(async () => ({ data: null, error: null }))
}));

mock.module('@neondatabase/auth', () => ({
	createAuthClient
}));

describe('neon auth wrapper', () => {
	const originalEnv = {
		NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
		VITE_NEON_AUTH_URL: process.env.VITE_NEON_AUTH_URL,
		PUBLIC_NEON_AUTH_URL: process.env.PUBLIC_NEON_AUTH_URL
	};

	beforeEach(() => {
		createAuthClient.mockClear();
		delete process.env.VITE_NEON_AUTH_URL;
		delete process.env.PUBLIC_NEON_AUTH_URL;
		process.env.NEON_AUTH_BASE_URL = 'https://auth.example.test/auth';
	});

	afterEach(() => {
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	});

	test('creates an auth client from NEON_AUTH_BASE_URL', async () => {
		const { createNeonAuthClient } = await import('./neon.server');
		const client = createNeonAuthClient();

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
			cookie: 'session=test-session',
			host: 'app.example.test',
			origin: 'https://app.example.test',
			'x-custom': 'internal-value'
		});

		const { createNeonAuthClient } = await import('./neon.server');
		createNeonAuthClient({ headers });

		expect(createAuthClient).toHaveBeenCalledWith('https://auth.example.test/auth', {
			fetchOptions: {
				headers: {
					authorization: 'Bearer test-token',
					cookie: 'session=test-session',
					origin: 'https://app.example.test'
				}
			}
		});
	});

	test('uses PUBLIC_NEON_AUTH_URL as public fallback', async () => {
		delete process.env.NEON_AUTH_BASE_URL;
		process.env.PUBLIC_NEON_AUTH_URL = 'https://public.example.test/auth';

		const { getNeonAuthUrl } = await import('./neon.server');
		expect(getNeonAuthUrl()).toBe('https://public.example.test/auth');
	});

	test('throws when auth URL is missing', async () => {
		delete process.env.NEON_AUTH_BASE_URL;
		delete process.env.VITE_NEON_AUTH_URL;
		delete process.env.PUBLIC_NEON_AUTH_URL;

		const { getNeonAuthUrl } = await import('./neon.server');
		expect(() => getNeonAuthUrl()).toThrow(
			'NEON_AUTH_BASE_URL, VITE_NEON_AUTH_URL, or PUBLIC_NEON_AUTH_URL is required'
		);
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
