import { describe, it, expect } from 'vitest';
import { paramDefaults } from '$lib/viz/types';
import { bifurcationHenonParamDefs } from './bifurcation-henon';

describe('bifurcationHenonParamDefs', () => {
	it('matches the current page defaults and ids', () => {
		expect(paramDefaults(bifurcationHenonParamDefs)).toEqual({
			aMin: 1.04,
			aMax: 1.1,
			b: 0.3,
			maxIterations: 1000
		});
		expect(bifurcationHenonParamDefs.map((d) => d.id ?? d.key)).toEqual([
			'aMin',
			'aMax',
			'b',
			'maxIterations'
		]);
	});
});
