import { describe, it, expect } from 'vitest';
import { paramDefaults, clampToDef, applyLoadedValues, type ParamDef } from './types';

const defs: ParamDef[] = [
	{ key: 'a', label: 'a', min: 0.5, max: 1.5, step: 0.01, decimals: 3, default: 1.4 },
	{ key: 'iterations', label: 'Iterations', min: 100, max: 5000, step: 100, default: 2000 }
];

describe('paramDefaults', () => {
	it('builds a values map from defaults', () => {
		expect(paramDefaults(defs)).toEqual({ a: 1.4, iterations: 2000 });
	});
});

describe('clampToDef', () => {
	it('clamps below min and above max, passes through in-range', () => {
		expect(clampToDef(defs[0], 0.1)).toBe(0.5);
		expect(clampToDef(defs[0], 9)).toBe(1.5);
		expect(clampToDef(defs[0], 1.0)).toBe(1.0);
	});
});

describe('applyLoadedValues', () => {
	it('applies and clamps finite loaded numbers, ignores others', () => {
		const values = paramDefaults(defs);
		applyLoadedValues(defs, values, { a: 99, iterations: 'x', missing: 1 });
		expect(values).toEqual({ a: 1.5, iterations: 2000 });
	});
});
