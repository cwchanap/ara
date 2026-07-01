import { describe, it, expect } from 'vitest';
import { paramDefaults } from '$lib/viz/types';
import { rosslerParamDefs } from './rossler';

describe('rosslerParamDefs', () => {
	it('matches the current page defaults and ids', () => {
		expect(paramDefaults(rosslerParamDefs)).toEqual({ a: 0.2, b: 0.2, c: 5.7 });
		expect(rosslerParamDefs.map((d) => d.id ?? d.key)).toEqual([
			'param-a',
			'param-b',
			'param-c'
		]);
	});
});
