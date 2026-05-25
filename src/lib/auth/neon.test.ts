import { beforeEach, describe, expect, mock, test } from 'bun:test';

const createAuthClient = mock((url: string) => ({
	url,
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
	beforeEach(() => {
		createAuthClient.mockClear();
		process.env.NEON_AUTH_BASE_URL = 'https://auth.example.test/auth';
	});

	test('creates an auth client from NEON_AUTH_BASE_URL', async () => {
		const { createNeonAuthClient } = await import('./neon');
		const client = createNeonAuthClient();

		expect(createAuthClient).toHaveBeenCalledWith('https://auth.example.test/auth');
		expect(client).toHaveProperty('getSession');
	});

	test('throws when auth URL is missing', async () => {
		delete process.env.NEON_AUTH_BASE_URL;
		delete process.env.VITE_NEON_AUTH_URL;

		const { getNeonAuthUrl } = await import('./neon');
		expect(() => getNeonAuthUrl()).toThrow(
			'NEON_AUTH_BASE_URL or VITE_NEON_AUTH_URL is required'
		);
	});
});
