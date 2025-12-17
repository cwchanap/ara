/**
 * Rössler Attractor Calculation
 *
 * The Rössler system is defined by the following differential equations:
 * dx/dt = -y - z
 * dy/dt = x + a*y
 * dz/dt = b + z*(x - c)
 *
 * Classic parameters: a = 0.2, b = 0.2, c = 5.7
 */

export interface RosslerPoint {
	x: number;
	y: number;
	z: number;
}

export interface RosslerParams {
	x0: number;
	y0: number;
	z0: number;
	steps: number;
	dt: number;
	a: number;
	b: number;
	c: number;
}

/**
 * Calculate Rössler attractor trajectory using Euler integration.
 *
 * @param params - Initial conditions and system parameters
 * @returns Array of 3D points representing the trajectory
 */
export function calculateRossler(params: RosslerParams): RosslerPoint[] {
	const { x0, y0, z0, steps, dt, a, b, c } = params;

	const points: RosslerPoint[] = [];
	let x = x0;
	let y = y0;
	let z = z0;

	for (let i = 0; i < steps; i++) {
		// Rössler equations
		const dx = -y - z;
		const dy = x + a * y;
		const dz = b + z * (x - c);

		// Euler integration
		x += dx * dt;
		y += dy * dt;
		z += dz * dt;

		points.push({ x, y, z });
	}

	return points;
}
