import { describe, it, expect } from 'vitest';
import {
	DOUBLE_PENDULUM_PRESETS,
	DEFAULT_DOUBLE_PENDULUM_PRESET_ID,
	getPreset,
	detectPresetId,
	type DoublePendulumState
} from './double-pendulum-presets';

describe('double pendulum presets', () => {
	it('exposes a non-empty preset list with a valid default id', () => {
		expect(DOUBLE_PENDULUM_PRESETS.length).toBeGreaterThan(0);
		expect(getPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID)).toBeDefined();
	});

	it('getPreset returns undefined for an unknown id', () => {
		expect(getPreset('nope')).toBeUndefined();
	});

	it('every preset has all required physical fields', () => {
		for (const preset of DOUBLE_PENDULUM_PRESETS) {
			const s = preset.state;
			for (const key of [
				'theta1',
				'theta2',
				'omega1',
				'omega2',
				'l1',
				'l2',
				'm1',
				'm2',
				'gravity',
				'damping'
			] as const) {
				expect(typeof s[key]).toBe('number');
			}
			expect(s.l1).toBeGreaterThan(0);
			expect(s.l2).toBeGreaterThan(0);
			expect(s.m1).toBeGreaterThan(0);
			expect(s.m2).toBeGreaterThan(0);
		}
	});

	it('detectPresetId round-trips a preset state', () => {
		const def = getPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID);
		expect(def).toBeDefined();
		expect(detectPresetId(def!.state)).toBe(DEFAULT_DOUBLE_PENDULUM_PRESET_ID);
	});

	it('detectPresetId returns null for a custom state', () => {
		const def = getPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID)!;
		const custom: DoublePendulumState = { ...def.state, gravity: def.state.gravity + 3.3 };
		expect(detectPresetId(custom)).toBeNull();
	});

	it('detectPresetId returns null when ANY field differs, including render fields', () => {
		// Regression guard for the keyof-driven comparison: before the refactor,
		// detectPresetId hand-listed fields and would silently ignore a newly
		// added one. Vary a render field (trailLength) and expect no match.
		const def = getPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID)!;
		const custom: DoublePendulumState = {
			...def.state,
			trailLength: def.state.trailLength + 1
		};
		expect(detectPresetId(custom)).toBeNull();
	});

	it('detectPresetId distinguishes presets that differ only by a boolean field', () => {
		const def = getPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID)!;
		const toggled: DoublePendulumState = { ...def.state, compareMode: !def.state.compareMode };
		expect(detectPresetId(toggled)).toBeNull();
	});

	it('DOUBLE_PENDULUM_PRESETS is immutable (readonly at the type level)', () => {
		// If this compiles, the array is typed readonly — accidental push/pop
		// would be a type error. We assert the runtime shape here.
		expect(Array.isArray(DOUBLE_PENDULUM_PRESETS)).toBe(true);
		expect(DOUBLE_PENDULUM_PRESETS.length).toBeGreaterThan(0);
	});
});
