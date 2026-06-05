import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest';

const h = vi.hoisted(() => {
	const state = {
		selectQueue: [] as unknown[][],
		updateReturnQueue: [] as unknown[][],
		insertShouldThrow: null as Error | null,
		updateShouldThrow: null as Error | null
	};

	const selectMock = vi.fn(() => {
		const chain: Record<string, unknown> = {
			from: vi.fn(() => chain),
			where: vi.fn(() => chain),
			limit: vi.fn(async () => state.selectQueue.shift() ?? [])
		};
		return chain;
	});

	const updateMock = vi.fn(() => ({
		set: vi.fn(() => ({
			where: vi.fn(() => ({
				returning: vi.fn(async () => {
					if (state.updateShouldThrow) {
						const err = state.updateShouldThrow;
						state.updateShouldThrow = null;
						throw err;
					}
					return state.updateReturnQueue.shift() ?? [];
				})
			}))
		}))
	}));

	const insertMock = vi.fn(() => ({
		values: vi.fn(async () => {
			if (state.insertShouldThrow) {
				const err = state.insertShouldThrow;
				state.insertShouldThrow = null;
				throw err;
			}
		})
	}));

	return { state, selectMock, updateMock, insertMock };
});

vi.mock('$lib/server/db', () => ({
	db: {
		select: h.selectMock,
		update: h.updateMock,
		insert: h.insertMock
	},
	profiles: { id: 'id', username: 'username' },
	savedConfigurations: {},
	sharedConfigurations: {}
}));

vi.mock('$env/dynamic/private', () => ({
	env: { NEON_AUTH_BASE_URL: 'https://auth.example.test/auth' }
}));

vi.mock('$env/dynamic/public', () => ({
	env: {}
}));

const { actions, load } = await import('./+page.server');

function makeLocals({ hasSession = true }: { hasSession?: boolean } = {}) {
	return {
		safeGetSession: async () => ({
			session: hasSession ? { user: { id: 'user-1' } } : null,
			user: hasSession ? { id: 'user-1', email: 'user@example.com' } : null
		})
	};
}

function makeRequest(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [key, value] of Object.entries(fields)) fd.set(key, value);
	return { formData: async () => fd };
}

const originalFetch = globalThis.fetch;

const upstreamFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
	void input;
	void init;
	return new Response('{}', {
		status: 200,
		headers: {
			'set-cookie':
				'__Secure-neon-auth.session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
		}
	});
});

beforeEach(() => {
	h.state.selectQueue.length = 0;
	h.state.updateReturnQueue.length = 0;
	h.state.insertShouldThrow = null;
	h.state.updateShouldThrow = null;
	h.selectMock.mockClear();
	h.updateMock.mockClear();
	h.insertMock.mockClear();
	upstreamFetch.mockClear();
	upstreamFetch.mockResolvedValue(
		new Response('{}', {
			status: 200,
			headers: {
				'set-cookie':
					'__Secure-neon-auth.session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
			}
		})
	);
	globalThis.fetch = upstreamFetch as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe('profile page load', () => {
	test('redirects unauthenticated users to login', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: false }),
				url: new URL('http://localhost/profile')
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/login?redirect=%2Fprofile' });
	});

	test('returns session, user, and profile for authenticated users', async () => {
		h.state.selectQueue.push([{ id: 'user-1', username: 'testuser' }]);

		const result = await load({
			locals: makeLocals(),
			url: new URL('http://localhost/profile')
		} as unknown as Parameters<typeof load>[0]);

		expect(result).toMatchObject({
			session: expect.any(Object),
			user: { id: 'user-1', email: 'user@example.com' },
			profile: { id: 'user-1', username: 'testuser' }
		});
	});

	test('auto-provisions a profile when not found in database', async () => {
		h.state.selectQueue.push([]);

		const result = await load({
			locals: makeLocals(),
			url: new URL('http://localhost/profile')
		} as unknown as Parameters<typeof load>[0]);

		expect(h.insertMock).toHaveBeenCalled();
		expect(result).toMatchObject({
			profile: {
				id: 'user-1',
				username: 'user'
			}
		});
	});
});

describe('profile update action', () => {
	test('returns 401 when not authenticated', async () => {
		const result = await actions.update({
			locals: makeLocals({ hasSession: false }),
			request: makeRequest({ username: 'newname' })
		} as unknown as Parameters<(typeof actions)['update']>[0]);

		expect(result).toMatchObject({
			status: 401,
			data: { updateError: 'You must be logged in to update your profile' }
		});
	});

	test('returns 400 for invalid username', async () => {
		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'ab' })
		} as unknown as Parameters<(typeof actions)['update']>[0]);

		expect(result).toMatchObject({ status: 400, data: { updateError: expect.any(String) } });
	});

	test('returns 400 when username is already taken by another user', async () => {
		h.state.selectQueue.push([{ id: 'other-user' }]);

		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'takenname' })
		} as unknown as Parameters<(typeof actions)['update']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { updateError: 'This username is already taken' }
		});
	});

	test('returns success and updated username on valid update', async () => {
		h.state.selectQueue.push([]);
		h.state.updateReturnQueue.push([{ id: 'user-1' }]);

		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'newusername' })
		} as unknown as Parameters<(typeof actions)['update']>[0]);

		expect(result).toMatchObject({ updateSuccess: true, username: 'newusername' });
	});

	test('inserts new profile when update finds no existing row', async () => {
		h.state.selectQueue.push([]);
		h.state.updateReturnQueue.push([]);

		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'brandnew' })
		} as unknown as Parameters<(typeof actions)['update']>[0]);

		expect(h.insertMock).toHaveBeenCalled();
		expect(result).toMatchObject({ updateSuccess: true });
	});

	test('returns 400 when database update throws', async () => {
		h.state.selectQueue.push([]);
		h.state.updateShouldThrow = new Error('DB connection failed');

		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'validname' })
		} as unknown as Parameters<(typeof actions)['update']>[0]);

		expect(result).toMatchObject({ status: 400, data: { updateError: expect.any(String) } });
	});

	test('returns 400 when username field is missing (null)', async () => {
		const fd = new FormData();
		// Intentionally do NOT set 'username' key
		const result = await actions.update({
			locals: makeLocals(),
			request: { formData: async () => fd }
		} as unknown as Parameters<(typeof actions)['update']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { updateError: 'Username is required', username: '' }
		});
	});

	test('returns 400 when username field is a File', async () => {
		const fd = new FormData();
		fd.set('username', new File(['x'], 'evil.txt'), 'evil.txt');
		const result = await actions.update({
			locals: makeLocals(),
			request: { formData: async () => fd }
		} as unknown as Parameters<(typeof actions)['update']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { updateError: 'Username is required', username: '' }
		});
	});
});

describe('profile signout action', () => {
	test('calls direct Neon Auth signout, applies clearing cookies, and redirects to login', async () => {
		const request = new Request('http://localhost/profile', { method: 'POST' });
		const cookies = { set: vi.fn(() => {}) };

		await expect(
			actions.signout({
				locals: makeLocals(),
				cookies,
				request
			} as unknown as Parameters<(typeof actions)['signout']>[0])
		).rejects.toMatchObject({ status: 303, location: '/login' });

		expect(upstreamFetch).toHaveBeenCalledWith('https://auth.example.test/auth/sign-out', {
			method: 'POST',
			headers: expect.any(Headers),
			body: '{}'
		});
		expect(
			new Headers((upstreamFetch.mock.calls[0][1] as RequestInit).headers).get('content-type')
		).toBe('application/json');
		expect(cookies.set).toHaveBeenCalledWith(
			'__Secure-neon-auth.session',
			'',
			expect.objectContaining({
				path: '/',
				maxAge: 0,
				httpOnly: true,
				secure: true,
				sameSite: 'lax'
			})
		);
	});

	test('still redirects when direct Neon Auth signout returns an error', async () => {
		upstreamFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ error: 'Network error' }), {
				status: 502,
				headers: {
					'set-cookie':
						'__Secure-neon-auth.session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
				}
			})
		);
		const originalConsoleError = console.error;
		console.error = vi.fn(() => {});

		try {
			await expect(
				actions.signout({
					locals: makeLocals(),
					cookies: { set: vi.fn(() => {}) },
					request: new Request('http://localhost/profile', { method: 'POST' })
				} as unknown as Parameters<(typeof actions)['signout']>[0])
			).rejects.toMatchObject({ status: 303, location: '/login' });
			expect(console.error).toHaveBeenCalledWith('Error signing out:', {
				error: 'Network error'
			});
		} finally {
			console.error = originalConsoleError;
		}
	});

	test('clears incoming Neon auth cookies and redirects when direct Neon Auth signout throws', async () => {
		const error = new Error('Network error');
		upstreamFetch.mockImplementationOnce(async () => {
			throw error;
		});
		const cookies = { set: vi.fn(() => {}) };
		const originalConsoleError = console.error;
		console.error = vi.fn(() => {});

		try {
			await expect(
				actions.signout({
					locals: makeLocals(),
					cookies,
					request: new Request('http://localhost/profile', {
						method: 'POST',
						headers: {
							cookie: '__Secure-neon-auth.session=abc; other=value'
						}
					})
				} as unknown as Parameters<(typeof actions)['signout']>[0])
			).rejects.toMatchObject({ status: 303, location: '/login' });

			expect(cookies.set).toHaveBeenCalledWith(
				'__Secure-neon-auth.session',
				'',
				expect.objectContaining({
					path: '/',
					maxAge: 0,
					httpOnly: true,
					secure: true,
					sameSite: 'lax'
				})
			);
			expect(console.error).toHaveBeenCalledWith('Error signing out:', error);
		} finally {
			console.error = originalConsoleError;
		}
	});
});
