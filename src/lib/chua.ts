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
