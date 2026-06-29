/**
 * Gumowski–Mira Map Calculation
 *
 * The Gumowski–Mira map is a 2D discrete nonlinear system:
 *   g(x)   = μ·x + 2(1−μ)·x² / (1 + x²)
 *   x(n+1) = y + a·(1 − b·y²)·y + g(x)
 *   y(n+1) = −x + g(x(n+1))
 *
 * Depending on μ the system moves between smooth invariant curves (μ < 0),
 * island chains (0 < μ < ~0.5), and fully chaotic seas (μ > ~0.5).
 * Multi-seed scattering uses a deterministic PRNG so saved/shared configs
 * reproduce exactly.
 */

import { mulberry32 } from './ikeda';

export interface GumowskiMiraParams {
	mu: number;
	a: number;
	b: number;
	x0: number;
	y0: number;
	iterations: number;
	burnIn: number;
}

export interface GumowskiMiraMultiSeedParams {
	mu: number;
	a: number;
	b: number;
	iterations: number;
	burnIn: number;
	seeds: number;
	/** Optional cap on total collected points; stops early once reached. */
	maxPoints?: number;
}

export interface GumowskiMiraMultiSeedResult {
	points: [number, number][];
	/** Parallel to `points`: which seed (0-based) each point came from. */
	seedIndices: number[];
}

/** The Gumowski function g(x) = μ·x + 2(1−μ)·x²/(1+x²). */
export function gumowskiFunction(x: number, mu: number): number {
	return mu * x + (2 * (1 - mu) * x * x) / (1 + x * x);
}

/** One iteration of the Gumowski–Mira map. */
export function gumowskiMiraStep(
	x: number,
	y: number,
	mu: number,
	a: number,
	b: number
): [number, number] {
	const gx = gumowskiFunction(x, mu);
	const xNew = y + a * (1 - b * y * y) * y + gx;
	const gxNew = gumowskiFunction(xNew, mu);
	const yNew = -x + gxNew;
	return [xNew, yNew];
}

/**
 * Single-orbit trajectory as [x, y] tuples (Canvas/D3-friendly). The first
 * `burnIn` iterations are discarded as transient. Stops early if a value
 * becomes non-finite.
 */
export function calculateGumowskiMiraTuples(params: GumowskiMiraParams): [number, number][] {
	const { mu, a, b, x0, y0, iterations, burnIn } = params;
	if (iterations <= 0) return [];
	const points: [number, number][] = [];
	let x = x0;
	let y = y0;
	for (let i = 0; i < iterations; i++) {
		[x, y] = gumowskiMiraStep(x, y, mu, a, b);
		if (!Number.isFinite(x) || !Number.isFinite(y)) break;
		if (i >= burnIn) points.push([x, y]);
	}
	return points;
}

/** Fixed seed so the multi-seed attractor is byte-identical across runs. */
const MULTI_SEED_RNG_SEED = 0x9e60f101; // gumowski-mira dedicated seed

/**
 * Multi-seed attractor: scatter `seeds` deterministic starting points across a
 * bounded box, iterate each, discard the first `burnIn` points per orbit, and
 * collect the rest into one point cloud.
 */
export function calculateGumowskiMiraMultiSeed(
	params: GumowskiMiraMultiSeedParams
): GumowskiMiraMultiSeedResult {
	const { mu, a, b, iterations, burnIn, seeds, maxPoints } = params;
	if (seeds <= 0 || iterations <= 0) return { points: [], seedIndices: [] };
	if (typeof maxPoints === 'number' && maxPoints <= 0) return { points: [], seedIndices: [] };
	const cap = maxPoints ?? Infinity;
	const points: [number, number][] = [];
	const seedIndices: number[] = [];
	const rand = mulberry32(MULTI_SEED_RNG_SEED);
	for (let s = 0; s < seeds && points.length < cap; s++) {
		let x = rand() * 2 - 1;
		let y = rand() * 2 - 1;
		for (let i = 0; i < iterations; i++) {
			[x, y] = gumowskiMiraStep(x, y, mu, a, b);
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
