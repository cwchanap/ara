import { describe, it, expect } from 'vitest';
import { paramDefaults } from '$lib/viz/types';
import { newtonParamDefs } from './newton';

describe('newtonParamDefs', () => {
	it('matches the current page defaults and ids', () => {
		expect(paramDefaults(newtonParamDefs)).toEqual({
			xMin: -0.01,
			xMax: 0.01,
			yMin: -0.01,
			yMax: 0.01,
			maxIterations: 50
		});
		expect(newtonParamDefs.map((d) => d.id ?? d.key)).toEqual([
			'xMin',
			'xMax',
			'yMin',
			'yMax',
			'maxIterations'
		]);
	});
});
