import { describe, it, expect } from 'vitest';
import { paramDefaults } from '$lib/viz/types';
import { standardParamDefs } from './standard';

describe('standardParamDefs', () => {
	it('matches the current page defaults and ids', () => {
		expect(paramDefaults(standardParamDefs)).toEqual({
			k: 0.971635,
			numP: 10,
			numQ: 10,
			iterations: 20000
		});
		expect(standardParamDefs.map((d) => d.id ?? d.key)).toEqual([
			'k',
			'numP',
			'numQ',
			'iterations'
		]);
	});
});
