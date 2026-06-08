/**
 * Shared types for chaos maps web worker communication.
 * Ensures type safety across worker boundary.
 */

// Request types
export interface StandardMapRequest {
	type: 'standard';
	id: number;
	numP: number;
	numQ: number;
	iterations: number;
	k: number;
	maxPoints: number;
}

export interface ChaosEsthetiqueRequest {
	type: 'chaos';
	id: number;
	a: number;
	b: number;
	x0: number;
	y0: number;
	iterations: number;
	maxPoints: number;
}

export interface IkedaRequest {
	type: 'ikeda';
	id: number;
	u: number;
	iterations: number;
	burnIn: number;
	seeds: number;
	maxPoints: number;
}

export type ChaosMapsWorkerRequest = StandardMapRequest | ChaosEsthetiqueRequest | IkedaRequest;

// Response types
export interface StandardMapResponse {
	type: 'standardResult';
	id: number;
	points: [number, number][];
}

export interface ChaosEsthetiqueResponse {
	type: 'chaosResult';
	id: number;
	points: [number, number][];
}

export interface IkedaResponse {
	type: 'ikedaResult';
	id: number;
	points: [number, number][];
	seedIndices: number[];
}

export type ChaosMapsWorkerResponse = StandardMapResponse | ChaosEsthetiqueResponse | IkedaResponse;
