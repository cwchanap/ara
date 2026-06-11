/**
 * Ikeda Map Calculation
 *
 * The Ikeda map is a 2D discrete nonlinear-optical-feedback system:
 *   tₙ   = 0.4 − 6 / (1 + xₙ² + yₙ²)
 *   xₙ₊₁ = 1 + u·(xₙ·cos tₙ − yₙ·sin tₙ)
 *   yₙ₊₁ = u·(xₙ·sin tₙ + yₙ·cos tₙ)
 *
 * `u` is the feedback parameter; the classic chaotic attractor occurs near u ≈ 0.918.
 * Multi-seed scattering uses a deterministic PRNG so saved/shared configs reproduce exactly.
 */

export interface IkedaPoint {
	x: number;
	y: number;
}

export interface IkedaParams {
	u: number;
	x0: number;
	y0: number;
	iterations: number;
	burnIn: number;
}

export interface IkedaMultiSeedParams {
	u: number;
	iterations: number;
	burnIn: number;
	seeds: number;
	/** Optional cap on total collected points; stops early once reached. */
	maxPoints?: number;
}

export interface IkedaMultiSeedResult {
	points: [number, number][];
	/** Parallel to `points`: which seed (0-based) each point came from. */
	seedIndices: number[];
}

/** One iteration of the Ikeda map. */
function ikedaStep(x: number, y: number, u: number): [number, number] {
	const t = 0.4 - 6 / (1 + x * x + y * y);
	const sinT = Math.sin(t);
	const cosT = Math.cos(t);
	const xNew = 1 + u * (x * cosT - y * sinT);
	const yNew = u * (x * sinT + y * cosT);
	return [xNew, yNew];
}

/**
 * Single-orbit trajectory from (x0, y0). The first `burnIn` iterations are
 * discarded as transient. Stops early if a value becomes non-finite.
 */
export function calculateIkeda(params: IkedaParams): IkedaPoint[] {
	const { u, x0, y0, iterations, burnIn } = params;
	if (iterations <= 0) return [];
	const points: IkedaPoint[] = [];
	let x = x0;
	let y = y0;
	for (let i = 0; i < iterations; i++) {
		[x, y] = ikedaStep(x, y, u);
		if (!Number.isFinite(x) || !Number.isFinite(y)) break;
		if (i >= burnIn) points.push({ x, y });
	}
	return points;
}

/** Single-orbit trajectory as [x, y] tuples (Canvas/D3-friendly). */
export function calculateIkedaTuples(params: IkedaParams): [number, number][] {
	const { u, x0, y0, iterations, burnIn } = params;
	if (iterations <= 0) return [];
	const points: [number, number][] = [];
	let x = x0;
	let y = y0;
	for (let i = 0; i < iterations; i++) {
		[x, y] = ikedaStep(x, y, u);
		if (!Number.isFinite(x) || !Number.isFinite(y)) break;
		if (i >= burnIn) points.push([x, y]);
	}
	return points;
}

/** Deterministic 32-bit PRNG (mulberry32). Same seed → same sequence. */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Fixed seed so the multi-seed attractor is byte-identical across runs. */
const MULTI_SEED_RNG_SEED = 0x1abe11ed;

/**
 * Multi-seed attractor: scatter `seeds` deterministic starting points across a
 * bounded box, iterate each, discard the first `burnIn` points per orbit, and
 * collect the rest into one point cloud.
 */
export function calculateIkedaMultiSeed(params: IkedaMultiSeedParams): IkedaMultiSeedResult {
	const { u, iterations, burnIn, seeds, maxPoints } = params;
	// Non-positive seeds or iterations → empty result.
	if (seeds <= 0 || iterations <= 0) return { points: [], seedIndices: [] };
	// Non-positive maxPoints → empty result (aligned with standardMap / calculateChaos).
	// undefined → no cap (uncapped).
	if (typeof maxPoints === 'number' && maxPoints <= 0) return { points: [], seedIndices: [] };
	const cap = maxPoints ?? Infinity;
	const points: [number, number][] = [];
	const seedIndices: number[] = [];
	const rand = mulberry32(MULTI_SEED_RNG_SEED);
	for (let s = 0; s < seeds && points.length < cap; s++) {
		// Starting box roughly enclosing the attractor: x ∈ [-0.5, 1.5], y ∈ [-0.5, 0.5]
		let x = rand() * 2 - 0.5;
		let y = rand() * 1 - 0.5;
		for (let i = 0; i < iterations; i++) {
			[x, y] = ikedaStep(x, y, u);
			if (!Number.isFinite(x) || !Number.isFinite(y)) break;
			if (i >= burnIn) {
				points.push([x, y]);
				seedIndices.push(s);
				if (points.length >= cap) break;
			}
		}
	}
	return { points, seedIndices };
}
