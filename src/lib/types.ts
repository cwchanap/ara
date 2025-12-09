// Shared types used across client and server code

export interface Profile {
	id: string;
	username: string;
	// Timestamps are strings due to Drizzle mode: 'string' configuration
	createdAt: string;
	updatedAt: string;
}

// Chaos Map Types - the 8 supported visualization types
export type ChaosMapType =
	| 'lorenz'
	| 'henon'
	| 'logistic'
	| 'newton'
	| 'standard'
	| 'bifurcation-logistic'
	| 'bifurcation-henon'
	| 'chaos-esthetique';

// Parameter interfaces for each chaos map type
export interface LorenzParameters {
	type: 'lorenz';
	sigma: number;
	rho: number;
	beta: number;
}

export interface HenonParameters {
	type: 'henon';
	a: number;
	b: number;
	iterations: number;
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
	K: number;
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

// Union type for all chaos map parameters
export type ChaosMapParameters =
	| LorenzParameters
	| HenonParameters
	| LogisticParameters
	| NewtonParameters
	| StandardParameters
	| BifurcationLogisticParameters
	| BifurcationHenonParameters
	| ChaosEsthetiqueParameters;

// Display names for chaos map types (UPPERCASE_SNAKE_CASE per constitution)
export const CHAOS_MAP_DISPLAY_NAMES: Record<ChaosMapType, string> = {
	lorenz: 'LORENZ_ATTRACTOR',
	henon: 'HÉNON_MAP',
	logistic: 'LOGISTIC_MAP',
	newton: 'NEWTON_FRACTAL',
	standard: 'STANDARD_MAP',
	'bifurcation-logistic': 'BIFURCATION_LOGISTIC',
	'bifurcation-henon': 'BIFURCATION_HÉNON',
	'chaos-esthetique': 'CHAOS_ESTHÉTIQUE'
};

// Valid chaos map types array for validation
export const VALID_MAP_TYPES: ChaosMapType[] = [
	'lorenz',
	'henon',
	'logistic',
	'newton',
	'standard',
	'bifurcation-logistic',
	'bifurcation-henon',
	'chaos-esthetique'
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
			mapType: 'henon';
			parameters: HenonParameters;
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
);
