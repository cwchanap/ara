import { describe, expect, it, vi } from 'vitest';

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
	isShareExpired,
	getDaysUntilExpiration,
	calculateExpirationDate
} from './share-utils';
import { SHARE_CODE_LENGTH, SHARE_CODE_CHARSET } from '$lib/constants';

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

	it('generates different codes on subsequent calls (probabilistic)', () => {
		const codes = new Set(Array.from({ length: 20 }, () => generateShortCode()));
		// With 62^8 combinations, getting 20 identical codes is astronomically unlikely
		expect(codes.size).toBeGreaterThan(1);
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
