import { beforeEach, describe, expect, mock, test } from 'bun:test';

interface ProfileRow {
	id: string;
	username: string;
	createdAt: string;
	updatedAt: string;
}

interface CapturedInsert {
	id?: string;
	username?: string;
}

interface ThrowSpec {
	code?: string;
	constraint?: string;
	name?: string;
	message?: string;
}

let selectResultsQueue: ProfileRow[][];
let insertResultsQueue: { throws?: Error | ThrowSpec }[];
let capturedInsertValues: CapturedInsert[];

selectResultsQueue = [];
insertResultsQueue = [];
capturedInsertValues = [];

mock.module('$lib/server/db', () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => selectResultsQueue.shift() ?? []
				})
			})
		}),
		insert: () => ({
			values: (vals: CapturedInsert) => {
				capturedInsertValues.push(vals);
				const item = insertResultsQueue.shift();
				if (!item) throw new Error('No insert result queued');
				if (item.throws) throw item.throws;
				return Promise.resolve();
			}
		})
	},
	profiles: { id: 'id' },
	savedConfigurations: {},
	sharedConfigurations: {}
}));

const { ensureProfileForUser } = await import('./profile-provisioning');

beforeEach(() => {
	selectResultsQueue = [];
	insertResultsQueue = [];
	capturedInsertValues = [];
});

describe('ensureProfileForUser', () => {
	test('returns existing profile immediately', async () => {
		const existing = {
			id: 'u1',
			username: 'existing',
			createdAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z'
		};
		selectResultsQueue.push([existing]);
		const result = await ensureProfileForUser({ id: 'u1' });
		expect(result).toEqual(existing);
		expect(capturedInsertValues).toHaveLength(0);
	});

	test('creates new profile when none exists', async () => {
		const created = {
			id: 'u1',
			username: 'alice',
			createdAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z'
		};
		selectResultsQueue.push([], [created]);
		insertResultsQueue.push({});
		const result = await ensureProfileForUser({ id: 'u1', name: 'Alice' });
		expect(result).toEqual(created);
		expect(capturedInsertValues).toHaveLength(1);
		expect(capturedInsertValues[0].id).toBe('u1');
	});

	test('falls back to profileFallback when findProfileById returns null after insert', async () => {
		selectResultsQueue.push([], []);
		insertResultsQueue.push({});
		const result = await ensureProfileForUser({ id: 'u1', name: 'Test' });
		expect(result.id).toBe('u1');
		expect(result.username).toBe('test');
		expect(result.createdAt).toBeTruthy();
		expect(result.updatedAt).toBeTruthy();
	});

	test('derives username from user.name', async () => {
		selectResultsQueue.push([], []);
		insertResultsQueue.push({});
		await ensureProfileForUser({ id: 'u1', name: 'Alice Smith' });
		expect(capturedInsertValues[0].username).toBe('alice_smith');
	});

	test('derives username from user_metadata.name when user.name is invalid', async () => {
		selectResultsQueue.push([], []);
		insertResultsQueue.push({});
		await ensureProfileForUser({
			id: 'u1',
			name: 'ab',
			user_metadata: { name: 'Bob' }
		});
		expect(capturedInsertValues[0].username).toBe('bob');
	});

	test('derives username from email local part when other sources fail', async () => {
		selectResultsQueue.push([], []);
		insertResultsQueue.push({});
		await ensureProfileForUser({
			id: 'u1',
			name: '!!',
			email: 'charlie@example.com'
		});
		expect(capturedInsertValues[0].username).toBe('charlie');
	});

	test('uses FALLBACK_USERNAME when all sources produce invalid usernames', async () => {
		selectResultsQueue.push([], []);
		insertResultsQueue.push({});
		await ensureProfileForUser({
			id: 'u1',
			name: null,
			email: null,
			user_metadata: null
		});
		expect(capturedInsertValues[0].username).toBe('chaos_user');
	});

	test('appends suffix and truncates base on retry with long name', async () => {
		selectResultsQueue.push([], [], []);
		insertResultsQueue.push({ throws: { code: '23505' } }, {});
		await ensureProfileForUser({ id: 'u1', name: 'a'.repeat(40) });
		expect(capturedInsertValues[0].username).toBe('a'.repeat(30));
		expect(capturedInsertValues[1].username).toBe('a'.repeat(28) + '_1');
	});

	test('returns concurrent profile after unique violation', async () => {
		const concurrent = {
			id: 'u1',
			username: 'concurrent',
			createdAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z'
		};
		selectResultsQueue.push([], [concurrent]);
		insertResultsQueue.push({ throws: { code: '23505' } });
		const result = await ensureProfileForUser({ id: 'u1', name: 'Test' });
		expect(result).toEqual(concurrent);
	});

	test('continues to next suffix on unique violation without concurrent profile', async () => {
		selectResultsQueue.push(
			[],
			[],
			[
				{
					id: 'u1',
					username: 'test_1',
					createdAt: '2024-01-01T00:00:00.000Z',
					updatedAt: '2024-01-01T00:00:00.000Z'
				}
			]
		);
		insertResultsQueue.push({ throws: { code: '23505' } }, {});
		const result = await ensureProfileForUser({ id: 'u1', name: 'Test' });
		expect(result.username).toBe('test_1');
	});

	test('rethrows non-unique-violation error', async () => {
		selectResultsQueue.push([]);
		insertResultsQueue.push({ throws: new Error('connection lost') });
		await expect(ensureProfileForUser({ id: 'u1', name: 'Test' })).rejects.toThrow(
			'connection lost'
		);
	});

	test('throws when max attempts exhausted', async () => {
		selectResultsQueue.push([]);
		for (let i = 0; i < 100; i++) {
			insertResultsQueue.push({ throws: { code: '23505' } });
			selectResultsQueue.push([]);
		}
		await expect(ensureProfileForUser({ id: 'u1', name: 'Test' })).rejects.toThrow(
			'Unable to provision a unique username'
		);
	});

	test('recognizes unique violation by constraint containing duplicate', async () => {
		selectResultsQueue.push(
			[],
			[],
			[
				{
					id: 'u1',
					username: 'test_1',
					createdAt: '2024-01-01T00:00:00.000Z',
					updatedAt: '2024-01-01T00:00:00.000Z'
				}
			]
		);
		insertResultsQueue.push({ throws: { constraint: 'duplicate_key_violation' } }, {});
		const result = await ensureProfileForUser({ id: 'u1', name: 'Test' });
		expect(result.username).toBe('test_1');
	});

	test('recognizes unique violation by name containing unique', async () => {
		selectResultsQueue.push(
			[],
			[],
			[
				{
					id: 'u1',
					username: 'test_1',
					createdAt: '2024-01-01T00:00:00.000Z',
					updatedAt: '2024-01-01T00:00:00.000Z'
				}
			]
		);
		insertResultsQueue.push({ throws: { name: 'UniqueConstraintError' } }, {});
		const result = await ensureProfileForUser({ id: 'u1', name: 'Test' });
		expect(result.username).toBe('test_1');
	});

	test('recognizes unique violation by message containing duplicate', async () => {
		selectResultsQueue.push(
			[],
			[],
			[
				{
					id: 'u1',
					username: 'test_1',
					createdAt: '2024-01-01T00:00:00.000Z',
					updatedAt: '2024-01-01T00:00:00.000Z'
				}
			]
		);
		insertResultsQueue.push(
			{ throws: { message: 'duplicate key value violates unique constraint' } },
			{}
		);
		const result = await ensureProfileForUser({ id: 'u1', name: 'Test' });
		expect(result.username).toBe('test_1');
	});

	test('sanitizes special characters in username', async () => {
		selectResultsQueue.push([], []);
		insertResultsQueue.push({});
		await ensureProfileForUser({ id: 'u1', name: 'Hello World!@#$%' });
		expect(capturedInsertValues[0].username).toBe('hello_world');
	});

	test('skips name that becomes too short after sanitization', async () => {
		selectResultsQueue.push([], []);
		insertResultsQueue.push({});
		await ensureProfileForUser({ id: 'u1', name: 'ab', email: 'valid@example.com' });
		expect(capturedInsertValues[0].username).toBe('valid');
	});

	test('truncates very long names to 30 characters', async () => {
		selectResultsQueue.push([], []);
		insertResultsQueue.push({});
		await ensureProfileForUser({ id: 'u1', name: 'a'.repeat(100) });
		expect(capturedInsertValues[0].username).toBe('a'.repeat(30));
	});

	test('handles email with empty local part by falling back', async () => {
		selectResultsQueue.push([], []);
		insertResultsQueue.push({});
		await ensureProfileForUser({ id: 'u1', name: null, email: '@example.com' });
		expect(capturedInsertValues[0].username).toBe('chaos_user');
	});

	test('skips user_metadata.name that is not a string', async () => {
		selectResultsQueue.push([], []);
		insertResultsQueue.push({});
		await ensureProfileForUser({
			id: 'u1',
			name: null,
			user_metadata: { name: 42 },
			email: 'fallback@example.com'
		});
		expect(capturedInsertValues[0].username).toBe('fallback');
	});
});
