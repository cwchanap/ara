import type { ParamDef } from '$lib/viz/types';

export const chaosEsthetiqueParamDefs: ParamDef[] = [
	{ key: 'a', label: 'a', min: 0, max: 2, step: 0.0001, decimals: 4, default: 0.9 },
	{ key: 'b', label: 'b', min: 0, max: 1.5, step: 0.0001, decimals: 4, default: 0.9999 },
	{ key: 'x0', label: 'x₀', min: -20, max: 20, step: 0.1, decimals: 2, default: 18 },
	{ key: 'y0', label: 'y₀', min: -20, max: 20, step: 0.1, decimals: 2, default: 0 },
	{ key: 'iterations', label: 'Iterations', min: 1000, max: 20000, step: 1000, default: 10000 }
];
