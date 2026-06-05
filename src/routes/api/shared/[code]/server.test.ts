/**
 * Tests for GET /api/shared/[code]
 *
 * Tests the shared configuration retrieval endpoint by mocking the db module
 * before importing the handler.
 */

import { beforeEach, describe, expect, vi, test } from 'vitest';

// ── Hoisted mock state ────────────────────────────────────────────────────────

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

type DeleteWhere = (c: unknown) => unknown;

const h = vi.hoisted(() => {
	const state = {
		mockDbSelectResult: null as MockShare | null,
		mockDbDeleteThrows: false,
		// Indirection layer so individual tests can swap the delete behaviour
		deleteImpl: null as null | (() => { where: DeleteWhere })
	};

	return { state };
});

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({
			from: () => ({
				leftJoin: () => ({
					where: () => ({
						limit: () =>
							h.state.mockDbSelectResult ? [h.state.mockDbSelectResult] : []
					})
				})
			})
		}),
		delete: () => {
			const impl = h.state.deleteImpl;
			if (impl) return impl();
			return {
				where: () => {
					if (h.state.mockDbDeleteThrows) throw new Error('Delete failed');
					return Promise.resolve();
				}
			};
		}
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

vi.mock('$lib/server/share-utils', () => ({
	isShareExpired: (expiresAt: string) => new Date(expiresAt) < new Date(),
	getDaysUntilExpiration: (expiresAt: string) => {
		const diff = new Date(expiresAt).getTime() - Date.now();
		return Math.ceil(diff / (1000 * 60 * 60 * 24));
	}
}));

// Dynamic import AFTER mock registration
const { GET } = await import('./+server');

// ── Helpers ──────────────────────────────────────────────────────────────────

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
	h.state.mockDbSelectResult = null;
	h.state.mockDbDeleteThrows = false;
	h.state.deleteImpl = null;
});

describe('GET /api/shared/[code]', () => {
	describe('code validation', () => {
		test('returns 400 for empty code', async () => {
			const event = makeEvent('');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 400 });
		});

		test('returns 400 for code that is not 8 characters', async () => {
			const event = makeEvent('SHORT');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 400 });
		});

		test('returns 400 for code that is too long', async () => {
			const event = makeEvent('TOOLONGCODE');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('share not found', () => {
		test('returns 404 when share does not exist', async () => {
			h.state.mockDbSelectResult = null;
			const event = makeEvent('NOTFOUND');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 404 });
		});
	});

	describe('expired share', () => {
		test('returns 410 (Gone) for expired share', async () => {
			h.state.mockDbSelectResult = makeValidShare({ expiresAt: pastDate });
			const event = makeEvent('ABCD1234');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 410 });
		});

		test('deletes expired share by id, not by shortCode', async () => {
			let capturedWhereArg: unknown;
			h.state.deleteImpl = () => ({
				where: (criteria: unknown) => {
					capturedWhereArg = criteria;
					return Promise.resolve();
				}
			});

			const share = makeValidShare({ expiresAt: pastDate });
			h.state.mockDbSelectResult = share;
			const event = makeEvent('ABCD1234');
			try {
				await GET(event as never);
			} catch {
				// expected 410 error
			}

			// The where clause should reference the share's id, not its shortCode.
			// Use a recursive string extractor instead of JSON.stringify so the
			// assertion is robust regardless of Drizzle's internal SQL object shape.
			const extractStrings = (value: unknown, seen = new Set<unknown>()): string[] => {
				if (value === null || typeof value === 'undefined') return [];
				if (typeof value === 'string') return [value];
				if (typeof value !== 'object') return [];
				if (seen.has(value)) return [];
				seen.add(value);
				const result: string[] = [];
				for (const key of Object.keys(value as Record<string, unknown>)) {
					const v = (value as Record<string, unknown>)[key];
					result.push(...extractStrings(v, seen));
				}
				return result;
			};
			const allStrings = extractStrings(capturedWhereArg);
			expect(allStrings).toContain(share.id);
			expect(allStrings).not.toContain(share.shortCode);
		});

		test('still returns 410 even if delete throws', async () => {
			h.state.mockDbDeleteThrows = true;
			h.state.mockDbSelectResult = makeValidShare({ expiresAt: pastDate });
			const event = makeEvent('ABCD1234');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 410 });
		});
	});

	describe('successful retrieval', () => {
		test('returns 200 with share data for valid non-expired share', async () => {
			h.state.mockDbSelectResult = makeValidShare();
			const event = makeEvent('ABCD1234');
			const response = await GET(event as never);
			expect(response.status).toBe(200);
		});

		test('response includes expected fields', async () => {
			h.state.mockDbSelectResult = makeValidShare();
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

		test('falls back to "Anonymous" when username is null', async () => {
			h.state.mockDbSelectResult = makeValidShare({ username: null });
			const event = makeEvent('ABCD1234');
			const response = await GET(event as never);
			const data = await response.json();
			expect(data.username).toBe('Anonymous');
		});

		test('includes the actual username when set', async () => {
			h.state.mockDbSelectResult = makeValidShare({ username: 'chaosuser' });
			const event = makeEvent('ABCD1234');
			const response = await GET(event as never);
			const data = await response.json();
			expect(data.username).toBe('chaosuser');
		});

		test('returns positive daysRemaining for non-expired share', async () => {
			h.state.mockDbSelectResult = makeValidShare();
			const event = makeEvent('ABCD1234');
			const response = await GET(event as never);
			const data = await response.json();
			expect(data.daysRemaining).toBeGreaterThan(0);
		});

		test('works for all supported map types', async () => {
			const mapTypes = ['lorenz', 'rossler', 'henon', 'lozi', 'logistic'];
			for (const mapType of mapTypes) {
				h.state.mockDbSelectResult = makeValidShare({ mapType, shortCode: 'TSTCODE1' });
				const event = makeEvent('TSTCODE1');
				const response = await GET(event as never);
				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.mapType).toBe(mapType);
			}
		});
	});
});
