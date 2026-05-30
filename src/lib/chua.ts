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

export type PoincarePlane = 'x=0' | 'y=0' | 'z=0';

export interface PoincarePoint {
	/** First in-plane coordinate. */
	u: number;
	/** Second in-plane coordinate. */
	v: number;
}

/**
 * Collect points where the trajectory crosses the chosen plane in the
 * positive direction (the normal coordinate goes from negative to >= 0).
 * In-plane coordinate mapping:
 *   x=0 -> (y, z)
 *   y=0 -> (x, z)
 *   z=0 -> (x, y)
 */
export function computePoincareSection(points: ChuaPoint[], plane: PoincarePlane): PoincarePoint[] {
	const section: PoincarePoint[] = [];
	if (points.length < 2) return section;

	const normal = (p: ChuaPoint): number => (plane === 'x=0' ? p.x : plane === 'y=0' ? p.y : p.z);
	const inPlane = (p: ChuaPoint): PoincarePoint =>
		plane === 'x=0'
			? { u: p.y, v: p.z }
			: plane === 'y=0'
				? { u: p.x, v: p.z }
				: { u: p.x, v: p.y };

	for (let i = 1; i < points.length; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		const nPrev = normal(prev);
		const nCurr = normal(curr);
		// Upward crossing only.
		if (nPrev < 0 && nCurr >= 0) {
			const denom = nCurr - nPrev;
			const t = denom === 0 ? 0 : -nPrev / denom;
			const a = inPlane(prev);
			const b = inPlane(curr);
			section.push({
				u: a.u + (b.u - a.u) * t,
				v: a.v + (b.v - a.v) * t
			});
		}
	}
	return section;
}
