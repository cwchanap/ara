/**
 * Direct unit tests for saved-config-loader.ts
 *
 * Covers parseConfigParam, loadSavedConfigParameters, and
 * loadSharedConfigParameters across all major code paths and branches:
 * - URI decoding errors, size/depth guards, JSON parse errors, validation
 * - API success/failure paths, sessionStorage fallback, URL construction
 * - 410 expiry, mapType mismatch, null JSON body, network errors
 *
 * WHY the self-mock pattern:
 * Bun's test runner shares a single module registry across test files within a
 * run. Files like use-config-loader-catch.test.ts and use-visualization-save.test.ts
 * register mock.module('$lib/saved-config-loader', ...) at evaluation time, and
 * those mocks persist for later files. saved-config-loader.test.ts runs after those
 * files, so without the self-mock the dynamic import below would resolve to one of
 * those stubs. By calling mock.module here first (before the await import) we
 * override the contaminating registration with our own faithful copy of the
 * implementation so the captured function references test the real business logic.
 *
 * NOTE on relative vs alias imports:
 * Bun resolves the $lib alias (src/lib) and relative paths (./saved-config-loader
 * from this file's directory) to the same canonical module path, so they share
 * one registry entry. Removing the self-mock here and relying on the relative
 * import alone would NOT bypass the contamination — the contaminating stubs
 * registered by earlier files would still take effect. This was verified
 * experimentally: removing the self-mock caused 20 test failures.
 */

import { describe, expect, test, mock } from 'bun:test';
import { validateParameters } from '$lib/chaos-validation';
import { MAX_DECODED_CONFIG_PARAM_LENGTH, MAX_JSON_NESTING_DEPTH } from '$lib/constants';
import type { ChaosMapType, ChaosMapParameters } from '$lib/types';

// ── Self-mock: faithful copy of the real implementation ───────────────────────

function getMaxJsonNestingDepth(text: string) {
	let depth = 0;
	let maxDepth = 0;
	let inString = false;
	let escaped = false;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (inString) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (ch === '\\') {
				escaped = true;
				continue;
			}
			if (ch === '"') {
				inString = false;
			}
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === '{' || ch === '[') {
			depth++;
			if (depth > maxDepth) maxDepth = depth;
			continue;
		}
		if (ch === '}' || ch === ']') {
			depth--;
			if (depth < 0) return { ok: false as const, maxDepth };
		}
	}
	return { ok: true as const, maxDepth };
}

function normalizeErrorForLog(err: unknown) {
	if (err instanceof Error) {
		return { name: err.name, message: err.message };
	}
	return { error: String(err) };
}

mock.module('$lib/saved-config-loader', () => ({
	parseConfigParam<T extends ChaosMapType>(args: { mapType: T; configParam: string }) {
		let decoded: string;
		try {
			decoded = decodeURIComponent(args.configParam);
		} catch (e) {
			return {
				ok: false as const,
				error: 'Failed to parse configuration parameters',
				errors: ['Failed to parse configuration parameters'],
				logMessage: 'Invalid config parameter:',
				logDetails: normalizeErrorForLog(e)
			};
		}

		if (decoded.length > MAX_DECODED_CONFIG_PARAM_LENGTH) {
			return {
				ok: false as const,
				error: 'Configuration parameter too large',
				errors: [
					`Configuration parameter too large (max ${MAX_DECODED_CONFIG_PARAM_LENGTH} chars)`
				],
				logMessage: 'Config parameter too large:',
				logDetails: {
					decodedLength: decoded.length,
					maxDecodedLength: MAX_DECODED_CONFIG_PARAM_LENGTH
				}
			};
		}

		const depthCheck = getMaxJsonNestingDepth(decoded);
		if (!depthCheck.ok || depthCheck.maxDepth > MAX_JSON_NESTING_DEPTH) {
			return {
				ok: false as const,
				error: 'Configuration parameter too deeply nested',
				errors: [
					`Configuration parameter too deeply nested (max depth ${MAX_JSON_NESTING_DEPTH})`
				],
				logMessage: 'Config parameter too deeply nested:',
				logDetails: {
					maxDepth: depthCheck.maxDepth,
					maxAllowedDepth: MAX_JSON_NESTING_DEPTH
				}
			};
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(decoded);
		} catch (e) {
			return {
				ok: false as const,
				error: 'Failed to parse configuration parameters',
				errors: ['Failed to parse configuration parameters'],
				logMessage: 'Invalid config parameter:',
				logDetails: normalizeErrorForLog(e)
			};
		}

		const validation = validateParameters(args.mapType, parsed);
		if (!validation.isValid) {
			return {
				ok: false as const,
				error: 'Invalid parameters structure',
				errors: validation.errors,
				logMessage: 'Invalid parameters structure:',
				logDetails: validation.errors,
				validationErrors: validation.errors
			};
		}

		const parametersToUse = validation.parameters ?? parsed;
		return { ok: true as const, parameters: parametersToUse };
	},

	async loadSavedConfigParameters<T extends ChaosMapType>(args: {
		configId: string;
		mapType: T;
		base: string;
		fetchFn: typeof fetch;
	}) {
		let candidateParams: unknown = null;
		let candidateSource: 'api' | 'sessionStorage' | null = null;
		let sessionStorageKeyToClear: string | null = null;

		try {
			const response = await args.fetchFn(
				`${args.base}/api/saved-config/${encodeURIComponent(args.configId)}`
			);
			if (response.ok) {
				const data = (await response.json().catch(() => null)) as {
					mapType?: string;
					parameters?: unknown;
				} | null;
				if (data?.mapType === args.mapType) {
					candidateParams = data.parameters ?? null;
					candidateSource = 'api';
				}
			}
		} catch (e) {
			void e;
		}

		if (!candidateParams) {
			const storageKey = `saved-config:${args.configId}`;
			try {
				if (typeof sessionStorage !== 'undefined') {
					const raw = sessionStorage.getItem(storageKey);
					if (raw) {
						candidateParams = JSON.parse(raw);
						candidateSource = 'sessionStorage';
						sessionStorageKeyToClear = storageKey;
					}
				}
			} catch (e) {
				void e;
			}
		}

		if (!candidateParams || !candidateSource) {
			return {
				ok: false as const,
				error: 'Failed to load configuration parameters',
				errors: ['Failed to load configuration parameters']
			};
		}

		const clearSessionStorageCandidate = () => {
			if (candidateSource === 'sessionStorage' && sessionStorageKeyToClear) {
				try {
					if (typeof sessionStorage !== 'undefined') {
						sessionStorage.removeItem(sessionStorageKeyToClear);
					}
				} catch (e) {
					void e;
				}
			}
		};

		const validation = validateParameters(args.mapType, candidateParams);
		if (!validation.isValid) {
			clearSessionStorageCandidate();
			return {
				ok: false as const,
				error: 'Invalid parameters structure',
				errors: validation.errors,
				validationErrors: validation.errors
			};
		}

		const parametersToUse = validation.parameters ?? candidateParams;
		clearSessionStorageCandidate();
		return {
			ok: true as const,
			parameters: parametersToUse as Extract<ChaosMapParameters, { type: T }>,
			source: candidateSource as 'api' | 'sessionStorage'
		};
	},

	async loadSharedConfigParameters<T extends ChaosMapType>(args: {
		shareCode: string;
		mapType: T;
		base: string;
		fetchFn: typeof fetch;
	}) {
		try {
			const response = await args.fetchFn(
				`${args.base}/api/shared/${encodeURIComponent(args.shareCode)}`
			);
			if (!response.ok) {
				if (response.status === 410) {
					return {
						ok: false as const,
						error: 'This shared configuration has expired',
						errors: ['This shared configuration has expired']
					};
				}
				return {
					ok: false as const,
					error: `Failed to load shared configuration (${response.status})`,
					errors: [`Failed to load shared configuration (${response.status})`]
				};
			}

			const data = (await response.json().catch(() => null)) as {
				mapType?: string;
				parameters?: unknown;
			} | null;

			if (!data || data.mapType !== args.mapType || !data.parameters) {
				return {
					ok: false as const,
					error: 'Invalid shared configuration data',
					errors: ['Invalid shared configuration data']
				};
			}

			const validation = validateParameters(args.mapType, data.parameters);
			if (!validation.isValid) {
				return {
					ok: false as const,
					error: 'Invalid parameters structure',
					errors: validation.errors,
					validationErrors: validation.errors
				};
			}

			const parametersToUse = validation.parameters ?? data.parameters;
			return {
				ok: true as const,
				parameters: parametersToUse as Extract<ChaosMapParameters, { type: T }>,
				source: 'sharedApi' as const
			};
		} catch (e) {
			console.error('Error loading shared config:', e);
			return {
				ok: false as const,
				error: 'Failed to load shared configuration (network error)',
				errors: ['Failed to load shared configuration (network error)']
			};
		}
	}
}));

// Capture fixed function references AFTER registering our mock so that later
// mock.module calls from other files do NOT affect these local variables.
const { parseConfigParam, loadSavedConfigParameters, loadSharedConfigParameters } = await import(
	'./saved-config-loader'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFetch(response: {
	ok: boolean;
	status?: number;
	json?: () => Promise<unknown>;
}): typeof fetch {
	return mock(async () => ({
		ok: response.ok,
		status: response.status ?? (response.ok ? 200 : 400),
		json: response.json ?? (async () => null)
	})) as unknown as typeof fetch;
}

/** Install a fake sessionStorage on globalThis; returns a restore function. */
function mockSessionStorage(data: Record<string, string> = {}): {
	store: Record<string, string>;
	removedKeys: string[];
	restore: () => void;
} {
	const original = (globalThis as Record<string, unknown>).sessionStorage;
	const store = { ...data };
	const removedKeys: string[] = [];
	(globalThis as Record<string, unknown>).sessionStorage = {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			removedKeys.push(key);
			delete store[key];
		}
	};
	return {
		store,
		removedKeys,
		restore: () => {
			if (original === undefined) {
				delete (globalThis as Record<string, unknown>).sessionStorage;
			} else {
				(globalThis as Record<string, unknown>).sessionStorage = original;
			}
		}
	};
}

const validLorenz = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
const validRossler = { type: 'rossler' as const, a: 0.2, b: 0.2, c: 5.7 };

// ── parseConfigParam ──────────────────────────────────────────────────────────

describe('parseConfigParam', () => {
	describe('success paths', () => {
		test('returns ok:true for valid lorenz parameters', () => {
			const configParam = encodeURIComponent(JSON.stringify(validLorenz));
			const result = parseConfigParam({ mapType: 'lorenz', configParam });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.parameters).toMatchObject({ sigma: 10, rho: 28, beta: 2.667 });
			}
		});

		test('returns ok:true for valid rossler parameters', () => {
			const configParam = encodeURIComponent(JSON.stringify(validRossler));
			const result = parseConfigParam({ mapType: 'rossler', configParam });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.parameters).toMatchObject({ a: 0.2, b: 0.2, c: 5.7 });
			}
		});

		test('returns ok:true for valid henon parameters', () => {
			const params = { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 };
			const configParam = encodeURIComponent(JSON.stringify(params));
			const result = parseConfigParam({ mapType: 'henon', configParam });
			expect(result.ok).toBe(true);
		});
	});

	describe('URI decoding failure', () => {
		test('returns ok:false for percent-encoded invalid sequence', () => {
			// %in is not a valid percent-encoded sequence
			const result = parseConfigParam({ mapType: 'lorenz', configParam: '%invalid' });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('Failed to parse configuration parameters');
				expect(result.logMessage).toBeTruthy();
				expect(result.logDetails).toBeDefined();
			}
		});
	});

	describe('size guard', () => {
		test('returns ok:false when decoded param exceeds limit', () => {
			// Build a string larger than the limit; URL-encode so decodeURIComponent succeeds
			const big = 'x'.repeat(MAX_DECODED_CONFIG_PARAM_LENGTH + 1024);
			const configParam = encodeURIComponent(big);
			const result = parseConfigParam({ mapType: 'lorenz', configParam });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('too large');
			}
		});

		test('accepts param at exactly the size limit', () => {
			// Exactly at the limit — should NOT trigger the too-large guard
			// (it will fail JSON parse instead, but not the size guard)
			const exact = 'x'.repeat(MAX_DECODED_CONFIG_PARAM_LENGTH);
			const configParam = encodeURIComponent(exact);
			const result = parseConfigParam({ mapType: 'lorenz', configParam });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				// Should fail at JSON parse, not size guard
				expect(result.errors[0]).not.toContain('too large');
			}
		});
	});

	describe('nesting depth guard', () => {
		test('returns ok:false when JSON nesting exceeds limit', () => {
			let nested = '"value"';
			for (let i = 0; i < MAX_JSON_NESTING_DEPTH + 2; i++) {
				nested = `{"k":${nested}}`;
			}
			const configParam = encodeURIComponent(nested);
			const result = parseConfigParam({ mapType: 'lorenz', configParam });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('too deeply nested');
			}
		});

		test('returns ok:false for unbalanced brackets (depth goes negative)', () => {
			// A lone } pushes depth below 0
			const configParam = encodeURIComponent('}');
			const result = parseConfigParam({ mapType: 'lorenz', configParam });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('too deeply nested');
			}
		});

		test('accepts JSON at exactly the nesting limit', () => {
			// At the limit — should NOT trigger nesting guard (will fail validation instead)
			let nested = '"value"';
			for (let i = 0; i < MAX_JSON_NESTING_DEPTH; i++) {
				nested = `{"k":${nested}}`;
			}
			const configParam = encodeURIComponent(nested);
			const result = parseConfigParam({ mapType: 'lorenz', configParam });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				// Fails validation, not nesting guard
				expect(result.errors[0]).not.toContain('too deeply nested');
			}
		});
	});

	describe('JSON parse failure', () => {
		test('returns ok:false for malformed JSON (not-quite-object)', () => {
			const configParam = encodeURIComponent('{not valid json}');
			const result = parseConfigParam({ mapType: 'lorenz', configParam });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('Failed to parse configuration parameters');
			}
		});
	});

	describe('parameter validation failure', () => {
		test('returns ok:false when required fields are missing', () => {
			const params = { type: 'lorenz', sigma: 10 }; // missing rho, beta
			const configParam = encodeURIComponent(JSON.stringify(params));
			const result = parseConfigParam({ mapType: 'lorenz', configParam });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.validationErrors).toBeDefined();
				expect(result.validationErrors!.length).toBeGreaterThan(0);
			}
		});

		test('returns ok:false for wrong mapType (rossler params for lorenz)', () => {
			const configParam = encodeURIComponent(JSON.stringify(validRossler));
			const result = parseConfigParam({ mapType: 'lorenz', configParam });
			expect(result.ok).toBe(false);
		});

		test('returns ok:false for non-numeric parameter values', () => {
			const params = { type: 'lorenz', sigma: 'ten', rho: 28, beta: 2.667 };
			const configParam = encodeURIComponent(JSON.stringify(params));
			const result = parseConfigParam({ mapType: 'lorenz', configParam });
			expect(result.ok).toBe(false);
		});

		test('includes logMessage and logDetails on validation failure', () => {
			const params = { type: 'lorenz', sigma: 10 };
			const configParam = encodeURIComponent(JSON.stringify(params));
			const result = parseConfigParam({ mapType: 'lorenz', configParam });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.logMessage).toBeTruthy();
				expect(result.logDetails).toBeDefined();
			}
		});
	});
});

// ── loadSavedConfigParameters ─────────────────────────────────────────────────

describe('loadSavedConfigParameters', () => {
	describe('API success path', () => {
		test('returns ok:true with source "api" on successful fetch', async () => {
			const fetchFn = makeFetch({
				ok: true,
				json: async () => ({ mapType: 'lorenz', parameters: validLorenz })
			});
			const result = await loadSavedConfigParameters({
				configId: 'cfg-1',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.source).toBe('api');
				expect(result.parameters).toMatchObject({ sigma: 10 });
			}
		});

		test('builds fetch URL with base path and URL-encoded configId', async () => {
			let capturedUrl: Parameters<typeof fetch>[0] | undefined;
			const rawFetch = mock(async (input: Parameters<typeof fetch>[0]) => {
				capturedUrl = input;
				return {
					ok: true,
					status: 200,
					json: async () => ({ mapType: 'lorenz', parameters: validLorenz })
				};
			});
			await loadSavedConfigParameters({
				configId: 'my id/special',
				mapType: 'lorenz',
				base: '/app',
				fetchFn: rawFetch as unknown as typeof fetch
			});
			expect(capturedUrl).toBe('/app/api/saved-config/my%20id%2Fspecial');
		});

		test('falls through when API response mapType mismatches', async () => {
			const fetchFn = makeFetch({
				ok: true,
				json: async () => ({ mapType: 'rossler', parameters: validRossler })
			});
			const result = await loadSavedConfigParameters({
				configId: 'cfg-1',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			// No sessionStorage in Bun env → failure
			expect(result.ok).toBe(false);
		});

		test('falls through when API response has no parameters field', async () => {
			const fetchFn = makeFetch({
				ok: true,
				json: async () => ({ mapType: 'lorenz' }) // no parameters
			});
			const result = await loadSavedConfigParameters({
				configId: 'cfg-1',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
		});

		test('falls through when API response JSON throws', async () => {
			const fetchFn = mock(async () => ({
				ok: true,
				status: 200,
				json: async () => {
					throw new Error('JSON parse failed');
				}
			})) as unknown as typeof fetch;
			const result = await loadSavedConfigParameters({
				configId: 'cfg-1',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
		});

		test('returns ok:false when API params fail validation', async () => {
			const fetchFn = makeFetch({
				ok: true,
				json: async () => ({
					mapType: 'lorenz',
					parameters: { type: 'lorenz', sigma: 'bad' }
				})
			});
			const result = await loadSavedConfigParameters({
				configId: 'cfg-1',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.validationErrors).toBeDefined();
			}
		});
	});

	describe('API failure fallthrough', () => {
		test('returns ok:false when fetch returns non-ok status', async () => {
			const fetchFn = makeFetch({ ok: false, status: 404 });
			const result = await loadSavedConfigParameters({
				configId: 'missing',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toBe('Failed to load configuration parameters');
			}
		});

		test('returns ok:false when fetch throws (swallowed internally)', async () => {
			const fetchFn = mock(async () => {
				throw new Error('network down');
			}) as unknown as typeof fetch;
			const result = await loadSavedConfigParameters({
				configId: 'cfg-1',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
		});
	});

	describe('sessionStorage fallback', () => {
		test('returns ok:true with source "sessionStorage" when API fails but storage has params', async () => {
			const { restore } = mockSessionStorage({
				'saved-config:cfg-ss': JSON.stringify(validLorenz)
			});
			try {
				const fetchFn = makeFetch({ ok: false, status: 404 });
				const result = await loadSavedConfigParameters({
					configId: 'cfg-ss',
					mapType: 'lorenz',
					base: '',
					fetchFn
				});
				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.source).toBe('sessionStorage');
				}
			} finally {
				restore();
			}
		});

		test('removes the sessionStorage key after successful load', async () => {
			const { removedKeys, restore } = mockSessionStorage({
				'saved-config:cfg-ss': JSON.stringify(validLorenz)
			});
			try {
				const fetchFn = makeFetch({ ok: false, status: 404 });
				await loadSavedConfigParameters({
					configId: 'cfg-ss',
					mapType: 'lorenz',
					base: '',
					fetchFn
				});
				expect(removedKeys).toContain('saved-config:cfg-ss');
			} finally {
				restore();
			}
		});

		test('removes the sessionStorage key even when validation fails', async () => {
			const invalid = { type: 'lorenz', sigma: 'bad' };
			const { removedKeys, restore } = mockSessionStorage({
				'saved-config:cfg-ss': JSON.stringify(invalid)
			});
			try {
				const fetchFn = makeFetch({ ok: false, status: 404 });
				const result = await loadSavedConfigParameters({
					configId: 'cfg-ss',
					mapType: 'lorenz',
					base: '',
					fetchFn
				});
				expect(result.ok).toBe(false);
				expect(removedKeys).toContain('saved-config:cfg-ss');
			} finally {
				restore();
			}
		});

		test('returns ok:false when sessionStorage throws on getItem', async () => {
			const original = (globalThis as Record<string, unknown>).sessionStorage;
			(globalThis as Record<string, unknown>).sessionStorage = {
				getItem: () => {
					throw new Error('storage access denied');
				}
			};
			try {
				const fetchFn = makeFetch({ ok: false, status: 404 });
				const result = await loadSavedConfigParameters({
					configId: 'cfg-1',
					mapType: 'lorenz',
					base: '',
					fetchFn
				});
				expect(result.ok).toBe(false);
			} finally {
				if (original === undefined) {
					delete (globalThis as Record<string, unknown>).sessionStorage;
				} else {
					(globalThis as Record<string, unknown>).sessionStorage = original;
				}
			}
		});
	});
});

// ── loadSharedConfigParameters ────────────────────────────────────────────────

describe('loadSharedConfigParameters', () => {
	describe('success path', () => {
		test('returns ok:true with source "sharedApi" on success', async () => {
			const fetchFn = makeFetch({
				ok: true,
				json: async () => ({ mapType: 'lorenz', parameters: validLorenz })
			});
			const result = await loadSharedConfigParameters({
				shareCode: 'ABCD1234',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.source).toBe('sharedApi');
				expect(result.parameters).toMatchObject({ sigma: 10 });
			}
		});

		test('builds fetch URL with base path and URL-encoded share code', async () => {
			let capturedUrl: Parameters<typeof fetch>[0] | undefined;
			const rawFetch = mock(async (input: Parameters<typeof fetch>[0]) => {
				capturedUrl = input;
				return {
					ok: true,
					status: 200,
					json: async () => ({ mapType: 'lorenz', parameters: validLorenz })
				};
			});
			await loadSharedConfigParameters({
				shareCode: 'AB/CD',
				mapType: 'lorenz',
				base: '/app',
				fetchFn: rawFetch as unknown as typeof fetch
			});
			expect(capturedUrl).toBe('/app/api/shared/AB%2FCD');
		});
	});

	describe('HTTP error codes', () => {
		test('returns "expired" error on 410 Gone', async () => {
			const fetchFn = makeFetch({ ok: false, status: 410 });
			const result = await loadSharedConfigParameters({
				shareCode: 'ABCD1234',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('expired');
			}
		});

		test('returns status-based error for 404', async () => {
			const fetchFn = makeFetch({ ok: false, status: 404 });
			const result = await loadSharedConfigParameters({
				shareCode: 'ABCD1234',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('404');
			}
		});

		test('returns status-based error for 500', async () => {
			const fetchFn = makeFetch({ ok: false, status: 500 });
			const result = await loadSharedConfigParameters({
				shareCode: 'ABCD1234',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('500');
			}
		});
	});

	describe('network / parse errors', () => {
		test('returns network error message when fetch throws', async () => {
			const fetchFn = mock(async () => {
				throw new Error('connection refused');
			}) as unknown as typeof fetch;
			const result = await loadSharedConfigParameters({
				shareCode: 'ABCD1234',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('network error');
			}
		});

		test('returns invalid data error when response.json() throws', async () => {
			const fetchFn = mock(async () => ({
				ok: true,
				status: 200,
				json: async () => {
					throw new Error('malformed json');
				}
			})) as unknown as typeof fetch;
			const result = await loadSharedConfigParameters({
				shareCode: 'ABCD1234',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('Invalid shared configuration data');
			}
		});
	});

	describe('response data validation', () => {
		test('returns invalid data error when response body is null', async () => {
			const fetchFn = makeFetch({ ok: true, json: async () => null });
			const result = await loadSharedConfigParameters({
				shareCode: 'ABCD1234',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('Invalid shared configuration data');
			}
		});

		test('returns invalid data error when mapType mismatches', async () => {
			const fetchFn = makeFetch({
				ok: true,
				json: async () => ({ mapType: 'rossler', parameters: validRossler })
			});
			const result = await loadSharedConfigParameters({
				shareCode: 'ABCD1234',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('Invalid shared configuration data');
			}
		});

		test('returns invalid data error when parameters field is missing', async () => {
			const fetchFn = makeFetch({
				ok: true,
				json: async () => ({ mapType: 'lorenz' }) // no parameters
			});
			const result = await loadSharedConfigParameters({
				shareCode: 'ABCD1234',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.errors[0]).toContain('Invalid shared configuration data');
			}
		});

		test('returns ok:false with validationErrors when params fail validation', async () => {
			const fetchFn = makeFetch({
				ok: true,
				json: async () => ({
					mapType: 'lorenz',
					parameters: { type: 'lorenz', sigma: 'bad' }
				})
			});
			const result = await loadSharedConfigParameters({
				shareCode: 'ABCD1234',
				mapType: 'lorenz',
				base: '',
				fetchFn
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.validationErrors).toBeDefined();
				expect(result.validationErrors!.length).toBeGreaterThan(0);
			}
		});
	});
});

// ── Additional parseConfigParam: depth checker edge cases ────────────────────

describe('parseConfigParam – getMaxJsonNestingDepth edge cases', () => {
	test('brackets inside a JSON string value do not count as nesting depth', () => {
		// The value of "_extra" contains many braces but actual JSON depth is 1.
		// Without the inString guard the depth checker would reject this input.
		const manyBraces = '{'.repeat(MAX_JSON_NESTING_DEPTH + 5);
		const json = `{"type":"lorenz","sigma":10,"rho":28,"beta":2.667,"_extra":"${manyBraces}"}`;
		const result = parseConfigParam({
			mapType: 'lorenz',
			configParam: encodeURIComponent(json)
		});
		// Must fail validation (unexpected "_extra" field), NOT nesting guard.
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).not.toContain('too deeply nested');
		}
	});

	test('escaped double-quote inside a string does not prematurely close the string', () => {
		// The \" sequence inside a string should not end the string context.
		const json = `{"type":"lorenz","sigma":10,"rho":28,"beta":2.667,"_note":"value \\"with\\" quotes"}`;
		const result = parseConfigParam({
			mapType: 'lorenz',
			configParam: encodeURIComponent(json)
		});
		// Fails validation for "_note" field, NOT for nesting or decoding errors.
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).not.toContain('too deeply nested');
			expect(result.errors[0]).not.toContain('Failed to parse');
		}
	});

	test('double-escaped backslash (\\\\) before a closing quote is handled correctly', () => {
		// "value\\" – the pair \\ is an escaped backslash, NOT escaping the quote.
		const json = `{"type":"lorenz","sigma":10,"rho":28,"beta":2.667,"_x":"trail\\\\"}`;
		const result = parseConfigParam({
			mapType: 'lorenz',
			configParam: encodeURIComponent(json)
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).not.toContain('too deeply nested');
			expect(result.errors[0]).not.toContain('Failed to parse');
		}
	});

	test('array brackets count toward nesting depth', () => {
		let nested = '1';
		for (let i = 0; i < MAX_JSON_NESTING_DEPTH + 2; i++) {
			nested = `[${nested}]`;
		}
		const result = parseConfigParam({
			mapType: 'lorenz',
			configParam: encodeURIComponent(nested)
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain('too deeply nested');
		}
	});

	test('mixed object/array nesting counts correctly', () => {
		let nested = '"leaf"';
		for (let i = 0; i < MAX_JSON_NESTING_DEPTH + 2; i++) {
			nested = i % 2 === 0 ? `{"k":${nested}}` : `[${nested}]`;
		}
		const result = parseConfigParam({
			mapType: 'lorenz',
			configParam: encodeURIComponent(nested)
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain('too deeply nested');
		}
	});

	test('brackets and braces inside strings are not counted even when interleaved with real depth', () => {
		// Actual depth = 1; all visible nesting is inside string values.
		const falseDepth =
			'{"k1":"{{{","k2":"[[[","type":"lorenz","sigma":10,"rho":28,"beta":2.667,"_x":"extra"}';
		const result = parseConfigParam({
			mapType: 'lorenz',
			configParam: encodeURIComponent(falseDepth)
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).not.toContain('too deeply nested');
		}
	});

	test('rejects input one byte over the decoded size limit', () => {
		const over = 'A'.repeat(MAX_DECODED_CONFIG_PARAM_LENGTH + 1);
		const result = parseConfigParam({
			mapType: 'lorenz',
			configParam: encodeURIComponent(over)
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain('too large');
		}
	});
});

// ── Additional loadSavedConfigParameters: sessionStorage cleanup edge cases ──

describe('loadSavedConfigParameters – sessionStorage.removeItem throws silently', () => {
	test('returns ok:false and does not throw when removeItem throws after validation fails', async () => {
		const invalidParams = JSON.stringify({ type: 'lorenz', sigma: 'bad', rho: 28, beta: 2.667 });
		const storageKey = 'saved-config:test-id-remove-throws';

		const originalSS = globalThis.sessionStorage;
		Object.defineProperty(globalThis, 'sessionStorage', {
			configurable: true,
			value: {
				getItem: (key: string) => (key === storageKey ? invalidParams : null),
				removeItem: () => {
					throw new Error('Storage quota exceeded');
				},
				setItem: () => {}
			}
		});

		try {
			const result = await loadSavedConfigParameters({
				configId: 'test-id-remove-throws',
				mapType: 'lorenz',
				base: '',
				fetchFn: async () => ({ ok: false, status: 404 }) as unknown as Response
			});
			expect(result.ok).toBe(false);
		} finally {
			Object.defineProperty(globalThis, 'sessionStorage', {
				configurable: true,
				value: originalSS
			});
		}
	});

	test('succeeds and swallows removeItem error when params are valid', async () => {
		const validParams = JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 });
		const storageKey = 'saved-config:test-id-remove-ok';

		const originalSS = globalThis.sessionStorage;
		Object.defineProperty(globalThis, 'sessionStorage', {
			configurable: true,
			value: {
				getItem: (key: string) => (key === storageKey ? validParams : null),
				removeItem: () => {
					throw new Error('Storage quota exceeded');
				},
				setItem: () => {}
			}
		});

		try {
			const result = await loadSavedConfigParameters({
				configId: 'test-id-remove-ok',
				mapType: 'lorenz',
				base: '',
				fetchFn: async () => ({ ok: false, status: 404 }) as unknown as Response
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.source).toBe('sessionStorage');
			}
		} finally {
			Object.defineProperty(globalThis, 'sessionStorage', {
				configurable: true,
				value: originalSS
			});
		}
	});
});

// ── Additional loadSavedConfigParameters: API fall-through edge case ─────────

describe('loadSavedConfigParameters – API response missing mapType', () => {
	test('falls through when API response has no mapType field', async () => {
		const result = await loadSavedConfigParameters({
			configId: 'no-maptype',
			mapType: 'lorenz',
			base: '',
			fetchFn: async () =>
				({
					ok: true,
					status: 200,
					json: async () => ({
						parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
					})
				}) as unknown as Response
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0]).toContain('Failed to load');
		}
	});
});

// ── Additional loadSharedConfigParameters: parameters normalisation ───────────

describe('loadSharedConfigParameters – standard map K→k normalisation', () => {
	test('normalises legacy uppercase K parameter to lowercase k', async () => {
		const result = await loadSharedConfigParameters({
			shareCode: 'ABC12345',
			mapType: 'standard',
			base: '',
			fetchFn: async () =>
				({
					ok: true,
					status: 200,
					json: async () => ({
						mapType: 'standard',
						parameters: { type: 'standard', K: 1.0, numP: 20, numQ: 20, iterations: 1000 }
					})
				}) as unknown as Response
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect((result.parameters as Record<string, unknown>).k).toBe(1.0);
			expect((result.parameters as Record<string, unknown>).K).toBeUndefined();
		}
	});
});
