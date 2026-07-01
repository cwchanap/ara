import type { ParamDef } from '$lib/viz/types';

export const rosslerParamDefs: ParamDef[] = [
	{
		key: 'a',
		id: 'param-a',
		label: 'a (parameter)',
		min: 0.126,
		max: 0.43295,
		step: 0.01,
		decimals: 3,
		default: 0.2
	},
	{
		key: 'b',
		id: 'param-b',
		label: 'b (parameter)',
		min: 0.01,
		max: 2,
		step: 0.01,
		decimals: 3,
		default: 0.2
	},
	{
		key: 'c',
		id: 'param-c',
		label: 'c (parameter)',
		min: 1,
		max: 30,
		step: 0.1,
		decimals: 2,
		default: 5.7
	}
];
