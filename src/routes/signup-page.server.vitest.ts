import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, load } from './signup/+page.server';

const selectResults = vi.hoisted<unknown[][]>(() => []);
const insertBehaviors = vi.hoisted<(unknown | Error)[]>(() => []);
const profiles = vi.hoisted(() => ({
	id: 'id',
	username: 'username'
}));
const selectMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn((left, right) => ({ left, right })));
const deleteAuthUserMock = vi.hoisted(() => vi.fn());
const signUpMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

function nextSelectResult() {
	return selectResults.shift() ?? [];
}

selectMock.mockImplementation(() => {
	const chain = {
		from: vi.fn(() => chain),
		where: vi.fn(() => chain),
		limit: vi.fn(async () => nextSelectResult())
	};
	return chain;
});

insertMock.mockImplementation(() => ({
	values: vi.fn(async (values) => {
		const next = insertBehaviors.shift();
		if (next instanceof Error) {
			throw next;
		}
		return next ?? values;
	})
}));

vi.mock('$app/paths', () => ({ base: '' }));

vi.mock('$lib/server/db', () => ({
	db: {
		select: selectMock,
		insert: insertMock
	},
	profiles
}));

vi.mock('drizzle-orm', () => ({
	eq: eqMock
}));

vi.mock('$lib/server/supabase-admin', () => ({
	deleteAuthUser: deleteAuthUserMock
}));

function makeLocals({
	session = null
}: {
	session?: Record<string, unknown> | null;
} = {}) {
	return {
		safeGetSession: vi.fn(async () => ({ session })),
		supabase: {
			auth: {
				signUp: signUpMock,
				signOut: signOutMock
			}
		}
	};
}

function makeRequest(fields: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		formData.set(key, value);
	}

	return {
		formData: async () => formData
	};
}

const validFields = {
	email: 'user@example.com',
	password: 'StrongPass123',
	confirmPassword: 'StrongPass123',
	username: 'chaos_user'
};

describe('signup route server', () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		selectResults.length = 0;
		insertBehaviors.length = 0;
		selectMock.mockClear();
		insertMock.mockClear();
		eqMock.mockClear();
		deleteAuthUserMock.mockReset();
		deleteAuthUserMock.mockResolvedValue(true);
		signUpMock.mockReset();
		signOutMock.mockReset();
		signOutMock.mockResolvedValue({ error: null });
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it('redirects authenticated users to a safe return path on load', async () => {
		await expect(
			load({
				locals: makeLocals({ session: { access_token: 'token' } }),
				url: new URL('http://localhost/signup?redirect=%2Florenz')
			} as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 303,
			location: '/lorenz'
		});
	});

	it('falls back to the base path for unsafe redirect targets on load', async () => {
		await expect(
			load({
				locals: makeLocals({ session: { access_token: 'token' } }),
				url: new URL('http://localhost/signup?redirect=https://evil.example')
			} as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 303,
			location: '/'
		});
	});

	it('returns validation errors for invalid email input', async () => {
		const result = await actions.default({
			locals: makeLocals(),
			request: makeRequest({
				...validFields,
				email: 'not-an-email'
			}),
			url: new URL('http://localhost/signup')
		} as Parameters<(typeof actions)['default']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { error: expect.stringContaining('valid email') }
		});
	});

	it('rejects usernames that are already taken', async () => {
		selectResults.push([{ id: 'existing-user' }]);

		const result = await actions.default({
			locals: makeLocals(),
			request: makeRequest(validFields),
			url: new URL('http://localhost/signup')
		} as Parameters<(typeof actions)['default']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'This username is already taken', username: validFields.username }
		});
	});

	it('maps duplicate email signup errors to a friendly message', async () => {
		selectResults.push([]);
		signUpMock.mockResolvedValue({
			data: { user: null, session: null },
			error: new Error('already registered')
		});

		const result = await actions.default({
			locals: makeLocals(),
			request: makeRequest(validFields),
			url: new URL('http://localhost/signup')
		} as Parameters<(typeof actions)['default']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'An account with this email already exists' }
		});
	});

	it('reports when email verification is enabled in Supabase', async () => {
		selectResults.push([]);
		signUpMock.mockResolvedValue({
			data: { user: { id: 'user-1' }, session: null },
			error: null
		});

		const result = await actions.default({
			locals: makeLocals(),
			request: makeRequest(validFields),
			url: new URL('http://localhost/signup')
		} as Parameters<(typeof actions)['default']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { error: expect.stringContaining('Email verification is enabled') }
		});
	});

	it('cleans up orphaned auth users when profile creation hits a unique violation', async () => {
		selectResults.push([]);
		signUpMock.mockResolvedValue({
			data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
			error: null
		});
		const uniqueViolation = Object.assign(
			new Error('duplicate key value violates unique constraint'),
			{
				code: '23505'
			}
		);
		insertBehaviors.push(uniqueViolation);

		const result = await actions.default({
			locals: makeLocals(),
			request: makeRequest(validFields),
			url: new URL('http://localhost/signup')
		} as Parameters<(typeof actions)['default']>[0]);

		expect(signOutMock).toHaveBeenCalledTimes(1);
		expect(deleteAuthUserMock).toHaveBeenCalledWith('user-1');
		expect(result).toMatchObject({
			status: 400,
			data: {
				error: 'This username was just taken. Please choose a different username.'
			}
		});
	});

	it('redirects to a safe return path after successful signup', async () => {
		selectResults.push([]);
		signUpMock.mockResolvedValue({
			data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
			error: null
		});
		insertBehaviors.push(undefined);

		await expect(
			actions.default({
				locals: makeLocals(),
				request: makeRequest(validFields),
				url: new URL('http://localhost/signup?redirect=%2Fsaved-configs')
			} as Parameters<(typeof actions)['default']>[0])
		).rejects.toMatchObject({
			status: 303,
			location: '/saved-configs'
		});
	});
});
