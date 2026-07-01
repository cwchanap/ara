import type { ParamDef } from '$lib/viz/types';

export const standardParamDefs: ParamDef[] = [
	{ key: 'k', label: 'K', min: 0, max: 5, step: 0.01, decimals: 6, default: 0.971635 },
	{ key: 'numP', label: 'Initial p points', min: 1, max: 20, step: 1, default: 10 },
	{ key: 'numQ', label: 'Initial q points', min: 1, max: 20, step: 1, default: 10 },
	{ key: 'iterations', label: 'Iterations', min: 1000, max: 50000, step: 1000, default: 20000 }
];
