// src/lib/lorenz/defaults.ts
import type {
	LorenzParameters,
	LorenzSolver,
	LorenzColorMode,
	LorenzTrailStyle,
	LorenzViewMode
} from '$lib/types';

export interface ResolvedLorenzParameters {
	type: 'lorenz';
	sigma: number;
	rho: number;
	beta: number;
	x0: number;
	y0: number;
	z0: number;
	epsilon: number;
	showGhost: boolean;
	solver: LorenzSolver;
	dt: number;
	stepsPerFrame: number;
	speed: number;
	colorMode: LorenzColorMode;
	trailLength: number;
	trailStyle: LorenzTrailStyle;
	viewMode: LorenzViewMode;
	autoRotate: boolean;
	rotationSpeed: number;
	zoom: number;
}

/** Defaults for every optional field. σ/ρ/β have no defaults (always required). */
export const LORENZ_DEFAULTS: Omit<ResolvedLorenzParameters, 'type' | 'sigma' | 'rho' | 'beta'> = {
	x0: 0.1,
	y0: 0,
	z0: 0,
	epsilon: 0.001,
	showGhost: false,
	solver: 'rk4',
	dt: 0.005,
	stepsPerFrame: 5,
	speed: 1,
	colorMode: 'time',
	trailLength: 15000,
	trailStyle: 'comet',
	viewMode: '3d',
	autoRotate: true,
	rotationSpeed: 0.5,
	zoom: 1
};

/** Resolve a (possibly partial) persisted LorenzParameters into a fully-populated object. */
export function withLorenzDefaults(p: LorenzParameters): ResolvedLorenzParameters {
	return {
		type: 'lorenz',
		sigma: p.sigma,
		rho: p.rho,
		beta: p.beta,
		x0: p.x0 ?? LORENZ_DEFAULTS.x0,
		y0: p.y0 ?? LORENZ_DEFAULTS.y0,
		z0: p.z0 ?? LORENZ_DEFAULTS.z0,
		epsilon: p.epsilon ?? LORENZ_DEFAULTS.epsilon,
		showGhost: p.showGhost ?? LORENZ_DEFAULTS.showGhost,
		solver: p.solver ?? LORENZ_DEFAULTS.solver,
		dt: p.dt ?? LORENZ_DEFAULTS.dt,
		stepsPerFrame: p.stepsPerFrame ?? LORENZ_DEFAULTS.stepsPerFrame,
		speed: p.speed ?? LORENZ_DEFAULTS.speed,
		colorMode: p.colorMode ?? LORENZ_DEFAULTS.colorMode,
		trailLength: p.trailLength ?? LORENZ_DEFAULTS.trailLength,
		trailStyle: p.trailStyle ?? LORENZ_DEFAULTS.trailStyle,
		viewMode: p.viewMode ?? LORENZ_DEFAULTS.viewMode,
		autoRotate: p.autoRotate ?? LORENZ_DEFAULTS.autoRotate,
		rotationSpeed: p.rotationSpeed ?? LORENZ_DEFAULTS.rotationSpeed,
		zoom: p.zoom ?? LORENZ_DEFAULTS.zoom
	};
}
