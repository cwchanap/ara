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
});
