import { describe, it, expect } from 'vitest';
import { paramDefaults } from '$lib/viz/types';
import { bifurcationLogisticParamDefs } from './bifurcation-logistic';

describe('bifurcationLogisticParamDefs', () => {
	it('matches the current page defaults and ids', () => {
		expect(paramDefaults(bifurcationLogisticParamDefs)).toEqual({
			rMin: 3.5,
			rMax: 4.0,
			maxIterations: 1000
		});
		expect(bifurcationLogisticParamDefs.map((d) => d.id ?? d.key)).toEqual([
			'rMin',
			'rMax',
			'maxIterations'
		]);
	});
});
