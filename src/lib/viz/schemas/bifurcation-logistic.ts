import type { ParamDef } from '$lib/viz/types';

export const bifurcationLogisticParamDefs: ParamDef[] = [
	{ key: 'rMin', label: 'r min', min: 2.5, max: 4, step: 0.01, decimals: 3, default: 3.5 },
	{ key: 'rMax', label: 'r max', min: 2.5, max: 4, step: 0.01, decimals: 3, default: 4.0 },
	{ key: 'maxIterations', label: 'Iterations', min: 100, max: 2000, step: 100, default: 1000 }
];
