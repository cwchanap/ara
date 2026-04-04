/**
 * Additional tests for comparison-url-state.ts
 *
 * Covers cases not in comparison-url-state.test.ts:
 * - decodeComparisonState for map types not fully round-tripped (rossler, lozi, newton,
 *   bifurcation-henon, chaos-esthetique, lyapunov)
 * - buildComparisonUrl with multiple trailing slashes
 * - base64Encode/Decode with empty string and special values
 * - swapParameters preserves compare flag
 * - createComparisonStateFromCurrent right side equals defaults
 * - encodeComparisonState strips type field
 * - decodeComparisonState with compare=1 (not 'true')
 */

import { describe, expect, test } from 'bun:test';
import {
	decodeComparisonState,
	encodeComparisonState,
	buildComparisonUrl,
	swapParameters,
	createComparisonStateFromCurrent,
	getDefaultParameters,
	base64Encode,
	base64Decode
} from './comparison-url-state';
import type { ComparisonURLState } from './comparison-url-state';
import type {
	RosslerParameters,
	LoziParameters,
	NewtonParameters,
	BifurcationHenonParameters,
	ChaosEsthetiqueParameters,
	LyapunovParameters
} from './types';

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
});

// ── buildComparisonUrl ────────────────────────────────────────────────────────

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

// ── swapParameters ────────────────────────────────────────────────────────────

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

// ── createComparisonStateFromCurrent ─────────────────────────────────────────

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

	test('works for all 11 map types without throwing', () => {
		const mapTypes = [
			'lorenz',
			'rossler',
			'henon',
			'lozi',
			'logistic',
			'newton',
			'standard',
			'bifurcation-logistic',
			'bifurcation-henon',
			'chaos-esthetique',
			'lyapunov'
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
