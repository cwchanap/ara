import type { ParamDef } from '$lib/viz/types';

export const newtonParamDefs: ParamDef[] = [
	{ key: 'xMin', label: 'x Min', min: -1, max: 0, step: 0.001, decimals: 4, default: -0.01 },
	{ key: 'xMax', label: 'x Max', min: 0, max: 1, step: 0.001, decimals: 4, default: 0.01 },
	{ key: 'yMin', label: 'y Min', min: -1, max: 0, step: 0.001, decimals: 4, default: -0.01 },
	{ key: 'yMax', label: 'y Max', min: 0, max: 1, step: 0.001, decimals: 4, default: 0.01 },
	{ key: 'maxIterations', label: 'Max Iterations', min: 10, max: 100, step: 5, default: 50 }
];
