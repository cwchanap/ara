/**
 * Gingerbreadman Map Calculation
 *
 * Fixed piecewise-linear map:
 *   x(n+1) = 1 − y(n) + |x(n)|
 *   y(n+1) = x(n)
 *
 * Initial conditions are user-facing. Guards: non-finite and magnitude cap
 * (1e4) — runaway points are not collected.
 */

export interface GingerbreadmanParams {
	x0: number;
	y0: number;
	iterations: number;
	maxPoints?: number;
}

export const MAGNITUDE_CAP = 1e4;

/** Quantize to a 0.001 grid via integer keys (orbit-richness tests). */
export function orbitKey(x: number, y: number): string {
	return `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
}

/**
 * Count unique orbit points under the 0.001 grid after `iterations` steps
 * (default 100_000). Stops early on non-finite or magnitude > MAGNITUDE_CAP.
 */
export function countUniqueOrbitPoints(x0: number, y0: number, iterations = 100_000): number {
	if (!Number.isFinite(iterations) || iterations <= 0) return 0;
	const steps = Math.floor(iterations);
	const seen = new Set<string>();
	let x = x0;
	let y = y0;
	for (let i = 0; i < steps; i++) {
		const xNew = 1 - y + Math.abs(x);
		const yNew = x;
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
		seen.add(orbitKey(x, y));
	}
	return seen.size;
}

export function calculateGingerbreadmanTuples(params: GingerbreadmanParams): [number, number][] {
	const { x0, y0, iterations } = params;
	if (!Number.isFinite(iterations) || iterations <= 0) return [];
	const steps = Math.floor(iterations);
	const cap = params.maxPoints ?? Infinity;
	if (cap <= 0) return [];

	const points: [number, number][] = [];
	let x = x0;
	let y = y0;
	for (let i = 0; i < steps && points.length < cap; i++) {
		const xNew = 1 - y + Math.abs(x);
		const yNew = x;
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
