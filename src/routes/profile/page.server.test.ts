import { beforeEach, describe, expect, mock, test } from 'bun:test';

const selectQueue: unknown[][] = [];
const updateReturnQueue: unknown[][] = [];
let insertShouldThrow: Error | null = null;
let updateShouldThrow: Error | null = null;

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
			returning: mock(async () => {
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
	profiles: { id: 'id', username: 'username' },
	savedConfigurations: {},
	sharedConfigurations: {}
}));

mock.module('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ eq: [a, b] })
}));

const upstreamFetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
	void input;
	void init;
	return new Response('{}', {
		status: 204,
		headers: {
			'set-cookie':
				'__Secure-neon-auth.session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
		}
	});
});

mock.module('$env/dynamic/private', () => ({
	env: { NEON_AUTH_BASE_URL: 'https://auth.example.test/auth' }
}));

mock.module('$env/dynamic/public', () => ({
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

beforeEach(() => {
	selectQueue.length = 0;
	updateReturnQueue.length = 0;
	insertShouldThrow = null;
	updateShouldThrow = null;
	selectMock.mockClear();
	updateMock.mockClear();
	insertMock.mockClear();
	upstreamFetch.mockClear();
	upstreamFetch.mockResolvedValue(
		new Response('{}', {
			status: 204,
			headers: {
				'set-cookie':
					'__Secure-neon-auth.session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
			}
		})
	);
	globalThis.fetch = upstreamFetch as unknown as typeof fetch;
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
		selectQueue.push([{ id: 'user-1', username: 'testuser' }]);

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
		selectQueue.push([]);

		const result = await load({
			locals: makeLocals(),
			url: new URL('http://localhost/profile')
		} as unknown as Parameters<typeof load>[0]);

		expect(insertMock).toHaveBeenCalled();
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
		selectQueue.push([{ id: 'other-user' }]);

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
		selectQueue.push([]);
		updateReturnQueue.push([{ id: 'user-1' }]);

		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'newusername' })
		} as unknown as Parameters<(typeof actions)['update']>[0]);

		expect(result).toMatchObject({ updateSuccess: true, username: 'newusername' });
	});

	test('inserts new profile when update finds no existing row', async () => {
		selectQueue.push([]);
		updateReturnQueue.push([]);

		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'brandnew' })
		} as unknown as Parameters<(typeof actions)['update']>[0]);

		expect(insertMock).toHaveBeenCalled();
		expect(result).toMatchObject({ updateSuccess: true });
	});

	test('returns 400 when database update throws', async () => {
		selectQueue.push([]);
		updateShouldThrow = new Error('DB connection failed');

		const result = await actions.update({
			locals: makeLocals(),
			request: makeRequest({ username: 'validname' })
		} as unknown as Parameters<(typeof actions)['update']>[0]);

		expect(result).toMatchObject({ status: 400, data: { updateError: expect.any(String) } });
	});
});

describe('profile signout action', () => {
	test('calls direct Neon Auth signout, applies clearing cookies, and redirects to login', async () => {
		const request = new Request('http://localhost/profile', { method: 'POST' });
		const cookies = { set: mock(() => {}) };

		await expect(
			actions.signout({
				locals: makeLocals(),
				cookies,
				request
			} as unknown as Parameters<(typeof actions)['signout']>[0])
		).rejects.toMatchObject({ status: 303, location: '/login' });

		expect(upstreamFetch).toHaveBeenCalledWith('https://auth.example.test/auth/sign-out', {
			method: 'POST',
			headers: expect.any(Headers)
		});
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
		console.error = mock(() => {});

		try {
			await expect(
				actions.signout({
					locals: makeLocals(),
					cookies: { set: mock(() => {}) },
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
});
