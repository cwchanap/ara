import { describe, test, expect } from 'vitest';
import {
	GUMOWSKI_MIRA_PRESETS,
	getPreset,
	detectPresetId,
	DEFAULT_GUMOWSKI_MIRA_PRESET_ID
} from './gumowski-mira-presets';

describe('GUMOWSKI_MIRA_PRESETS', () => {
	test('has at least 5 presets', () => {
		expect(GUMOWSKI_MIRA_PRESETS.length).toBeGreaterThanOrEqual(5);
	});

	test('every preset has a unique id', () => {
		const ids = GUMOWSKI_MIRA_PRESETS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test('every preset has a label', () => {
		for (const p of GUMOWSKI_MIRA_PRESETS) {
			expect(typeof p.label).toBe('string');
			expect(p.label.length).toBeGreaterThan(0);
		}
	});
});

describe('getPreset', () => {
	test('returns the preset for a known id', () => {
		const preset = getPreset('island-structure');
		expect(preset).toBeDefined();
		expect(preset?.id).toBe('island-structure');
	});

	test('returns undefined for unknown id', () => {
		expect(getPreset('does-not-exist')).toBeUndefined();
	});
});

describe('DEFAULT_GUMOWSKI_MIRA_PRESET_ID', () => {
	test('resolves to a valid preset', () => {
		expect(getPreset(DEFAULT_GUMOWSKI_MIRA_PRESET_ID)).toBeDefined();
	});
});

describe('detectPresetId', () => {
	test('detects an exact preset state match', () => {
		const preset = getPreset('island-structure')!;
		expect(detectPresetId(preset.state)).toBe('island-structure');
	});

	test('returns null for a non-matching (custom) state', () => {
		const preset = getPreset('island-structure')!;
		const modified = { ...preset.state, mu: 0.999 };
		expect(detectPresetId(modified)).toBeNull();
	});

	test('detects every preset in the list', () => {
		for (const preset of GUMOWSKI_MIRA_PRESETS) {
			expect(detectPresetId(preset.state)).toBe(preset.id);
		}
	});
});
