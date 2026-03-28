import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithPasswordMock = vi.hoisted(() => vi.fn());

vi.mock('$app/paths', () => ({ base: '' }));

function makeLocals({ hasSession = false }: { hasSession?: boolean } = {}) {
	return {
		safeGetSession: vi.fn(async () => ({
			session: hasSession ? { access_token: 'tok' } : null,
			user: hasSession ? { id: 'user-1', email: 'user@example.com' } : null
		})),
		supabase: {
			auth: {
				signInWithPassword: signInWithPasswordMock
			}
		}
	};
}

function makeRequest(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	return { formData: async () => fd };
}

import { actions, load } from './+page.server';

describe('login page server', () => {
	beforeEach(() => {
		signInWithPasswordMock.mockReset();
		signInWithPasswordMock.mockResolvedValue({ error: null });
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('load', () => {
		it('returns empty object for unauthenticated users', async () => {
			const result = await load({
				locals: makeLocals({ hasSession: false }),
				url: new URL('http://localhost/login')
			} as unknown as Parameters<typeof load>[0]);
			expect(result).toEqual({});
		});

		it('redirects authenticated user to base path when no redirect param', async () => {
			await expect(
				load({
					locals: makeLocals({ hasSession: true }),
					url: new URL('http://localhost/login')
				} as unknown as Parameters<typeof load>[0])
			).rejects.toMatchObject({ status: 303, location: '/' });
		});

		it('redirects authenticated user to safe redirect path', async () => {
			await expect(
				load({
					locals: makeLocals({ hasSession: true }),
					url: new URL('http://localhost/login?redirect=%2Florenz')
				} as unknown as Parameters<typeof load>[0])
			).rejects.toMatchObject({ status: 303, location: '/lorenz' });
		});

		it('blocks open redirect (absolute URL) for authenticated user', async () => {
			await expect(
				load({
					locals: makeLocals({ hasSession: true }),
					url: new URL('http://localhost/login?redirect=https%3A%2F%2Fevil.example')
				} as unknown as Parameters<typeof load>[0])
			).rejects.toMatchObject({ status: 303, location: '/' });
		});

		it('blocks open redirect (protocol-relative URL) for authenticated user', async () => {
			await expect(
				load({
					locals: makeLocals({ hasSession: true }),
					url: new URL('http://localhost/login?redirect=%2F%2Fattacker.example')
				} as unknown as Parameters<typeof load>[0])
			).rejects.toMatchObject({ status: 303, location: '/' });
		});
	});

	describe('default action', () => {
		it('returns 400 for missing email', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ email: '', password: 'Pass123!' }),
				url: new URL('http://localhost/login')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({ status: 400 });
		});

		it('returns 400 for malformed email', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ email: 'not-an-email', password: 'Pass123!' }),
				url: new URL('http://localhost/login')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({ status: 400, data: { error: expect.any(String) } });
		});

		it('returns 400 when password is missing', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ email: 'user@example.com', password: '' }),
				url: new URL('http://localhost/login')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: 'Password is required', email: 'user@example.com' }
			});
		});

		it('returns 400 and preserves email on Supabase sign-in error', async () => {
			signInWithPasswordMock.mockResolvedValueOnce({
				error: new Error('Invalid login credentials')
			});
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ email: 'user@example.com', password: 'wrongpass' }),
				url: new URL('http://localhost/login')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: expect.any(String), email: 'user@example.com' }
			});
		});

		it('redirects to base path when no redirect param after successful login', async () => {
			await expect(
				actions.default({
					locals: makeLocals(),
					request: makeRequest({ email: 'user@example.com', password: 'correct' }),
					url: new URL('http://localhost/login')
				} as unknown as Parameters<(typeof actions)['default']>[0])
			).rejects.toMatchObject({ status: 303, location: '/' });
		});

		it('redirects to safe redirect path after login', async () => {
			await expect(
				actions.default({
					locals: makeLocals(),
					request: makeRequest({ email: 'user@example.com', password: 'correct' }),
					url: new URL('http://localhost/login?redirect=%2Fsaved-configs')
				} as unknown as Parameters<(typeof actions)['default']>[0])
			).rejects.toMatchObject({ status: 303, location: '/saved-configs' });
		});

		it('blocks open redirect after successful login', async () => {
			await expect(
				actions.default({
					locals: makeLocals(),
					request: makeRequest({ email: 'user@example.com', password: 'correct' }),
					url: new URL('http://localhost/login?redirect=%2F%2Fattacker.example')
				} as unknown as Parameters<(typeof actions)['default']>[0])
			).rejects.toMatchObject({ status: 303, location: '/' });
		});
	});
});
