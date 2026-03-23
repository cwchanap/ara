/**
 * Unit tests for share utilities
 *
 * Tests pure functions and DB-dependent functions (using mocked db).
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import {
	SHARE_CODE_LENGTH,
	SHARE_CODE_CHARSET,
	SHARE_RATE_LIMIT_PER_HOUR,
	SHARE_EXPIRATION_DAYS
} from '$lib/constants';

// Mutable state controlling mock tx behavior – mutated per test.
let mockTxShareCount = 0;

// Mutable state controlling outer db.select result (for generateUniqueShortCode).
// Empty array = no collision; non-empty = collision (code already exists).
let mockDbSelectResult: { id: string }[] = [];

// Controls tx.insert().values().returning() behavior:
// - mockTxInsertThrowCount > 0: throw a 23505 unique-violation that many times before succeeding
// - mockTxInsertThrowNonUnique: throw a generic (non-23505) error on the next call
let mockTxInsertThrowCount = 0;
let mockTxInsertThrowNonUnique = false;

// Captures the most recently inserted payload via tx.insert().values(payload).
let savedInsertPayload: Record<string, unknown> | null = null;

// Returns shares in ascending createdAt order (oldest first) to match the
// real DB query which uses orderBy(asc(sharedConfigurations.createdAt)).
// i=0 is the oldest share, i=mockTxShareCount-1 is the newest.
const getMockTxShares = () =>
	Array(mockTxShareCount)
		.fill(null)
		.map((_, i) => ({
			createdAt: new Date(Date.now() - (mockTxShareCount - i) * 1000).toISOString()
		}));

const createMockTx = () => {
	let insertCallCount = 0;
	return {
		select: () => ({
			from: () => ({
				where: () => ({
					orderBy: () => getMockTxShares()
				})
			})
		}),
		insert: () => ({
			values: (payload: Record<string, unknown>) => {
				savedInsertPayload = payload;
				return {
					returning: () => {
						if (mockTxInsertThrowNonUnique) {
							mockTxInsertThrowNonUnique = false;
							throw new Error('Database connection failed');
						}
						if (insertCallCount < mockTxInsertThrowCount) {
							insertCallCount++;
							// Simulate PostgreSQL unique constraint violation with proper Error semantics
							const uniqueViolation = new Error('unique_violation');
							(uniqueViolation as NodeJS.ErrnoException).code = '23505';
							throw uniqueViolation;
						}
						return [
							{
								id: 'mock-share-id',
								shortCode: 'ABCD1234',
								expiresAt: '2030-01-01T00:00:00.000Z'
							}
						];
					}
				};
			}
		})
	};
};

// Mock $lib/server/db BEFORE importing share-utils to ensure the mock
// intercepts the DB module before its import-time side effects run.
// This makes the test truly independent of DB initialization.
mock.module('$lib/server/db', () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => mockDbSelectResult,
					orderBy: () => []
				})
			})
		}),
		insert: () => ({
			values: () => ({
				returning: () => [
					{
						id: 'mock-share-id',
						shortCode: 'ABCD1234',
						expiresAt: '2030-01-01T00:00:00.000Z'
					}
				]
			})
		}),
		update: () => ({
			set: () => ({
				where: () => ({
					execute: async () => {}
				})
			})
		}),
		transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(createMockTx())
	},
	sharedConfigurations: {
		id: { name: 'id' },
		createdAt: { name: 'created_at' },
		userId: { name: 'user_id' },
		shortCode: { name: 'short_code' },
		expiresAt: { name: 'expires_at' },
		viewCount: { name: 'view_count' }
	},
	savedConfigurations: {},
	profiles: {}
}));

// Dynamic import AFTER mock registration ensures the mock intercepts
// $lib/server/db before share-utils imports it.
const {
	generateShortCode,
	calculateExpirationDate,
	isShareExpired,
	getDaysUntilExpiration,
	generateUniqueShortCode,
	createShareWithRateLimit,
	incrementViewCount
} = await import('$lib/server/share-utils');

// Reset all mock control variables before every test so tests are isolated.
beforeEach(() => {
	mockTxShareCount = 0;
	mockDbSelectResult = [];
	mockTxInsertThrowCount = 0;
	mockTxInsertThrowNonUnique = false;
	savedInsertPayload = null;
});

describe('generateShortCode', () => {
	test('generates an 8-character alphanumeric code', () => {
		const code = generateShortCode();
		expect(code).toHaveLength(SHARE_CODE_LENGTH);
		expect(code).toMatch(/^[A-Za-z0-9]+$/);
	});

	test('generates unique codes on multiple calls', () => {
		const codes = new Set<string>();
		for (let i = 0; i < 100; i++) {
			codes.add(generateShortCode());
		}
		// Allow for rare collisions, but should have high uniqueness
		expect(codes.size).toBeGreaterThan(90);
	});

	test('generates codes using only valid charset characters', () => {
		for (let i = 0; i < 50; i++) {
			const code = generateShortCode();
			for (const char of code) {
				expect(SHARE_CODE_CHARSET).toContain(char);
			}
		}
	});

	test('produces codes with uniform distribution', () => {
		// Test that no character is significantly overrepresented
		const charCounts: Record<string, number> = {};
		const totalSamples = 10000;

		for (let i = 0; i < totalSamples; i++) {
			const code = generateShortCode();
			for (const char of code) {
				charCounts[char] = (charCounts[char] || 0) + 1;
			}
		}

		const expectedCount = (totalSamples * 8) / SHARE_CODE_CHARSET.length;
		const tolerance = expectedCount * 0.2; // Allow 20% deviation

		for (const count of Object.values(charCounts)) {
			expect(count).toBeGreaterThan(expectedCount - tolerance);
			expect(count).toBeLessThan(expectedCount + tolerance);
		}
	});
});

describe('calculateExpirationDate', () => {
	test('returns a date SHARE_EXPIRATION_DAYS in the future by default', () => {
		const now = new Date();
		const expiration = calculateExpirationDate();

		const expectedDate = new Date(now);
		expectedDate.setDate(expectedDate.getDate() + SHARE_EXPIRATION_DAYS);

		expect(expiration.getDate()).toBe(expectedDate.getDate());
		expect(expiration.getMonth()).toBe(expectedDate.getMonth());
		expect(expiration.getFullYear()).toBe(expectedDate.getFullYear());
	});

	test('returns correct date for custom day count', () => {
		const now = new Date();
		const expiration = calculateExpirationDate(14);

		const expectedDate = new Date(now);
		expectedDate.setDate(expectedDate.getDate() + 14);

		expect(expiration.getDate()).toBe(expectedDate.getDate());
	});

	test('returns correct difference in days', () => {
		const now = new Date();
		const expiration = calculateExpirationDate(SHARE_EXPIRATION_DAYS);
		const diffTime = Math.abs(expiration.getTime() - now.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		// Should be approximately SHARE_EXPIRATION_DAYS (accounting for day boundary rollover)
		expect([SHARE_EXPIRATION_DAYS, SHARE_EXPIRATION_DAYS + 1]).toContain(diffDays);
	});
});

describe('isShareExpired', () => {
	test('returns true for past expiration date', () => {
		const now = Date.now();
		const pastDate = new Date(now - 24 * 60 * 60 * 1000).toISOString();
		expect(isShareExpired(pastDate)).toBe(true);
	});

	test('returns false for future expiration date', () => {
		const now = Date.now();
		const futureDate = new Date(now + 24 * 60 * 60 * 1000).toISOString();
		expect(isShareExpired(futureDate)).toBe(false);
	});

	test('returns true for current timestamp', () => {
		const now = Date.now();
		// Set expiration to now (already expired or exactly at limit)
		// Since the comparison is < (not <=), a timestamp at exactly now is not expired
		// This is expected behavior - a share expires when expiresAt < now
		const currentDate = new Date(now - 1).toISOString(); // 1ms in the past
		expect(isShareExpired(currentDate)).toBe(true);
	});

	test('handles edge case of expiration exactly 1 second ago', () => {
		const now = Date.now();
		const justExpired = new Date(now - 1000).toISOString();
		expect(isShareExpired(justExpired)).toBe(true);
	});

	test('handles edge case of expiration exactly 1 second from now', () => {
		const now = Date.now();
		const justFuture = new Date(now + 1000).toISOString();
		expect(isShareExpired(justFuture)).toBe(false);
	});
});

describe('getDaysUntilExpiration', () => {
	test('returns positive days for future expiration', () => {
		const now = Date.now();
		const futureDate = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
		const days = getDaysUntilExpiration(futureDate);
		expect(days).toBe(7);
	});

	test('returns negative days for past expiration', () => {
		const now = Date.now();
		const pastDate = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
		const days = getDaysUntilExpiration(pastDate);
		expect(days).toBe(-2);
	});

	test('returns 0 for current timestamp', () => {
		const now = Date.now();
		const currentDate = new Date(now).toISOString();
		const days = getDaysUntilExpiration(currentDate);
		// A few ms may elapse between capturing now and calling the function,
		// but Math.ceil of a tiny negative diff (e.g. -1ms / 86_400_000ms) still
		// rounds up to 0, so the result is always 0.
		expect(days).toBe(0);
	});

	test('calculates partial days correctly (rounds up)', () => {
		const now = Date.now();
		// Set expiration to 3.5 days from now
		const futureDate = new Date(now + 3.5 * 24 * 60 * 60 * 1000).toISOString();
		const days = getDaysUntilExpiration(futureDate);
		expect(days).toBe(4); // Should round up to 4 days
	});

	test('returns correct value for expiration just over 24 hours from now', () => {
		const now = Date.now();
		const futureDate = new Date(now + 25 * 60 * 60 * 1000).toISOString();
		const days = getDaysUntilExpiration(futureDate);
		expect(days).toBe(2); // Should round up to 2 days (25+ hours = 2 days)
	});
});

describe('share rate limit constant', () => {
	test('SHARE_RATE_LIMIT_PER_HOUR is set to 10', () => {
		expect(SHARE_RATE_LIMIT_PER_HOUR).toBe(10);
	});
});

describe('generateUniqueShortCode (mocked db)', () => {
	test('returns a valid short code when no collision exists', async () => {
		mockDbSelectResult = []; // no existing code → no collision
		const code = await generateUniqueShortCode();
		expect(code).not.toBeNull();
		expect(typeof code).toBe('string');
		expect(code!.length).toBe(SHARE_CODE_LENGTH);
		expect(code).toMatch(/^[A-Za-z0-9]+$/);
	});

	test('returns a string that uses only valid charset characters', async () => {
		mockDbSelectResult = [];
		const code = await generateUniqueShortCode();
		expect(code).not.toBeNull();
		for (const char of code!) {
			expect(SHARE_CODE_CHARSET).toContain(char);
		}
	});

	test('returns null when all retries collide with existing codes', async () => {
		// Simulates every generated code already existing in DB → all retries fail
		mockDbSelectResult = [{ id: 'existing-id' }];
		const code = await generateUniqueShortCode();
		expect(code).toBeNull();
	});
});

describe('incrementViewCount (mocked db)', () => {
	test('completes without throwing', async () => {
		await expect(incrementViewCount('mock-share-id')).resolves.toBeUndefined();
	});

	test('accepts any share ID string', async () => {
		const ids = ['uuid-1', 'uuid-2', '00000000-0000-0000-0000-000000000000'];
		for (const id of ids) {
			await expect(incrementViewCount(id)).resolves.toBeUndefined();
		}
	});
});

describe('createShareWithRateLimit (mocked db)', () => {
	test('returns success with share data when under rate limit', async () => {
		mockTxShareCount = 0; // under rate limit

		const result = await createShareWithRateLimit(
			'user-id',
			'lorenz',
			{ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			'TESTCODE',
			'2030-01-01T00:00:00.000Z'
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.share).toBeDefined();
			expect(result.share!.id).toBe('mock-share-id');
			expect(result.share!.shortCode).toBe('ABCD1234');
			expect(result.share!.expiresAt).toBe('2030-01-01T00:00:00.000Z');
		}
		expect(result.remaining).toBe(SHARE_RATE_LIMIT_PER_HOUR - 1);
		expect(result.resetAt).toBeInstanceOf(Date);

		// Verify the payload passed to insert contains the expected fields
		expect(savedInsertPayload).not.toBeNull();
		expect(savedInsertPayload!.userId).toBe('user-id');
		expect(savedInsertPayload!.shortCode).toBe('TESTCODE');
		expect(savedInsertPayload!.expiresAt).toBe('2030-01-01T00:00:00.000Z');
	});

	test('calculates remaining shares correctly', async () => {
		mockTxShareCount = 5; // 5 shares already used

		const result = await createShareWithRateLimit(
			'user-id',
			'henon',
			{ type: 'henon', a: 1.4, b: 0.3, iterations: 2000 },
			'TESTCODE',
			'2030-01-01T00:00:00.000Z'
		);

		expect(result.success).toBe(true);
		// remaining = SHARE_RATE_LIMIT_PER_HOUR - shareCount - 1 = 10 - 5 - 1 = 4
		expect(result.remaining).toBe(SHARE_RATE_LIMIT_PER_HOUR - 5 - 1);
	});

	test('returns rate limit error when at the limit', async () => {
		mockTxShareCount = SHARE_RATE_LIMIT_PER_HOUR; // exactly at limit

		const result = await createShareWithRateLimit(
			'user-id',
			'lorenz',
			{ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			'TESTCODE',
			'2030-01-01T00:00:00.000Z'
		);

		expect(result.success).toBe(false);
		expect(result.remaining).toBe(0);
		expect(result.resetAt).toBeInstanceOf(Date);
		if (!result.success) {
			expect(result.error).toContain('Rate limit exceeded');
		}
	});

	test('retries on unique constraint violation (23505) and succeeds', async () => {
		mockTxShareCount = 0;
		mockTxInsertThrowCount = 1; // first insert throws 23505, second succeeds

		const result = await createShareWithRateLimit(
			'user-id',
			'lorenz',
			{ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			'TESTCODE',
			'2030-01-01T00:00:00.000Z'
		);

		expect(result.success).toBe(true);
	});

	test('throws non-unique-violation errors from insert', async () => {
		mockTxShareCount = 0;
		mockTxInsertThrowNonUnique = true; // throws a generic Error (not 23505)

		await expect(
			createShareWithRateLimit(
				'user-id',
				'lorenz',
				{ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
				'TESTCODE',
				'2030-01-01T00:00:00.000Z'
			)
		).rejects.toThrow('Database connection failed');
	});

	test('reset time is approximately 1 hour after oldest share when rate limited', async () => {
		mockTxShareCount = SHARE_RATE_LIMIT_PER_HOUR;

		// Freeze Date.now so getMockTxShares and share-utils both use the same timestamp,
		// enabling an exact assertion on resetAt.
		const frozenNow = 1700000000000;
		const originalDateNow = Date.now;
		Date.now = () => frozenNow;

		try {
			const result = await createShareWithRateLimit(
				'user-id',
				'lorenz',
				{ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
				'TESTCODE',
				'2030-01-01T00:00:00.000Z'
			);

			expect(result.success).toBe(false);

			// getMockTxShares makes oldest share at: frozenNow - SHARE_RATE_LIMIT_PER_HOUR * 1000
			// share-utils.ts calculates: resetAt = oldest.createdAt + 60*60*1000 + 1000
			const expectedResetAtMs =
				frozenNow - SHARE_RATE_LIMIT_PER_HOUR * 1000 + 60 * 60 * 1000 + 1000;
			expect(result.resetAt.getTime()).toBe(expectedResetAtMs);
		} finally {
			Date.now = originalDateNow;
		}
	});

	test('passes correct mapType, parameters, userId, and shortCode to insert', async () => {
		mockTxShareCount = 0;

		await createShareWithRateLimit(
			'user-99',
			'rossler',
			{ type: 'rossler', a: 0.2, b: 0.2, c: 5.7 },
			'ROSSLER1',
			'2030-06-01T00:00:00.000Z'
		);

		expect(savedInsertPayload).not.toBeNull();
		expect(savedInsertPayload!.mapType).toBe('rossler');
		expect(savedInsertPayload!.expiresAt).toBe('2030-06-01T00:00:00.000Z');
		expect(savedInsertPayload!.parameters).toEqual({ type: 'rossler', a: 0.2, b: 0.2, c: 5.7 });
		expect(savedInsertPayload!.userId).toBe('user-99');
		expect(savedInsertPayload!.shortCode).toBe('ROSSLER1');
	});

	test('returns remaining = 0 when exactly one slot is left', async () => {
		mockTxShareCount = SHARE_RATE_LIMIT_PER_HOUR - 1; // 9 used, 1 remaining

		const result = await createShareWithRateLimit(
			'user-id',
			'lorenz',
			{ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			'TESTCODE',
			'2030-01-01T00:00:00.000Z'
		);

		expect(result.success).toBe(true);
		// remaining = SHARE_RATE_LIMIT_PER_HOUR - (SHARE_RATE_LIMIT_PER_HOUR - 1) - 1 = 0
		expect(result.remaining).toBe(0);
	});
});

describe('calculateExpirationDate edge cases', () => {
	test("returns today's date for 0 days", () => {
		// Snapshot the reference time once so both sides use the same instant,
		// avoiding flakiness when the test runs near midnight. new Date() inside
		// calculateExpirationDate is called immediately after, within the same
		// tick, so date parts are stable.
		const ref = new Date();
		const expiration = calculateExpirationDate(0);
		expect(expiration.getDate()).toBe(ref.getDate());
		expect(expiration.getMonth()).toBe(ref.getMonth());
		expect(expiration.getFullYear()).toBe(ref.getFullYear());
	});

	test('returns correct date for 1 day', () => {
		// Snapshot the reference time once and derive the expected date from it,
		// so both sides of the comparison use the same instant.
		const ref = new Date();
		const expected = new Date(ref);
		expected.setDate(expected.getDate() + 1);
		const expiration = calculateExpirationDate(1);
		expect(expiration.getDate()).toBe(expected.getDate());
		expect(expiration.getMonth()).toBe(expected.getMonth());
		expect(expiration.getFullYear()).toBe(expected.getFullYear());
	});

	test('returns a Date object', () => {
		const result = calculateExpirationDate(7);
		expect(result).toBeInstanceOf(Date);
	});
});

describe('isShareExpired and getDaysUntilExpiration combined', () => {
	test('a future expiration is not expired and has positive days remaining', () => {
		const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
		expect(isShareExpired(future)).toBe(false);
		expect(getDaysUntilExpiration(future)).toBeGreaterThan(0);
	});

	test('a past expiration is expired and has non-positive days remaining', () => {
		const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
		expect(isShareExpired(past)).toBe(true);
		expect(getDaysUntilExpiration(past)).toBeLessThanOrEqual(0);
	});
});
