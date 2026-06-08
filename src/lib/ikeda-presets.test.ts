import { describe, expect, test } from 'vitest';
import { IKEDA_PRESETS, getPreset, detectPresetId, type IkedaPresetState } from './ikeda-presets';

describe('IKEDA_PRESETS', () => {
	test('contains the 5 required presets in order', () => {
		expect(IKEDA_PRESETS.map((p) => p.id)).toEqual([
			'low-feedback',
			'transition',
			'structured-chaos',
			'classic-ikeda',
			'dense-fractal'
		]);
	});

	test('every preset has a human-readable label and valid feedback', () => {
		for (const p of IKEDA_PRESETS) {
			expect(p.label.length).toBeGreaterThan(0);
			expect(p.state.u).toBeGreaterThanOrEqual(0);
			expect(p.state.u).toBeLessThanOrEqual(1);
		}
	});
});

describe('getPreset', () => {
	test('returns the matching preset by id', () => {
		expect(getPreset('classic-ikeda')?.label).toMatch(/classic/i);
	});

	test('returns undefined for an unknown id', () => {
		expect(getPreset('nope')).toBeUndefined();
	});
});

describe('detectPresetId', () => {
	test('returns the id when state matches a preset exactly', () => {
		const classic = getPreset('classic-ikeda')!;
		expect(detectPresetId(classic.state)).toBe('classic-ikeda');
	});

	test('returns null when a parameter has been changed (Custom)', () => {
		const classic = getPreset('classic-ikeda')!;
		const edited: IkedaPresetState = { ...classic.state, u: classic.state.u + 0.05 };
		expect(detectPresetId(edited)).toBeNull();
	});
});
