import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── DB mock state ─────────────────────────────────────────────────────────────
const insertMock = vi.hoisted(() => vi.fn());
let lastInsertedValues: Record<string, unknown> | null = null;
let mockDbInsertShouldThrow = false;

insertMock.mockImplementation(() => ({
	values: vi.fn((vals: Record<string, unknown>) => {
		lastInsertedValues = vals;
		return {
			returning: vi.fn(async () => {
				if (mockDbInsertShouldThrow) throw new Error('DB connection failed');
				return [
					{
						id: 'new-config-id',
						name: lastInsertedValues?.name ?? 'Test Config',
						mapType: lastInsertedValues?.mapType ?? 'lorenz',
						createdAt: '2024-01-01T00:00:00Z'
					}
				];
			})
		};
	})
}));

vi.mock('$lib/server/db', () => ({
	db: {
		insert: insertMock
	},
	savedConfigurations: {
		id: {},
		userId: {},
		name: {},
		mapType: {},
		parameters: {},
		createdAt: {},
		updatedAt: {}
	},
	sharedConfigurations: {},
	profiles: {}
}));

import { POST } from './+server';

function makeEvent(body: unknown, userId = 'user-123', hasSession = true) {
	return {
		request: new Request('http://localhost/api/save-config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			safeGetSession: vi.fn(async () =>
				hasSession
					? { session: { access_token: 'tok' }, user: { id: userId } }
					: { session: null, user: null }
			)
		}
	};
}

function makeBrokenJsonEvent() {
	return {
		request: new Request('http://localhost/api/save-config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'not json{'
		}),
		locals: {
			safeGetSession: vi.fn(async () => ({
				session: { access_token: 'tok' },
				user: { id: 'user-123' }
			}))
		}
	};
}

describe('POST /api/save-config', () => {
	beforeEach(() => {
		mockDbInsertShouldThrow = false;
		lastInsertedValues = null;
		insertMock.mockClear();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('authentication', () => {
		it('returns 401 when not authenticated', async () => {
			const event = makeEvent(
				{ name: 'Test', mapType: 'lorenz', parameters: {} },
				'u1',
				false
			);
			await expect(POST(event as never)).rejects.toMatchObject({ status: 401 });
		});
	});

	describe('request body parsing', () => {
		it('returns 400 for invalid JSON', async () => {
			const event = makeBrokenJsonEvent();
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('name validation', () => {
		it('returns 400 when name is missing', async () => {
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 when name is not a string', async () => {
			const event = makeEvent({
				name: 42,
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 when name is empty string', async () => {
			const event = makeEvent({
				name: '   ',
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 when name exceeds 100 characters', async () => {
			const event = makeEvent({
				name: 'a'.repeat(101),
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('mapType validation', () => {
		it('returns 400 when mapType is missing', async () => {
			const event = makeEvent({
				name: 'Test Config',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 when mapType is not a string', async () => {
			const event = makeEvent({
				name: 'Test Config',
				mapType: 123,
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 for invalid mapType value', async () => {
			const event = makeEvent({
				name: 'Test Config',
				mapType: 'invalid-type',
				parameters: {}
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('parameters validation', () => {
		it('returns 400 for invalid lorenz parameters (missing fields)', async () => {
			const event = makeEvent({
				name: 'Test Config',
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 for non-numeric parameter values', async () => {
			const event = makeEvent({
				name: 'Test Config',
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 'not-a-number', rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('successful saves', () => {
		it('returns 201 with configuration data for valid lorenz params', async () => {
			const event = makeEvent({
				name: 'My Lorenz Config',
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			const response = await POST(event as never);
			expect(response.status).toBe(201);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.configuration).toBeDefined();
			expect(data.configuration.id).toBe('new-config-id');
		});

		it('trims whitespace from name', async () => {
			const event = makeEvent({
				name: '  Trimmed Name  ',
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await POST(event as never);
			expect(lastInsertedValues?.name).toBe('Trimmed Name');
		});

		it('accepts a name exactly 100 characters long', async () => {
			const event = makeEvent({
				name: 'a'.repeat(100),
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			const response = await POST(event as never);
			expect(response.status).toBe(201);
		});

		it('stores userId from authenticated user', async () => {
			const event = makeEvent(
				{
					name: 'Test',
					mapType: 'lorenz',
					parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
				},
				'specific-user-id'
			);
			await POST(event as never);
			expect(lastInsertedValues?.userId).toBe('specific-user-id');
		});

		it('saves valid rossler parameters', async () => {
			const event = makeEvent({
				name: 'Rossler Config',
				mapType: 'rossler',
				parameters: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 }
			});
			const response = await POST(event as never);
			expect(response.status).toBe(201);
		});

		it('saves valid henon parameters', async () => {
			const event = makeEvent({
				name: 'Henon Config',
				mapType: 'henon',
				parameters: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 }
			});
			const response = await POST(event as never);
			expect(response.status).toBe(201);
		});
	});

	describe('database errors', () => {
		it('returns 500 when database insert fails', async () => {
			mockDbInsertShouldThrow = true;
			const event = makeEvent({
				name: 'Test Config',
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 500 });
		});
	});
});
