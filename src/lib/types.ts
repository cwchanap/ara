// Shared types used across client and server code

export interface Profile {
	id: string;
	username: string;
	// Timestamps are strings due to Drizzle mode: 'string' configuration
	createdAt: string;
	updatedAt: string;
}

// Chaos Map Types - the 13 supported visualization types
export type ChaosMapType =
	| 'lorenz'
	| 'rossler'
	| 'henon'
	| 'lozi'
	| 'ikeda'
	| 'logistic'
	| 'newton'
	| 'standard'
	| 'bifurcation-logistic'
	| 'bifurcation-henon'
	| 'chaos-esthetique'
	| 'lyapunov'
	| 'chua';

export type LorenzSolver = 'euler' | 'rk2' | 'rk4';
export type LorenzColorMode = 'time' | 'speed' | 'zheight' | 'divergence' | 'single';
export type LorenzTrailStyle = 'comet' | 'cumulative';
export type LorenzViewMode = '3d' | 'xy' | 'xz' | 'yz';

// Parameter interfaces for each chaos map type
export interface LorenzParameters {
	type: 'lorenz';
	sigma: number;
	rho: number;
	beta: number;
	// Optional extended controls (added by the control-suite feature).
	// All optional for backward compatibility with legacy σ/ρ/β-only configs.
	x0?: number;
	y0?: number;
	z0?: number;
	epsilon?: number;
	showGhost?: boolean;
	solver?: LorenzSolver;
	dt?: number;
	stepsPerFrame?: number;
	speed?: number;
	colorMode?: LorenzColorMode;
	trailLength?: number;
	trailStyle?: LorenzTrailStyle;
	viewMode?: LorenzViewMode;
	autoRotate?: boolean;
	rotationSpeed?: number;
	zoom?: number;
}

export interface RosslerParameters {
	type: 'rossler';
	a: number;
	b: number;
	c: number;
}

export interface HenonParameters {
	type: 'henon';
	a: number;
	b: number;
	iterations: number;
}

export interface LoziParameters {
	type: 'lozi';
	a: number;
	b: number;
	x0: number;
	y0: number;
	iterations: number;
}

export type IkedaRenderMode = 'single' | 'multi';
export type IkedaColorMode = 'single' | 'iteration' | 'seed' | 'radius';

export interface IkedaParameters {
	type: 'ikeda';
	// Required system + initial-condition parameters
	u: number;
	x0: number;
	y0: number;
	iterations: number;
	burnIn: number;
	// Optional render state — persisted so save/share/snapshot reproduce exactly.
	renderMode?: IkedaRenderMode;
	seeds?: number;
	colorMode?: IkedaColorMode;
	pointSize?: number;
	opacity?: number;
}

export interface LogisticParameters {
	type: 'logistic';
	r: number;
	x0: number;
	iterations: number;
}

export interface NewtonParameters {
	type: 'newton';
	xMin: number;
	xMax: number;
	yMin: number;
	yMax: number;
	maxIterations: number;
}

export interface StandardParameters {
	type: 'standard';
	k: number;
	numP: number;
	numQ: number;
	iterations: number;
}

export interface BifurcationLogisticParameters {
	type: 'bifurcation-logistic';
	rMin: number;
	rMax: number;
	maxIterations: number;
}

export interface BifurcationHenonParameters {
	type: 'bifurcation-henon';
	aMin: number;
	aMax: number;
	b: number;
	maxIterations: number;
}

export interface ChaosEsthetiqueParameters {
	type: 'chaos-esthetique';
	a: number;
	b: number;
	x0: number;
	y0: number;
	iterations: number;
}

export interface LyapunovParameters {
	type: 'lyapunov';
	rMin: number;
	rMax: number;
	iterations: number;
	transientIterations: number;
}

/**
 * Chua parameters shared/saved between sessions.
 *
 * Note: The solver (ChuaParams in chua.ts) also includes integration settings
 * (dt, steps, x0/y0/z0) that are session-local and NOT persisted. Loading a
 * saved Chua config restores the math parameters but uses the page's current
 * dt and trailLength, so the trajectory may differ from the original session.
 */
export interface ChuaParameters {
	type: 'chua';
	alpha: number;
	beta: number;
	gamma: number;
	a: number;
	b: number;
}

// Union type for all chaos map parameters
export type ChaosMapParameters =
	| LorenzParameters
	| RosslerParameters
	| HenonParameters
	| LoziParameters
	| IkedaParameters
	| LogisticParameters
	| NewtonParameters
	| StandardParameters
	| BifurcationLogisticParameters
	| BifurcationHenonParameters
	| ChaosEsthetiqueParameters
	| LyapunovParameters
	| ChuaParameters;

// Display names for chaos map types (UPPERCASE_SNAKE_CASE per constitution)
export const CHAOS_MAP_DISPLAY_NAMES: Record<ChaosMapType, string> = {
	lorenz: 'LORENZ_ATTRACTOR',
	rossler: 'RÖSSLER_ATTRACTOR',
	henon: 'HÉNON_MAP',
	lozi: 'LOZI_MAP',
	ikeda: 'IKEDA_MAP',
	logistic: 'LOGISTIC_MAP',
	newton: 'NEWTON_FRACTAL',
	standard: 'STANDARD_MAP',
	'bifurcation-logistic': 'BIFURCATION_LOGISTIC',
	'bifurcation-henon': 'BIFURCATION_HÉNON',
	'chaos-esthetique': 'CHAOS_ESTHÉTIQUE',
	lyapunov: 'LYAPUNOV_EXPONENTS',
	chua: 'CHUA_CIRCUIT'
};

// Valid chaos map types array for validation
export const VALID_MAP_TYPES: ChaosMapType[] = [
	'lorenz',
	'rossler',
	'henon',
	'lozi',
	'ikeda',
	'logistic',
	'newton',
	'standard',
	'bifurcation-logistic',
	'bifurcation-henon',
	'chaos-esthetique',
	'lyapunov',
	'chua'
];

// Saved configuration discriminated union (matches Drizzle schema)
export type SavedConfiguration = {
	id: string;
	userId: string;
	name: string;
	createdAt: string;
	updatedAt: string;
} & (
	| {
			mapType: 'lorenz';
			parameters: LorenzParameters;
	  }
	| {
			mapType: 'rossler';
			parameters: RosslerParameters;
	  }
	| {
			mapType: 'henon';
			parameters: HenonParameters;
	  }
	| {
			mapType: 'lozi';
			parameters: LoziParameters;
	  }
	| {
			mapType: 'ikeda';
			parameters: IkedaParameters;
	  }
	| {
			mapType: 'logistic';
			parameters: LogisticParameters;
	  }
	| {
			mapType: 'newton';
			parameters: NewtonParameters;
	  }
	| {
			mapType: 'standard';
			parameters: StandardParameters;
	  }
	| {
			mapType: 'bifurcation-logistic';
			parameters: BifurcationLogisticParameters;
	  }
	| {
			mapType: 'bifurcation-henon';
			parameters: BifurcationHenonParameters;
	  }
	| {
			mapType: 'chaos-esthetique';
			parameters: ChaosEsthetiqueParameters;
	  }
	| {
			mapType: 'lyapunov';
			parameters: LyapunovParameters;
	  }
	| {
			mapType: 'chua';
			parameters: ChuaParameters;
	  }
);
