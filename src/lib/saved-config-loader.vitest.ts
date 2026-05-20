import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateParameters } from '$lib/chaos-validation';

vi.mock('$lib/chaos-validation', () => ({
	validateParameters: vi.fn()
}));

import {
	loadSavedConfigParameters,
	loadSharedConfigParameters,
	parseConfigParam
} from './saved-config-loader';

const mockValidate = vi.mocked(validateParameters);

beforeEach(() => {
	vi.restoreAllMocks();
});

function makeConfigParam(obj: Record<string, unknown>): string {
	return encodeURIComponent(JSON.stringify(obj));
}

function deepNestedJson(depth: number): string {
	let s = '';
	for (let i = 0; i < depth; i++) s += '{"a":';
	s += '1';
	for (let i = 0; i < depth; i++) s += '}';
	return s;
}

describe('parseConfigParam', () => {
	const validParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.66 };

	it('returns ok:true with valid config', () => {
		mockValidate.mockReturnValue({
			isValid: true,
			errors: [],
			parameters: validParams
		});
		const result = parseConfigParam({
			mapType: 'lorenz',
			configParam: makeConfigParam(validParams)
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.parameters).toEqual(validParams);
		}
	});

	it('returns ok:false for invalid URI encoding', () => {
		const result = parseConfigParam({ mapType: 'lorenz', configParam: '%ZZ' });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('Failed to parse configuration parameters');
			expect(result.logMessage).toBe('Invalid config parameter:');
		}
	});

	it('returns ok:false for oversized param', () => {
		const bigObj = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 2.66,
			extra: 'x'.repeat(55 * 1024)
		};
		mockValidate.mockReturnValue({ isValid: true, errors: [], parameters: bigObj });
		const result = parseConfigParam({
			mapType: 'lorenz',
			configParam: makeConfigParam(bigObj)
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('Configuration parameter too large');
		}
	});

	it('returns ok:false for deeply nested JSON', () => {
		const nested = deepNestedJson(25);
		const encoded = encodeURIComponent(nested);
		const result = parseConfigParam({ mapType: 'lorenz', configParam: encoded });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('Configuration parameter too deeply nested');
		}
	});

	it('returns ok:false for invalid JSON', () => {
		const result = parseConfigParam({
			mapType: 'lorenz',
			configParam: encodeURIComponent('not-json')
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('Failed to parse configuration parameters');
		}
	});

	it('returns ok:false when validateParameters reports invalid', () => {
		mockValidate.mockReturnValue({
			isValid: false,
			errors: ['Missing required parameters: sigma']
		});
		const result = parseConfigParam({
			mapType: 'lorenz',
			configParam: makeConfigParam({ type: 'lorenz' })
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('Invalid parameters structure');
			expect(result.errors).toContain('Missing required parameters: sigma');
		}
	});

	it('uses normalized parameters from validateParameters', () => {
		const normalized = { type: 'standard', k: 1.5, numP: 10, numQ: 10, iterations: 1000 };
		mockValidate.mockReturnValue({ isValid: true, errors: [], parameters: normalized });
		const result = parseConfigParam({
			mapType: 'standard',
			configParam: makeConfigParam({
				type: 'standard',
				K: 1.5,
				numP: 10,
				numQ: 10,
				iterations: 1000
			})
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.parameters).toEqual(normalized);
		}
	});
});

describe('loadSavedConfigParameters', () => {
	const validParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.66 };

	afterEach(() => {
		sessionStorage.clear();
	});

	it('returns ok:true from API on success', async () => {
		mockValidate.mockReturnValue({ isValid: true, errors: [], parameters: validParams });
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ mapType: 'lorenz', parameters: validParams })
		});
		const result = await loadSavedConfigParameters({
			configId: 'cfg-1',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.source).toBe('api');
			expect(result.parameters).toEqual(validParams);
		}
	});

	it('falls back to sessionStorage when API returns wrong mapType', async () => {
		mockValidate.mockReturnValue({ isValid: true, errors: [], parameters: validParams });
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ mapType: 'henon', parameters: { a: 1.4 } })
		});
		sessionStorage.setItem('saved-config:cfg-1', JSON.stringify(validParams));
		const result = await loadSavedConfigParameters({
			configId: 'cfg-1',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.source).toBe('sessionStorage');
		}
	});

	it('falls back to sessionStorage on API network error', async () => {
		mockValidate.mockReturnValue({ isValid: true, errors: [], parameters: validParams });
		const fetchFn = vi.fn().mockRejectedValue(new Error('network'));
		sessionStorage.setItem('saved-config:cfg-1', JSON.stringify(validParams));
		const result = await loadSavedConfigParameters({
			configId: 'cfg-1',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.source).toBe('sessionStorage');
		}
	});

	it('returns ok:true from sessionStorage when API not ok', async () => {
		mockValidate.mockReturnValue({ isValid: true, errors: [], parameters: validParams });
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404 });
		sessionStorage.setItem('saved-config:cfg-2', JSON.stringify(validParams));
		const result = await loadSavedConfigParameters({
			configId: 'cfg-2',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.source).toBe('sessionStorage');
		}
	});

	it('returns ok:false when no data found anywhere', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404 });
		const result = await loadSavedConfigParameters({
			configId: 'cfg-missing',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('Failed to load configuration parameters');
		}
	});

	it('returns ok:false when API returns invalid params', async () => {
		mockValidate.mockReturnValue({ isValid: false, errors: ['bad param'] });
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ mapType: 'lorenz', parameters: { wrong: true } })
		});
		const result = await loadSavedConfigParameters({
			configId: 'cfg-3',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('Invalid parameters structure');
		}
	});

	it('returns ok:false and clears sessionStorage for invalid params from sessionStorage', async () => {
		const badParams = { type: 'lorenz', sigma: 'not-a-number' };
		mockValidate.mockReturnValue({ isValid: false, errors: ['sigma must be a number'] });
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404 });
		sessionStorage.setItem('saved-config:cfg-bad', JSON.stringify(badParams));
		const result = await loadSavedConfigParameters({
			configId: 'cfg-bad',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(false);
		expect(sessionStorage.getItem('saved-config:cfg-bad')).toBeNull();
	});

	it('uses normalized parameters from validateParameters', async () => {
		const normalized = { type: 'standard', k: 2, numP: 20, numQ: 20, iterations: 500 };
		mockValidate.mockReturnValue({ isValid: true, errors: [], parameters: normalized });
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					mapType: 'standard',
					parameters: { type: 'standard', K: 2, numP: 20, numQ: 20, iterations: 500 }
				})
		});
		const result = await loadSavedConfigParameters({
			configId: 'cfg-norm',
			mapType: 'standard',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.parameters).toEqual(normalized);
		}
	});
});

describe('loadSharedConfigParameters', () => {
	const validParams = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.66 };

	it('returns ok:true on success', async () => {
		mockValidate.mockReturnValue({ isValid: true, errors: [], parameters: validParams });
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ mapType: 'lorenz', parameters: validParams })
		});
		const result = await loadSharedConfigParameters({
			shareCode: 'abc123',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.parameters).toEqual(validParams);
			expect(result.source).toBe('sharedApi');
		}
	});

	it('returns ok:false with expired message for 410', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 410 });
		const result = await loadSharedConfigParameters({
			shareCode: 'abc123',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('expired');
		}
	});

	it('returns ok:false with status for other HTTP errors', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500 });
		const result = await loadSharedConfigParameters({
			shareCode: 'abc123',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('500');
		}
	});

	it('returns ok:false for null data', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(null)
		});
		const result = await loadSharedConfigParameters({
			shareCode: 'abc123',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('Invalid shared configuration data');
		}
	});

	it('returns ok:false for mapType mismatch', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ mapType: 'henon', parameters: { a: 1.4 } })
		});
		const result = await loadSharedConfigParameters({
			shareCode: 'abc123',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('Invalid shared configuration data');
		}
	});

	it('returns ok:false for missing parameters', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ mapType: 'lorenz' })
		});
		const result = await loadSharedConfigParameters({
			shareCode: 'abc123',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('Invalid shared configuration data');
		}
	});

	it('returns ok:false on network error', async () => {
		const fetchFn = vi.fn().mockRejectedValue(new Error('Network failure'));
		const result = await loadSharedConfigParameters({
			shareCode: 'abc123',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('network error');
		}
	});

	it('returns ok:false for invalid params from API', async () => {
		mockValidate.mockReturnValue({ isValid: false, errors: ['bad'] });
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ mapType: 'lorenz', parameters: { sigma: 'bad' } })
		});
		const result = await loadSharedConfigParameters({
			shareCode: 'abc123',
			mapType: 'lorenz',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('Invalid parameters structure');
		}
	});

	it('uses normalized parameters from validateParameters', async () => {
		const normalized = { type: 'standard', k: 1, numP: 5, numQ: 5, iterations: 100 };
		mockValidate.mockReturnValue({ isValid: true, errors: [], parameters: normalized });
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					mapType: 'standard',
					parameters: { type: 'standard', K: 1, numP: 5, numQ: 5, iterations: 100 }
				})
		});
		const result = await loadSharedConfigParameters({
			shareCode: 'xyz',
			mapType: 'standard',
			base: '',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.parameters).toEqual(normalized);
		}
	});
});
