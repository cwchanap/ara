import type { ParamDef } from '$lib/viz/types';

export const logisticParamDefs: ParamDef[] = [
	{ key: 'r', label: 'r (growth rate)', min: 0, max: 4, step: 0.01, decimals: 3, default: 3.9 },
	{
		key: 'x0',
		label: 'x₀ (initial value)',
		min: 0,
		max: 1,
		step: 0.01,
		decimals: 3,
		default: 0.5
	},
	{ key: 'iterations', label: 'Iterations', min: 10, max: 200, step: 10, default: 100 }
];
