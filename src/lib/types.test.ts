/**
 * Tests for types.ts runtime constants
 *
 * Tests the VALID_MAP_TYPES array and CHAOS_MAP_DISPLAY_NAMES record
 * for correctness and consistency.
 */

import { describe, expect, test } from 'vitest';
import { VALID_MAP_TYPES, CHAOS_MAP_DISPLAY_NAMES } from './types';
import type { ChaosMapType, LorenzParameters } from './types';

const EXPECTED_MAP_TYPES: ChaosMapType[] = [
	'lorenz',
	'rossler',
	'henon',
	'lozi',
	'ikeda',
	'clifford',
	'tinkerbell',
	'logistic',
	'newton',
	'standard',
	'bifurcation-logistic',
	'bifurcation-henon',
	'chaos-esthetique',
	'gumowski-mira',
	'lyapunov',
	'chua',
	'double-pendulum',
	'bakers-map'
];

describe('VALID_MAP_TYPES', () => {
	test('contains exactly the expected number of map types', () => {
		expect(VALID_MAP_TYPES).toHaveLength(EXPECTED_MAP_TYPES.length);
	});

	test('contains all expected map types', () => {
		for (const type of EXPECTED_MAP_TYPES) {
			expect(VALID_MAP_TYPES).toContain(type);
		}
	});

	test('has no duplicate entries', () => {
		const unique = new Set(VALID_MAP_TYPES);
		expect(unique.size).toBe(VALID_MAP_TYPES.length);
	});

	test('contains only string values', () => {
		for (const type of VALID_MAP_TYPES) {
			expect(typeof type).toBe('string');
		}
	});

	test('does not contain invalid types', () => {
		expect(VALID_MAP_TYPES).not.toContain('invalid');
		expect(VALID_MAP_TYPES).not.toContain('');
		expect(VALID_MAP_TYPES).not.toContain('chaos');
	});
});

describe('CHAOS_MAP_DISPLAY_NAMES', () => {
	test('has an entry for every valid map type', () => {
		for (const type of VALID_MAP_TYPES) {
			expect(CHAOS_MAP_DISPLAY_NAMES).toHaveProperty(type);
		}
	});

	test('has exactly one entry per expected map type', () => {
		expect(Object.keys(CHAOS_MAP_DISPLAY_NAMES)).toHaveLength(EXPECTED_MAP_TYPES.length);
	});

	test('all display names are non-empty strings', () => {
		for (const [, name] of Object.entries(CHAOS_MAP_DISPLAY_NAMES)) {
			expect(typeof name).toBe('string');
			expect(name.length).toBeGreaterThan(0);
		}
	});

	test('all display names use UPPERCASE format', () => {
		for (const [, name] of Object.entries(CHAOS_MAP_DISPLAY_NAMES)) {
			// Display names should be uppercase (allowing unicode like Ö, É, Ê)
			expect(name).toBe(name.toUpperCase());
		}
	});

	test('display names contain underscores as word separators', () => {
		for (const [, name] of Object.entries(CHAOS_MAP_DISPLAY_NAMES)) {
			expect(name).toContain('_');
		}
	});

	test('maps each type to the correct display name', () => {
		expect(CHAOS_MAP_DISPLAY_NAMES['lorenz']).toBe('LORENZ_ATTRACTOR');
		expect(CHAOS_MAP_DISPLAY_NAMES['rossler']).toBe('RÖSSLER_ATTRACTOR');
		expect(CHAOS_MAP_DISPLAY_NAMES['henon']).toBe('HÉNON_MAP');
		expect(CHAOS_MAP_DISPLAY_NAMES['lozi']).toBe('LOZI_MAP');
		expect(CHAOS_MAP_DISPLAY_NAMES['ikeda']).toBe('IKEDA_MAP');
		expect(CHAOS_MAP_DISPLAY_NAMES['clifford']).toBe('CLIFFORD_ATTRACTOR');
		expect(CHAOS_MAP_DISPLAY_NAMES['tinkerbell']).toBe('TINKERBELL_MAP');
		expect(CHAOS_MAP_DISPLAY_NAMES['logistic']).toBe('LOGISTIC_MAP');
		expect(CHAOS_MAP_DISPLAY_NAMES['newton']).toBe('NEWTON_FRACTAL');
		expect(CHAOS_MAP_DISPLAY_NAMES['standard']).toBe('STANDARD_MAP');
		expect(CHAOS_MAP_DISPLAY_NAMES['bifurcation-logistic']).toBe('BIFURCATION_LOGISTIC');
		expect(CHAOS_MAP_DISPLAY_NAMES['bifurcation-henon']).toBe('BIFURCATION_HÉNON');
		expect(CHAOS_MAP_DISPLAY_NAMES['chaos-esthetique']).toBe('CHAOS_ESTHÉTIQUE');
		expect(CHAOS_MAP_DISPLAY_NAMES['gumowski-mira']).toBe('GUMOWSKI–MIRA_MAP');
		expect(CHAOS_MAP_DISPLAY_NAMES['lyapunov']).toBe('LYAPUNOV_EXPONENTS');
		expect(CHAOS_MAP_DISPLAY_NAMES['chua']).toBe('CHUA_CIRCUIT');
		expect(CHAOS_MAP_DISPLAY_NAMES['double-pendulum']).toBe('DOUBLE_PENDULUM');
		expect(CHAOS_MAP_DISPLAY_NAMES['bakers-map']).toBe('BAKERS_MAP');
	});

	test('display names for all map types are consistent with VALID_MAP_TYPES', () => {
		const displayNameKeys = Object.keys(CHAOS_MAP_DISPLAY_NAMES).sort();
		const validMapTypesSorted = [...VALID_MAP_TYPES].sort();
		expect(displayNameKeys).toEqual(validMapTypesSorted);
	});
});

describe('clifford registration', () => {
	test('clifford is a valid map type with the correct display name', () => {
		expect(VALID_MAP_TYPES).toContain('clifford');
		expect(CHAOS_MAP_DISPLAY_NAMES.clifford).toBe('CLIFFORD_ATTRACTOR');
	});
});

describe('LorenzParameters extended fields', () => {
	test('accepts a fully-populated object', () => {
		const p: LorenzParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 8 / 3,
			x0: 0.1,
			y0: 0,
			z0: 0,
			epsilon: 0.001,
			showGhost: true,
			solver: 'rk4',
			dt: 0.005,
			stepsPerFrame: 5,
			speed: 1,
			colorMode: 'divergence',
			trailLength: 15000,
			trailStyle: 'comet',
			viewMode: 'xy',
			autoRotate: true,
			rotationSpeed: 0.5,
			zoom: 1
		};
		expect(p.type).toBe('lorenz');
	});

	test('accepts a legacy sigma/rho/beta-only object', () => {
		const p: LorenzParameters = { type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 };
		expect(p.sigma).toBe(10);
	});
});
