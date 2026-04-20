import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the db module before importing share-utils to prevent DATABASE_URL error
vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		transaction: vi.fn()
	},
	sharedConfigurations: {
		id: {},
		shortCode: {},
		userId: {},
		mapType: {},
		parameters: {},
		viewCount: {},
		createdAt: {},
		expiresAt: {}
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((a, b) => ({ a, b })),
	and: vi.fn((...args) => ({ and: args })),
	gte: vi.fn((a, b) => ({ gte: [a, b] })),
	asc: vi.fn((a) => ({ asc: a })),
	sql: vi.fn()
}));

import {
	generateShortCode,
	generateUniqueShortCode,
	createShareWithRateLimit,
	incrementViewCount,
	isShareExpired,
	getDaysUntilExpiration,
	calculateExpirationDate
} from './share-utils';
import { SHARE_CODE_LENGTH, SHARE_CODE_CHARSET, SHARE_RATE_LIMIT_PER_HOUR } from '$lib/constants';

describe('generateShortCode', () => {
	it('returns a string of exactly SHARE_CODE_LENGTH characters', () => {
		const code = generateShortCode();
		expect(code).toHaveLength(SHARE_CODE_LENGTH);
	});

	it('only contains characters from SHARE_CODE_CHARSET', () => {
		const code = generateShortCode();
		for (const char of code) {
			expect(SHARE_CODE_CHARSET).toContain(char);
		}
	});

	it('generates different codes on subsequent calls', () => {
		// Deterministic: each getRandomValues call gets the next byte value (0, 1, 2…)
		// so the two 8-char codes use different input bytes and therefore differ.
		let callCount = 0;
		const spy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
			const bytes = new Uint8Array(
				(array as ArrayBufferView).buffer as ArrayBuffer,
				(array as ArrayBufferView).byteOffset,
				(array as ArrayBufferView).byteLength
			);
			for (let i = 0; i < bytes.length; i++) {
				bytes[i] = callCount++;
			}
			return array;
		});
		try {
			const code1 = generateShortCode();
			const code2 = generateShortCode();
			expect(code1).not.toBe(code2);
		} finally {
			spy.mockRestore();
		}
	});

	it('returns only alphanumeric characters', () => {
		for (let i = 0; i < 10; i++) {
			const code = generateShortCode();
			expect(code).toMatch(/^[A-Za-z0-9]+$/);
		}
	});
});

describe('isShareExpired', () => {
	it('returns true for a date in the past', () => {
		const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		expect(isShareExpired(pastDate)).toBe(true);
	});

	it('returns false for a date in the future', () => {
		const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
		expect(isShareExpired(futureDate)).toBe(false);
	});

	it('returns false for a date far in the future', () => {
		const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
		expect(isShareExpired(farFuture)).toBe(false);
	});

	it('returns true for a date long in the past', () => {
		const longPast = new Date('2000-01-01T00:00:00Z').toISOString();
		expect(isShareExpired(longPast)).toBe(true);
	});
});

describe('getDaysUntilExpiration', () => {
	it('returns a positive number for future expiration', () => {
		const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
		const days = getDaysUntilExpiration(futureDate);
		expect(days).toBeGreaterThan(0);
		expect(days).toBeLessThanOrEqual(8); // ~7 days, ceil
	});

	it('returns a negative number for past expiration', () => {
		const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
		const days = getDaysUntilExpiration(pastDate);
		expect(days).toBeLessThan(0);
	});

	it('returns approximately the correct number of days', () => {
		const tenDays = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
		const days = getDaysUntilExpiration(tenDays);
		// Should be 10 or 11 due to ceiling and timing
		expect(days).toBeGreaterThanOrEqual(9);
		expect(days).toBeLessThanOrEqual(11);
	});
});

describe('calculateExpirationDate', () => {
	it('returns a date approximately the given number of days in the future', () => {
		const days = 7;
		const result = calculateExpirationDate(days);
		const now = new Date();
		const expectedMs = days * 24 * 60 * 60 * 1000;
		const actualMs = result.getTime() - now.getTime();
		// Allow a 5-second tolerance for test execution time
		expect(actualMs).toBeGreaterThan(expectedMs - 5000);
		expect(actualMs).toBeLessThan(expectedMs + 5000);
	});

	it('returns a future date', () => {
		const result = calculateExpirationDate(7);
		expect(result.getTime()).toBeGreaterThan(Date.now());
	});

	it('returns a Date instance', () => {
		const result = calculateExpirationDate(7);
		expect(result).toBeInstanceOf(Date);
	});

	it('uses SHARE_EXPIRATION_DAYS as default when no argument provided', () => {
		const result = calculateExpirationDate();
		expect(result.getTime()).toBeGreaterThan(Date.now());
	});

	it('works with different day values', () => {
		const result1 = calculateExpirationDate(1);
		const result30 = calculateExpirationDate(30);
		expect(result30.getTime()).toBeGreaterThan(result1.getTime());
	});
});

describe('generateUniqueShortCode', () => {
	beforeEach(async () => {
		const { db } = await import('$lib/server/db');
		vi.mocked(db.select).mockClear();
	});

	it('returns a code when the first attempt is unique', async () => {
		const { db } = await import('$lib/server/db');
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([])
				})
			})
		} as unknown as ReturnType<typeof db.select>);

		const code = await generateUniqueShortCode();
		expect(code).not.toBeNull();
		expect(typeof code).toBe('string');
		expect(code!.length).toBe(SHARE_CODE_LENGTH);
	});

	it('retries when first code already exists and succeeds on second attempt', async () => {
		const { db } = await import('$lib/server/db');
		const existingRow = [{ id: 'some-id' }];

		vi.mocked(db.select)
			.mockReturnValueOnce({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue(existingRow)
					})
				})
			} as unknown as ReturnType<typeof db.select>)
			.mockReturnValueOnce({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([])
					})
				})
			} as unknown as ReturnType<typeof db.select>);

		const code = await generateUniqueShortCode();
		expect(code).not.toBeNull();
		expect(db.select).toHaveBeenCalledTimes(2);
	});

	it('returns null when all retries are exhausted', async () => {
		const { db } = await import('$lib/server/db');
		const existingRow = [{ id: 'existing' }];
		const alwaysExists = {
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue(existingRow)
				})
			})
		} as unknown as ReturnType<typeof db.select>;

		vi.mocked(db.select).mockReturnValue(alwaysExists);
		const code = await generateUniqueShortCode();
		expect(code).toBeNull();
	});
});

describe('createShareWithRateLimit', () => {
	const userId = 'user-uuid';
	const mapType = 'lorenz' as const;
	const parameters = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
	const shortCode = 'ABCD1234';
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

	it('creates a share when under the rate limit', async () => {
		const { db } = await import('$lib/server/db');
		const newShare = { id: 'share-id', shortCode, expiresAt };

		vi.mocked(db.transaction).mockImplementation(async (fn) => {
			const tx = {
				select: vi.fn().mockReturnValue({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							orderBy: vi.fn().mockResolvedValue([])
						})
					})
				}),
				insert: vi.fn().mockReturnValue({
					values: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([newShare])
					})
				})
			};
			return fn(tx as unknown as Parameters<typeof fn>[0]);
		});

		const result = await createShareWithRateLimit(
			userId,
			mapType,
			parameters,
			shortCode,
			expiresAt
		);
		expect(result.success).toBe(true);
		expect(result.share).toEqual(newShare);
		expect(result.remaining).toBe(SHARE_RATE_LIMIT_PER_HOUR - 1);
	});

	it('returns rate limit error when at or over the limit', async () => {
		const { db } = await import('$lib/server/db');
		const oldestCreatedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
		const existingShares = Array.from({ length: SHARE_RATE_LIMIT_PER_HOUR }, () => ({
			createdAt: oldestCreatedAt
		}));

		vi.mocked(db.transaction).mockImplementation(async (fn) => {
			const tx = {
				select: vi.fn().mockReturnValue({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							orderBy: vi.fn().mockResolvedValue(existingShares)
						})
					})
				})
			};
			return fn(tx as unknown as Parameters<typeof fn>[0]);
		});

		const result = await createShareWithRateLimit(
			userId,
			mapType,
			parameters,
			shortCode,
			expiresAt
		);
		expect(result.success).toBe(false);
		expect(result.remaining).toBe(0);
		expect(result.error).toContain('Rate limit exceeded');
	});

	it('retries on unique constraint violation and succeeds', async () => {
		const { db } = await import('$lib/server/db');
		const newShare = { id: 'share-id-2', shortCode: 'NEWCODE1', expiresAt };
		let insertCallCount = 0;

		vi.mocked(db.transaction).mockImplementation(async (fn) => {
			const tx = {
				select: vi.fn().mockReturnValue({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							orderBy: vi.fn().mockResolvedValue([])
						})
					})
				}),
				insert: vi.fn().mockReturnValue({
					values: vi.fn().mockReturnValue({
						returning: vi.fn().mockImplementation(async () => {
							insertCallCount++;
							if (insertCallCount === 1) {
								throw Object.assign(new Error('unique violation'), {
									code: '23505'
								});
							}
							return [newShare];
						})
					})
				})
			};
			return fn(tx as unknown as Parameters<typeof fn>[0]);
		});

		const result = await createShareWithRateLimit(
			userId,
			mapType,
			parameters,
			shortCode,
			expiresAt
		);
		expect(result.success).toBe(true);
		expect(insertCallCount).toBe(2);
	});
});

describe('incrementViewCount', () => {
	it('calls db.update with the correct share id', async () => {
		const { db } = await import('$lib/server/db');
		const executeMock = vi.fn().mockResolvedValue(undefined);
		vi.mocked(db.update).mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					execute: executeMock
				})
			})
		} as unknown as ReturnType<typeof db.update>);

		await incrementViewCount('share-id-123');
		expect(db.update).toHaveBeenCalledTimes(1);
		expect(executeMock).toHaveBeenCalledTimes(1);
	});
});
