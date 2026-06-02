// src/lib/lorenz/presets.ts
export interface LorenzPreset {
	id: string;
	label: string;
	sigma: number;
	rho: number;
	beta: number;
}

export const LORENZ_PRESETS: LorenzPreset[] = [
	{ id: 'classic', label: 'Classic', sigma: 10, rho: 28, beta: 8 / 3 },
	{ id: 'stable', label: 'Stable', sigma: 10, rho: 10, beta: 8 / 3 },
	{ id: 'periodic', label: 'Near Trans.', sigma: 10, rho: 24.74, beta: 8 / 3 },
	{ id: 'chaotic', label: 'High Energy', sigma: 10, rho: 40, beta: 8 / 3 },
	{ id: 'wild', label: 'Wild', sigma: 14, rho: 99.96, beta: 8 / 3 }
];

const EPS = 1e-6;

/** Return the id of the preset matching the given σ/ρ/β, or 'custom' if none. */
export function matchPreset(p: { sigma: number; rho: number; beta: number }): string {
	const found = LORENZ_PRESETS.find(
		(preset) =>
			Math.abs(preset.sigma - p.sigma) < EPS &&
			Math.abs(preset.rho - p.rho) < EPS &&
			Math.abs(preset.beta - p.beta) < EPS
	);
	return found ? found.id : 'custom';
}
