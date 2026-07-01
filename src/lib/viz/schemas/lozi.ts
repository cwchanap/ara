import type { ParamDef } from '$lib/viz/types';

export const loziParamDefs: ParamDef[] = [
	{ key: 'a', label: 'a', min: 0.5, max: 2, step: 0.01, decimals: 3, default: 0.5 },
	{ key: 'b', label: 'b', min: 0, max: 1, step: 0.01, decimals: 3, default: 0.3 },
	{ key: 'x0', label: 'x₀', min: -2, max: 2, step: 0.1, decimals: 2, default: 0 },
	{ key: 'y0', label: 'y₀', min: -2, max: 2, step: 0.1, decimals: 2, default: 0 },
	{ key: 'iterations', label: 'Iterations', min: 100, max: 5000, step: 100, default: 2000 }
];
