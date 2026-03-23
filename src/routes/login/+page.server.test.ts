/**
 * Tests for the login page server (load + default action).
 *
 * Exercises redirect-safety (open-redirect prevention), input validation,
 * Supabase auth error handling, and successful sign-in redirect.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

// ── Supabase auth mock state ──────────────────────────────────────────────────

let mockSignInError: Error | null = null;

mock.module('@supabase/ssr', () => ({}));

// Dynamic import AFTER mock registration so the server module resolves the
// $lib/* virtual modules through the build plugin stubs in test-setup.ts.
const { actions, load } = await import('./+page.server');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLocals({
	hasSession = false
}: {
	hasSession?: boolean;
} = {}) {
	return {
		safeGetSession: async () => ({
			session: hasSession ? { access_token: 'tok' } : null,
			user: hasSession ? { id: 'user-1', email: 'user@example.com' } : null
		}),
		supabase: {
			auth: {
				signInWithPassword: async () => ({
					error: mockSignInError
				})
			}
		}
	};
}

function makeRequest(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	return { formData: async () => fd };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let consoleErrorSpy: ReturnType<typeof import('bun:test').spyOn>;

beforeEach(() => {
	mockSignInError = null;
	consoleErrorSpy = mock.module && (undefined as never); // no-op placeholder
});

afterEach(() => {
	// nothing to restore
});

// ── load ──────────────────────────────────────────────────────────────────────

describe('login page load', () => {
	test('returns empty object for unauthenticated users', async () => {
		const result = await load({
			locals: makeLocals({ hasSession: false }),
			url: new URL('http://localhost/login')
		} as never);
		expect(result).toEqual({});
	});

	test('redirects authenticated user to base path when no redirect param', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: true }),
				url: new URL('http://localhost/login')
			} as never)
		).rejects.toMatchObject({ status: 303, location: '/' });
	});

	test('redirects authenticated user to safe redirect path', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: true }),
				url: new URL('http://localhost/login?redirect=%2Florenz')
			} as never)
		).rejects.toMatchObject({ status: 303, location: '/lorenz' });
	});

	test('blocks open redirect (absolute URL) for authenticated user', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: true }),
				url: new URL('http://localhost/login?redirect=https%3A%2F%2Fevil.example')
			} as never)
		).rejects.toMatchObject({ status: 303, location: '/' });
	});

	test('blocks open redirect (protocol-relative URL) for authenticated user', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: true }),
				url: new URL('http://localhost/login?redirect=%2F%2Fattacker.example')
			} as never)
		).rejects.toMatchObject({ status: 303, location: '/' });
	});
});

// ── default action ────────────────────────────────────────────────────────────

describe('login default action', () => {
	describe('input validation', () => {
		test('returns 400 for missing email', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ email: '', password: 'Pass123!' }),
				url: new URL('http://localhost/login')
			} as never);
			expect(result).toMatchObject({ status: 400 });
		});

		test('returns 400 for malformed email', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ email: 'not-an-email', password: 'Pass123!' }),
				url: new URL('http://localhost/login')
			} as never);
			expect(result).toMatchObject({ status: 400, data: { error: expect.any(String) } });
		});

		test('returns 400 when password is missing', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ email: 'user@example.com', password: '' }),
				url: new URL('http://localhost/login')
			} as never);
			expect(result).toMatchObject({
				status: 400,
				data: { error: 'Password is required', email: 'user@example.com' }
			});
		});
	});

	describe('auth errors', () => {
		test('returns 400 and preserves email on Supabase sign-in error', async () => {
			mockSignInError = new Error('Invalid login credentials');
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ email: 'user@example.com', password: 'wrongpass' }),
				url: new URL('http://localhost/login')
			} as never);
			expect(result).toMatchObject({
				status: 400,
				data: { error: expect.any(String), email: 'user@example.com' }
			});
		});
	});

	describe('successful login', () => {
		test('redirects to base path when no redirect param', async () => {
			await expect(
				actions.default({
					locals: makeLocals(),
					request: makeRequest({ email: 'user@example.com', password: 'correct' }),
					url: new URL('http://localhost/login')
				} as never)
			).rejects.toMatchObject({ status: 303, location: '/' });
		});

		test('redirects to safe redirect path after login', async () => {
			await expect(
				actions.default({
					locals: makeLocals(),
					request: makeRequest({ email: 'user@example.com', password: 'correct' }),
					url: new URL('http://localhost/login?redirect=%2Fsaved-configs')
				} as never)
			).rejects.toMatchObject({ status: 303, location: '/saved-configs' });
		});

		test('blocks open redirect after successful login', async () => {
			await expect(
				actions.default({
					locals: makeLocals(),
					request: makeRequest({ email: 'user@example.com', password: 'correct' }),
					url: new URL('http://localhost/login?redirect=%2F%2Fattacker.example')
				} as never)
			).rejects.toMatchObject({ status: 303, location: '/' });
		});
	});
});
