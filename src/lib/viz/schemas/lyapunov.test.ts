import { describe, it, expect } from 'vitest';
import { paramDefaults } from '$lib/viz/types';
import { lyapunovParamDefs } from './lyapunov';

describe('lyapunovParamDefs', () => {
	it('matches the current page defaults and ids', () => {
		expect(paramDefaults(lyapunovParamDefs)).toEqual({
			rMin: 2.5,
			rMax: 4.0,
			iterations: 1000,
			transientIterations: 500
		});
		expect(lyapunovParamDefs.map((d) => d.id ?? d.key)).toEqual([
			'r-min',
			'r-max',
			'iterations',
			'transient'
		]);
	});
});
