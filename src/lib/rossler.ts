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
 * Calculate Rössler attractor trajectory using 4th-order Runge–Kutta (RK4) integration.
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

	const derivatives = (xVal: number, yVal: number, zVal: number) => {
		return {
			dx: -yVal - zVal,
			dy: xVal + a * yVal,
			dz: b + zVal * (xVal - c)
		};
	};

	for (let i = 0; i < steps; i++) {
		const k1 = derivatives(x, y, z);
		const k2 = derivatives(x + (dt * k1.dx) / 2, y + (dt * k1.dy) / 2, z + (dt * k1.dz) / 2);
		const k3 = derivatives(x + (dt * k2.dx) / 2, y + (dt * k2.dy) / 2, z + (dt * k2.dz) / 2);
		const k4 = derivatives(x + dt * k3.dx, y + dt * k3.dy, z + dt * k3.dz);

		const nextX = x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx);
		const nextY = y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy);
		const nextZ = z + (dt / 6) * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz);

		x = nextX;
		y = nextY;
		z = nextZ;

		points.push({ x, y, z });
	}

	return points;
}
