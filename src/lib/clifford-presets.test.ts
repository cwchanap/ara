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
});
