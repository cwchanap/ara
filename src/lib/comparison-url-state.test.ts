/**
 * Tests for comparison-url-state.ts
 *
 * Tests the URL state management functions for comparison mode.
 */

import { describe, expect, test } from 'bun:test';
import {
	getDefaultParameters,
	encodeComparisonState,
	decodeComparisonState,
	swapParameters,
	createComparisonStateFromCurrent,
	buildComparisonUrl,
	base64Encode,
	base64Decode
} from './comparison-url-state';
import type { ComparisonURLState } from './comparison-url-state';
import type {
	LorenzParameters,
	HenonParameters,
	LogisticParameters,
	StandardParameters,
	LyapunovParameters
} from './types';

describe('getDefaultParameters', () => {
	test('returns correct default parameters for lorenz', () => {
		const params = getDefaultParameters('lorenz') as LorenzParameters;
		expect(params.type).toBe('lorenz');
		expect(params.sigma).toBe(10);
		expect(params.rho).toBe(28);
		expect(params.beta).toBeCloseTo(8 / 3);
	});

	test('returns correct default parameters for rossler', () => {
		const params = getDefaultParameters('rossler');
		expect(params.type).toBe('rossler');
		expect(params).toHaveProperty('a', 0.2);
		expect(params).toHaveProperty('b', 0.2);
		expect(params).toHaveProperty('c', 5.7);
	});

	test('returns correct default parameters for henon', () => {
		const params = getDefaultParameters('henon') as HenonParameters;
		expect(params.type).toBe('henon');
		expect(params.a).toBe(1.4);
		expect(params.b).toBe(0.3);
		expect(params.iterations).toBe(2000);
	});

	test('returns correct default parameters for lozi', () => {
		const params = getDefaultParameters('lozi');
		expect(params.type).toBe('lozi');
		expect(params).toHaveProperty('a', 1.7);
		expect(params).toHaveProperty('b', 0.5);
		expect(params).toHaveProperty('x0', 0);
		expect(params).toHaveProperty('y0', 0);
		expect(params).toHaveProperty('iterations', 5000);
	});

	test('returns correct default parameters for logistic', () => {
		const params = getDefaultParameters('logistic') as LogisticParameters;
		expect(params.type).toBe('logistic');
		expect(params.r).toBe(3.9);
		expect(params.x0).toBe(0.1);
		expect(params.iterations).toBe(100);
	});

	test('returns correct default parameters for newton', () => {
		const params = getDefaultParameters('newton');
		expect(params.type).toBe('newton');
		expect(params).toHaveProperty('xMin', -2);
		expect(params).toHaveProperty('xMax', 2);
		expect(params).toHaveProperty('yMin', -2);
		expect(params).toHaveProperty('yMax', 2);
		expect(params).toHaveProperty('maxIterations', 50);
	});

	test('returns correct default parameters for standard', () => {
		const params = getDefaultParameters('standard') as StandardParameters;
		expect(params.type).toBe('standard');
		expect(params.k).toBe(0.97);
		expect(params.numP).toBe(20);
		expect(params.numQ).toBe(20);
		expect(params.iterations).toBe(20000);
	});

	test('returns correct default parameters for bifurcation-logistic', () => {
		const params = getDefaultParameters('bifurcation-logistic');
		expect(params.type).toBe('bifurcation-logistic');
		expect(params).toHaveProperty('rMin', 2.5);
		expect(params).toHaveProperty('rMax', 4.0);
		expect(params).toHaveProperty('maxIterations', 1000);
	});

	test('returns correct default parameters for bifurcation-henon', () => {
		const params = getDefaultParameters('bifurcation-henon');
		expect(params.type).toBe('bifurcation-henon');
		expect(params).toHaveProperty('aMin', 0.8);
		expect(params).toHaveProperty('aMax', 1.4);
		expect(params).toHaveProperty('b', 0.3);
		expect(params).toHaveProperty('maxIterations', 500);
	});

	test('returns correct default parameters for chaos-esthetique', () => {
		const params = getDefaultParameters('chaos-esthetique');
		expect(params.type).toBe('chaos-esthetique');
		expect(params).toHaveProperty('a', 1.4);
		expect(params).toHaveProperty('b', 0.3);
		expect(params).toHaveProperty('x0', 0);
		expect(params).toHaveProperty('y0', 0);
		expect(params).toHaveProperty('iterations', 10000);
	});

	test('returns correct default parameters for lyapunov', () => {
		const params = getDefaultParameters('lyapunov') as LyapunovParameters;
		expect(params.type).toBe('lyapunov');
		expect(params.rMin).toBe(2.5);
		expect(params.rMax).toBe(4.0);
		expect(params.iterations).toBe(100);
		expect(params.transientIterations).toBe(100);
	});
});

describe('encodeComparisonState', () => {
	test('encodes comparison state to URLSearchParams', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			right: { type: 'lorenz', sigma: 15, rho: 30, beta: 3 }
		};

		const params = encodeComparisonState(state);

		expect(params.get('compare')).toBe('true');
		expect(params.get('left')).toBeDefined();
		expect(params.get('right')).toBeDefined();
	});

	test('encoded params can be decoded back', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 },
			right: { type: 'henon', a: 1.2, b: 0.4, iterations: 3000 }
		};

		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/henon/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'henon');

		expect(decoded).not.toBeNull();
		expect(decoded!.compare).toBe(true);
		expect((decoded!.left as HenonParameters).a).toBe(1.4);
		expect((decoded!.left as HenonParameters).b).toBe(0.3);
		expect((decoded!.right as HenonParameters).a).toBe(1.2);
		expect((decoded!.right as HenonParameters).b).toBe(0.4);
	});
});

describe('decodeComparisonState', () => {
	test('returns null when compare param is not true', () => {
		const url = new URL('https://example.com/lorenz/compare');
		const result = decodeComparisonState(url, 'lorenz');
		expect(result).toBeNull();
	});

	test('returns null when compare param is false', () => {
		const url = new URL('https://example.com/lorenz/compare?compare=false');
		const result = decodeComparisonState(url, 'lorenz');
		expect(result).toBeNull();
	});

	test('uses default parameters when left/right are missing', () => {
		const url = new URL('https://example.com/lorenz/compare?compare=true');
		const result = decodeComparisonState(url, 'lorenz');

		expect(result).not.toBeNull();
		expect(result!.compare).toBe(true);
		expect((result!.left as LorenzParameters).sigma).toBe(10);
		expect((result!.left as LorenzParameters).rho).toBe(28);
	});

	test('uses default parameters for invalid base64', () => {
		const url = new URL(
			'https://example.com/lorenz/compare?compare=true&left=invalid&right=alsobad'
		);
		const result = decodeComparisonState(url, 'lorenz');

		expect(result).not.toBeNull();
		expect(result!.compare).toBe(true);
		// Should fall back to defaults
		expect((result!.left as LorenzParameters).sigma).toBe(10);
	});

	test('prefers mapType over decoded type field', () => {
		const leftPayload = base64Encode(
			JSON.stringify({ type: 'logistic', sigma: 10, rho: 28, beta: 2.667 })
		);
		const rightPayload = base64Encode(
			JSON.stringify({ type: 'logistic', sigma: 12, rho: 30, beta: 3 })
		);
		const url = new URL(
			`https://example.com/lorenz/compare?compare=true&left=${leftPayload}&right=${rightPayload}`
		);
		const result = decodeComparisonState(url, 'lorenz');

		expect(result).not.toBeNull();
		expect(result!.left.type).toBe('lorenz');
		expect(result!.right.type).toBe('lorenz');
	});

	test('decodes valid comparison state for logistic map', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'logistic', r: 3.5, x0: 0.2, iterations: 50 },
			right: { type: 'logistic', r: 3.9, x0: 0.1, iterations: 100 }
		};

		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/logistic/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'logistic');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as LogisticParameters).r).toBe(3.5);
		expect((decoded!.left as LogisticParameters).x0).toBe(0.2);
		expect((decoded!.right as LogisticParameters).r).toBe(3.9);
	});

	test('decodes valid comparison state for standard map', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'standard', k: 0.5, numP: 10, numQ: 10, iterations: 1000 },
			right: { type: 'standard', k: 1.5, numP: 15, numQ: 15, iterations: 2000 }
		};

		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/standard/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'standard');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as StandardParameters).k).toBe(0.5);
		expect((decoded!.right as StandardParameters).k).toBe(1.5);
	});
});

describe('swapParameters', () => {
	test('swaps left and right parameters', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			right: { type: 'lorenz', sigma: 15, rho: 30, beta: 3 }
		};

		const swapped = swapParameters(state);

		expect(swapped.compare).toBe(true);
		expect((swapped.left as LorenzParameters).sigma).toBe(15);
		expect((swapped.right as LorenzParameters).sigma).toBe(10);
	});

	test('double swap returns original state', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 },
			right: { type: 'henon', a: 1.2, b: 0.4, iterations: 3000 }
		};

		const doubleSwapped = swapParameters(swapParameters(state));

		expect((doubleSwapped.left as HenonParameters).a).toBe(1.4);
		expect((doubleSwapped.right as HenonParameters).a).toBe(1.2);
	});
});

describe('createComparisonStateFromCurrent', () => {
	test('creates comparison state with current params as left', () => {
		const currentParams: LorenzParameters = { type: 'lorenz', sigma: 12, rho: 25, beta: 3 };
		const state = createComparisonStateFromCurrent('lorenz', currentParams);

		expect(state.compare).toBe(true);
		expect((state.left as LorenzParameters).sigma).toBe(12);
		expect((state.left as LorenzParameters).rho).toBe(25);
		// Right should be defaults
		expect((state.right as LorenzParameters).sigma).toBe(10);
		expect((state.right as LorenzParameters).rho).toBe(28);
	});

	test('creates comparison state for henon map', () => {
		const currentParams: HenonParameters = { type: 'henon', a: 1.2, b: 0.4, iterations: 5000 };
		const state = createComparisonStateFromCurrent('henon', currentParams);

		expect(state.compare).toBe(true);
		expect((state.left as HenonParameters).a).toBe(1.2);
		expect((state.left as HenonParameters).iterations).toBe(5000);
		// Right should be defaults
		expect((state.right as HenonParameters).a).toBe(1.4);
		expect((state.right as HenonParameters).iterations).toBe(2000);
	});

	test('creates comparison state for lyapunov map', () => {
		const currentParams: LyapunovParameters = {
			type: 'lyapunov',
			rMin: 3.0,
			rMax: 3.8,
			iterations: 500,
			transientIterations: 200
		};
		const state = createComparisonStateFromCurrent('lyapunov', currentParams);

		expect(state.compare).toBe(true);
		expect((state.left as LyapunovParameters).rMin).toBe(3.0);
		expect((state.left as LyapunovParameters).rMax).toBe(3.8);
		// Right should be defaults
		expect((state.right as LyapunovParameters).rMin).toBe(2.5);
		expect((state.right as LyapunovParameters).rMax).toBe(4.0);
	});
});

describe('buildComparisonUrl', () => {
	test('builds correct URL for lorenz comparison', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			right: { type: 'lorenz', sigma: 15, rho: 30, beta: 3 }
		};

		const url = buildComparisonUrl('/app', 'lorenz', state);

		expect(url).toContain('/app/lorenz/compare?');
		expect(url).toContain('compare=true');
		expect(url).toContain('left=');
		expect(url).toContain('right=');
	});

	test('trims trailing slashes from base path', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			right: { type: 'lorenz', sigma: 15, rho: 30, beta: 3 }
		};

		const url = buildComparisonUrl('/app/', 'lorenz', state);

		expect(url).toContain('/app/lorenz/compare?');
		expect(url).not.toContain('/app//lorenz');
	});

	test('builds correct URL with empty base path', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 },
			right: { type: 'henon', a: 1.2, b: 0.4, iterations: 3000 }
		};

		const url = buildComparisonUrl('', 'henon', state);

		expect(url).toContain('/henon/compare?');
		expect(url).toContain('compare=true');
	});

	test('URL can be parsed back to state', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'logistic', r: 3.5, x0: 0.2, iterations: 50 },
			right: { type: 'logistic', r: 3.9, x0: 0.1, iterations: 100 }
		};

		const urlString = buildComparisonUrl('', 'logistic', state);
		const url = new URL(`https://example.com${urlString}`);
		const decoded = decodeComparisonState(url, 'logistic');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as LogisticParameters).r).toBe(3.5);
		expect((decoded!.right as LogisticParameters).r).toBe(3.9);
	});
});

describe('SSR-safe base64 helpers', () => {
	test('base64Encode and base64Decode handle basic strings', () => {
		const input = '{"K":0.97,"numP":20,"numQ":20,"iterations":20000}';
		const encoded = base64Encode(input);
		const decoded = base64Decode(encoded);
		expect(decoded).toBe(input);
	});

	test('base64Encode and base64Decode handle unicode strings', () => {
		const input = '{"a":"b","c":"d é 🚀"}';
		const encoded = base64Encode(input);
		const decoded = base64Decode(encoded);
		expect(decoded).toBe(input);
	});

	test('base64Encode and base64Decode are symmetric', () => {
		const inputs = [
			'{}',
			'{"a":1}',
			'{"sigma":10,"rho":28,"beta":2.6666666666666665}',
			'{"K":0.971635,"numP":10,"numQ":10,"iterations":20000}'
		];
		for (const input of inputs) {
			const encoded = base64Encode(input);
			const decoded = base64Decode(encoded);
			expect(decoded).toBe(input);
		}
	});
});

describe('round-trip encoding/decoding', () => {
	test('preserves all lorenz parameters through round-trip', () => {
		const original: ComparisonURLState = {
			compare: true,
			left: { type: 'lorenz', sigma: 10.5, rho: 28.7, beta: 2.667 },
			right: { type: 'lorenz', sigma: 15.3, rho: 30.1, beta: 3.5 }
		};

		const encoded = encodeComparisonState(original);
		const url = new URL(`https://example.com/lorenz/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'lorenz');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as LorenzParameters).sigma).toBeCloseTo(10.5);
		expect((decoded!.left as LorenzParameters).rho).toBeCloseTo(28.7);
		expect((decoded!.right as LorenzParameters).sigma).toBeCloseTo(15.3);
		expect((decoded!.right as LorenzParameters).rho).toBeCloseTo(30.1);
	});

	test('preserves all standard map parameters through round-trip', () => {
		const original: ComparisonURLState = {
			compare: true,
			left: { type: 'standard', k: 0.971, numP: 12, numQ: 15, iterations: 25000 },
			right: { type: 'standard', k: 2.5, numP: 8, numQ: 10, iterations: 10000 }
		};

		const encoded = encodeComparisonState(original);
		const url = new URL(`https://example.com/standard/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'standard');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as StandardParameters).k).toBeCloseTo(0.971);
		expect((decoded!.left as StandardParameters).numP).toBe(12);
		expect((decoded!.left as StandardParameters).numQ).toBe(15);
		expect((decoded!.left as StandardParameters).iterations).toBe(25000);
		expect((decoded!.right as StandardParameters).k).toBeCloseTo(2.5);
	});

	test('preserves bifurcation-logistic parameters through round-trip', () => {
		const original: ComparisonURLState = {
			compare: true,
			left: { type: 'bifurcation-logistic', rMin: 3.2, rMax: 3.8, maxIterations: 1500 },
			right: { type: 'bifurcation-logistic', rMin: 2.8, rMax: 4.0, maxIterations: 800 }
		};

		const encoded = encodeComparisonState(original);
		const url = new URL(
			`https://example.com/bifurcation-logistic/compare?${encoded.toString()}`
		);
		const decoded = decodeComparisonState(url, 'bifurcation-logistic');

		expect(decoded).not.toBeNull();
		expect(decoded!.left).toHaveProperty('rMin', 3.2);
		expect(decoded!.left).toHaveProperty('rMax', 3.8);
		expect(decoded!.left).toHaveProperty('maxIterations', 1500);
		expect(decoded!.right).toHaveProperty('rMin', 2.8);
	});
});
