/**
 * Tinkerbell Map Calculation
 *
 * The Tinkerbell map is a 2D iterative system:
 *   x(n+1) = x(n)² − y(n)² + a·x(n) + b·y(n)
 *   y(n+1) = 2·x(n)·y(n) + c·x(n) + d·y(n)
 *
 * Unlike the Clifford map (bounded by sin/cos), Tinkerbell has quadratic
 * terms and is NOT analytically bounded: for many parameter sets the orbit
 * escapes to infinity. The loop therefore guards two ways — non-finite
 * values, and a magnitude cap — dropping the offending point on escape so a
 * single runaway coordinate cannot crush the visible attractor. The
 * attractor is independent of the initial point, so a fixed internal seed is
 * used and is neither exposed nor persisted.
 */

export interface TinkerbellParams {
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	/** Optional cap on collected points; stops early once reached. */
	maxPoints?: number;
}

/** Coordinates beyond this are treated as divergence; the orbit stops. */
const MAGNITUDE_CAP = 1e6;

/** Fixed internal seed — the attractor is independent of initial conditions. */
const START_X = -0.72;
const START_Y = -0.64;

/**
 * A single Tinkerbell orbit of `iterations` steps as [x, y] tuples
 * (Canvas/D3 friendly). Capped at `maxPoints` when provided. Stops early if a
 * value becomes non-finite or exceeds `MAGNITUDE_CAP` (the runaway point is
 * not collected).
 */
export function calculateTinkerbellTuples(params: TinkerbellParams): [number, number][] {
	const { a, b, c, d, iterations } = params;
	if (iterations <= 0) return [];
	const cap = params.maxPoints ?? Infinity;
	if (cap <= 0) return [];

	const points: [number, number][] = [];
	let x = START_X;
	let y = START_Y;
	for (let i = 0; i < iterations && points.length < cap; i++) {
		const xNew = x * x - y * y + a * x + b * y;
		const yNew = 2 * x * y + c * x + d * y;
		if (
			!Number.isFinite(xNew) ||
			!Number.isFinite(yNew) ||
			Math.abs(xNew) > MAGNITUDE_CAP ||
			Math.abs(yNew) > MAGNITUDE_CAP
		) {
			break;
		}
		x = xNew;
		y = yNew;
		points.push([x, y]);
	}
	return points;
}
