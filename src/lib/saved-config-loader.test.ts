/**
 * Tests for saved-config-loader.ts
 *
 * Tests the parseConfigParam and loadSavedConfigParameters functions.
 */

import { describe, expect, test, mock } from 'bun:test';
import {
	parseConfigParam,
	loadSavedConfigParameters,
	loadSharedConfigParameters
} from './saved-config-loader';

describe('parseConfigParam', () => {
	describe('valid inputs', () => {
		test('parses valid Lorenz parameters', () => {
			const configParam = encodeURIComponent(
				JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
			);

			const result = parseConfigParam({ mapType: 'lorenz', configParam });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.parameters.sigma).toBe(10);
				expect(result.parameters.rho).toBe(28);
				expect(result.parameters.beta).toBe(2.667);
			}
		});

		test('parses valid Henon parameters', () => {
			const configParam = encodeURIComponent(
				JSON.stringify({ type: 'henon', a: 1.4, b: 0.3, iterations: 2000 })
			);

			const result = parseConfigParam({ mapType: 'henon', configParam });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.parameters.a).toBe(1.4);
				expect(result.parameters.b).toBe(0.3);
				expect(result.parameters.iterations).toBe(2000);
			}
		});

		test('parses valid Lozi parameters', () => {
			const configParam = encodeURIComponent(
				JSON.stringify({ type: 'lozi', a: 0.5, b: 0.3, x0: 0, y0: 0, iterations: 2000 })
			);

			const result = parseConfigParam({ mapType: 'lozi', configParam });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.parameters.a).toBe(0.5);
				expect(result.parameters.b).toBe(0.3);
				expect(result.parameters.x0).toBe(0);
				expect(result.parameters.y0).toBe(0);
				expect(result.parameters.iterations).toBe(2000);
			}
		});

		test('parses valid Rossler parameters', () => {
			const configParam = encodeURIComponent(
				JSON.stringify({ type: 'rossler', a: 0.2, b: 0.2, c: 5.7 })
			);

			const result = parseConfigParam({ mapType: 'rossler', configParam });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.parameters.a).toBe(0.2);
				expect(result.parameters.b).toBe(0.2);
				expect(result.parameters.c).toBe(5.7);
			}
		});
	});

	describe('invalid inputs', () => {
		test('returns error for invalid URI encoding', () => {
			const configParam = '%invalid%encoding';

			const result = parseConfigParam({ mapType: 'lorenz', configParam });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors).toContain('Failed to parse configuration parameters');
			}
		});

		test('returns error for invalid JSON', () => {
			const configParam = encodeURIComponent('{invalid json}');

			const result = parseConfigParam({ mapType: 'lorenz', configParam });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors).toContain('Failed to parse configuration parameters');
			}
		});

		test('returns error for missing required parameters', () => {
			const configParam = encodeURIComponent(JSON.stringify({ type: 'lorenz', sigma: 10 }));

			const result = parseConfigParam({ mapType: 'lorenz', configParam });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors.some((e) => e.includes('Missing required parameters'))).toBe(
					true
				);
			}
		});

		test('returns error for non-numeric parameter values', () => {
			const configParam = encodeURIComponent(
				JSON.stringify({ type: 'lorenz', sigma: 'ten', rho: 28, beta: 2.667 })
			);

			const result = parseConfigParam({ mapType: 'lorenz', configParam });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors.some((e) => e.includes('must be a valid number'))).toBe(true);
			}
		});

		test('returns error for excessively large config param', () => {
			const largeString = 'a'.repeat(60 * 1024); // 60KB
			const configParam = encodeURIComponent(largeString);

			const result = parseConfigParam({ mapType: 'lorenz', configParam });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors.some((e) => e.includes('too large'))).toBe(true);
			}
		});

		test('returns error for deeply nested JSON', () => {
			// Create deeply nested object
			let nested: Record<string, unknown> = { value: 1 };
			for (let i = 0; i < 25; i++) {
				nested = { nested };
			}
			const configParam = encodeURIComponent(JSON.stringify(nested));

			const result = parseConfigParam({ mapType: 'lorenz', configParam });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors.some((e) => e.includes('too deeply nested'))).toBe(true);
			}
		});

		test('returns error for unexpected parameters', () => {
			const configParam = encodeURIComponent(
				JSON.stringify({
					type: 'lorenz',
					sigma: 10,
					rho: 28,
					beta: 2.667,
					extraParam: 'unexpected'
				})
			);

			const result = parseConfigParam({ mapType: 'lorenz', configParam });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors.some((e) => e.includes('Unexpected parameters'))).toBe(true);
			}
		});
	});
});

// Helper to create a mock fetch function with proper typing
function createMockFetch(responseProvider: () => Promise<Response>): typeof fetch {
	const mockFn = mock(responseProvider);
	// Add the preconnect property that fetch requires
	Object.defineProperty(mockFn, 'preconnect', {
		value: () => {},
		writable: true,
		configurable: true
	});
	return mockFn as unknown as typeof fetch;
}

describe('loadSavedConfigParameters', () => {
	describe('API loading', () => {
		test('loads parameters from API successfully', async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({
					mapType: 'lorenz',
					parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
				})
			};

			const mockFetch = createMockFetch(() => Promise.resolve(mockResponse as Response));

			const result = await loadSavedConfigParameters({
				configId: 'test-config-id',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.parameters.sigma).toBe(10);
				expect(result.source).toBe('api');
			}
		});

		test('returns error when API returns invalid map type', async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({
					mapType: 'henon', // Different from requested
					parameters: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 }
				})
			};

			const mockFetch = createMockFetch(() => Promise.resolve(mockResponse as Response));

			const result = await loadSavedConfigParameters({
				configId: 'test-config-id',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(false);
		});

		test('returns error when API returns non-ok response', async () => {
			const mockResponse = {
				ok: false,
				status: 404
			};

			const mockFetch = createMockFetch(() => Promise.resolve(mockResponse as Response));

			const result = await loadSavedConfigParameters({
				configId: 'test-config-id',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain('Failed to load configuration parameters');
				expect(result.errors[0]).toContain('Failed to load configuration parameters');
			}
		});

		test('returns error when parameters fail validation', async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({
					mapType: 'lorenz',
					parameters: { type: 'lorenz', sigma: 'invalid' } // Invalid parameter type
				})
			};

			const mockFetch = createMockFetch(() => Promise.resolve(mockResponse as Response));

			const result = await loadSavedConfigParameters({
				configId: 'test-config-id',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.validationErrors).toBeDefined();
			}
		});

		test('handles fetch exceptions gracefully', async () => {
			const mockFetch = createMockFetch(() => Promise.reject(new Error('Network error')));

			const result = await loadSavedConfigParameters({
				configId: 'test-config-id',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(false);
		});
	});

	describe('all map types', () => {
		const testCases: Array<{ mapType: string; params: Record<string, unknown> }> = [
			{
				mapType: 'lorenz',
				params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			},
			{
				mapType: 'rossler',
				params: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 }
			},
			{
				mapType: 'henon',
				params: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 }
			},
			{
				mapType: 'lozi',
				params: { type: 'lozi', a: 0.5, b: 0.3, x0: 0, y0: 0, iterations: 2000 }
			},
			{
				mapType: 'logistic',
				params: { type: 'logistic', r: 3.5, x0: 0.5, iterations: 100 }
			},
			{
				mapType: 'newton',
				params: { type: 'newton', xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 50 }
			},
			{
				mapType: 'standard',
				params: { type: 'standard', k: 1, numP: 50, numQ: 50, iterations: 1000 }
			},
			{
				mapType: 'bifurcation-logistic',
				params: { type: 'bifurcation-logistic', rMin: 2.5, rMax: 4, maxIterations: 1000 }
			},
			{
				mapType: 'bifurcation-henon',
				params: {
					type: 'bifurcation-henon',
					aMin: 0.5,
					aMax: 1.5,
					b: 0.3,
					maxIterations: 1000
				}
			},
			{
				mapType: 'chaos-esthetique',
				params: { type: 'chaos-esthetique', a: 1.5, b: 0.5, x0: 0, y0: 0, iterations: 5000 }
			},
			{
				mapType: 'lyapunov',
				params: {
					type: 'lyapunov',
					rMin: 2,
					rMax: 4,
					iterations: 1000,
					transientIterations: 100
				}
			}
		];

		test.each(testCases)(
			'parses valid $mapType parameters correctly',
			({ mapType, params }) => {
				const configParam = encodeURIComponent(JSON.stringify(params));

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const result = parseConfigParam({ mapType: mapType as any, configParam });

				expect(result.ok).toBe(true);
			}
		);
	});
});

describe('loadSharedConfigParameters', () => {
	describe('API loading', () => {
		test('loads parameters from shared API successfully', async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({
					mapType: 'lorenz',
					parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
				})
			};

			const mockFetch = createMockFetch(() => Promise.resolve(mockResponse as Response));

			const result = await loadSharedConfigParameters({
				shareCode: 'test-share-code',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.parameters.sigma).toBe(10);
				expect(result.source).toBe('sharedApi');
			}
		});

		test('returns specific error for expired share (410)', async () => {
			const mockResponse = {
				ok: false,
				status: 410
			};

			const mockFetch = createMockFetch(() => Promise.resolve(mockResponse as Response));

			const result = await loadSharedConfigParameters({
				shareCode: 'test-share-code',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBe('This shared configuration has expired');
				expect(result.errors[0]).toBe('This shared configuration has expired');
			}
		});

		test('returns error with status code for non-410 errors', async () => {
			const mockResponse = {
				ok: false,
				status: 404
			};

			const mockFetch = createMockFetch(() => Promise.resolve(mockResponse as Response));

			const result = await loadSharedConfigParameters({
				shareCode: 'test-share-code',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain('Failed to load shared configuration');
				expect(result.error).toContain('404');
				expect(result.errors[0]).toContain('Failed to load shared configuration');
				expect(result.errors[0]).toContain('404');
			}
		});

		test('returns error for invalid map type in response', async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({
					mapType: 'henon', // Different from requested
					parameters: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 }
				})
			};

			const mockFetch = createMockFetch(() => Promise.resolve(mockResponse as Response));

			const result = await loadSharedConfigParameters({
				shareCode: 'test-share-code',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBe('Invalid shared configuration data');
			}
		});

		test('returns error for missing or invalid data', async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({
					mapType: 'lorenz'
					// Missing parameters
				})
			};

			const mockFetch = createMockFetch(() => Promise.resolve(mockResponse as Response));

			const result = await loadSharedConfigParameters({
				shareCode: 'test-share-code',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBe('Invalid shared configuration data');
			}
		});

		test('returns error for invalid parameters', async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({
					mapType: 'lorenz',
					parameters: { type: 'lorenz', sigma: 'invalid' } // Invalid parameter type
				})
			};

			const mockFetch = createMockFetch(() => Promise.resolve(mockResponse as Response));

			const result = await loadSharedConfigParameters({
				shareCode: 'test-share-code',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBe('Invalid parameters structure');
				expect(result.validationErrors).toBeDefined();
			}
		});

		test('handles fetch exceptions gracefully', async () => {
			const mockFetch = createMockFetch(() => Promise.reject(new Error('Network error')));

			const result = await loadSharedConfigParameters({
				shareCode: 'test-share-code',
				mapType: 'lorenz',
				base: '',
				fetchFn: mockFetch
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBe('Failed to load shared configuration (network error)');
				expect(result.errors[0]).toBe(
					'Failed to load shared configuration (network error)'
				);
			}
		});
	});
});
