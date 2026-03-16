/**
 * Tests for types.ts runtime constants
 *
 * Tests the VALID_MAP_TYPES array and CHAOS_MAP_DISPLAY_NAMES record
 * for correctness and consistency.
 */

import { describe, expect, test } from 'bun:test';
import { VALID_MAP_TYPES, CHAOS_MAP_DISPLAY_NAMES } from './types';
import type { ChaosMapType } from './types';

const EXPECTED_MAP_TYPES: ChaosMapType[] = [
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
];

describe('VALID_MAP_TYPES', () => {
	test('contains exactly 11 map types', () => {
		expect(VALID_MAP_TYPES).toHaveLength(11);
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

	test('has exactly 11 entries', () => {
		expect(Object.keys(CHAOS_MAP_DISPLAY_NAMES)).toHaveLength(11);
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
		expect(CHAOS_MAP_DISPLAY_NAMES['henon']).toBe('HÉNON_MAP');
		expect(CHAOS_MAP_DISPLAY_NAMES['lozi']).toBe('LOZI_MAP');
		expect(CHAOS_MAP_DISPLAY_NAMES['logistic']).toBe('LOGISTIC_MAP');
		expect(CHAOS_MAP_DISPLAY_NAMES['newton']).toBe('NEWTON_FRACTAL');
		expect(CHAOS_MAP_DISPLAY_NAMES['standard']).toBe('STANDARD_MAP');
		expect(CHAOS_MAP_DISPLAY_NAMES['bifurcation-logistic']).toBe('BIFURCATION_LOGISTIC');
		expect(CHAOS_MAP_DISPLAY_NAMES['lyapunov']).toBe('LYAPUNOV_EXPONENTS');
	});

	test('display names for all map types are consistent with VALID_MAP_TYPES', () => {
		const displayNameKeys = Object.keys(CHAOS_MAP_DISPLAY_NAMES).sort();
		const validMapTypesSorted = [...VALID_MAP_TYPES].sort();
		expect(displayNameKeys).toEqual(validMapTypesSorted);
	});
});
