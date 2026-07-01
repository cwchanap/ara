import { describe, it, expect } from 'vitest';
import { paramDefaults } from '$lib/viz/types';
import { loziParamDefs } from './lozi';

describe('loziParamDefs', () => {
	it('matches the current page defaults and ids', () => {
		expect(paramDefaults(loziParamDefs)).toEqual({
			a: 0.5,
			b: 0.3,
			x0: 0,
			y0: 0,
			iterations: 2000
		});
		expect(loziParamDefs.map((d) => d.id ?? d.key)).toEqual([
			'a',
			'b',
			'x0',
			'y0',
			'iterations'
		]);
	});
});
