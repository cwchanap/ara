/**
 * Clifford Attractor Calculation
 *
 * The Clifford attractor is a 2D iterative map:
 *   xₙ₊₁ = sin(a·yₙ) + c·cos(a·xₙ)
 *   yₙ₊₁ = sin(b·xₙ) + d·cos(b·yₙ)
 *
 * Because sin/cos ∈ [−1, 1], every iterate is bounded
 * (|x| ≤ 1+|c|, |y| ≤ 1+|d|) and can never diverge or become non-finite from
 * finite inputs. The attractor is independent of the initial point, so a fixed
 * internal seed is used and is neither exposed nor persisted.
 */

export interface CliffordParams {
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	/** Optional cap on collected points; stops early once reached. */
	maxPoints?: number;
}

/** Fixed internal seed — the attractor is independent of initial conditions. */
const START_X = 0.1;
const START_Y = 0.1;

/**
 * A single Clifford orbit of `iterations` steps as [x, y] tuples (Canvas/D3
 * friendly). Capped at `maxPoints` when provided. Stops early if a value
 * becomes non-finite (defensive only — the map is analytically bounded).
 */
export function calculateCliffordTuples(params: CliffordParams): [number, number][] {
	const { a, b, c, d, iterations } = params;
	if (iterations <= 0) return [];
	const cap = params.maxPoints ?? Infinity;
	if (cap <= 0) return [];

	const points: [number, number][] = [];
	let x = START_X;
	let y = START_Y;
	for (let i = 0; i < iterations && points.length < cap; i++) {
		const xNew = Math.sin(a * y) + c * Math.cos(a * x);
		const yNew = Math.sin(b * x) + d * Math.cos(b * y);
		if (!Number.isFinite(xNew) || !Number.isFinite(yNew)) break;
		x = xNew;
		y = yNew;
		points.push([x, y]);
	}
	return points;
}
