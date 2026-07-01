import { describe, it, expect } from 'vitest';
import { paramDefaults } from '$lib/viz/types';
import { henonParamDefs } from './henon';

describe('henonParamDefs', () => {
	it('matches the current page defaults and ids', () => {
		expect(paramDefaults(henonParamDefs)).toEqual({ a: 1.4, b: 0.3, iterations: 2000 });
		expect(henonParamDefs.map((d) => d.id ?? d.key)).toEqual(['a', 'b', 'iterations']);
	});
});
