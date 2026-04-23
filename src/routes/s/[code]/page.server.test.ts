/**
 * Tests for the public share viewer page server load.
 *
 * Covers: invalid code format, not-found, expired share (lazy deletion),
 * invalid map type, successful load with view-count increment, and
 * graceful fallback when the increment fails.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

// ── DB mock state ─────────────────────────────────────────────────────────────

// Controls what db.select().from()...where().limit(1) returns.
// Two queues because the load function may issue two selects:
//   1. fetch the share + profile join
//   2. fetch fresh viewCount after incrementing
const selectQueue: unknown[][] = [];
let deleteCalled = false;

const selectMock = mock(() => {
	const chain: Record<string, unknown> = {
		from: mock(() => chain),
		leftJoin: mock(() => chain),
		where: mock(() => chain),
		limit: mock(async () => selectQueue.shift() ?? [])
	};
	return chain;
});

const deleteMock = mock(() => ({
	where: mock(async () => {
		deleteCalled = true;
	})
}));

mock.module('$lib/server/db', () => ({
	db: {
		select: selectMock,
		delete: deleteMock
	},
	sharedConfigurations: {
		id: 'id',
		shortCode: 'shortCode',
		userId: 'userId',
		mapType: 'mapType',
		parameters: 'parameters',
		viewCount: 'viewCount',
		createdAt: 'createdAt',
		expiresAt: 'expiresAt'
	},
	profiles: { id: 'id', username: 'username' },
	// Included so the module cache stays valid when other test files that import
	// $lib/server/db (e.g. saved-configs actions) run in the same bun process.
	savedConfigurations: {}
}));

mock.module('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ eq: [a, b] })
}));

// ── share-utils mock state ────────────────────────────────────────────────────

// null = fall back to real date-based logic (keeps the mock compatible with
// other test files that rely on isShareExpired checking actual dates).
// Set to true/false to force a specific return value within a single test.
let mockIsShareExpiredOverride: boolean | null = null;
let mockDaysRemaining = 30;
let incrementViewCountShouldThrow = false;

mock.module('$lib/server/share-utils', () => ({
	isShareExpired: (expiresAt: string | null) => {
		if (mockIsShareExpiredOverride !== null) return mockIsShareExpiredOverride;
		return expiresAt !== null && new Date(expiresAt) < new Date();
	},
	getDaysUntilExpiration: () => mockDaysRemaining,
	incrementViewCount: async () => {
		if (incrementViewCountShouldThrow) {
			throw new Error('DB write failed');
		}
	}
}));

// Dynamic import AFTER mocks are registered.
const { load } = await import('./+page.server');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A minimal valid share row returned by the first DB select. */
function makeShareRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 'share-1',
		shortCode: 'ABCD1234',
		username: 'testuser',
		mapType: 'lorenz',
		parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
		viewCount: 5,
		createdAt: new Date('2026-01-01').toISOString(),
		expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
		...overrides
	};
}

beforeEach(() => {
	selectQueue.length = 0;
	deleteCalled = false;
	mockIsShareExpiredOverride = null;
	mockDaysRemaining = 30;
	incrementViewCountShouldThrow = false;
	selectMock.mockClear();
	deleteMock.mockClear();
});

// Reset per-test overrides after every test so the mock closure doesn't leak
// a stale `mockIsShareExpiredOverride = true` into subsequent test files.
afterEach(() => {
	mockIsShareExpiredOverride = null;
	incrementViewCountShouldThrow = false;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('share viewer page load', () => {
	test('throws 400 for a code shorter than 8 characters', async () => {
		await expect(
			load({ params: { code: 'SHORT' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 400
		});
	});

	test('throws 400 for a code longer than 8 characters', async () => {
		await expect(
			load({ params: { code: 'TOOLONGCO' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 400
		});
	});

	test('throws 400 for an empty code', async () => {
		await expect(
			load({ params: { code: '' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 400
		});
	});

	test('throws 404 when the share is not found in the database', async () => {
		selectQueue.push([]); // empty result
		await expect(
			load({ params: { code: 'NOTFOUND' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 404
		});
	});

	test('throws 410 and triggers lazy deletion for an expired share', async () => {
		mockIsShareExpiredOverride = true;
		selectQueue.push([makeShareRow()]);
		await expect(
			load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 410
		});
		expect(deleteCalled).toBe(true);
	});

	test('throws 500 for an unrecognised map type', async () => {
		selectQueue.push([makeShareRow({ mapType: 'unknown-type' })]);
		await expect(
			load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 500
		});
	});

	test('returns share data with incremented view count on success', async () => {
		selectQueue.push([makeShareRow()]); // first select: the share row
		selectQueue.push([{ viewCount: 6 }]); // second select: fresh count after increment
		const result = await load({ params: { code: 'ABCD1234' } } as unknown as Parameters<
			typeof load
		>[0]);
		expect(result).toMatchObject({
			shortCode: 'ABCD1234',
			username: 'testuser',
			mapType: 'lorenz',
			viewCount: 6,
			daysRemaining: 30
		});
	});

	test('falls back to optimistic view count when increment throws', async () => {
		incrementViewCountShouldThrow = true;
		selectQueue.push([makeShareRow({ viewCount: 5 })]);
		const result = await load({ params: { code: 'ABCD1234' } } as unknown as Parameters<
			typeof load
		>[0]);
		// Optimistic increment: original viewCount + 1
		expect(result).toMatchObject({ viewCount: 6 });
	});

	test('uses "Anonymous" when share has no associated username', async () => {
		selectQueue.push([makeShareRow({ username: null })]);
		selectQueue.push([{ viewCount: 6 }]);
		const result = await load({ params: { code: 'ABCD1234' } } as unknown as Parameters<
			typeof load
		>[0]);
		expect(result).toMatchObject({ username: 'Anonymous' });
	});

	test('does NOT delete the share when it is not expired', async () => {
		selectQueue.push([makeShareRow()]);
		selectQueue.push([{ viewCount: 6 }]);
		await load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0]);
		expect(deleteCalled).toBe(false);
	});

	test('uses optimistic view count when second select returns empty array', async () => {
		// After incrementViewCount, the second db.select for fresh viewCount returns [].
		// freshShare is undefined → finalViewCount stays at share.viewCount + 1.
		selectQueue.push([makeShareRow({ viewCount: 7 })]); // first select
		selectQueue.push([]); // second select → empty → freshShare is undefined
		const result = await load({ params: { code: 'ABCD1234' } } as unknown as Parameters<
			typeof load
		>[0]);
		// Falls back to optimistic: 7 + 1 = 8
		expect(result.viewCount).toBe(8);
	});

	test('still returns 410 when lazy deletion throws on expired share', async () => {
		// Covers the catch block: delete throws → error logged → 410 still thrown.
		mockIsShareExpiredOverride = true;
		selectQueue.push([makeShareRow()]);

		// Override delete mock to throw
		deleteMock.mockImplementationOnce(() => ({
			where: async () => {
				throw new Error('DB delete failed');
			}
		}));

		await expect(
			load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 410 });
	});
});
