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

export interface CliffordRequest {
	type: 'clifford';
	id: number;
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	maxPoints: number;
}

export interface TinkerbellRequest {
	type: 'tinkerbell';
	id: number;
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	maxPoints: number;
}

export interface GumowskiMiraRequest {
	type: 'gumowskiMira';
	id: number;
	mu: number;
	a: number;
	b: number;
	iterations: number;
	burnIn: number;
	seeds: number;
	maxPoints: number;
}

export type ChaosMapsWorkerRequest =
	| StandardMapRequest
	| ChaosEsthetiqueRequest
	| IkedaRequest
	| CliffordRequest
	| TinkerbellRequest
	| GumowskiMiraRequest;

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

export interface CliffordResponse {
	type: 'cliffordResult';
	id: number;
	points: [number, number][];
}

export interface TinkerbellResponse {
	type: 'tinkerbellResult';
	id: number;
	points: [number, number][];
}

export interface GumowskiMiraResponse {
	type: 'gumowskiMiraResult';
	id: number;
	points: [number, number][];
	seedIndices: number[];
}

export interface ErrorResponse {
	type: 'error';
	id: number;
	message: string;
}

export type ChaosMapsWorkerResponse =
	| StandardMapResponse
	| ChaosEsthetiqueResponse
	| IkedaResponse
	| CliffordResponse
	| TinkerbellResponse
	| GumowskiMiraResponse
	| ErrorResponse;
