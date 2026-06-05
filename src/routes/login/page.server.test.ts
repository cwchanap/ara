import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest';

const upstreamFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
	void input;
	void init;
	return new Response(
		JSON.stringify({ redirect: true, url: 'https://accounts.google.example/oauth' }),
		{
			status: 200,
			headers: {
				'set-cookie':
					'__Secure-neon-auth.challenge=abc; Path=/; HttpOnly; Secure; SameSite=Lax'
			}
		}
	);
});

vi.mock('$env/dynamic/private', () => ({
	env: { NEON_AUTH_BASE_URL: 'https://auth.example.test/auth' }
}));

vi.mock('$env/dynamic/public', () => ({
	env: {}
}));

const { actions, load } = await import('./+page.server');

function makeLocals({ hasSession = false }: { hasSession?: boolean } = {}) {
	return {
		safeGetSession: async () => ({
			session: hasSession ? { user: { id: 'user-1' } } : null,
			user: hasSession ? { id: 'user-1', email: 'user@example.com' } : null
		})
	};
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
	upstreamFetch.mockClear();
	upstreamFetch.mockResolvedValue(
		new Response(
			JSON.stringify({ redirect: true, url: 'https://accounts.google.example/oauth' }),
			{
				status: 200,
				headers: {
					'set-cookie':
						'__Secure-neon-auth.challenge=abc; Path=/; HttpOnly; Secure; SameSite=Lax'
				}
			}
		)
	);
	globalThis.fetch = upstreamFetch as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe('login page load', () => {
	test('returns safe redirect target for unauthenticated users', async () => {
		const result = await load({
			locals: makeLocals(),
			url: new URL('http://localhost/login?redirect=%2Fsaved-configs')
		} as unknown as Parameters<typeof load>[0]);

		expect(result).toEqual({ redirectTo: '/saved-configs' });
	});

	test('redirects authenticated user to safe redirect path', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: true }),
				url: new URL('http://localhost/login?redirect=%2Florenz')
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/lorenz' });
	});

	test('blocks open redirect for authenticated user', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: true }),
				url: new URL('http://localhost/login?redirect=https%3A%2F%2Fevil.example')
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/' });
	});
});

describe('login default action', () => {
	test('starts Google OAuth and redirects to the provider URL', async () => {
		const request = new Request('http://localhost/login?redirect=%2Fsaved-configs', {
			method: 'POST',
			body: new FormData()
		});
		const cookies = { set: vi.fn(() => {}) };

		await expect(
			actions.default({
				locals: makeLocals(),
				cookies,
				request,
				url: new URL('http://localhost/login?redirect=%2Fsaved-configs')
			} as unknown as Parameters<(typeof actions)['default']>[0])
		).rejects.toMatchObject({
			status: 303,
			location: 'https://accounts.google.example/oauth'
		});

		expect(upstreamFetch).toHaveBeenCalledWith(
			'https://auth.example.test/auth/sign-in/social',
			{
				method: 'POST',
				headers: expect.any(Headers),
				body: JSON.stringify({
					provider: 'google',
					callbackURL: '/saved-configs',
					disableRedirect: true
				})
			}
		);
		expect(cookies.set).toHaveBeenCalledWith(
			'__Secure-neon-auth.challenge',
			'abc',
			expect.objectContaining({
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'lax'
			})
		);
	});

	test('falls back to base path for unsafe redirect params', async () => {
		const request = new Request('http://localhost/login?redirect=%2F%2Fevil.example', {
			method: 'POST',
			body: new FormData()
		});

		await expect(
			actions.default({
				locals: makeLocals(),
				cookies: { set: vi.fn(() => {}) },
				request,
				url: new URL('http://localhost/login?redirect=%2F%2Fevil.example')
			} as unknown as Parameters<(typeof actions)['default']>[0])
		).rejects.toMatchObject({
			status: 303,
			location: 'https://accounts.google.example/oauth'
		});

		expect(JSON.parse(String(upstreamFetch.mock.calls[0][1]?.body))).toMatchObject({
			callbackURL: '/'
		});
	});

	test('redirects authenticated POSTs to the safe redirect target without starting OAuth', async () => {
		await expect(
			actions.default({
				locals: makeLocals({ hasSession: true }),
				cookies: { set: vi.fn(() => {}) },
				request: new Request('http://localhost/login?redirect=%2Fsaved-configs', {
					method: 'POST',
					body: new FormData()
				}),
				url: new URL('http://localhost/login?redirect=%2Fsaved-configs')
			} as unknown as Parameters<(typeof actions)['default']>[0])
		).rejects.toMatchObject({ status: 303, location: '/saved-configs' });

		expect(upstreamFetch).not.toHaveBeenCalled();
	});

	test('returns 400 when Google OAuth start fails', async () => {
		upstreamFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 })
		);

		const result = await actions.default({
			locals: makeLocals(),
			cookies: { set: vi.fn(() => {}) },
			request: new Request('http://localhost/login', {
				method: 'POST',
				body: new FormData()
			}),
			url: new URL('http://localhost/login')
		} as unknown as Parameters<(typeof actions)['default']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Google sign-in failed. Please try again.' }
		});
	});

	test('returns 400 when Google OAuth start returns no provider URL', async () => {
		upstreamFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ redirect: true }), { status: 200 })
		);

		const result = await actions.default({
			locals: makeLocals(),
			cookies: { set: vi.fn(() => {}) },
			request: new Request('http://localhost/login', {
				method: 'POST',
				body: new FormData()
			}),
			url: new URL('http://localhost/login')
		} as unknown as Parameters<(typeof actions)['default']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Google sign-in failed. Please try again.' }
		});
	});
});
