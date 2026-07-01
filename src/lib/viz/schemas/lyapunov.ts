import type { ParamDef } from '$lib/viz/types';

export const lyapunovParamDefs: ParamDef[] = [
	{
		key: 'rMin',
		id: 'r-min',
		label: 'r min',
		min: 0,
		max: 4,
		step: 0.01,
		decimals: 3,
		default: 2.5
	},
	{
		key: 'rMax',
		id: 'r-max',
		label: 'r max',
		min: 0,
		max: 4,
		step: 0.01,
		decimals: 3,
		default: 4.0
	},
	{ key: 'iterations', label: 'Iterations', min: 100, max: 10000, step: 100, default: 1000 },
	{
		key: 'transientIterations',
		id: 'transient',
		label: 'Transient',
		min: 50,
		max: 5000,
		step: 50,
		default: 500
	}
];
