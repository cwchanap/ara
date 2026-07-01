import type { ParamDef } from '$lib/viz/types';

export const henonParamDefs: ParamDef[] = [
	{ key: 'a', label: 'a', min: 0.5, max: 1.5, step: 0.01, decimals: 3, default: 1.4 },
	{ key: 'b', label: 'b', min: 0, max: 1, step: 0.01, decimals: 3, default: 0.3 },
	{ key: 'iterations', label: 'Iterations', min: 100, max: 5000, step: 100, default: 2000 }
];
