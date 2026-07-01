import { describe, it, expect } from 'vitest';
import { paramDefaults } from '$lib/viz/types';
import { chaosEsthetiqueParamDefs } from './chaos-esthetique';

describe('chaosEsthetiqueParamDefs', () => {
	it('matches the current page defaults and ids', () => {
		expect(paramDefaults(chaosEsthetiqueParamDefs)).toEqual({
			a: 0.9,
			b: 0.9999,
			x0: 18,
			y0: 0,
			iterations: 10000
		});
		expect(chaosEsthetiqueParamDefs.map((d) => d.id ?? d.key)).toEqual([
			'a',
			'b',
			'x0',
			'y0',
			'iterations'
		]);
	});
});
