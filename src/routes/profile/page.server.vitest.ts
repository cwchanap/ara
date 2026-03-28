import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const selectResults = vi.hoisted<unknown[][]>(() => []);
const updateReturnQueue = vi.hoisted<unknown[][]>(() => []);
const selectMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn((left, right) => ({ left, right })));
const profiles = vi.hoisted(() => ({ id: 'id', username: 'username' }));

let insertShouldThrow: Error | null = null;
let updateShouldThrow: Error | null = null;

selectMock.mockImplementation(() => {
	const chain = {
		from: vi.fn(() => chain),
		where: vi.fn(() => chain),
		limit: vi.fn(async () => selectResults.shift() ?? [])
	};
	return chain;
});

updateMock.mockImplementation(() => ({
	set: vi.fn(() => ({
		where: vi.fn(() => ({
			returning: vi.fn(async () => {
				if (updateShouldThrow) {
					const err = updateShouldThrow;
					updateShouldThrow = null;
					throw err;
				}
				return updateReturnQueue.shift() ?? [];
			})
		}))
	}))
}));

insertMock.mockImplementation(() => ({
	values: vi.fn(async () => {
		if (insertShouldThrow) {
			const err = insertShouldThrow;
			insertShouldThrow = null;
			throw err;
		}
	})
}));

vi.mock('$app/paths', () => ({ base: '' }));

vi.mock('$lib/server/db', () => ({
	db: {
		select: selectMock,
		update: updateMock,
		insert: insertMock
	},
	profiles,
	savedConfigurations: {},
	sharedConfigurations: {}
}));

vi.mock('drizzle-orm', () => ({
	eq: eqMock
}));

import { actions, load } from './+page.server';

function makeLocals({
	hasSession = true,
	email = 'user@example.com'
}: {
	hasSession?: boolean;
	email?: string | null;
} = {}) {
	return {
		safeGetSession: vi.fn(async () => ({
			session: hasSession ? { access_token: 'tok' } : null,
			user: hasSession ? { id: 'user-1', email } : null
		})),
		supabase: {
			auth: {
				signInWithPassword: vi.fn(async () => ({ error: null })),
				updateUser: vi.fn(async () => ({ error: null })),
				signOut: vi.fn(async () => ({ error: null }))
			}
		}
	};
}

function makeRequest(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	return { formData: async () => fd };
}

describe('profile page server', () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		selectResults.length = 0;
		updateReturnQueue.length = 0;
		insertShouldThrow = null;
		updateShouldThrow = null;
		selectMock.mockClear();
		updateMock.mockClear();
		insertMock.mockClear();
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	describe('load', () => {
		it('redirects unauthenticated users to login', async () => {
			await expect(
				load({
					locals: makeLocals({ hasSession: false }),
					url: new URL('http://localhost/profile')
				} as unknown as Parameters<typeof load>[0])
			).rejects.toMatchObject({ status: 303 });
		});

		it('returns session, user and profile for authenticated users', async () => {
			selectResults.push([{ id: 'user-1', username: 'testuser' }]);
			const result = await load({
				locals: makeLocals(),
				url: new URL('http://localhost/profile')
			} as unknown as Parameters<typeof load>[0]);
			expect(result).toMatchObject({
				session: expect.any(Object),
				user: expect.any(Object),
				profile: { id: 'user-1', username: 'testuser' }
			});
		});

		it('returns null profile when not found in database', async () => {
			selectResults.push([]);
			const result = await load({
				locals: makeLocals(),
				url: new URL('http://localhost/profile')
			} as unknown as Parameters<typeof load>[0]);
			expect(result).toMatchObject({ profile: null });
		});
	});

	describe('update action', () => {
		it('returns 401 when not authenticated', async () => {
			const result = await actions.update({
				locals: makeLocals({ hasSession: false }),
				request: makeRequest({ username: 'newname' })
			} as unknown as Parameters<(typeof actions)['update']>[0]);
			expect(result).toMatchObject({ status: 401 });
		});

		it('returns 400 for invalid username (too short)', async () => {
			const result = await actions.update({
				locals: makeLocals(),
				request: makeRequest({ username: 'ab' })
			} as unknown as Parameters<(typeof actions)['update']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { updateError: expect.any(String) }
			});
		});

		it('returns 400 when username is already taken by another user', async () => {
			selectResults.push([{ id: 'other-user' }]);
			const result = await actions.update({
				locals: makeLocals(),
				request: makeRequest({ username: 'takenname' })
			} as unknown as Parameters<(typeof actions)['update']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { updateError: 'This username is already taken' }
			});
		});

		it('allows updating to the same username (own profile)', async () => {
			selectResults.push([{ id: 'user-1' }]);
			updateReturnQueue.push([{ id: 'user-1' }]);
			const result = await actions.update({
				locals: makeLocals(),
				request: makeRequest({ username: 'sameuser' })
			} as unknown as Parameters<(typeof actions)['update']>[0]);
			expect(result).toMatchObject({ updateSuccess: true });
		});

		it('returns success and updated username on valid update', async () => {
			selectResults.push([]);
			updateReturnQueue.push([{ id: 'user-1' }]);
			const result = await actions.update({
				locals: makeLocals(),
				request: makeRequest({ username: 'newusername' })
			} as unknown as Parameters<(typeof actions)['update']>[0]);
			expect(result).toMatchObject({ updateSuccess: true, username: 'newusername' });
		});

		it('inserts new profile when update finds no existing row', async () => {
			selectResults.push([]);
			updateReturnQueue.push([]);
			const result = await actions.update({
				locals: makeLocals(),
				request: makeRequest({ username: 'brandnew' })
			} as unknown as Parameters<(typeof actions)['update']>[0]);
			expect(insertMock).toHaveBeenCalled();
			expect(result).toMatchObject({ updateSuccess: true });
		});

		it('returns 400 when database update throws', async () => {
			selectResults.push([]);
			updateShouldThrow = new Error('DB connection failed');
			const result = await actions.update({
				locals: makeLocals(),
				request: makeRequest({ username: 'validname' })
			} as unknown as Parameters<(typeof actions)['update']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { updateError: expect.any(String) }
			});
		});
	});

	describe('changePassword action', () => {
		it('returns 401 when not authenticated', async () => {
			const result = await actions.changePassword({
				locals: makeLocals({ hasSession: false }),
				request: makeRequest({
					currentPassword: 'old',
					newPassword: 'New1234!',
					confirmPassword: 'New1234!'
				})
			} as unknown as Parameters<(typeof actions)['changePassword']>[0]);
			expect(result).toMatchObject({ status: 401 });
		});

		it('returns 400 when currentPassword is missing', async () => {
			const result = await actions.changePassword({
				locals: makeLocals(),
				request: makeRequest({
					currentPassword: '',
					newPassword: 'New1234!',
					confirmPassword: 'New1234!'
				})
			} as unknown as Parameters<(typeof actions)['changePassword']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { passwordError: 'Current password is required' }
			});
		});

		it('returns 400 when new password is too weak', async () => {
			const result = await actions.changePassword({
				locals: makeLocals(),
				request: makeRequest({
					currentPassword: 'oldpass',
					newPassword: 'short',
					confirmPassword: 'short'
				})
			} as unknown as Parameters<(typeof actions)['changePassword']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { passwordError: expect.any(String) }
			});
		});

		it('returns 400 when passwords do not match', async () => {
			const result = await actions.changePassword({
				locals: makeLocals(),
				request: makeRequest({
					currentPassword: 'oldpass',
					newPassword: 'NewValid1!',
					confirmPassword: 'NewValid2!'
				})
			} as unknown as Parameters<(typeof actions)['changePassword']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { passwordError: 'New passwords do not match' }
			});
		});

		it('returns 400 for account without email', async () => {
			const result = await actions.changePassword({
				locals: makeLocals({ email: null }),
				request: makeRequest({
					currentPassword: 'oldpass',
					newPassword: 'NewValid1!',
					confirmPassword: 'NewValid1!'
				})
			} as unknown as Parameters<(typeof actions)['changePassword']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { passwordError: expect.any(String) }
			});
		});

		it('returns 400 when current password verification fails', async () => {
			const locals = makeLocals();
			(
				locals.supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>
			).mockResolvedValueOnce({ error: new Error('Invalid login credentials') });
			const result = await actions.changePassword({
				locals,
				request: makeRequest({
					currentPassword: 'wrongold',
					newPassword: 'NewValid1!',
					confirmPassword: 'NewValid1!'
				})
			} as unknown as Parameters<(typeof actions)['changePassword']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { passwordError: 'Current password is incorrect' }
			});
		});

		it('returns 400 when updateUser fails', async () => {
			const locals = makeLocals();
			(locals.supabase.auth.updateUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				error: new Error('Update failed')
			});
			const result = await actions.changePassword({
				locals,
				request: makeRequest({
					currentPassword: 'correctold',
					newPassword: 'NewValid1!',
					confirmPassword: 'NewValid1!'
				})
			} as unknown as Parameters<(typeof actions)['changePassword']>[0]);
			expect(result).toMatchObject({
				status: 400,
				data: { passwordError: expect.any(String) }
			});
		});

		it('returns passwordSuccess: true on successful password change', async () => {
			const result = await actions.changePassword({
				locals: makeLocals(),
				request: makeRequest({
					currentPassword: 'correctold',
					newPassword: 'NewValid1!',
					confirmPassword: 'NewValid1!'
				})
			} as unknown as Parameters<(typeof actions)['changePassword']>[0]);
			expect(result).toMatchObject({ passwordSuccess: true });
		});

		it('returns passwordWarning when signOut(others) fails after change', async () => {
			const locals = makeLocals();
			(locals.supabase.auth.signOut as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				error: new Error('Session revoke failed')
			});
			const result = await actions.changePassword({
				locals,
				request: makeRequest({
					currentPassword: 'correctold',
					newPassword: 'NewValid1!',
					confirmPassword: 'NewValid1!'
				})
			} as unknown as Parameters<(typeof actions)['changePassword']>[0]);
			expect(result).toMatchObject({
				passwordSuccess: true,
				passwordWarning: expect.any(String)
			});
		});
	});

	describe('signout action', () => {
		it('redirects to login after sign-out', async () => {
			await expect(
				actions.signout({
					locals: makeLocals()
				} as unknown as Parameters<(typeof actions)['signout']>[0])
			).rejects.toMatchObject({ status: 303 });
		});

		it('still redirects when signOut returns an error', async () => {
			const locals = makeLocals();
			(locals.supabase.auth.signOut as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				error: new Error('Network error')
			});
			await expect(
				actions.signout({ locals } as unknown as Parameters<(typeof actions)['signout']>[0])
			).rejects.toMatchObject({ status: 303 });
		});
	});
});
