import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock state ─────────────────────────────────────────────────────────────────
const createShareWithRateLimitMock = vi.hoisted(() => vi.fn());
const generateShortCodeMock = vi.hoisted(() => vi.fn());
const calculateExpirationDateMock = vi.hoisted(() => vi.fn());

generateShortCodeMock.mockReturnValue('TESTCODE');
calculateExpirationDateMock.mockReturnValue(new Date('2030-01-01T00:00:00Z'));

vi.mock('$lib/server/db', () => ({
	db: {},
	sharedConfigurations: {},
	savedConfigurations: {},
	profiles: {}
}));

vi.mock('$lib/server/share-utils', () => ({
	generateShortCode: generateShortCodeMock,
	calculateExpirationDate: calculateExpirationDateMock,
	createShareWithRateLimit: createShareWithRateLimitMock,
	isShareExpired: (expiresAt: string) => new Date(expiresAt) < new Date(),
	getDaysUntilExpiration: (expiresAt: string) => {
		const diff = new Date(expiresAt).getTime() - Date.now();
		return Math.ceil(diff / (1000 * 60 * 60 * 24));
	},
	generateUniqueShortCode: vi.fn(async () => 'UNIQUE12'),
	incrementViewCount: vi.fn(async () => undefined)
}));

vi.mock('$app/paths', () => ({ base: '' }));

import { POST } from './+server';

function makeEvent(body: unknown, userId = 'user-123', hasSession = true) {
	return {
		request: new Request('http://localhost/api/share', {
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
			safeGetSession: vi.fn(async () => ({
				session: { access_token: 'tok' },
				user: { id: 'user-123' }
			}))
		},
		url: new URL('http://localhost/api/share')
	};
}

const defaultSuccessResult = {
	success: true,
	share: { id: 'share-id', shortCode: 'ABCD1234', expiresAt: '2030-01-01T00:00:00Z' },
	remaining: 9,
	resetAt: new Date(Date.now() + 3600000)
};

describe('POST /api/share', () => {
	beforeEach(() => {
		createShareWithRateLimitMock.mockResolvedValue(defaultSuccessResult);
		generateShortCodeMock.mockReturnValue('TESTCODE');
		calculateExpirationDateMock.mockReturnValue(new Date('2030-01-01T00:00:00Z'));
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('authentication', () => {
		it('returns 401 when not authenticated', async () => {
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
		it('returns 400 for invalid JSON', async () => {
			const event = makeBrokenJsonEvent();
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('mapType validation', () => {
		it('returns 400 for missing mapType', async () => {
			const event = makeEvent({
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 for invalid mapType string', async () => {
			const event = makeEvent({
				mapType: 'not-a-map',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 for numeric mapType', async () => {
			const event = makeEvent({
				mapType: 42,
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('parameters validation', () => {
		it('returns 400 when parameters is missing', async () => {
			const event = makeEvent({ mapType: 'lorenz' });
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 when parameters is an array', async () => {
			const event = makeEvent({ mapType: 'lorenz', parameters: [1, 2, 3] });
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 for invalid lorenz parameters', async () => {
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 for non-numeric parameter values', async () => {
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 'high', rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
		});
	});

	describe('rate limiting', () => {
		it('returns 429 when rate limit is exceeded', async () => {
			createShareWithRateLimitMock.mockResolvedValueOnce({
				success: false,
				remaining: 0,
				resetAt: new Date(Date.now() + 3600000),
				error: 'Rate limit exceeded. Limit resets in about 1 hour.'
			});
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 429 });
		});

		it('returns 429 with default message when error field is missing', async () => {
			createShareWithRateLimitMock.mockResolvedValueOnce({
				success: false,
				remaining: 0,
				resetAt: new Date(Date.now() + 3600000)
			});
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			await expect(POST(event as never)).rejects.toMatchObject({ status: 429 });
		});
	});

	describe('successful share creation', () => {
		it('returns 201 with share data', async () => {
			const event = makeEvent({
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			});
			const response = await POST(event as never);
			expect(response.status).toBe(201);
		});

		it('response includes shareUrl, shortCode, expiresAt, remaining', async () => {
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

		it('accepts valid rossler parameters', async () => {
			const event = makeEvent({
				mapType: 'rossler',
				parameters: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 }
			});
			const response = await POST(event as never);
			expect(response.status).toBe(201);
		});

		it('accepts valid henon parameters', async () => {
			const event = makeEvent({
				mapType: 'henon',
				parameters: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 }
			});
			const response = await POST(event as never);
			expect(response.status).toBe(201);
		});

		it('accepts valid logistic parameters', async () => {
			const event = makeEvent({
				mapType: 'logistic',
				parameters: { type: 'logistic', r: 3.9, x0: 0.1, iterations: 100 }
			});
			const response = await POST(event as never);
			expect(response.status).toBe(201);
		});
	});
});
