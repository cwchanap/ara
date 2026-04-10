/**
 * Tests for the signup page server (load + default action).
 *
 * Covers:
 *  - load: redirect of authenticated users, safe redirect URL handling
 *  - default action: email/username/password validation, username uniqueness,
 *    Supabase signUp errors, email verification enabled detection,
 *    profile creation, orphaned user cleanup on profile failure,
 *    successful signup redirect
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// ── DB mock state ─────────────────────────────────────────────────────────────

const selectQueue: unknown[][] = [];
let insertShouldThrow: Error | null = null;

const selectMock = mock(() => {
	const chain: Record<string, unknown> = {
		from: mock(() => chain),
		where: mock(() => chain),
		limit: mock(async () => selectQueue.shift() ?? [])
	};
	return chain;
});

let lastInsertedValues: Record<string, unknown> | null = null;

const insertMock = mock(() => ({
	values: async (vals: Record<string, unknown>) => {
		lastInsertedValues = vals;
		if (insertShouldThrow) {
			const e = insertShouldThrow;
			insertShouldThrow = null;
			throw e;
		}
	}
}));

mock.module('$lib/server/db', () => ({
	db: { select: selectMock, insert: insertMock },
	profiles: { id: 'id', username: 'username' },
	savedConfigurations: {},
	sharedConfigurations: {}
}));

mock.module('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ eq: [a, b] })
}));

// ── supabase-admin mock ───────────────────────────────────────────────────────

let deleteAuthUserResult = true;
const deleteAuthUserMock = mock(async () => deleteAuthUserResult);
const signOutMock = mock(async () => ({ error: null as Error | null }));

mock.module('$lib/server/supabase-admin', () => ({
	deleteAuthUser: deleteAuthUserMock
}));

// Dynamic import AFTER mocks.
const { actions, load } = await import('./+page.server');

// ── Helpers ───────────────────────────────────────────────────────────────────

type SignUpResult = {
	data: { user: { id: string } | null; session: { access_token: string } | null };
	error: Error | null;
};

function makeLocals({
	hasSession = false,
	signUpResult = {
		data: { user: { id: 'new-user-id' }, session: { access_token: 'tok' } },
		error: null
	} as SignUpResult
}: {
	hasSession?: boolean;
	signUpResult?: SignUpResult;
} = {}) {
	return {
		safeGetSession: async () => ({
			session: hasSession ? { access_token: 'tok' } : null,
			user: hasSession ? { id: 'existing-user' } : null
		}),
		supabase: {
			auth: {
				signUp: async () => signUpResult,
				signOut: signOutMock
			}
		}
	};
}

function makeRequest(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	return { formData: async () => fd };
}

const validFields = {
	email: 'user@example.com',
	password: 'StrongPass123',
	confirmPassword: 'StrongPass123',
	username: 'chaos_user'
};

beforeEach(() => {
	selectQueue.length = 0;
	insertShouldThrow = null;
	lastInsertedValues = null;
	deleteAuthUserResult = true;
	selectMock.mockClear();
	insertMock.mockClear();
	deleteAuthUserMock.mockClear();
	signOutMock.mockClear();
});

// ── load ──────────────────────────────────────────────────────────────────────

describe('signup load', () => {
	test('returns empty object for unauthenticated users', async () => {
		const result = await load({
			locals: makeLocals({ hasSession: false }),
			url: new URL('http://localhost/signup')
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toEqual({});
	});

	test('redirects authenticated user to base path when no redirect param', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: true }),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/' });
	});

	test('redirects authenticated user to safe redirect path', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: true }),
				url: new URL('http://localhost/signup?redirect=%2Florenz')
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/lorenz' });
	});

	test('blocks open redirect (absolute URL)', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: true }),
				url: new URL('http://localhost/signup?redirect=https%3A%2F%2Fevil.example')
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/' });
	});

	test('blocks protocol-relative open redirect', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: true }),
				url: new URL('http://localhost/signup?redirect=%2F%2Fattacker.example')
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/' });
	});
});

// ── default action ────────────────────────────────────────────────────────────

describe('signup default action', () => {
	describe('email validation', () => {
		test('returns 400 for empty email', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ ...validFields, email: '' }),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: 'Email is required' }
			});
		});

		test('returns 400 for invalid email format', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ ...validFields, email: 'not-an-email' }),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: 'Please enter a valid email address' }
			});
		});
	});

	describe('username validation', () => {
		test('returns 400 for username that is too short', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ ...validFields, username: 'ab' }),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({ status: 400 });
		});

		test('returns 400 for empty username', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ ...validFields, username: '' }),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({ status: 400 });
		});
	});

	describe('password validation', () => {
		test('returns 400 for password that is too short', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({
					...validFields,
					password: 'short',
					confirmPassword: 'short'
				}),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: 'Password must be at least 8 characters' }
			});
		});

		test('returns 400 when passwords do not match', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({
					...validFields,
					password: 'StrongPass123',
					confirmPassword: 'DifferentPass456'
				}),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: 'Passwords do not match' }
			});
		});
	});

	describe('username uniqueness check', () => {
		test('returns 400 when username is already taken', async () => {
			selectQueue.push([{ id: 'existing-user' }]); // username taken
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest(validFields),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: 'This username is already taken' }
			});
		});

		test('returns 400 when DB select throws during username check', async () => {
			// Make select throw by implementing it to throw
			selectMock.mockImplementationOnce(() => {
				const chain: Record<string, unknown> = {
					from: mock(() => chain),
					where: mock(() => chain),
					limit: mock(async () => {
						throw new Error('DB error');
					})
				};
				return chain;
			});
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest(validFields),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: expect.stringContaining('Database error') }
			});
		});
	});

	describe('Supabase signUp errors', () => {
		test('returns 400 with friendly message for duplicate email (already registered)', async () => {
			selectQueue.push([]); // username not taken
			const result = await actions.default({
				locals: makeLocals({
					signUpResult: {
						data: { user: null, session: null },
						error: new Error('User already registered')
					}
				}),
				request: makeRequest(validFields),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: 'An account with this email already exists' }
			});
		});

		test('returns 400 with friendly message for duplicate email (already exists)', async () => {
			selectQueue.push([]);
			const result = await actions.default({
				locals: makeLocals({
					signUpResult: {
						data: { user: null, session: null },
						error: new Error('Email already exists in auth')
					}
				}),
				request: makeRequest(validFields),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: 'An account with this email already exists' }
			});
		});

		test('returns 400 for other Supabase signup errors', async () => {
			selectQueue.push([]);
			const result = await actions.default({
				locals: makeLocals({
					signUpResult: {
						data: { user: null, session: null },
						error: new Error('Rate limit exceeded')
					}
				}),
				request: makeRequest(validFields),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: expect.stringContaining('Something went wrong') }
			});
		});
	});

	describe('email verification detection', () => {
		test('returns 400 when Supabase returns user but no session (email verification enabled)', async () => {
			selectQueue.push([]);
			const result = await actions.default({
				locals: makeLocals({
					signUpResult: {
						data: { user: { id: 'user-1' }, session: null },
						error: null
					}
				}),
				request: makeRequest(validFields),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: expect.stringContaining('Email verification is enabled') }
			});
		});
	});

	describe('profile creation', () => {
		test('returns 400 with unique violation message on username race condition', async () => {
			selectQueue.push([]); // username not taken at check time
			const uniqueViolation = Object.assign(new Error('unique_violation'), { code: '23505' });
			insertShouldThrow = uniqueViolation;
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest(validFields),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { error: expect.stringContaining('username was just taken') }
			});
		});

		test('returns 400 on unique violation detected via "duplicate" message', async () => {
			selectQueue.push([]);
			insertShouldThrow = new Error('duplicate key value violates unique constraint');
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest(validFields),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({ status: 400 });
		});

		test('returns 500 when profile insert fails with non-unique error', async () => {
			selectQueue.push([]);
			insertShouldThrow = new Error('DB connection refused');
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest(validFields),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({ status: 500, data: { error: expect.any(String) } });
			expect(signOutMock).toHaveBeenCalledTimes(1);
			expect(deleteAuthUserMock).toHaveBeenCalledTimes(1);
		});

		test('still returns error when deleteAuthUser fails after profile creation failure', async () => {
			selectQueue.push([]);
			insertShouldThrow = new Error('DB connection refused');
			deleteAuthUserResult = false;
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest(validFields),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			// Should still return an error, not crash
			expect(result).toMatchObject({ status: 500 });
			expect(signOutMock).toHaveBeenCalledTimes(1);
			expect(deleteAuthUserMock).toHaveBeenCalledTimes(1);
			expect(deleteAuthUserMock).toHaveBeenCalledWith('new-user-id');
		});
	});

	describe('successful signup', () => {
		test('redirects to base path after successful signup', async () => {
			selectQueue.push([]); // username not taken
			await expect(
				actions.default({
					locals: makeLocals(),
					request: makeRequest(validFields),
					url: new URL('http://localhost/signup')
				} as unknown as Parameters<(typeof actions)['default']>[0])
			).rejects.toMatchObject({ status: 303, location: '/' });
		});

		test('redirects to safe redirect path after successful signup', async () => {
			selectQueue.push([]);
			await expect(
				actions.default({
					locals: makeLocals(),
					request: makeRequest(validFields),
					url: new URL('http://localhost/signup?redirect=%2Fsaved-configs')
				} as unknown as Parameters<(typeof actions)['default']>[0])
			).rejects.toMatchObject({ status: 303, location: '/saved-configs' });
		});

		test('blocks open redirect after successful signup', async () => {
			selectQueue.push([]);
			await expect(
				actions.default({
					locals: makeLocals(),
					request: makeRequest(validFields),
					url: new URL('http://localhost/signup?redirect=https%3A%2F%2Fevil.com')
				} as unknown as Parameters<(typeof actions)['default']>[0])
			).rejects.toMatchObject({ status: 303, location: '/' });
		});

		test('creates profile with correct userId and username', async () => {
			selectQueue.push([]);
			await expect(
				actions.default({
					locals: makeLocals({
						signUpResult: {
							data: {
								user: { id: 'new-user-123' },
								session: { access_token: 'tok' }
							},
							error: null
						}
					}),
					request: makeRequest(validFields),
					url: new URL('http://localhost/signup')
				} as unknown as Parameters<(typeof actions)['default']>[0])
			).rejects.toMatchObject({ status: 303, location: '/' });
			expect(lastInsertedValues?.id).toBe('new-user-123');
			expect(lastInsertedValues?.username).toBe(validFields.username);
		});

		test('preserves email and username in error response for re-population', async () => {
			const result = await actions.default({
				locals: makeLocals(),
				request: makeRequest({ ...validFields, email: 'bad-email' }),
				url: new URL('http://localhost/signup')
			} as unknown as Parameters<(typeof actions)['default']>[0]);
			expect(result).toMatchObject({
				data: { email: 'bad-email', username: validFields.username }
			});
		});
	});
});
