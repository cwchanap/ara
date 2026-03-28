import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── DB mock state ─────────────────────────────────────────────────────────────
const selectQueue = vi.hoisted<unknown[][]>(() => []);
const selectMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

selectMock.mockImplementation(() => {
	const chain: Record<string, unknown> = {
		from: vi.fn(() => chain),
		leftJoin: vi.fn(() => chain),
		where: vi.fn(() => chain),
		limit: vi.fn(async () => selectQueue.shift() ?? [])
	};
	return chain;
});

deleteMock.mockImplementation(() => ({
	where: vi.fn(async () => undefined)
}));

vi.mock('$lib/server/db', () => ({
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
	savedConfigurations: {}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((a, b) => ({ eq: [a, b] }))
}));

// ── share-utils mock state ─────────────────────────────────────────────────────
const isShareExpiredMock = vi.hoisted(() => vi.fn());
const getDaysUntilExpirationMock = vi.hoisted(() => vi.fn());
const incrementViewCountMock = vi.hoisted(() => vi.fn());

isShareExpiredMock.mockImplementation((expiresAt: string | null) => {
	return expiresAt !== null && new Date(expiresAt) < new Date();
});
getDaysUntilExpirationMock.mockReturnValue(30);
incrementViewCountMock.mockResolvedValue(undefined);

vi.mock('$lib/server/share-utils', () => ({
	isShareExpired: isShareExpiredMock,
	getDaysUntilExpiration: getDaysUntilExpirationMock,
	incrementViewCount: incrementViewCountMock
}));

import { load } from './+page.server';

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

describe('share viewer page load', () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		selectQueue.length = 0;
		selectMock.mockClear();
		deleteMock.mockClear();
		isShareExpiredMock.mockImplementation((expiresAt: string | null) => {
			return expiresAt !== null && new Date(expiresAt) < new Date();
		});
		getDaysUntilExpirationMock.mockReturnValue(30);
		incrementViewCountMock.mockResolvedValue(undefined);
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it('throws 400 for a code shorter than 8 characters', async () => {
		await expect(
			load({ params: { code: 'SHORT' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 400 });
	});

	it('throws 400 for a code longer than 8 characters', async () => {
		await expect(
			load({ params: { code: 'TOOLONGCO' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 400 });
	});

	it('throws 400 for an empty code', async () => {
		await expect(
			load({ params: { code: '' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 400 });
	});

	it('throws 404 when the share is not found in the database', async () => {
		selectQueue.push([]);
		await expect(
			load({ params: { code: 'NOTFOUND' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 404 });
	});

	it('throws 410 and triggers lazy deletion for an expired share', async () => {
		isShareExpiredMock.mockReturnValue(true);
		selectQueue.push([makeShareRow()]);
		await expect(
			load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 410 });
		expect(deleteMock).toHaveBeenCalledTimes(1);
	});

	it('throws 500 for an unrecognised map type', async () => {
		selectQueue.push([makeShareRow({ mapType: 'unknown-type' })]);
		await expect(
			load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 500 });
	});

	it('returns share data with incremented view count on success', async () => {
		selectQueue.push([makeShareRow()]);
		selectQueue.push([{ viewCount: 6 }]);
		const result = await load({
			params: { code: 'ABCD1234' }
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({
			shortCode: 'ABCD1234',
			username: 'testuser',
			mapType: 'lorenz',
			viewCount: 6,
			daysRemaining: 30
		});
	});

	it('falls back to optimistic view count when increment throws', async () => {
		incrementViewCountMock.mockRejectedValueOnce(new Error('DB write failed'));
		selectQueue.push([makeShareRow({ viewCount: 5 })]);
		const result = await load({
			params: { code: 'ABCD1234' }
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ viewCount: 6 });
	});

	it('uses "Anonymous" when share has no associated username', async () => {
		selectQueue.push([makeShareRow({ username: null })]);
		selectQueue.push([{ viewCount: 6 }]);
		const result = await load({
			params: { code: 'ABCD1234' }
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ username: 'Anonymous' });
	});

	it('does NOT delete the share when it is not expired', async () => {
		selectQueue.push([makeShareRow()]);
		selectQueue.push([{ viewCount: 6 }]);
		await load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0]);
		expect(deleteMock).not.toHaveBeenCalled();
	});

	it('still returns 410 even if delete throws on expired share', async () => {
		isShareExpiredMock.mockReturnValue(true);
		deleteMock.mockImplementationOnce(() => ({
			where: vi.fn(async () => {
				throw new Error('Delete failed');
			})
		}));
		selectQueue.push([makeShareRow()]);
		await expect(
			load({ params: { code: 'ABCD1234' } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 410 });
	});
});
