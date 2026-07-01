import type { ParamDef } from '$lib/viz/types';

export const bifurcationHenonParamDefs: ParamDef[] = [
	{ key: 'aMin', label: 'a min', min: 0.5, max: 1.5, step: 0.01, decimals: 3, default: 1.04 },
	{ key: 'aMax', label: 'a max', min: 0.5, max: 1.5, step: 0.01, decimals: 3, default: 1.1 },
	{ key: 'b', label: 'b', min: 0, max: 1, step: 0.01, decimals: 3, default: 0.3 },
	{ key: 'maxIterations', label: 'Iterations', min: 100, max: 2000, step: 100, default: 1000 }
];
