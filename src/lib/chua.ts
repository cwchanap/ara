/**
 * Chua Circuit Solver
 *
 * Dimensionless Chua system (piecewise-linear 3D ODE):
 *   f(x)  = b*x + 0.5*(a - b)*(|x + 1| - |x - 1|)   // Chua diode
 *   dx/dt = alpha*(y - x - f(x))
 *   dy/dt = x - y + z
 *   dz/dt = -(beta*y + gamma*z)
 *
 * Classic double-scroll parameters: alpha = 15.6, beta = 28, gamma = 0,
 * a = -8/7, b = -5/7.
 */

/**
 * Chua diode piecewise-linear response.
 * Inner slope (|x| <= 1) is `a`; outer slope (|x| > 1) is `b`.
 */
export function chuaDiode(x: number, a: number, b: number): number {
	return b * x + 0.5 * (a - b) * (Math.abs(x + 1) - Math.abs(x - 1));
}

export interface ChuaPoint {
	x: number;
	y: number;
	z: number;
}

export interface ChuaParams {
	x0: number;
	y0: number;
	z0: number;
	steps: number;
	dt: number;
	alpha: number;
	beta: number;
	gamma: number;
	a: number;
	b: number;
}

interface Derivatives {
	dx: number;
	dy: number;
	dz: number;
}

function chuaDerivatives(
	x: number,
	y: number,
	z: number,
	alpha: number,
	beta: number,
	gamma: number,
	a: number,
	b: number
): Derivatives {
	const fx = chuaDiode(x, a, b);
	return {
		dx: alpha * (y - x - fx),
		dy: x - y + z,
		dz: -(beta * y + gamma * z)
	};
}

/**
 * Advance one RK4 step. Shared by `calculateChua` and `estimateLargestLyapunov`.
 */
function rk4Step(
	x: number,
	y: number,
	z: number,
	dt: number,
	alpha: number,
	beta: number,
	gamma: number,
	a: number,
	b: number
): ChuaPoint {
	const k1 = chuaDerivatives(x, y, z, alpha, beta, gamma, a, b);
	const k2 = chuaDerivatives(
		x + (dt * k1.dx) / 2,
		y + (dt * k1.dy) / 2,
		z + (dt * k1.dz) / 2,
		alpha,
		beta,
		gamma,
		a,
		b
	);
	const k3 = chuaDerivatives(
		x + (dt * k2.dx) / 2,
		y + (dt * k2.dy) / 2,
		z + (dt * k2.dz) / 2,
		alpha,
		beta,
		gamma,
		a,
		b
	);
	const k4 = chuaDerivatives(
		x + dt * k3.dx,
		y + dt * k3.dy,
		z + dt * k3.dz,
		alpha,
		beta,
		gamma,
		a,
		b
	);
	return {
		x: x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
		y: y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy),
		z: z + (dt / 6) * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz)
	};
}

/**
 * Calculate the Chua trajectory using 4th-order Runge–Kutta integration.
 */
export function calculateChua(params: ChuaParams): ChuaPoint[] {
	const { x0, y0, z0, steps, dt, alpha, beta, gamma, a, b } = params;
	const points: ChuaPoint[] = [];
	let x = x0;
	let y = y0;
	let z = z0;
	for (let i = 0; i < steps; i++) {
		const next = rk4Step(x, y, z, dt, alpha, beta, gamma, a, b);
		x = next.x;
		y = next.y;
		z = next.z;
		points.push({ x, y, z });
	}
	return points;
}
