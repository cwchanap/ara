import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── DB mock state ─────────────────────────────────────────────────────────────
interface MockConfig {
	id: string;
	userId: string;
	mapType: string;
	parameters: unknown;
}

let mockDbSelectResult: MockConfig | null = null;

const selectMock = vi.hoisted(() => vi.fn());

selectMock.mockImplementation(() => ({
	from: vi.fn(() => ({
		where: vi.fn(() => ({
			limit: vi.fn(async () => (mockDbSelectResult ? [mockDbSelectResult] : []))
		}))
	}))
}));

vi.mock('$lib/server/db', () => ({
	db: {
		select: selectMock
	},
	savedConfigurations: { id: {}, userId: {}, mapType: {}, parameters: {} },
	sharedConfigurations: {},
	profiles: {}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((a, b) => ({ a, b }))
}));

import { GET } from './+server';

function makeEvent(id: string | undefined, userId = 'owner-id', hasSession = true) {
	return {
		params: { id },
		locals: {
			safeGetSession: vi.fn(async () =>
				hasSession
					? { session: { access_token: 'tok' }, user: { id: userId } }
					: { session: null, user: null }
			)
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

describe('GET /api/saved-config/[id]', () => {
	beforeEach(() => {
		mockDbSelectResult = null;
		selectMock.mockClear();
	});

	describe('authentication', () => {
		it('returns 401 when not authenticated', async () => {
			const event = makeEvent('config-id-1', 'user', false);
			await expect(GET(event as never)).rejects.toMatchObject({ status: 401 });
		});
	});

	describe('parameter validation', () => {
		it('returns 400 when id is undefined', async () => {
			const event = makeEvent(undefined);
			await expect(GET(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('config not found', () => {
		it('returns 404 when config does not exist', async () => {
			mockDbSelectResult = null;
			const event = makeEvent('nonexistent-id');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 404 });
		});
	});

	describe('authorization', () => {
		it('returns 403 when config belongs to a different user', async () => {
			mockDbSelectResult = makeValidConfig({ userId: 'other-user' });
			const event = makeEvent('config-id-1', 'requesting-user');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 403 });
		});
	});

	describe('successful retrieval', () => {
		it('returns 200 with config data for the owner', async () => {
			mockDbSelectResult = makeValidConfig();
			const event = makeEvent('config-id-1', 'owner-id');
			const response = await GET(event as never);
			expect(response.status).toBe(200);
		});

		it('response includes id, mapType, and parameters', async () => {
			mockDbSelectResult = makeValidConfig();
			const event = makeEvent('config-id-1', 'owner-id');
			const response = await GET(event as never);
			const data = await response.json();
			expect(data.id).toBe('config-id-1');
			expect(data.mapType).toBe('lorenz');
			expect(data.parameters).toBeDefined();
		});

		it('works for rossler map type', async () => {
			mockDbSelectResult = makeValidConfig({
				mapType: 'rossler',
				parameters: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 }
			});
			const event = makeEvent('config-id-1', 'owner-id');
			const response = await GET(event as never);
			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.mapType).toBe('rossler');
		});

		it('works for henon map type', async () => {
			mockDbSelectResult = makeValidConfig({
				mapType: 'henon',
				parameters: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 }
			});
			const event = makeEvent('config-id-1', 'owner-id');
			const response = await GET(event as never);
			expect(response.status).toBe(200);
		});
	});

	describe('parameter validation on retrieval', () => {
		it('returns 500 when stored parameters fail validation', async () => {
			mockDbSelectResult = makeValidConfig({
				parameters: { type: 'lorenz', sigma: 'bad' }
			});
			const event = makeEvent('config-id-1', 'owner-id');
			await expect(GET(event as never)).rejects.toMatchObject({ status: 500 });
		});
	});
});
