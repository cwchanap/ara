/**
 * Calculates the Logistic map time series
 *
 * Implements the recurrence relation: x(n+1) = r * x(n) * (1 - x(n))
 *
 * @param r - Growth rate parameter (typically 0 < r <= 4)
 * @param x0 - Initial value (typically 0 < x0 < 1)
 * @param iterations - Number of iterations to compute
 * @returns Array of [iteration, value] tuples representing the time series
 */
export function calculateLogistic(r: number, x0: number, iterations: number): [number, number][] {
	const points: [number, number][] = [];
	let x = x0;
	for (let i = 0; i < iterations; i++) {
		x = r * x * (1 - x);
		points.push([i, x]);
	}
	return points;
}
