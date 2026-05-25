import { beforeEach, describe, expect, mock, test } from 'bun:test';

const { actions, load } = await import('./+page.server');

type SignInSocialResult = {
	data?: { url?: string } | null;
	error: Error | null;
};

const signInSocial = mock(
	async (): Promise<SignInSocialResult> => ({
		data: { url: 'https://accounts.google.example/oauth' },
		error: null as Error | null
	})
);

function makeLocals({ hasSession = false }: { hasSession?: boolean } = {}) {
	return {
		safeGetSession: async () => ({
			session: hasSession ? { user: { id: 'user-1' } } : null,
			user: hasSession ? { id: 'user-1', email: 'user@example.com' } : null
		}),
		neonAuth: {
			signIn: {
				social: signInSocial
			}
		}
	};
}

beforeEach(() => {
	signInSocial.mockClear();
	signInSocial.mockResolvedValue({
		data: { url: 'https://accounts.google.example/oauth' },
		error: null
	});
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
		await expect(
			actions.default({
				locals: makeLocals(),
				request: new Request('http://localhost/login?redirect=%2Fsaved-configs', {
					method: 'POST',
					body: new FormData()
				}),
				url: new URL('http://localhost/login?redirect=%2Fsaved-configs')
			} as unknown as Parameters<(typeof actions)['default']>[0])
		).rejects.toMatchObject({
			status: 303,
			location: 'https://accounts.google.example/oauth'
		});

		expect(signInSocial).toHaveBeenCalledWith({
			provider: 'google',
			callbackURL: '/saved-configs',
			disableRedirect: true
		});
	});

	test('falls back to base path for unsafe redirect params', async () => {
		await expect(
			actions.default({
				locals: makeLocals(),
				request: new Request('http://localhost/login?redirect=%2F%2Fevil.example', {
					method: 'POST',
					body: new FormData()
				}),
				url: new URL('http://localhost/login?redirect=%2F%2Fevil.example')
			} as unknown as Parameters<(typeof actions)['default']>[0])
		).rejects.toMatchObject({
			status: 303,
			location: 'https://accounts.google.example/oauth'
		});

		expect(signInSocial).toHaveBeenCalledWith({
			provider: 'google',
			callbackURL: '/',
			disableRedirect: true
		});
	});

	test('returns 400 when Google OAuth start fails', async () => {
		signInSocial.mockResolvedValueOnce({ error: new Error('OAuth unavailable') });

		const result = await actions.default({
			locals: makeLocals(),
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
		signInSocial.mockResolvedValueOnce({ data: {}, error: null });

		const result = await actions.default({
			locals: makeLocals(),
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
