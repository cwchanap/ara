/**
 * Tests for the public share viewer page server load.
 *
 * Covers: invalid code format, not-found, expired share (lazy deletion),
 * invalid map type, successful load with view-count increment, and
 * graceful fallback when the increment fails.
 */

import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest';

// ── Hoisted mock state ────────────────────────────────────────────────────────

const h = vi.hoisted(() => {
	// Controls what db.select().from()...where().limit(1) returns.
	// Two queues because the load function may issue two selects:
	//   1. fetch the share + profile join
	//   2. fetch fresh viewCount after incrementing
	const state = {
		selectQueue: [] as unknown[][],
		deleteCalled: false,
		// null = fall back to real date-based logic.
		// Set to true/false to force a specific return value within a single test.
		mockIsShareExpiredOverride: null as boolean | null,
		mockDaysRemaining: 30,
		incrementViewCountShouldThrow: false
	};

	const selectMock = vi.fn(() => {
		const chain: Record<string, unknown> = {
			from: vi.fn(() => chain),
			leftJoin: vi.fn(() => chain),
			where: vi.fn(() => chain),
			limit: vi.fn(async () => state.selectQueue.shift() ?? [])
		};
		return chain;
	});

	const deleteMock = vi.fn(() => ({
		where: vi.fn(async () => {
			state.deleteCalled = true;
		})
	}));

	return { state, selectMock, deleteMock };
});

vi.mock('$lib/server/db', () => ({
	db: {
		select: h.selectMock,
		delete: h.deleteMock
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
	savedConfigurations: {}
}));

vi.mock('$lib/server/share-utils', () => ({
	isShareExpired: (expiresAt: string | null) => {
		if (h.state.mockIsShareExpiredOverride !== null) return h.state.mockIsShareExpiredOverride;
		return expiresAt !== null && new Date(expiresAt) < new Date();
	},
	getDaysUntilExpiration: () => h.state.mockDaysRemaining,
	incrementViewCount: async () => {
		if (h.state.incrementViewCountShouldThrow) {
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
	h.state.selectQueue.length = 0;
	h.state.deleteCalled = false;
	h.state.mockIsShareExpiredOverride = null;
	h.state.mockDaysRemaining = 30;
	h.state.incrementViewCountShouldThrow = false;
	h.selectMock.mockClear();
	h.deleteMock.mockClear();
});

// Reset per-test overrides after every test so the mock closure doesn't leak
// a stale `mockIsShareExpiredOverride = true` into subsequent test files.
afterEach(() => {
	h.state.mockIsShareExpiredOverride = null;
	h.state.incrementViewCountShouldThrow = false;
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
		h.state.selectQueue.push([]); // empty result
		await expect(
			load({ params: { code: 'NOTFOUND' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 404
		});
	});

	test('throws 410 and triggers lazy deletion for an expired share', async () => {
		h.state.mockIsShareExpiredOverride = true;
		h.state.selectQueue.push([makeShareRow()]);
		await expect(
			load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 410
		});
		expect(h.state.deleteCalled).toBe(true);
	});

	test('throws 500 for an unrecognised map type', async () => {
		h.state.selectQueue.push([makeShareRow({ mapType: 'unknown-type' })]);
		await expect(
			load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 500
		});
	});

	test('returns share data with incremented view count on success', async () => {
		h.state.selectQueue.push([makeShareRow()]); // first select: the share row
		h.state.selectQueue.push([{ viewCount: 6 }]); // second select: fresh count after increment
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
		h.state.incrementViewCountShouldThrow = true;
		h.state.selectQueue.push([makeShareRow({ viewCount: 5 })]);
		const result = await load({ params: { code: 'ABCD1234' } } as unknown as Parameters<
			typeof load
		>[0]);
		// Optimistic increment: original viewCount + 1
		expect(result).toMatchObject({ viewCount: 6 });
	});

	test('uses "Anonymous" when share has no associated username', async () => {
		h.state.selectQueue.push([makeShareRow({ username: null })]);
		h.state.selectQueue.push([{ viewCount: 6 }]);
		const result = await load({ params: { code: 'ABCD1234' } } as unknown as Parameters<
			typeof load
		>[0]);
		expect(result).toMatchObject({ username: 'Anonymous' });
	});

	test('does NOT delete the share when it is not expired', async () => {
		h.state.selectQueue.push([makeShareRow()]);
		h.state.selectQueue.push([{ viewCount: 6 }]);
		await load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0]);
		expect(h.state.deleteCalled).toBe(false);
	});

	test('uses optimistic view count when second select returns empty array', async () => {
		// After incrementViewCount, the second db.select for fresh viewCount returns [].
		// freshShare is undefined → finalViewCount stays at share.viewCount + 1.
		h.state.selectQueue.push([makeShareRow({ viewCount: 7 })]); // first select
		h.state.selectQueue.push([]); // second select → empty → freshShare is undefined
		const result = await load({ params: { code: 'ABCD1234' } } as unknown as Parameters<
			typeof load
		>[0]);
		// Falls back to optimistic: 7 + 1 = 8
		expect(result).toMatchObject({ viewCount: 8 });
	});

	test('still returns 410 when lazy deletion throws on expired share', async () => {
		// Covers the catch block: delete throws → error logged → 410 still thrown.
		h.state.mockIsShareExpiredOverride = true;
		h.state.selectQueue.push([makeShareRow()]);

		// Override delete mock to throw
		h.deleteMock.mockImplementationOnce(
			() =>
				({
					where: async () => {
						throw new Error('DB delete failed');
					}
				}) as never
		);

		await expect(
			load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 410 });
	});
});
