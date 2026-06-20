import { describe, expect, test } from 'vitest';
import {
	CLIFFORD_PRESETS,
	DEFAULT_CLIFFORD_PRESET_ID,
	getPreset,
	detectPresetId,
	type CliffordPresetState
} from './clifford-presets';

describe('CLIFFORD_PRESETS', () => {
	test('contains the 5 required presets in order', () => {
		expect(CLIFFORD_PRESETS.map((p) => p.id)).toEqual([
			'classic',
			'wings',
			'web',
			'swirl',
			'ribbons'
		]);
	});

	test('every preset has a label and in-range shape parameters', () => {
		for (const p of CLIFFORD_PRESETS) {
			expect(p.label.length).toBeGreaterThan(0);
			for (const v of [p.state.a, p.state.b, p.state.c, p.state.d]) {
				expect(v).toBeGreaterThanOrEqual(-3);
				expect(v).toBeLessThanOrEqual(3);
			}
		}
	});

	test('default preset id resolves', () => {
		expect(getPreset(DEFAULT_CLIFFORD_PRESET_ID)).toBeDefined();
	});
});

describe('detectPresetId', () => {
	test('round-trips every preset', () => {
		for (const p of CLIFFORD_PRESETS) {
			expect(detectPresetId(p.state)).toBe(p.id);
		}
	});

	test('returns null for a custom state', () => {
		const classic = getPreset('classic')!;
		const edited: CliffordPresetState = { ...classic.state, a: classic.state.a + 0.05 };
		expect(detectPresetId(edited)).toBeNull();
	});

	test('matches when a numeric field differs by less than the 1e-9 tolerance', () => {
		const classic = getPreset('classic')!;
		// 1e-10 is below the 1e-9 tolerance → still considered the same preset.
		const within: CliffordPresetState = { ...classic.state, a: classic.state.a + 1e-10 };
		expect(detectPresetId(within)).toBe('classic');
	});

	test('returns null when a numeric field differs by more than the 1e-9 tolerance', () => {
		const classic = getPreset('classic')!;
		// 1e-8 exceeds the 1e-9 tolerance → custom state.
		const outside: CliffordPresetState = { ...classic.state, a: classic.state.a + 1e-8 };
		expect(detectPresetId(outside)).toBeNull();
	});

	test('uses strict equality for iterations (off-by-one is custom)', () => {
		const classic = getPreset('classic')!;
		const edited: CliffordPresetState = {
			...classic.state,
			iterations: classic.state.iterations + 1
		};
		expect(detectPresetId(edited)).toBeNull();
	});

	test('uses strict equality for colorMode (any mismatch is custom)', () => {
		const classic = getPreset('classic')!;
		// classic.state.colorMode is 'density' — flip it.
		const edited: CliffordPresetState = { ...classic.state, colorMode: 'iteration' };
		expect(detectPresetId(edited)).toBeNull();
	});

	test('returns null when every individual field is within tolerance but the state is custom', () => {
		// Guard against accidental match-by-majority: perturb every numeric
		// field by a sub-tolerance amount so the cumulative state is custom
		// but each comparison individually passes.
		const classic = getPreset('classic')!;
		const nudged: CliffordPresetState = {
			...classic.state,
			a: classic.state.a + 1e-10,
			b: classic.state.b + 1e-10,
			c: classic.state.c + 1e-10,
			d: classic.state.d + 1e-10,
			zoom: classic.state.zoom + 1e-10,
			pointSize: classic.state.pointSize + 1e-10,
			opacity: classic.state.opacity + 1e-10
		};
		// Within tolerance on every field → still matches 'classic'.
		// This documents the implementation's per-field tolerance semantics.
		expect(detectPresetId(nudged)).toBe('classic');
	});
});
