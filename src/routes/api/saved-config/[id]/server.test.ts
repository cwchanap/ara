/**
 * Tests for GET /api/saved-config/[id]
 *
 * Tests the saved configuration retrieval endpoint by mocking the db module
 * before importing the handler.
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// ── DB mock state ────────────────────────────────────────────────────────────

interface MockConfig {
	id: string;
	userId: string;
	mapType: string;
	parameters: unknown;
}

let mockDbSelectResult: MockConfig | null = null;

mock.module('$lib/server/db', () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => (mockDbSelectResult ? [mockDbSelectResult] : [])
				})
			})
		})
	},
	savedConfigurations: { id: {}, userId: {}, mapType: {}, parameters: {} },
	sharedConfigurations: {
		id: {},
		userId: {},
		shortCode: {},
		mapType: {},
		parameters: {},
		viewCount: {},
		createdAt: {},
		expiresAt: {}
	},
	profiles: { id: {}, username: {} }
}));

// Dynamic import AFTER mock registration
const { GET } = await import('./+server');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(id: string | undefined, userId = 'owner-id', hasSession = true) {
	return {
		params: { id },
		locals: {
			safeGetSession: async () =>
				hasSession
					? { session: { access_token: 'tok' }, user: { id: userId } }
					: { session: null, user: null }
		}
	};
}

function makeValidConfig(overrides: Partial<MockConfig> = {}): MockConfig {
	return {
		id: 'config-id-1',
		userId: 'owner-id',
		mapType: 'lorenz',
		parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
		...overrides
	};
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
	mockDbSelectResult = null;
});

describe('GET /api/saved-config/[id]', () => {
	describe('authentication', () => {
		test('returns 401 when not authenticated', async () => {
			const event = makeEvent('config-id-1', 'user', false);
			await expect(GET(event as never)).rejects.toMatchObject({ status: 401 });
		});
	});

	describe('parameter validation', () => {
		test('returns 400 when id is undefined', async () => {
			const event = makeEvent(undefined);
			await expect(GET(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('config not found', () => {
		test('returns 404 when config does not exist', async () => {
			mockDbSelectResult = null;
			const event = makeEvent('nonexistent-id');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 404 });
		});
	});

	describe('authorization', () => {
		test('returns 403 when config belongs to a different user', async () => {
			mockDbSelectResult = makeValidConfig({ userId: 'other-user' });
			const event = makeEvent('config-id-1', 'requesting-user');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 403 });
		});
	});

	describe('successful retrieval', () => {
		test('returns 200 with config data for the owner', async () => {
			mockDbSelectResult = makeValidConfig();
			const event = makeEvent('config-id-1', 'owner-id');
			const response = await GET(event as never);
			expect(response.status).toBe(200);
		});

		test('response includes id, mapType, and parameters', async () => {
			mockDbSelectResult = makeValidConfig();
			const event = makeEvent('config-id-1', 'owner-id');
			const response = await GET(event as never);
			const data = await response.json();
			expect(data.id).toBe('config-id-1');
			expect(data.mapType).toBe('lorenz');
			expect(data.parameters).toBeDefined();
		});

		test('works for all valid map types', async () => {
			const testCases = [
				{ mapType: 'rossler', parameters: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 } },
				{
					mapType: 'henon',
					parameters: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 }
				},
				{
					mapType: 'lozi',
					parameters: { type: 'lozi', a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 5000 }
				}
			];

			for (const tc of testCases) {
				mockDbSelectResult = makeValidConfig({
					mapType: tc.mapType,
					parameters: tc.parameters
				});
				const event = makeEvent('config-id-1', 'owner-id');
				const response = await GET(event as never);
				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.mapType).toBe(tc.mapType);
			}
		});
	});

	describe('parameter validation on retrieval', () => {
		test('returns 500 when stored parameters fail validation', async () => {
			mockDbSelectResult = makeValidConfig({
				parameters: { type: 'lorenz', sigma: 'bad' } // invalid
			});
			const event = makeEvent('config-id-1', 'owner-id');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 500 });
		});
	});
});
