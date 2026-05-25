import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Profile } from '$lib/types';
import type { NeonAuthUser } from '$lib/auth/types';

const selectQueue: Profile[][] = [];
const insertedProfiles: Array<{ id: string; username: string }> = [];

const selectMock = mock(() => {
	const chain: Record<string, unknown> = {
		from: mock(() => chain),
		where: mock(() => chain),
		limit: mock(async () => selectQueue.shift() ?? [])
	};
	return chain;
});

const insertMock = mock(() => ({
	values: mock((payload: { id: string; username: string }) => {
		insertedProfiles.push(payload);
		return {
			returning: mock(async () => selectQueue.shift() ?? [])
		};
	})
}));

mock.module('$lib/server/db', () => ({
	db: {
		select: selectMock,
		insert: insertMock
	},
	profiles: { id: 'id', username: 'username' },
	savedConfigurations: {},
	sharedConfigurations: {}
}));

mock.module('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ eq: [a, b] })
}));

const { ensureProfileForUser } = await import('./profile-provisioning');

const profile = (overrides: Partial<Profile>): Profile => ({
	id: 'user-1',
	username: 'existing_user',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	...overrides
});

const user = (overrides: Partial<NeonAuthUser>): NeonAuthUser => ({
	id: 'user-1',
	email: null,
	name: null,
	image: null,
	user_metadata: null,
	...overrides
});

beforeEach(() => {
	selectQueue.length = 0;
	insertedProfiles.length = 0;
	selectMock.mockClear();
	insertMock.mockClear();
});

describe('ensureProfileForUser', () => {
	test('returns an existing profile without inserting', async () => {
		const existing = profile({ username: 'grace_hopper' });
		selectQueue.push([existing]);

		const result = await ensureProfileForUser(user({ id: existing.id }));

		expect(result).toEqual(existing);
		expect(insertedProfiles).toEqual([]);
	});

	test('creates a sanitized username from display name', async () => {
		const created = profile({ id: 'user-2', username: 'grace_hopper' });
		selectQueue.push([], [], [created]);

		const result = await ensureProfileForUser(user({ id: 'user-2', name: 'Grace Hopper' }));

		expect(insertedProfiles).toEqual([{ id: 'user-2', username: 'grace_hopper' }]);
		expect(result).toEqual(created);
	});

	test('falls back to email local part when names are missing', async () => {
		const created = profile({ id: 'user-3', username: 'alan_turing' });
		selectQueue.push([], [], [created]);

		const result = await ensureProfileForUser(
			user({ id: 'user-3', email: 'Alan.Turing@example.com' })
		);

		expect(insertedProfiles).toEqual([{ id: 'user-3', username: 'alan_turing' }]);
		expect(result).toEqual(created);
	});

	test('uses user metadata name before email local part', async () => {
		const created = profile({ id: 'user-4', username: 'katherine_johnson' });
		selectQueue.push([], [], [created]);

		const result = await ensureProfileForUser(
			user({
				id: 'user-4',
				email: 'fallback@example.com',
				user_metadata: { name: 'Katherine Johnson' }
			})
		);

		expect(insertedProfiles).toEqual([{ id: 'user-4', username: 'katherine_johnson' }]);
		expect(result).toEqual(created);
	});

	test('adds a numeric suffix when username is taken', async () => {
		const created = profile({ id: 'user-5', username: 'ada_1' });
		selectQueue.push([], [profile({ id: 'other-user', username: 'ada' })], [], [created]);

		const result = await ensureProfileForUser(user({ id: 'user-5', name: 'Ada' }));

		expect(insertedProfiles).toEqual([{ id: 'user-5', username: 'ada_1' }]);
		expect(result).toEqual(created);
	});

	test('keeps suffixed usernames within the max length', async () => {
		const base = 'averyveryveryveryverylongname';
		const created = profile({ id: 'user-6', username: 'averyveryveryveryverylongnam_1' });
		selectQueue.push([], [profile({ id: 'other-user', username: base })], [], [created]);

		const result = await ensureProfileForUser(user({ id: 'user-6', name: base }));

		expect(insertedProfiles).toEqual([
			{ id: 'user-6', username: 'averyveryveryveryverylongnam_1' }
		]);
		expect(insertedProfiles[0].username).toHaveLength(30);
		expect(result).toEqual(created);
	});

	test('falls back to chaos_user for very short or unusable sources', async () => {
		const created = profile({ id: 'user-7', username: 'chaos_user' });
		selectQueue.push([], [], [created]);

		const result = await ensureProfileForUser(
			user({ id: 'user-7', name: '__', email: '@example.com' })
		);

		expect(insertedProfiles).toEqual([{ id: 'user-7', username: 'chaos_user' }]);
		expect(result).toEqual(created);
	});

	test('throws after a finite number of username collision attempts', async () => {
		selectQueue.push(
			[],
			...Array.from({ length: 100 }, (_, i) => [
				profile({
					id: `other-user-${i}`,
					username: i === 0 ? 'ada' : `ada_${i}`
				})
			])
		);

		await expect(ensureProfileForUser(user({ id: 'user-8', name: 'Ada' }))).rejects.toThrow(
			'Unable to provision a unique username'
		);
		expect(insertedProfiles).toEqual([]);
	});
});
