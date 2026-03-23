/**
 * Tests for the profile page server.
 *
 * Covers:
 *  - load: auth guard, profile fetch
 *  - update action: username validation, duplicate check, upsert
 *  - changePassword action: validation, current-password verification, update,
 *    session revocation
 *  - signout action: redirect
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// ── DB mock state ─────────────────────────────────────────────────────────────

// Each element in the queue is the result for one .limit() or .returning() call.
const selectQueue: unknown[][] = [];
const updateReturnQueue: unknown[][] = [];
let insertShouldThrow: Error | null = null;

const selectMock = mock(() => {
	const chain: Record<string, unknown> = {
		from: mock(() => chain),
		where: mock(() => chain),
		limit: mock(async () => selectQueue.shift() ?? [])
	};
	return chain;
});

const updateMock = mock(() => ({
	set: mock(() => ({
		where: mock(() => ({
			returning: mock(async () => updateReturnQueue.shift() ?? [])
		}))
	}))
}));

const insertMock = mock(() => ({
	values: mock(async () => {
		if (insertShouldThrow) {
			const err = insertShouldThrow;
			insertShouldThrow = null;
			throw err;
		}
	})
}));

mock.module('$lib/server/db', () => ({
	db: {
		select: selectMock,
		update: updateMock,
		insert: insertMock
	},
	profiles: { id: 'id', username: 'username' }
}));

mock.module('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ eq: [a, b] })
}));

// Dynamic import AFTER mocks are registered.
const { actions, load } = await import('./+page.server');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLocals({
	hasSession = true,
	email = 'user@example.com'
}: {
	hasSession?: boolean;
	email?: string | null;
} = {}) {
	return {
		safeGetSession: async () => ({
			session: hasSession ? { access_token: 'tok' } : null,
			user: hasSession ? { id: 'user-1', email } : null
		}),
		supabase: {
			auth: {
				signInWithPassword: mock(async () => ({ error: null })),
				updateUser: mock(async () => ({ error: null })),
				signOut: mock(async () => ({ error: null }))
			}
		}
	};
}

function makeRequest(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	return { formData: async () => fd };
}

beforeEach(() => {
	selectQueue.length = 0;
	updateReturnQueue.length = 0;
	insertShouldThrow = null;
	selectMock.mockClear();
	updateMock.mockClear();
	insertMock.mockClear();
});

// ── load ──────────────────────────────────────────────────────────────────────

describe('profile page load', () => {
	test('redirects unauthenticated users to login', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: false }),
				url: new URL('http://localhost/profile')
			} as never)
		).rejects.toMatchObject({ status: 303 });
	});

	test('returns session, user and profile for authenticated users', async () => {
		selectQueue.push([{ id: 'user-1', username: 'testuser' }]);
		const result = await load({
			locals: makeLocals(),
			url: new URL('http://localhost/profile')
		} as never);
		expect(result).toMatchObject({
			session: expect.any(Object),
			user: expect.any(Object),
			profile: { id: 'user-1', username: 'testuser' }
		});
	});

	test('returns null profile when not found in database', async () => {
		selectQueue.push([]); // empty result
		const result = await load({
			locals: makeLocals(),
			url: new URL('http://localhost/profile')
		} as never);
		expect(result).toMatchObject({ profile: null });
	});
});

// ── update action ─────────────────────────────────────────────────────────────

describe('profile update action', () => {
	test('returns 401 when not authenticated', async () => {
		const result = await actions.update({
			locals: makeLocals({ hasSession: false }),
			request: makeRequest({ username: 'newname' })
		} as never);
		expect(result).toMatchObject({ status: 401 });
	});

	test('returns 400 for invalid username (too short)', async () => {
		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'ab' })
		} as never);
		expect(result).toMatchObject({ status: 400, data: { updateError: expect.any(String) } });
	});

	test('returns 400 when username is already taken by another user', async () => {
		// Existing profile with a DIFFERENT user id
		selectQueue.push([{ id: 'other-user' }]);
		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'takenname' })
		} as never);
		expect(result).toMatchObject({
			status: 400,
			data: { updateError: 'This username is already taken' }
		});
	});

	test('allows updating to the same username (own profile)', async () => {
		// The existing profile belongs to the same user
		selectQueue.push([{ id: 'user-1' }]);
		updateReturnQueue.push([{ id: 'user-1' }]);
		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'sameuser' })
		} as never);
		expect(result).toMatchObject({ updateSuccess: true });
	});

	test('returns success and updated username on valid update', async () => {
		selectQueue.push([]); // username not taken
		updateReturnQueue.push([{ id: 'user-1' }]);
		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'newusername' })
		} as never);
		expect(result).toMatchObject({ updateSuccess: true, username: 'newusername' });
	});

	test('inserts new profile when update finds no existing row', async () => {
		selectQueue.push([]); // username not taken
		updateReturnQueue.push([]); // no row updated → triggers insert
		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'brandnew' })
		} as never);
		expect(insertMock).toHaveBeenCalled();
		expect(result).toMatchObject({ updateSuccess: true });
	});

	test('returns 400 when database update throws', async () => {
		selectQueue.push([]); // username not taken
		const dbError = new Error('DB connection failed');
		// Make the returning() call throw by having update mock throw
		updateMock.mockImplementationOnce(() => ({
			set: () => ({
				where: () => ({
					returning: async () => {
						throw dbError;
					}
				})
			})
		}));
		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'validname' })
		} as never);
		expect(result).toMatchObject({ status: 400, data: { updateError: expect.any(String) } });
	});
});

// ── changePassword action ─────────────────────────────────────────────────────

describe('profile changePassword action', () => {
	test('returns 401 when not authenticated', async () => {
		const result = await actions.changePassword({
			locals: makeLocals({ hasSession: false }),
			request: makeRequest({
				currentPassword: 'old',
				newPassword: 'New1234!',
				confirmPassword: 'New1234!'
			})
		} as never);
		expect(result).toMatchObject({ status: 401 });
	});

	test('returns 400 when currentPassword is missing', async () => {
		const result = await actions.changePassword({
			locals: makeLocals(),
			request: makeRequest({
				currentPassword: '',
				newPassword: 'New1234!',
				confirmPassword: 'New1234!'
			})
		} as never);
		expect(result).toMatchObject({
			status: 400,
			data: { passwordError: 'Current password is required' }
		});
	});

	test('returns 400 when new password is too weak', async () => {
		const result = await actions.changePassword({
			locals: makeLocals(),
			request: makeRequest({
				currentPassword: 'oldpass',
				newPassword: 'short',
				confirmPassword: 'short'
			})
		} as never);
		expect(result).toMatchObject({ status: 400, data: { passwordError: expect.any(String) } });
	});

	test('returns 400 when passwords do not match', async () => {
		const result = await actions.changePassword({
			locals: makeLocals(),
			request: makeRequest({
				currentPassword: 'oldpass',
				newPassword: 'NewValid1!',
				confirmPassword: 'NewValid2!'
			})
		} as never);
		expect(result).toMatchObject({
			status: 400,
			data: { passwordError: 'New passwords do not match' }
		});
	});

	test('returns 400 for account without email', async () => {
		const result = await actions.changePassword({
			locals: makeLocals({ email: null }),
			request: makeRequest({
				currentPassword: 'oldpass',
				newPassword: 'NewValid1!',
				confirmPassword: 'NewValid1!'
			})
		} as never);
		expect(result).toMatchObject({ status: 400, data: { passwordError: expect.any(String) } });
	});

	test('returns 400 when current password verification fails', async () => {
		const locals = makeLocals();
		(locals.supabase.auth.signInWithPassword as ReturnType<typeof mock>).mockResolvedValueOnce({
			error: new Error('Invalid login credentials')
		});
		const result = await actions.changePassword({
			locals,
			request: makeRequest({
				currentPassword: 'wrongold',
				newPassword: 'NewValid1!',
				confirmPassword: 'NewValid1!'
			})
		} as never);
		expect(result).toMatchObject({
			status: 400,
			data: { passwordError: 'Current password is incorrect' }
		});
	});

	test('returns 400 when updateUser fails', async () => {
		const locals = makeLocals();
		(locals.supabase.auth.updateUser as ReturnType<typeof mock>).mockResolvedValueOnce({
			error: new Error('Update failed')
		});
		const result = await actions.changePassword({
			locals,
			request: makeRequest({
				currentPassword: 'correctold',
				newPassword: 'NewValid1!',
				confirmPassword: 'NewValid1!'
			})
		} as never);
		expect(result).toMatchObject({ status: 400, data: { passwordError: expect.any(String) } });
	});

	test('returns passwordSuccess: true on successful password change', async () => {
		const result = await actions.changePassword({
			locals: makeLocals(),
			request: makeRequest({
				currentPassword: 'correctold',
				newPassword: 'NewValid1!',
				confirmPassword: 'NewValid1!'
			})
		} as never);
		expect(result).toMatchObject({ passwordSuccess: true });
	});

	test('returns passwordWarning when signOut(others) fails after change', async () => {
		const locals = makeLocals();
		(locals.supabase.auth.signOut as ReturnType<typeof mock>).mockResolvedValueOnce({
			error: new Error('Session revoke failed')
		});
		const result = await actions.changePassword({
			locals,
			request: makeRequest({
				currentPassword: 'correctold',
				newPassword: 'NewValid1!',
				confirmPassword: 'NewValid1!'
			})
		} as never);
		expect(result).toMatchObject({ passwordSuccess: true, passwordWarning: expect.any(String) });
	});
});

// ── signout action ────────────────────────────────────────────────────────────

describe('profile signout action', () => {
	test('redirects to login after sign-out', async () => {
		await expect(
			actions.signout({ locals: makeLocals() } as never)
		).rejects.toMatchObject({ status: 303 });
	});

	test('still redirects when signOut returns an error', async () => {
		const locals = makeLocals();
		(locals.supabase.auth.signOut as ReturnType<typeof mock>).mockResolvedValueOnce({
			error: new Error('Network error')
		});
		await expect(actions.signout({ locals } as never)).rejects.toMatchObject({ status: 303 });
	});
});
