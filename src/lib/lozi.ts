/**
 * Lozi Map Calculation
 *
 * The Lozi map is a piecewise-linear discrete dynamical system defined by:
 * x(n+1) = 1 + y(n) - a|x(n)|
 * y(n+1) = b * x(n)
 *
 * It serves as a piecewise-linear counterpart to the Hénon map,
 * providing a simpler mathematical structure while retaining rich chaotic dynamics.
 *
 * Classic parameters for chaotic behavior: a = 1.7, b = 0.5
 * Default parameters used in this app: a = 0.5, b = 0.3
 */

export interface LoziPoint {
	x: number;
	y: number;
}

export interface LoziParams {
	a: number;
	b: number;
	x0: number;
	y0: number;
	iterations: number;
}

/**
 * Calculate Lozi map trajectory using direct iteration.
 *
 * @param params - Initial conditions and system parameters
 * @returns Array of 2D points representing the trajectory
 */
export function calculateLozi(params: LoziParams): LoziPoint[] {
	const { a, b, x0, y0, iterations } = params;

	const points: LoziPoint[] = [];
	let x = x0;
	let y = y0;

	for (let i = 0; i < iterations; i++) {
		const xNew = 1 + y - a * Math.abs(x);
		const yNew = b * x;
		points.push({ x: xNew, y: yNew });
		x = xNew;
		y = yNew;
	}

	return points;
}

/**
 * Calculate Lozi map trajectory as tuple array for D3.js compatibility.
 *
 * @param params - Initial conditions and system parameters
 * @returns Array of [x, y] tuples representing the trajectory
 */
export function calculateLoziTuples(params: LoziParams): [number, number][] {
	const { a, b, x0, y0, iterations } = params;

	const points: [number, number][] = [];
	let x = x0;
	let y = y0;

	for (let i = 0; i < iterations; i++) {
		const xNew = 1 + y - a * Math.abs(x);
		const yNew = b * x;
		points.push([xNew, yNew]);
		x = xNew;
		y = yNew;
	}

	return points;
}
