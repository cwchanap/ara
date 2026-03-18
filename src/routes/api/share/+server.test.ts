/**
 * Tests for POST /api/share
 *
 * Tests the share-creation API endpoint by mocking $lib/server/db and
 * $lib/server/share-utils before importing the handler.
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// ── Mock state ───────────────────────────────────────────────────────────────

let mockRateLimitResult: {
	success: boolean;
	share?: { id: string; shortCode: string; expiresAt: string };
	remaining: number;
	resetAt: Date;
	error?: string;
} = {
	success: true,
	share: { id: 'share-id', shortCode: 'ABCD1234', expiresAt: '2030-01-01T00:00:00Z' },
	remaining: 9,
	resetAt: new Date(Date.now() + 3600000)
};

mock.module('$lib/server/db', () => ({
	db: {},
	sharedConfigurations: {},
	savedConfigurations: {},
	profiles: {}
}));

mock.module('$lib/server/share-utils', () => ({
	generateShortCode: () => 'TESTCODE',
	calculateExpirationDate: () => new Date('2030-01-01T00:00:00Z'),
	createShareWithRateLimit: async () => mockRateLimitResult,
	isShareExpired: (expiresAt: string) => new Date(expiresAt) < new Date(),
	getDaysUntilExpiration: (expiresAt: string) => {
		const diff = new Date(expiresAt).getTime() - Date.now();
		return Math.ceil(diff / (1000 * 60 * 60 * 24));
	},
	generateUniqueShortCode: async () => 'UNIQUE12',
	incrementViewCount: async () => {}
}));

// Dynamic import AFTER mock registration
const { POST } = await import('./+server');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(body: unknown, userId = 'user-123', hasSession = true) {
	return {
		request: new Request('http://localhost/api/share', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			safeGetSession: async () =>
				hasSession
					? { session: { access_token: 'tok' }, user: { id: userId } }
					: { session: null, user: null }
		},
		url: new URL('http://localhost/api/share')
	};
}

function makeBrokenJsonEvent() {
	return {
		request: new Request('http://localhost/api/share', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'not json{'
		}),
		locals: {
			safeGetSession: async () => ({
				session: { access_token: 'tok' },
				user: { id: 'user-123' }
			})
		},
		url: new URL('http://localhost/api/share')
	};
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
	mockRateLimitResult = {
		success: true,
		share: { id: 'share-id', shortCode: 'ABCD1234', expiresAt: '2030-01-01T00:00:00Z' },
		remaining: 9,
		resetAt: new Date(Date.now() + 3600000)
	};
});

describe('POST /api/share', () => {
	describe('authentication', () => {
		test('returns 401 when not authenticated', async () => {
			const event = makeEvent(
				{
					mapType: 'lorenz',
					parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
				},
				'u1',
				false
			);
			await expect(POST(event as never)).rejects.toMatchObject({ status: 401 });
		});
	});

	describe('request body parsing', () => {
		test('returns 400 for invalid JSON', async () => {
			const event = makeBrokenJsonEvent();
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('mapType validation', () => {
		test('returns 400 for missing mapType', async () => {
			const event = makeEvent({
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		test('returns 400 for invalid mapType string', async () => {
			const event = makeEvent({
				mapType: 'not-a-map',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		test('returns 400 for numeric mapType', async () => {
			const event = makeEvent({
				mapType: 42,
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('parameters validation', () => {
		test('returns 400 when parameters is missing', async () => {
			const event = makeEvent({ mapType: 'lorenz' });
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		test('returns 400 when parameters is an array', async () => {
			const event = makeEvent({ mapType: 'lorenz', parameters: [1, 2, 3] });
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		test('returns 400 for invalid lorenz parameters', async () => {
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10 } // missing rho and beta
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		test('returns 400 for non-numeric parameter values', async () => {
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 'high', rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('rate limiting', () => {
		test('returns 429 when rate limit is exceeded', async () => {
			mockRateLimitResult = {
				success: false,
				remaining: 0,
				resetAt: new Date(Date.now() + 3600000),
				error: 'Rate limit exceeded. Limit resets in about 1 hour.'
			};
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 429 });
		});

		test('returns 429 with default message when error field is missing', async () => {
			mockRateLimitResult = {
				success: false,
				remaining: 0,
				resetAt: new Date(Date.now() + 3600000)
				// no error field
			};
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 429 });
		});
	});

	describe('successful share creation', () => {
		test('returns 201 with share data', async () => {
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			const response = await POST(event as never);
			expect(response.status).toBe(201);
		});

		test('response includes shareUrl, shortCode, expiresAt, remaining', async () => {
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			const response = await POST(event as never);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.shortCode).toBe('ABCD1234');
			expect(data.shareUrl).toContain('ABCD1234');
			expect(data.expiresAt).toBe('2030-01-01T00:00:00Z');
			expect(data.remaining).toBe(9);
		});

		test('accepts all valid map types', async () => {
			const validInputs = [
				{ mapType: 'rossler', parameters: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 } },
				{
					mapType: 'henon',
					parameters: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 }
				},
				{
					mapType: 'lozi',
					parameters: { type: 'lozi', a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 5000 }
				},
				{
					mapType: 'logistic',
					parameters: { type: 'logistic', r: 3.9, x0: 0.1, iterations: 100 }
				}
			];

			for (const input of validInputs) {
				const event = makeEvent(input);
				const response = await POST(event as never);
				expect(response.status).toBe(201);
			}
		});
	});
});
