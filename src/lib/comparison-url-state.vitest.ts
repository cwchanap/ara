import { describe, expect, it } from 'vitest';
import {
	base64Encode,
	base64Decode,
	getDefaultParameters,
	encodeComparisonState,
	buildComparisonUrl,
	decodeComparisonState
} from './comparison-url-state';

const lorenzLeft = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
const lorenzRight = { type: 'lorenz' as const, sigma: 12, rho: 30, beta: 3.0 };

describe('base64Encode / base64Decode', () => {
	it('round-trips ASCII strings', () => {
		const original = 'hello world';
		expect(base64Decode(base64Encode(original))).toBe(original);
	});

	it('round-trips JSON strings', () => {
		const json = JSON.stringify({ sigma: 10, rho: 28, beta: 2.667 });
		expect(base64Decode(base64Encode(json))).toBe(json);
	});

	it('round-trips unicode strings', () => {
		const unicode = 'Rössler Hénoné';
		expect(base64Decode(base64Encode(unicode))).toBe(unicode);
	});
});

describe('getDefaultParameters', () => {
	it('returns lorenz defaults', () => {
		const p = getDefaultParameters('lorenz');
		expect(p.type).toBe('lorenz');
	});

	it('returns rossler defaults', () => {
		const p = getDefaultParameters('rossler');
		expect(p.type).toBe('rossler');
	});

	it('returns henon defaults', () => {
		const p = getDefaultParameters('henon');
		expect(p.type).toBe('henon');
	});

	it('returns lozi defaults', () => {
		const p = getDefaultParameters('lozi');
		expect(p.type).toBe('lozi');
	});

	it('returns logistic defaults', () => {
		const p = getDefaultParameters('logistic');
		expect(p.type).toBe('logistic');
	});

	it('returns newton defaults', () => {
		const p = getDefaultParameters('newton');
		expect(p.type).toBe('newton');
	});

	it('returns standard defaults', () => {
		const p = getDefaultParameters('standard');
		expect(p.type).toBe('standard');
	});

	it('returns bifurcation-logistic defaults', () => {
		const p = getDefaultParameters('bifurcation-logistic');
		expect(p.type).toBe('bifurcation-logistic');
	});

	it('returns bifurcation-henon defaults', () => {
		const p = getDefaultParameters('bifurcation-henon');
		expect(p.type).toBe('bifurcation-henon');
	});

	it('returns chaos-esthetique defaults', () => {
		const p = getDefaultParameters('chaos-esthetique');
		expect(p.type).toBe('chaos-esthetique');
	});

	it('returns lyapunov defaults', () => {
		const p = getDefaultParameters('lyapunov');
		expect(p.type).toBe('lyapunov');
	});
});

describe('encodeComparisonState', () => {
	it('returns URLSearchParams with compare=true', () => {
		const params = encodeComparisonState({
			compare: true,
			left: lorenzLeft,
			right: lorenzRight
		});
		expect(params.get('compare')).toBe('true');
	});

	it('encodes left and right parameters', () => {
		const params = encodeComparisonState({
			compare: true,
			left: lorenzLeft,
			right: lorenzRight
		});
		expect(params.get('left')).toBeTruthy();
		expect(params.get('right')).toBeTruthy();
	});
});

describe('buildComparisonUrl', () => {
	it('builds a correct comparison URL', () => {
		const url = buildComparisonUrl('', 'lorenz', {
			compare: true,
			left: lorenzLeft,
			right: lorenzRight
		});
		expect(url).toContain('/lorenz/compare');
		expect(url).toContain('compare=true');
	});

	it('handles base path with trailing slash', () => {
		const url = buildComparisonUrl('/app/', 'lorenz', {
			compare: true,
			left: lorenzLeft,
			right: lorenzRight
		});
		expect(url).toContain('/app/lorenz/compare');
	});
});

describe('decodeComparisonState', () => {
	it('returns null when compare is not true', () => {
		const url = new URL('http://localhost/lorenz/compare');
		expect(decodeComparisonState(url, 'lorenz')).toBeNull();
	});

	it('returns default params when left/right are missing', () => {
		const url = new URL('http://localhost/lorenz/compare?compare=true');
		const state = decodeComparisonState(url, 'lorenz');
		expect(state).not.toBeNull();
		expect(state!.compare).toBe(true);
		expect(state!.left.type).toBe('lorenz');
		expect(state!.right.type).toBe('lorenz');
	});

	it('round-trips comparison state via encode/decode', () => {
		const original = { compare: true, left: lorenzLeft, right: lorenzRight };
		const encoded = encodeComparisonState(original);
		const url = new URL(`http://localhost/lorenz/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'lorenz');

		expect(decoded).not.toBeNull();
		expect(decoded!.left).toMatchObject({ sigma: 10, rho: 28 });
		expect(decoded!.right).toMatchObject({ sigma: 12, rho: 30 });
	});

	it('falls back to defaults when left param is invalid', () => {
		const url = new URL('http://localhost/lorenz/compare?compare=true&left=!!!@@@&right=%%%');
		const state = decodeComparisonState(url, 'lorenz');
		expect(state).not.toBeNull();
		// Falls back to defaults
		expect(state!.left.type).toBe('lorenz');
	});

	it('round-trips henon comparison state', () => {
		const henonLeft = { type: 'henon' as const, a: 1.4, b: 0.3, iterations: 2000 };
		const henonRight = { type: 'henon' as const, a: 1.2, b: 0.25, iterations: 3000 };
		const original = { compare: true, left: henonLeft, right: henonRight };
		const encoded = encodeComparisonState(original);
		const url = new URL(`http://localhost/henon/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'henon');

		expect(decoded).not.toBeNull();
		expect(decoded!.left).toMatchObject({ a: 1.4, b: 0.3 });
		expect(decoded!.right).toMatchObject({ a: 1.2, b: 0.25 });
	});

	it('round-trips standard map with k parameter', () => {
		const standardLeft = {
			type: 'standard' as const,
			k: 0.97,
			numP: 20,
			numQ: 20,
			iterations: 20000
		};
		const standardRight = {
			type: 'standard' as const,
			k: 1.5,
			numP: 15,
			numQ: 15,
			iterations: 10000
		};
		const original = { compare: true, left: standardLeft, right: standardRight };
		const encoded = encodeComparisonState(original);
		const url = new URL(`http://localhost/standard/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'standard');

		expect(decoded).not.toBeNull();
		expect(decoded!.left).toMatchObject({ k: 0.97 });
		expect(decoded!.right).toMatchObject({ k: 1.5 });
	});

	it('normalizes legacy uppercase K to lowercase k for standard map', () => {
		const legacyPayload = base64Encode(
			JSON.stringify({ K: 0.97, numP: 20, numQ: 20, iterations: 20000 })
		);
		const url = new URL(
			`http://localhost/standard/compare?compare=true&left=${legacyPayload}&right=${legacyPayload}`
		);
		const decoded = decodeComparisonState(url, 'standard');
		expect(decoded).not.toBeNull();
		expect(decoded!.left).toMatchObject({ k: 0.97 });
		expect(decoded!.left).not.toHaveProperty('K');
	});
});
