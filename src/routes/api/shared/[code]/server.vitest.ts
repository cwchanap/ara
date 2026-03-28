import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── DB mock state ─────────────────────────────────────────────────────────────
interface MockShare {
	id: string;
	shortCode: string;
	username: string | null;
	mapType: string;
	parameters: unknown;
	viewCount: number;
	createdAt: string;
	expiresAt: string;
}

let mockDbSelectResult: MockShare | null = null;
const deleteMock = vi.hoisted(() => vi.fn());

deleteMock.mockImplementation(() => ({
	where: vi.fn(async () => undefined)
}));

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(function (this: unknown) {
				return this;
			})
		})),
		delete: deleteMock
	},
	sharedConfigurations: {
		id: {},
		shortCode: {},
		mapType: {},
		parameters: {},
		viewCount: {},
		createdAt: {},
		expiresAt: {},
		userId: {}
	},
	profiles: { username: {}, id: {} }
}));

// Override the db.select with a proper chain mock
const dbSelectMock = vi.hoisted(() => vi.fn());
dbSelectMock.mockImplementation(() => {
	const chain: Record<string, unknown> = {
		from: vi.fn(() => chain),
		leftJoin: vi.fn(() => chain),
		where: vi.fn(() => chain),
		limit: vi.fn(async () => (mockDbSelectResult ? [mockDbSelectResult] : []))
	};
	return chain;
});

vi.mock('$lib/server/db', () => ({
	db: {
		select: dbSelectMock,
		delete: deleteMock
	},
	sharedConfigurations: {
		id: {},
		shortCode: {},
		mapType: {},
		parameters: {},
		viewCount: {},
		createdAt: {},
		expiresAt: {},
		userId: {}
	},
	profiles: { username: {}, id: {} }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((a, b) => ({ a, b }))
}));

// ── share-utils mock ──────────────────────────────────────────────────────────
const isShareExpiredMock = vi.hoisted(() => vi.fn());
const getDaysUntilExpirationMock = vi.hoisted(() => vi.fn());

isShareExpiredMock.mockImplementation((expiresAt: string) => new Date(expiresAt) < new Date());
getDaysUntilExpirationMock.mockImplementation((expiresAt: string) => {
	const diff = new Date(expiresAt).getTime() - Date.now();
	return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

vi.mock('$lib/server/share-utils', () => ({
	isShareExpired: isShareExpiredMock,
	getDaysUntilExpiration: getDaysUntilExpirationMock
}));

import { GET } from './+server';

function makeEvent(code: string) {
	return { params: { code } };
}

function makeValidShare(overrides: Partial<MockShare> = {}): MockShare {
	return {
		id: 'share-uuid-1',
		shortCode: 'ABCD1234',
		username: 'testuser',
		mapType: 'lorenz',
		parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
		viewCount: 5,
		createdAt: '2024-01-01T00:00:00Z',
		expiresAt: futureDate,
		...overrides
	};
}

describe('GET /api/shared/[code]', () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		mockDbSelectResult = null;
		dbSelectMock.mockClear();
		deleteMock.mockClear();
		isShareExpiredMock.mockImplementation(
			(expiresAt: string) => new Date(expiresAt) < new Date()
		);
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	describe('code validation', () => {
		it('returns 400 for empty code', async () => {
			const event = makeEvent('');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 for code that is not 8 characters', async () => {
			const event = makeEvent('SHORT');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 for code that is too long', async () => {
			const event = makeEvent('TOOLONGCODE');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('share not found', () => {
		it('returns 404 when share does not exist', async () => {
			mockDbSelectResult = null;
			const event = makeEvent('NOTFOUND');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 404 });
		});
	});

	describe('expired share', () => {
		it('returns 410 (Gone) for expired share', async () => {
			mockDbSelectResult = makeValidShare({ expiresAt: pastDate });
			const event = makeEvent('ABCD1234');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 410 });
		});

		it('still returns 410 even if delete throws', async () => {
			deleteMock.mockImplementationOnce(() => ({
				where: vi.fn(async () => {
					throw new Error('Delete failed');
				})
			}));
			mockDbSelectResult = makeValidShare({ expiresAt: pastDate });
			const event = makeEvent('ABCD1234');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 410 });
		});
	});

	describe('successful retrieval', () => {
		it('returns 200 with share data for valid non-expired share', async () => {
			mockDbSelectResult = makeValidShare();
			const event = makeEvent('ABCD1234');
			const response = await GET(event as never);
			expect(response.status).toBe(200);
		});

		it('response includes expected fields', async () => {
			mockDbSelectResult = makeValidShare();
			const event = makeEvent('ABCD1234');
			const response = await GET(event as never);
			const data = await response.json();
			expect(data.shortCode).toBe('ABCD1234');
			expect(data.mapType).toBe('lorenz');
			expect(data.parameters).toBeDefined();
			expect(data.viewCount).toBe(5);
			expect(data.expiresAt).toBeDefined();
			expect(data.daysRemaining).toBeDefined();
		});

		it('falls back to "Anonymous" when username is null', async () => {
			mockDbSelectResult = makeValidShare({ username: null });
			const event = makeEvent('ABCD1234');
			const response = await GET(event as never);
			const data = await response.json();
			expect(data.username).toBe('Anonymous');
		});

		it('includes the actual username when set', async () => {
			mockDbSelectResult = makeValidShare({ username: 'chaosuser' });
			const event = makeEvent('ABCD1234');
			const response = await GET(event as never);
			const data = await response.json();
			expect(data.username).toBe('chaosuser');
		});

		it('returns positive daysRemaining for non-expired share', async () => {
			mockDbSelectResult = makeValidShare();
			getDaysUntilExpirationMock.mockReturnValueOnce(5);
			const event = makeEvent('ABCD1234');
			const response = await GET(event as never);
			const data = await response.json();
			expect(data.daysRemaining).toBeGreaterThan(0);
		});
	});
});
