import { describe, expect, it, vi, afterEach } from 'vitest';
import { base64Encode, base64Decode, decodeComparisonState } from './comparison-url-state';

describe('base64Decode – Buffer fallback path', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('uses Buffer when atob is not available', () => {
		// Stub atob out so the function falls through to the Buffer path
		vi.stubGlobal('atob', undefined);

		const original = JSON.stringify({ sigma: 10, rho: 28, beta: 2.667 });
		const encoded = Buffer.from(original, 'utf8').toString('base64');
		const result = base64Decode(encoded);
		expect(result).toBe(original);
	});

	it('throws when neither atob nor Buffer is available', () => {
		vi.stubGlobal('atob', undefined);
		const originalBuffer = global.Buffer;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(global as any).Buffer = undefined;

		try {
			expect(() => base64Decode('dGVzdA==')).toThrow(
				'No base64 decoding method available in current environment'
			);
		} finally {
			global.Buffer = originalBuffer;
		}
	});
});

describe('base64Encode – Buffer fallback path', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('uses Buffer when btoa is not available', () => {
		vi.stubGlobal('btoa', undefined);

		const original = 'hello world';
		const encoded = base64Encode(original);
		// Should still produce a valid base64 string that can be decoded
		const decoded = Buffer.from(encoded, 'base64').toString('utf8');
		expect(decoded).toBe(original);
	});

	it('throws when neither btoa nor Buffer is available', () => {
		vi.stubGlobal('btoa', undefined);
		const originalBuffer = global.Buffer;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(global as any).Buffer = undefined;

		try {
			expect(() => base64Encode('test')).toThrow(
				'No base64 encoding method available in current environment'
			);
		} finally {
			global.Buffer = originalBuffer;
		}
	});
});

describe('decodeComparisonState – validation failure branch', () => {
	it('falls back to defaults when decoded params fail parameter validation', () => {
		// Encode JSON that is structurally wrong for lorenz (missing rho and beta)
		const invalidParams = JSON.stringify({ sigma: 10 }); // missing rho, beta
		const encoded = Buffer.from(invalidParams, 'utf8').toString('base64');
		const url = new URL(
			`http://localhost/lorenz/compare?compare=true&left=${encoded}&right=${encoded}`
		);
		const state = decodeComparisonState(url, 'lorenz');
		expect(state).not.toBeNull();
		// Should fall back to lorenz defaults
		expect(state!.left.type).toBe('lorenz');
		expect(state!.right.type).toBe('lorenz');
	});

	it('falls back to defaults when decoded params have non-number values', () => {
		// Encode params with a string where a number is expected
		const invalidParams = JSON.stringify({ sigma: 'bad', rho: 28, beta: 2.667 });
		const encoded = Buffer.from(invalidParams, 'utf8').toString('base64');
		const url = new URL(
			`http://localhost/lorenz/compare?compare=true&left=${encoded}&right=${encoded}`
		);
		const state = decodeComparisonState(url, 'lorenz');
		expect(state).not.toBeNull();
		expect(state!.left.type).toBe('lorenz');
	});
});
