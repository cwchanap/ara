import { describe, it, expect } from 'vitest';
import { paramDefaults } from '$lib/viz/types';
import { logisticParamDefs } from './logistic';

describe('logisticParamDefs', () => {
	it('matches the current page defaults and ids', () => {
		expect(paramDefaults(logisticParamDefs)).toEqual({ r: 3.9, x0: 0.5, iterations: 100 });
		expect(logisticParamDefs.map((d) => d.id ?? d.key)).toEqual(['r', 'x0', 'iterations']);
	});
});
