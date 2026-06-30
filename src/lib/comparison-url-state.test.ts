/**
 * Tests for comparison-url-state.ts
 *
 * Tests the URL state management functions for comparison mode.
 */

import { describe, expect, test } from 'vitest';
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
	LyapunovParameters,
	RosslerParameters,
	LoziParameters,
	NewtonParameters,
	BifurcationHenonParameters,
	ChaosEsthetiqueParameters,
	ChuaParameters,
	DoublePendulumParameters,
	GumowskiMiraParameters
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

	test('returns correct default parameters for ikeda', () => {
		const params = getDefaultParameters('ikeda');
		expect(params.type).toBe('ikeda');
		if (params.type === 'ikeda') {
			expect(params.u).toBeCloseTo(0.918, 5);
			expect(params.x0).toBe(0.1);
			expect(params.y0).toBe(0);
			expect(params.iterations).toBe(800);
			expect(params.burnIn).toBe(100);
			expect(params.renderMode).toBe('multi');
			expect(params.seeds).toBe(250);
			expect(params.colorMode).toBe('iteration');
			expect(params.pointSize).toBe(1.5);
			expect(params.opacity).toBe(0.6);
		}
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

	test('returns correct default parameters for chua', () => {
		const params = getDefaultParameters('chua') as ChuaParameters;
		expect(params.type).toBe('chua');
		expect(params.alpha).toBe(15.6);
		expect(params.beta).toBe(28);
		expect(params.gamma).toBe(0);
		expect(params.a).toBeCloseTo(-8 / 7);
		expect(params.b).toBeCloseTo(-5 / 7);
	});

	test('returns correct default parameters for double-pendulum', () => {
		const params = getDefaultParameters('double-pendulum') as DoublePendulumParameters;
		expect(params.type).toBe('double-pendulum');
		// Defaults come from the 'classic' preset.
		expect(params.theta1).toBeCloseTo(Math.PI / 2);
		expect(params.theta2).toBeCloseTo(Math.PI / 2);
		expect(params.omega1).toBe(0);
		expect(params.omega2).toBe(0);
		expect(params.l1).toBe(1);
		expect(params.l2).toBe(1);
		expect(params.m1).toBe(1);
		expect(params.m2).toBe(1);
		expect(params.gravity).toBeCloseTo(9.81);
		expect(params.damping).toBe(0);
	});

	test('returns correct default parameters for gumowski-mira', () => {
		const params = getDefaultParameters('gumowski-mira') as GumowskiMiraParameters;
		expect(params.type).toBe('gumowski-mira');
		// Defaults come from the 'island-structure' preset.
		expect(params.mu).toBeCloseTo(0.31, 5);
		expect(params.a).toBeCloseTo(0.008, 5);
		expect(params.b).toBeCloseTo(0.05, 5);
		expect(params.x0).toBeCloseTo(0.1, 5);
		expect(params.y0).toBe(0);
		expect(params.iterations).toBe(15000);
		expect(params.burnIn).toBe(500);
		expect(params.renderMode).toBe('multi');
		expect(params.seeds).toBe(300);
		expect(params.colorMode).toBe('iteration');
		expect(params.pointSize).toBeCloseTo(1.5, 5);
		expect(params.opacity).toBeCloseTo(0.6, 5);
	});
});

describe('getDefaultParameters – persistence round-trip', () => {
	test('lorenz defaults match expected persistence values', () => {
		const params = getDefaultParameters('lorenz') as LorenzParameters;
		expect(params).toMatchObject({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 8 / 3
		});
		expect(params.sigma).toBe(10);
		expect(params.rho).toBe(28);
		expect(params.beta).toBeCloseTo(8 / 3);
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
		// Both encoded sides were present but unreadable → a correction happened.
		expect(result!.corrected).toBe(true);
	});

	test('falls back to defaults when encoded parameters fail validation', () => {
		// Encode parameters with an invalid value (sigma as string, not number)
		const invalidPayload = base64Encode(
			JSON.stringify({ sigma: 'not-a-number', rho: 28, beta: 2.667 })
		);
		const url = new URL(
			`https://example.com/lorenz/compare?compare=true&left=${invalidPayload}`
		);
		const result = decodeComparisonState(url, 'lorenz');

		expect(result).not.toBeNull();
		// left should fall back to defaults because validation failed
		expect((result!.left as LorenzParameters).sigma).toBe(10);
		expect((result!.left as LorenzParameters).rho).toBe(28);
		// Encoded left was present but failed validation → correction flagged.
		expect(result!.corrected).toBe(true);
	});

	test('corrected is false for a clean, fully-valid link', () => {
		const leftPayload = base64Encode(JSON.stringify({ sigma: 10, rho: 28, beta: 2.667 }));
		const rightPayload = base64Encode(JSON.stringify({ sigma: 14, rho: 30, beta: 3 }));
		const url = new URL(
			`https://example.com/lorenz/compare?compare=true&left=${leftPayload}&right=${rightPayload}`
		);
		const result = decodeComparisonState(url, 'lorenz');
		expect(result!.corrected).toBe(false);
	});

	test('corrected is false for a fresh compare entry with no encoded params', () => {
		// Entering compare mode without left/right is normal, not a correction.
		const url = new URL('https://example.com/lorenz/compare?compare=true');
		const result = decodeComparisonState(url, 'lorenz');
		expect(result!.corrected).toBe(false);
	});

	test('corrected is true when only one side fails to decode', () => {
		const goodPayload = base64Encode(JSON.stringify({ sigma: 10, rho: 28, beta: 2.667 }));
		const url = new URL(
			`https://example.com/lorenz/compare?compare=true&left=${goodPayload}&right=garbage!!`
		);
		const result = decodeComparisonState(url, 'lorenz');
		expect(result!.corrected).toBe(true);
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

	test('canonicalizes legacy K parameter to k for standard map', () => {
		// Create a URL with legacy "K" parameter (uppercase)
		const legacyPayload = base64Encode(
			JSON.stringify({ K: 0.5, numP: 10, numQ: 10, iterations: 1000 })
		);
		const url = new URL(
			`https://example.com/standard/compare?compare=true&left=${legacyPayload}&right=${legacyPayload}`
		);
		const decoded = decodeComparisonState(url, 'standard');

		expect(decoded).not.toBeNull();
		// Should have normalized to lowercase 'k'
		expect((decoded!.left as StandardParameters).k).toBe(0.5);
		expect(decoded!.left as unknown as Record<string, unknown>).not.toHaveProperty('K');
		expect((decoded!.right as StandardParameters).k).toBe(0.5);
		expect(decoded!.right as unknown as Record<string, unknown>).not.toHaveProperty('K');
	});

	test('removes stale K when both K and k present for standard map', () => {
		// Create a URL with both legacy "K" and new "k" parameters
		// K should be discarded, k should be kept
		const mixedPayload = base64Encode(
			JSON.stringify({ K: 0.3, k: 0.5, numP: 10, numQ: 10, iterations: 1000 })
		);
		const url = new URL(
			`https://example.com/standard/compare?compare=true&left=${mixedPayload}`
		);
		const decoded = decodeComparisonState(url, 'standard');

		expect(decoded).not.toBeNull();
		// Should keep the 'k' value, not 'K'
		expect((decoded!.left as StandardParameters).k).toBe(0.5);
		expect(decoded!.left as unknown as Record<string, unknown>).not.toHaveProperty('K');
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

	test('base64Encode uses Node.js Buffer when btoa is unavailable', () => {
		const savedBtoa = globalThis.btoa;
		(globalThis as Record<string, unknown>).btoa = undefined;
		try {
			const input = '{"test":"value"}';
			const encoded = base64Encode(input);
			const decoded = base64Decode(encoded);
			expect(decoded).toBe(input);
		} finally {
			(globalThis as Record<string, unknown>).btoa = savedBtoa;
		}
	});

	test('base64Decode uses Node.js Buffer when atob is unavailable', () => {
		const savedAtob = globalThis.atob;
		(globalThis as Record<string, unknown>).atob = undefined;
		try {
			const input = '{"test":"value"}';
			const encoded = base64Encode(input);
			const decoded = base64Decode(encoded);
			expect(decoded).toBe(input);
		} finally {
			(globalThis as Record<string, unknown>).atob = savedAtob;
		}
	});

	test('base64Encode throws when no encoding method available', () => {
		const savedBtoa = globalThis.btoa;
		const savedBuffer = globalThis.Buffer;
		(globalThis as Record<string, unknown>).btoa = undefined;
		(globalThis as Record<string, unknown>).Buffer = undefined;
		try {
			expect(() => base64Encode('test')).toThrow('No base64 encoding method available');
		} finally {
			(globalThis as Record<string, unknown>).btoa = savedBtoa;
			(globalThis as Record<string, unknown>).Buffer = savedBuffer;
		}
	});

	test('base64Decode throws when no decoding method available', () => {
		const savedAtob = globalThis.atob;
		const savedBuffer = globalThis.Buffer;
		(globalThis as Record<string, unknown>).atob = undefined;
		(globalThis as Record<string, unknown>).Buffer = undefined;
		try {
			expect(() => base64Decode('dGVzdA==')).toThrow('No base64 decoding method available');
		} finally {
			(globalThis as Record<string, unknown>).atob = savedAtob;
			(globalThis as Record<string, unknown>).Buffer = savedBuffer;
		}
	});
});

describe('double-pendulum specific comparison state', () => {
	test('encodes and decodes double-pendulum comparison state', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0,
				speed: 1,
				showTrail: true,
				trailLength: 400,
				compareMode: false,
				compareOffset: 0.001
			},
			right: {
				type: 'double-pendulum',
				theta1: Math.PI / 2 + 0.01,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0,
				speed: 1,
				showTrail: true,
				trailLength: 400,
				compareMode: false,
				compareOffset: 0.001
			}
		};

		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/double-pendulum/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'double-pendulum');

		expect(decoded).not.toBeNull();
		expect(decoded!.compare).toBe(true);
		const leftParams = decoded!.left as DoublePendulumParameters;
		const rightParams = decoded!.right as DoublePendulumParameters;
		expect(leftParams.theta1).toBeCloseTo(Math.PI / 2);
		expect(rightParams.theta1).toBeCloseTo(Math.PI / 2 + 0.01);
	});

	test('handles double-pendulum with missing optional parameters', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0,
				speed: 1,
				showTrail: true,
				trailLength: 400,
				compareMode: false,
				compareOffset: 0.001
			},
			right: {
				type: 'double-pendulum',
				theta1: 0,
				theta2: 0,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0,
				speed: 1,
				showTrail: true,
				trailLength: 400,
				compareMode: false,
				compareOffset: 0.001
			}
		};

		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/double-pendulum/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'double-pendulum');

		expect(decoded).not.toBeNull();
		const leftParams = decoded!.left as DoublePendulumParameters;
		// All parameters should be preserved
		expect(leftParams.speed).toBe(1);
		expect(leftParams.showTrail).toBe(true);
	});

	test('createComparisonStateFromCurrent for double-pendulum', () => {
		const currentParams: DoublePendulumParameters = {
			type: 'double-pendulum',
			theta1: 1.0,
			theta2: -0.5,
			omega1: 0.5,
			omega2: -0.3,
			l1: 1.5,
			l2: 1.2,
			m1: 2,
			m2: 1.5,
			gravity: 15,
			damping: 0.1,
			speed: 1.5,
			showTrail: true,
			trailLength: 500,
			compareMode: false,
			compareOffset: 0.002
		};

		const state = createComparisonStateFromCurrent('double-pendulum', currentParams);

		expect(state.compare).toBe(true);
		const leftParams = state.left as DoublePendulumParameters;
		const rightParams = state.right as DoublePendulumParameters;
		expect(leftParams.theta1).toBe(1.0);
		expect(leftParams.gravity).toBe(15);
		// Right should be defaults
		expect(rightParams.theta1).toBeCloseTo(Math.PI / 2);
		expect(rightParams.gravity).toBeCloseTo(9.81);
	});

	test('buildComparisonUrl for double-pendulum', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0
			},
			right: {
				type: 'double-pendulum',
				theta1: 0,
				theta2: 0,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0
			}
		};

		const url = buildComparisonUrl('/app', 'double-pendulum', state);

		expect(url).toContain('/app/double-pendulum/compare?');
		expect(url).toContain('compare=true');
	});

	test('normalizeParameters handles double-pendulum parameters', () => {
		// double-pendulum doesn't have legacy parameters, but should pass through unchanged
		const params = {
			theta1: 1.0,
			theta2: 0.5,
			omega1: 0.2,
			omega2: -0.1,
			l1: 1.5,
			l2: 1.2,
			m1: 2,
			m2: 1.5,
			gravity: 15,
			damping: 0.1
		};

		// This function is internal, but we can test it indirectly through decode
		const encoded = base64Encode(JSON.stringify(params));
		const url = new URL(
			`https://example.com/double-pendulum/compare?compare=true&left=${encoded}`
		);
		const decoded = decodeComparisonState(url, 'double-pendulum');

		expect(decoded).not.toBeNull();
		const leftParams = decoded!.left as DoublePendulumParameters;
		expect(leftParams.theta1).toBe(1.0);
		expect(leftParams.gravity).toBe(15);
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

	test('preserves extended lorenz parameters (x0, solver, dt, trailLength, viewMode) through round-trip', () => {
		const original: ComparisonURLState = {
			compare: true,
			left: {
				type: 'lorenz',
				sigma: 10,
				rho: 28,
				beta: 8 / 3,
				x0: 5,
				y0: -3,
				z0: 2,
				solver: 'euler',
				dt: 0.01,
				trailLength: 8000,
				viewMode: 'xy',
				colorMode: 'speed',
				autoRotate: false,
				zoom: 1.5
			},
			right: {
				type: 'lorenz',
				sigma: 14,
				rho: 35,
				beta: 2.5,
				x0: -1,
				y0: 0.5,
				z0: 10,
				solver: 'rk2',
				dt: 0.003,
				trailLength: 20000,
				viewMode: 'xz',
				colorMode: 'zheight',
				autoRotate: true,
				zoom: 0.8
			}
		};

		const encoded = encodeComparisonState(original);
		const url = new URL(`https://example.com/lorenz/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'lorenz');

		expect(decoded).not.toBeNull();
		const left = decoded!.left as LorenzParameters;
		const right = decoded!.right as LorenzParameters;

		// Left extended params preserved
		expect(left.x0).toBe(5);
		expect(left.y0).toBe(-3);
		expect(left.z0).toBe(2);
		expect(left.solver).toBe('euler');
		expect(left.dt).toBeCloseTo(0.01);
		expect(left.trailLength).toBe(8000);
		expect(left.viewMode).toBe('xy');
		expect(left.colorMode).toBe('speed');
		expect(left.autoRotate).toBe(false);
		expect(left.zoom).toBeCloseTo(1.5);

		// Right extended params preserved
		expect(right.x0).toBe(-1);
		expect(right.y0).toBe(0.5);
		expect(right.z0).toBe(10);
		expect(right.solver).toBe('rk2');
		expect(right.dt).toBeCloseTo(0.003);
		expect(right.trailLength).toBe(20000);
		expect(right.viewMode).toBe('xz');
		expect(right.colorMode).toBe('zheight');
		expect(right.autoRotate).toBe(true);
		expect(right.zoom).toBeCloseTo(0.8);
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

	test('normalizes legacy uppercase K to lowercase k for standard map during decode', () => {
		// Simulate a URL produced by old code that used uppercase 'K'
		// Encode manually with uppercase 'K' bypassing encodeComparisonState
		const legacyParams = { K: 0.97, numP: 20, numQ: 20, iterations: 20000 };
		const encoded = base64Encode(JSON.stringify(legacyParams));
		const url = new URL(
			`https://example.com/standard/compare?compare=true&left=${encoded}&right=${encoded}`
		);

		const decoded = decodeComparisonState(url, 'standard');

		expect(decoded).not.toBeNull();
		// After normalization 'K' → 'k', the result should contain lowercase 'k'
		expect(decoded!.left).toHaveProperty('k', 0.97);
		expect(decoded!.right).toHaveProperty('k', 0.97);
	});

	test('falls back to defaults when encoded params are invalid JSON', () => {
		const url = new URL(
			'https://example.com/lorenz/compare?compare=true&left=INVALID_BASE64!!!&right=ALSO_BAD'
		);
		const decoded = decodeComparisonState(url, 'lorenz');

		// decodeParams returns null for invalid base64 → falls back to defaults
		expect(decoded).not.toBeNull();
		expect(decoded!.compare).toBe(true);
		// Should fall back to default lorenz params
		expect(decoded!.left).toHaveProperty('type', 'lorenz');
		expect(decoded!.right).toHaveProperty('type', 'lorenz');
	});

	test('falls back to defaults when left param is missing', () => {
		const right = encodeComparisonState({
			compare: true,
			left: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			right: { type: 'lorenz', sigma: 12, rho: 30, beta: 3 }
		});
		// Remove the left param from the URL
		const params = new URLSearchParams(right.toString());
		params.delete('left');
		const url = new URL(`https://example.com/lorenz/compare?${params.toString()}`);

		const decoded = decodeComparisonState(url, 'lorenz');

		expect(decoded).not.toBeNull();
		// left should fall back to defaults
		expect((decoded!.left as LorenzParameters).sigma).toBe(10);
	});
});

// ── decodeComparisonState for remaining map types ─────────────────────────────

describe('decodeComparisonState – remaining map types round-trip', () => {
	test('round-trips rossler parameters', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'rossler', a: 0.3, b: 0.5, c: 10 },
			right: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 }
		};
		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/rossler/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'rossler');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as RosslerParameters).a).toBe(0.3);
		expect((decoded!.left as RosslerParameters).c).toBe(10);
		expect((decoded!.right as RosslerParameters).a).toBe(0.2);
	});

	test('round-trips lozi parameters', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'lozi', a: 1.5, b: 0.4, x0: 0.1, y0: 0.1, iterations: 3000 },
			right: { type: 'lozi', a: 1.7, b: 0.5, x0: 0, y0: 0, iterations: 5000 }
		};
		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/lozi/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'lozi');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as LoziParameters).a).toBe(1.5);
		expect((decoded!.left as LoziParameters).iterations).toBe(3000);
		expect((decoded!.right as LoziParameters).a).toBe(1.7);
	});

	test('round-trips newton parameters', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'newton', xMin: -3, xMax: 3, yMin: -3, yMax: 3, maxIterations: 100 },
			right: { type: 'newton', xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 50 }
		};
		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/newton/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'newton');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as NewtonParameters).xMin).toBe(-3);
		expect((decoded!.left as NewtonParameters).maxIterations).toBe(100);
		expect((decoded!.right as NewtonParameters).xMax).toBe(2);
	});

	test('round-trips bifurcation-henon parameters', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: {
				type: 'bifurcation-henon',
				aMin: 0.9,
				aMax: 1.3,
				b: 0.3,
				maxIterations: 400
			},
			right: {
				type: 'bifurcation-henon',
				aMin: 0.8,
				aMax: 1.4,
				b: 0.3,
				maxIterations: 500
			}
		};
		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/bifurcation-henon/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'bifurcation-henon');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as BifurcationHenonParameters).aMin).toBe(0.9);
		expect((decoded!.left as BifurcationHenonParameters).maxIterations).toBe(400);
		expect((decoded!.right as BifurcationHenonParameters).aMin).toBe(0.8);
	});

	test('round-trips chaos-esthetique parameters', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'chaos-esthetique', a: 1.2, b: 0.4, x0: 1, y0: -1, iterations: 5000 },
			right: { type: 'chaos-esthetique', a: 1.4, b: 0.3, x0: 0, y0: 0, iterations: 10000 }
		};
		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/chaos-esthetique/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'chaos-esthetique');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as ChaosEsthetiqueParameters).a).toBe(1.2);
		expect((decoded!.left as ChaosEsthetiqueParameters).x0).toBe(1);
		expect((decoded!.right as ChaosEsthetiqueParameters).iterations).toBe(10000);
	});

	test('round-trips lyapunov parameters', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: {
				type: 'lyapunov',
				rMin: 2.0,
				rMax: 3.5,
				iterations: 200,
				transientIterations: 80
			},
			right: {
				type: 'lyapunov',
				rMin: 2.5,
				rMax: 4.0,
				iterations: 100,
				transientIterations: 100
			}
		};
		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/lyapunov/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'lyapunov');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as LyapunovParameters).rMin).toBe(2.0);
		expect((decoded!.left as LyapunovParameters).transientIterations).toBe(80);
		expect((decoded!.right as LyapunovParameters).rMax).toBe(4.0);
	});

	test('compare param value "1" is not treated as true', () => {
		const url = new URL('https://example.com/lorenz/compare?compare=1');
		const result = decodeComparisonState(url, 'lorenz');
		// Only the exact string "true" is accepted
		expect(result).toBeNull();
	});

	test('compare param value "TRUE" (uppercase) is not treated as true', () => {
		const url = new URL('https://example.com/lorenz/compare?compare=TRUE');
		const result = decodeComparisonState(url, 'lorenz');
		expect(result).toBeNull();
	});

	test('round-trips chua parameters', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'chua', alpha: 15.6, beta: 28, gamma: 0, a: -8 / 7, b: -5 / 7 },
			right: { type: 'chua', alpha: 10, beta: 20, gamma: 1, a: -1, b: -0.5 }
		};
		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/chua/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'chua');

		expect(decoded).not.toBeNull();
		expect((decoded!.left as ChuaParameters).alpha).toBeCloseTo(15.6);
		expect((decoded!.left as ChuaParameters).beta).toBe(28);
		expect((decoded!.right as ChuaParameters).alpha).toBe(10);
		expect((decoded!.right as ChuaParameters).gamma).toBe(1);
	});

	test('round-trips double-pendulum parameters', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 3,
				omega1: 0,
				omega2: 0,
				l1: 1.5,
				l2: 0.8,
				m1: 2,
				m2: 1,
				gravity: 9.81,
				damping: 0.05
			},
			right: {
				type: 'double-pendulum',
				theta1: Math.PI,
				theta2: Math.PI / 4,
				omega1: 1,
				omega2: -1,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 3,
				gravity: 20,
				damping: 0.2
			}
		};
		const encoded = encodeComparisonState(state);
		const url = new URL(`https://example.com/double-pendulum/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'double-pendulum');

		expect(decoded).not.toBeNull();
		const left = decoded!.left as DoublePendulumParameters;
		const right = decoded!.right as DoublePendulumParameters;
		expect(left.l1).toBe(1.5);
		expect(left.m2).toBe(1);
		expect(left.gravity).toBeCloseTo(9.81);
		expect(right.theta1).toBeCloseTo(Math.PI);
		expect(right.damping).toBeCloseTo(0.2);
	});
});

// ── buildComparisonUrl additional cases ───────────────────────────────────────

describe('buildComparisonUrl – additional cases', () => {
	const defaultState: ComparisonURLState = {
		compare: true,
		left: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
		right: { type: 'lorenz', sigma: 15, rho: 30, beta: 3 }
	};

	test('trims multiple trailing slashes from base', () => {
		const url = buildComparisonUrl('https://example.com///', 'lorenz', defaultState);
		expect(url).not.toContain('///lorenz');
		expect(url).toContain('/lorenz/compare');
	});

	test('works with non-empty base path', () => {
		const url = buildComparisonUrl('/app', 'rossler', {
			compare: true,
			left: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 },
			right: { type: 'rossler', a: 0.3, b: 0.2, c: 5.7 }
		});
		expect(url).toMatch(/^\/app\/rossler\/compare\?/);
	});

	test('produced URL contains compare=true', () => {
		const url = buildComparisonUrl('', 'henon', {
			compare: true,
			left: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 },
			right: { type: 'henon', a: 1.2, b: 0.3, iterations: 2000 }
		});
		expect(url).toContain('compare=true');
	});

	test('produced URL contains left and right params', () => {
		const url = buildComparisonUrl('', 'lorenz', defaultState);
		expect(url).toContain('left=');
		expect(url).toContain('right=');
	});
});

// ── swapParameters additional cases ───────────────────────────────────────────

describe('swapParameters – additional cases', () => {
	test('preserves compare flag as true', () => {
		const state: ComparisonURLState = {
			compare: true,
			left: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
			right: { type: 'lorenz', sigma: 15, rho: 30, beta: 3 }
		};
		const swapped = swapParameters(state);
		expect(swapped.compare).toBe(true);
	});

	test('left becomes right and right becomes left', () => {
		const left = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
		const right = { type: 'lorenz' as const, sigma: 20, rho: 35, beta: 3 };
		const state: ComparisonURLState = { compare: true, left, right };
		const swapped = swapParameters(state);

		expect(swapped.left).toEqual(right);
		expect(swapped.right).toEqual(left);
	});

	test('original state is not mutated', () => {
		const left = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };
		const right = { type: 'lorenz' as const, sigma: 20, rho: 35, beta: 3 };
		const state: ComparisonURLState = { compare: true, left, right };
		swapParameters(state);

		// Original should be unchanged
		expect(state.left).toEqual(left);
		expect(state.right).toEqual(right);
	});
});

// ── createComparisonStateFromCurrent additional cases ─────────────────────────

describe('createComparisonStateFromCurrent – additional cases', () => {
	test('right panel equals defaults for the given map type', () => {
		const currentParams = { type: 'rossler' as const, a: 0.3, b: 0.5, c: 10 };
		const state = createComparisonStateFromCurrent('rossler', currentParams);
		const defaults = getDefaultParameters('rossler');

		expect(state.right).toEqual(defaults);
	});

	test('left panel matches provided current params', () => {
		const currentParams = { type: 'henon' as const, a: 1.2, b: 0.25, iterations: 1500 };
		const state = createComparisonStateFromCurrent('henon', currentParams);

		expect(state.left).toEqual(currentParams);
	});

	test('compare flag is true', () => {
		const state = createComparisonStateFromCurrent('logistic', {
			type: 'logistic',
			r: 3.9,
			x0: 0.1,
			iterations: 100
		});
		expect(state.compare).toBe(true);
	});

	test('works for all map types without throwing', () => {
		// Drives getDefaultParameters + createComparisonStateFromCurrent for every
		// map type, so a newly added type that forgets a default (e.g. the
		// double-pendulum throw path) fails here instead of at runtime.
		const mapTypes = [
			'lorenz',
			'rossler',
			'henon',
			'lozi',
			'ikeda',
			'logistic',
			'newton',
			'standard',
			'bifurcation-logistic',
			'bifurcation-henon',
			'chaos-esthetique',
			'lyapunov',
			'chua',
			'double-pendulum'
		] as const;

		for (const mapType of mapTypes) {
			const defaults = getDefaultParameters(mapType);
			const state = createComparisonStateFromCurrent(mapType, defaults);
			expect(state.compare).toBe(true);
			expect(state.left).toEqual(defaults);
		}
	});
});

// ── base64Encode / base64Decode edge cases ────────────────────────────────────

describe('base64Encode / base64Decode – additional cases', () => {
	test('round-trips empty string', () => {
		const encoded = base64Encode('');
		const decoded = base64Decode(encoded);
		expect(decoded).toBe('');
	});

	test('round-trips single character', () => {
		expect(base64Decode(base64Encode('A'))).toBe('A');
	});

	test('round-trips JSON with all parameter types', () => {
		const obj = { sigma: 10, rho: 28.5, beta: 2.667, label: 'test' };
		const json = JSON.stringify(obj);
		const roundTripped = base64Decode(base64Encode(json));
		expect(JSON.parse(roundTripped)).toEqual(obj);
	});

	test('round-trips string with only spaces', () => {
		const input = '   ';
		expect(base64Decode(base64Encode(input))).toBe(input);
	});

	test('round-trips string with newlines', () => {
		const input = 'line1\nline2\nline3';
		expect(base64Decode(base64Encode(input))).toBe(input);
	});

	test('encoded output contains only base64 safe characters', () => {
		const encoded = base64Encode('Hello, World! 123');
		// Base64 alphabet: A-Z, a-z, 0-9, +, /, =
		expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
	});
});

// ── Optional field clamping via URL decode ────────────────────────────────────

describe('decodeComparisonState – optional field clamping', () => {
	test('clamps ikeda pointSize above max to 6 instead of rejecting entire config', () => {
		// pointSize max is 6 — sending 10 should be clamped, not rejected
		const payload = base64Encode(
			JSON.stringify({
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 800,
				burnIn: 100,
				renderMode: 'multi',
				seeds: 250,
				colorMode: 'iteration',
				pointSize: 10,
				opacity: 0.6
			})
		);
		const url = new URL(
			`https://example.com/ikeda/compare?compare=true&left=${payload}&right=${payload}`
		);
		const result = decodeComparisonState(url, 'ikeda');

		expect(result).not.toBeNull();
		// The config should be accepted with pointSize clamped, not rejected entirely
		const left = result!.left as unknown as Record<string, unknown>;
		expect(left.pointSize).toBe(6);
		expect(left.u).toBeCloseTo(0.918, 5);
	});

	test('clamps ikeda opacity below min to 0 instead of rejecting entire config', () => {
		// opacity min is 0 — sending -0.5 should be clamped
		const payload = base64Encode(
			JSON.stringify({
				u: 0.918,
				x0: 0.1,
				y0: 0,
				iterations: 800,
				burnIn: 100,
				pointSize: 1.5,
				opacity: -0.5
			})
		);
		const url = new URL(`https://example.com/ikeda/compare?compare=true&left=${payload}`);
		const result = decodeComparisonState(url, 'ikeda');

		expect(result).not.toBeNull();
		expect((result!.left as unknown as Record<string, unknown>).opacity).toBe(0);
	});

	test('clamps lorenz zoom below min to 0.5 instead of rejecting entire config', () => {
		// zoom min is 0.5 — sending 0 should be clamped
		const payload = base64Encode(
			JSON.stringify({
				sigma: 10,
				rho: 28,
				beta: 2.667,
				zoom: 0,
				trailLength: 200000
			})
		);
		const url = new URL(`https://example.com/lorenz/compare?compare=true&left=${payload}`);
		const result = decodeComparisonState(url, 'lorenz');

		expect(result).not.toBeNull();
		const left = result!.left as unknown as Record<string, unknown>;
		expect(left.zoom).toBe(0.5);
		expect(left.trailLength).toBe(100000);
		// Core params should still be intact
		expect((result!.left as LorenzParameters).sigma).toBe(10);
	});
});

// ── getDefaultParameters derives from presets ─────────────────────────────────

describe('clifford comparison defaults', () => {
	test('getDefaultParameters returns the classic clifford preset', () => {
		const params = getDefaultParameters('clifford');
		expect(params.type).toBe('clifford');
		expect(params).toMatchObject({ a: -1.4, b: 1.6, c: 1.0, d: 0.7 });
	});

	test('round-trips a clifford comparison state through the URL', () => {
		const left = getDefaultParameters('clifford');
		const right = { ...getDefaultParameters('clifford'), a: 1.5 } as typeof left;
		const encoded = encodeComparisonState({ compare: true, left, right });
		const url = new URL(`http://localhost/clifford/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'clifford');
		expect(decoded?.left).toMatchObject({ type: 'clifford', a: -1.4 });
		expect(decoded?.right).toMatchObject({ type: 'clifford', a: 1.5 });
		expect(decoded?.corrected).toBe(false);
	});
});

describe('getDefaultParameters – preset derivation', () => {
	test('ikeda defaults match the classic-ikeda preset', () => {
		const defaults = getDefaultParameters('ikeda');
		// These values come from the classic-ikeda preset in ikeda-presets.ts
		if (defaults.type === 'ikeda') {
			expect(defaults.u).toBeCloseTo(0.918, 5);
			expect(defaults.x0).toBe(0.1);
			expect(defaults.y0).toBe(0);
			expect(defaults.iterations).toBe(800);
			expect(defaults.burnIn).toBe(100);
			expect(defaults.renderMode).toBe('multi');
			expect(defaults.seeds).toBe(250);
			expect(defaults.colorMode).toBe('iteration');
			expect(defaults.pointSize).toBe(1.5);
			expect(defaults.opacity).toBe(0.6);
		}
	});

	test('lorenz defaults match the classic lorenz preset', () => {
		const defaults = getDefaultParameters('lorenz') as LorenzParameters;
		expect(defaults.sigma).toBe(10);
		expect(defaults.rho).toBe(28);
		expect(defaults.beta).toBeCloseTo(8 / 3);
	});

	test('chua defaults have correct parameter values', () => {
		const defaults = getDefaultParameters('chua') as ChuaParameters;
		expect(defaults.type).toBe('chua');
		expect(defaults.alpha).toBe(15.6);
		expect(defaults.beta).toBe(28);
		expect(defaults.gamma).toBe(0);
		expect(defaults.a).toBeCloseTo(-8 / 7);
		expect(defaults.b).toBeCloseTo(-5 / 7);
	});

	test('gumowski-mira defaults match the island-structure preset', () => {
		const defaults = getDefaultParameters('gumowski-mira') as GumowskiMiraParameters;
		expect(defaults.type).toBe('gumowski-mira');
		expect(defaults.mu).toBeCloseTo(0.31, 5);
		expect(defaults.a).toBeCloseTo(0.008, 5);
		expect(defaults.b).toBeCloseTo(0.05, 5);
		expect(defaults.iterations).toBe(15000);
		expect(defaults.burnIn).toBe(500);
		expect(defaults.renderMode).toBe('multi');
		expect(defaults.seeds).toBe(300);
		expect(defaults.colorMode).toBe('iteration');
	});
});

describe('gumowski-mira comparison URL round-trip', () => {
	test('round-trips a gumowski-mira comparison state through the URL', () => {
		const left = getDefaultParameters('gumowski-mira') as GumowskiMiraParameters;
		const right: GumowskiMiraParameters = {
			...left,
			mu: -0.4,
			renderMode: 'single',
			colorMode: 'seed'
		};
		const encoded = encodeComparisonState({ compare: true, left, right });
		const url = new URL(`http://localhost/gumowski-mira/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'gumowski-mira');
		expect(decoded).not.toBeNull();
		expect(decoded!.corrected).toBe(false);
		expect((decoded!.left as GumowskiMiraParameters).mu).toBeCloseTo(0.31, 5);
		expect((decoded!.left as GumowskiMiraParameters).renderMode).toBe('multi');
		expect((decoded!.right as GumowskiMiraParameters).mu).toBeCloseTo(-0.4, 5);
		expect((decoded!.right as GumowskiMiraParameters).renderMode).toBe('single');
		expect((decoded!.right as GumowskiMiraParameters).colorMode).toBe('seed');
	});

	test('buildComparisonUrl produces a parseable gumowski-mira compare URL', () => {
		const left = getDefaultParameters('gumowski-mira') as GumowskiMiraParameters;
		const right: GumowskiMiraParameters = { ...left, mu: 0.55 };
		const urlString = buildComparisonUrl('', 'gumowski-mira', {
			compare: true,
			left,
			right
		});
		expect(urlString).toContain('/gumowski-mira/compare?');
		const url = new URL(`http://localhost${urlString}`);
		const decoded = decodeComparisonState(url, 'gumowski-mira');
		expect(decoded).not.toBeNull();
		expect((decoded!.right as GumowskiMiraParameters).mu).toBeCloseTo(0.55, 5);
	});
});
