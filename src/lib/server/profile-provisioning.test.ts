import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { NeonAuthUser } from '$lib/auth/types';
import type { Profile } from '$lib/server/db/schema';

type InsertPayload = { id: string; username: string };
type QueryPredicate =
	| [unknown, unknown]
	| { eq: [unknown, unknown] }
	| {
			queryChunks?: Array<{ name?: string } | { value?: unknown[] }>;
	  };

const profileRows: Profile[] = [];
const insertedProfiles: InsertPayload[] = [];
const insertErrors: Error[] = [];

const profileColumns = {
	id: { name: 'id' },
	username: { name: 'username' }
};

function queryProfiles(predicate?: QueryPredicate): Profile[] {
	if (!predicate) return profileRows;

	let column: unknown;
	let value: unknown;
	if (Array.isArray(predicate)) {
		[column, value] = predicate;
	} else if ('eq' in predicate) {
		[column, value] = predicate.eq;
	} else {
		const valueChunk = predicate.queryChunks?.[3];
		[column, value] = [
			predicate.queryChunks?.[1],
			valueChunk && 'value' in valueChunk ? valueChunk.value?.[0] : undefined
		];
	}

	if (column === profileColumns.id) {
		return profileRows.filter((profile) => profile.id === value);
	}
	if (column === profileColumns.username) {
		return profileRows.filter((profile) => profile.username === value);
	}
	return [];
}

const selectMock = mock(() => {
	const chain: {
		from: ReturnType<typeof mock>;
		where: ReturnType<typeof mock>;
		limit: ReturnType<typeof mock>;
		predicate?: QueryPredicate;
	} = {
		from: mock(() => chain),
		where: mock((predicate: QueryPredicate) => {
			chain.predicate = predicate;
			return chain;
		}),
		limit: mock(async (count: number) => queryProfiles(chain.predicate).slice(0, count))
	};
	return chain;
});

const insertMock = mock(() => ({
	values: mock(async (payload: InsertPayload) => {
		insertedProfiles.push(payload);
		const error = insertErrors.shift();
		if (error) throw error;
		profileRows.push(profile(payload));
	})
}));

mock.module('$lib/server/db', () => ({
	db: {
		select: selectMock,
		insert: insertMock
	},
	profiles: profileColumns,
	savedConfigurations: {},
	sharedConfigurations: {}
}));

mock.module('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ eq: [a, b] })
}));

const { ensureProfileForUser } = await import('./profile-provisioning');

function profile(overrides: Partial<Profile>): Profile {
	return {
		id: 'user-1',
		username: 'existing_user',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides
	};
}

function user(overrides: Partial<NeonAuthUser>): NeonAuthUser {
	return {
		id: 'user-1',
		email: null,
		name: null,
		image: null,
		user_metadata: null,
		...overrides
	};
}

function uniqueViolation(message = 'duplicate key value violates unique constraint'): Error {
	const error = new Error(message);
	(error as NodeJS.ErrnoException).code = '23505';
	return error;
}

beforeEach(() => {
	profileRows.length = 0;
	insertedProfiles.length = 0;
	insertErrors.length = 0;
	selectMock.mockClear();
	insertMock.mockClear();
});

describe('ensureProfileForUser', () => {
	test('returns an existing profile without inserting', async () => {
		const existing = profile({ id: 'user-existing', username: 'grace_hopper' });
		profileRows.push(existing);

		const result = await ensureProfileForUser(user({ id: existing.id }));

		expect(result).toEqual(existing);
		expect(insertedProfiles).toEqual([]);
	});

	test('creates a sanitized username from display name', async () => {
		const result = await ensureProfileForUser(user({ id: 'user-2', name: 'Grace Hopper' }));

		expect(insertedProfiles).toEqual([{ id: 'user-2', username: 'grace_hopper' }]);
		expect(result).toEqual(profileRows[0]);
		expect(result.username).toBe('grace_hopper');
	});

	test('falls back to email local part when names are missing', async () => {
		const result = await ensureProfileForUser(
			user({ id: 'user-3', email: 'Alan.Turing@example.com' })
		);

		expect(insertedProfiles).toEqual([{ id: 'user-3', username: 'alan_turing' }]);
		expect(result.username).toBe('alan_turing');
	});

	test('uses user metadata name before email local part', async () => {
		const result = await ensureProfileForUser(
			user({
				id: 'user-4',
				email: 'fallback@example.com',
				user_metadata: { name: 'Katherine Johnson' }
			})
		);

		expect(insertedProfiles).toEqual([{ id: 'user-4', username: 'katherine_johnson' }]);
		expect(result.username).toBe('katherine_johnson');
	});

	test('adds a numeric suffix when username is taken', async () => {
		insertErrors.push(uniqueViolation());

		const result = await ensureProfileForUser(user({ id: 'user-5', name: 'Ada' }));

		expect(insertedProfiles).toEqual([
			{ id: 'user-5', username: 'ada' },
			{ id: 'user-5', username: 'ada_1' }
		]);
		expect(result.username).toBe('ada_1');
	});

	test('keeps suffixed usernames within the max length', async () => {
		const base = 'averyveryveryveryverylongname';
		insertErrors.push(uniqueViolation());

		const result = await ensureProfileForUser(user({ id: 'user-6', name: base }));

		expect(insertedProfiles).toEqual([
			{ id: 'user-6', username: base },
			{ id: 'user-6', username: 'averyveryveryveryverylongnam_1' }
		]);
		expect(insertedProfiles[1].username).toHaveLength(30);
		expect(result.username).toBe('averyveryveryveryverylongnam_1');
	});

	test('falls back to chaos_user for very short or unusable sources', async () => {
		const result = await ensureProfileForUser(
			user({ id: 'user-7', name: '__', email: '@example.com' })
		);

		expect(insertedProfiles).toEqual([{ id: 'user-7', username: 'chaos_user' }]);
		expect(result.username).toBe('chaos_user');
	});

	test('throws after a finite number of username collision attempts', async () => {
		insertErrors.push(...Array.from({ length: 100 }, () => uniqueViolation()));

		await expect(ensureProfileForUser(user({ id: 'user-8', name: 'Ada' }))).rejects.toThrow(
			'Unable to provision a unique username'
		);
		expect(insertedProfiles).toHaveLength(100);
	});

	test('retries with next suffix after an insert-time username collision', async () => {
		insertErrors.push(uniqueViolation('profiles_username_unique'));

		const result = await ensureProfileForUser(user({ id: 'user-9', name: 'Ada' }));

		expect(insertedProfiles).toEqual([
			{ id: 'user-9', username: 'ada' },
			{ id: 'user-9', username: 'ada_1' }
		]);
		expect(result.username).toBe('ada_1');
	});

	test('returns concurrently created profile when insert hits same-user unique violation', async () => {
		const concurrentProfile = profile({ id: 'user-10', username: 'ada' });
		insertErrors.push(uniqueViolation('profiles_pkey'));
		insertMock.mockImplementationOnce(() => ({
			values: mock(async (payload: InsertPayload) => {
				insertedProfiles.push(payload);
				profileRows.push(concurrentProfile);
				throw insertErrors.shift();
			})
		}));

		const result = await ensureProfileForUser(user({ id: 'user-10', name: 'Ada' }));

		expect(insertedProfiles).toEqual([{ id: 'user-10', username: 'ada' }]);
		expect(result).toEqual(concurrentProfile);
	});

	test('propagates non-unique insert errors', async () => {
		const dbError = new Error('database unavailable');
		insertErrors.push(dbError);

		await expect(ensureProfileForUser(user({ id: 'user-11', name: 'Ada' }))).rejects.toBe(
			dbError
		);
		expect(insertedProfiles).toEqual([{ id: 'user-11', username: 'ada' }]);
	});
});
