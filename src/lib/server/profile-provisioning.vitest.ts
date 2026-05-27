import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NeonAuthUser } from '$lib/auth/types';
import type { Profile } from '$lib/server/db/schema';

type InsertPayload = { id: string; username: string };

const profileRows: Profile[] = [];
const insertedProfiles: InsertPayload[] = [];
const insertErrors: Error[] = [];

const profileColumns = {
	id: { name: 'id' },
	username: { name: 'username' }
};

function queryProfiles(predicate?: unknown): Profile[] {
	if (!predicate) return profileRows;

	let column: unknown;
	let value: unknown;
	if (Array.isArray(predicate)) {
		[column, value] = predicate;
	} else if (predicate && typeof predicate === 'object' && 'eq' in predicate) {
		[column, value] = (predicate as { eq: [unknown, unknown] }).eq;
	} else {
		const chunks = (
			predicate as { queryChunks?: Array<{ name?: string } | { value?: unknown[] }> }
		)?.queryChunks;
		const valueChunk = chunks?.[3];
		[column, value] = [
			chunks?.[1],
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

function createSelectChain() {
	let storedPredicate: unknown;
	return {
		from: vi.fn(() => {
			const self = {
				from: vi.fn(() => self),
				where: vi.fn((predicate: unknown) => {
					storedPredicate = predicate;
					return self;
				}),
				limit: vi.fn(async (count: number) =>
					queryProfiles(storedPredicate).slice(0, count)
				)
			};
			return self;
		})
	};
}

function createInsertChain() {
	return {
		values: vi.fn(async (payload: InsertPayload) => {
			insertedProfiles.push(payload);
			const error = insertErrors.shift();
			if (error) throw error;
			profileRows.push(makeProfile(payload));
		})
	};
}

const selectFn = vi.fn(() => createSelectChain());
const insertFn = vi.fn(() => createInsertChain());

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => selectFn(),
		insert: () => insertFn()
	},
	profiles: profileColumns,
	savedConfigurations: {},
	sharedConfigurations: {}
}));

vi.mock('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ eq: [a, b] })
}));

function makeProfile(overrides: Partial<Profile>): Profile {
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
	selectFn.mockClear();
	insertFn.mockClear();
});

describe('ensureProfileForUser', () => {
	it('returns an existing profile without inserting', async () => {
		const existing = makeProfile({ id: 'user-existing', username: 'grace_hopper' });
		profileRows.push(existing);

		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser(user({ id: existing.id }));

		expect(result).toEqual(existing);
		expect(insertedProfiles).toEqual([]);
	});

	it('creates a sanitized username from display name', async () => {
		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser(user({ id: 'user-2', name: 'Grace Hopper' }));

		expect(insertedProfiles).toEqual([{ id: 'user-2', username: 'grace_hopper' }]);
		expect(result).toEqual(profileRows[0]);
		expect(result.username).toBe('grace_hopper');
	});

	it('falls back to email local part when names are missing', async () => {
		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser(
			user({ id: 'user-3', email: 'Alan.Turing@example.com' })
		);

		expect(insertedProfiles).toEqual([{ id: 'user-3', username: 'alan_turing' }]);
		expect(result.username).toBe('alan_turing');
	});

	it('uses user metadata name before email local part', async () => {
		const { ensureProfileForUser } = await import('./profile-provisioning');
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

	it('adds a numeric suffix when username is taken', async () => {
		insertErrors.push(uniqueViolation());

		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser(user({ id: 'user-5', name: 'Ada' }));

		expect(insertedProfiles).toEqual([
			{ id: 'user-5', username: 'ada' },
			{ id: 'user-5', username: 'ada_1' }
		]);
		expect(result.username).toBe('ada_1');
	});

	it('keeps suffixed usernames within the max length', async () => {
		const base = 'averyveryveryveryverylongname';
		insertErrors.push(uniqueViolation());

		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser(user({ id: 'user-6', name: base }));

		expect(insertedProfiles).toEqual([
			{ id: 'user-6', username: base },
			{ id: 'user-6', username: 'averyveryveryveryverylongnam_1' }
		]);
		expect(insertedProfiles[1].username).toHaveLength(30);
		expect(result.username).toBe('averyveryveryveryverylongnam_1');
	});

	it('falls back to chaos_user for very short or unusable sources', async () => {
		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser(
			user({ id: 'user-7', name: '__', email: '@example.com' })
		);

		expect(insertedProfiles).toEqual([{ id: 'user-7', username: 'chaos_user' }]);
		expect(result.username).toBe('chaos_user');
	});

	it('throws after a finite number of username collision attempts', async () => {
		insertErrors.push(...Array.from({ length: 100 }, () => uniqueViolation()));

		const { ensureProfileForUser } = await import('./profile-provisioning');
		await expect(ensureProfileForUser(user({ id: 'user-8', name: 'Ada' }))).rejects.toThrow(
			'Unable to provision a unique username'
		);
		expect(insertedProfiles).toHaveLength(100);
	});

	it('retries with next suffix after an insert-time username collision', async () => {
		insertErrors.push(uniqueViolation('profiles_username_unique'));

		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser(user({ id: 'user-9', name: 'Ada' }));

		expect(insertedProfiles).toEqual([
			{ id: 'user-9', username: 'ada' },
			{ id: 'user-9', username: 'ada_1' }
		]);
		expect(result.username).toBe('ada_1');
	});

	it('returns concurrently created profile when insert hits same-user unique violation', async () => {
		const concurrentProfile = makeProfile({ id: 'user-10', username: 'ada' });
		insertErrors.push(uniqueViolation('profiles_pkey'));
		insertFn.mockImplementationOnce(() => ({
			values: vi.fn(async (payload: InsertPayload) => {
				insertedProfiles.push(payload);
				profileRows.push(concurrentProfile);
				throw insertErrors.shift();
			})
		}));

		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser(user({ id: 'user-10', name: 'Ada' }));

		expect(insertedProfiles).toEqual([{ id: 'user-10', username: 'ada' }]);
		expect(result).toEqual(concurrentProfile);
	});

	it('propagates non-unique insert errors', async () => {
		const dbError = new Error('database unavailable');
		insertErrors.push(dbError);

		const { ensureProfileForUser } = await import('./profile-provisioning');
		await expect(ensureProfileForUser(user({ id: 'user-11', name: 'Ada' }))).rejects.toBe(
			dbError
		);
		expect(insertedProfiles).toEqual([{ id: 'user-11', username: 'ada' }]);
	});
});
