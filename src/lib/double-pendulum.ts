/**
 * Double Pendulum Physics
 *
 * Two point masses on massless rigid rods, pivot fixed at the origin.
 * Angles `theta1`/`theta2` are measured from the downward vertical (radians);
 * y points downward so positions map directly to canvas coordinates.
 *
 * Equations of motion follow the standard formulation (e.g. myphysicslab),
 * with an added linear viscous damping term `-damping * omega` on each angular
 * acceleration. Integrated with classic fourth-order Runge–Kutta.
 */

export interface PendulumState {
	theta1: number;
	theta2: number;
	omega1: number;
	omega2: number;
}

export interface PendulumPhysics {
	l1: number;
	l2: number;
	m1: number;
	m2: number;
	gravity: number;
	damping: number;
}

export interface PendulumDerivatives {
	dTheta1: number;
	dTheta2: number;
	dOmega1: number;
	dOmega2: number;
}

export interface BobPositions {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/** Compute the time-derivatives of the state under the given physics. */
export function derivatives(s: PendulumState, p: PendulumPhysics): PendulumDerivatives {
	const { theta1, theta2, omega1, omega2 } = s;
	const { l1, l2, m1, m2, gravity: g, damping } = p;

	const delta = theta1 - theta2;
	const denom = 2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2);

	const dOmega1 =
		(-g * (2 * m1 + m2) * Math.sin(theta1) -
			m2 * g * Math.sin(theta1 - 2 * theta2) -
			2 *
				Math.sin(delta) *
				m2 *
				(omega2 * omega2 * l2 + omega1 * omega1 * l1 * Math.cos(delta))) /
			(l1 * denom) -
		damping * omega1;

	const dOmega2 =
		(2 *
			Math.sin(delta) *
			(omega1 * omega1 * l1 * (m1 + m2) +
				g * (m1 + m2) * Math.cos(theta1) +
				omega2 * omega2 * l2 * m2 * Math.cos(delta))) /
			(l2 * denom) -
		damping * omega2;

	return { dTheta1: omega1, dTheta2: omega2, dOmega1, dOmega2 };
}

function addScaled(s: PendulumState, d: PendulumDerivatives, h: number): PendulumState {
	return {
		theta1: s.theta1 + h * d.dTheta1,
		theta2: s.theta2 + h * d.dTheta2,
		omega1: s.omega1 + h * d.dOmega1,
		omega2: s.omega2 + h * d.dOmega2
	};
}

/** Advance one fourth-order Runge–Kutta step. Pure: returns a new state. */
export function rk4Step(s: PendulumState, p: PendulumPhysics, dt: number): PendulumState {
	const k1 = derivatives(s, p);
	const k2 = derivatives(addScaled(s, k1, dt / 2), p);
	const k3 = derivatives(addScaled(s, k2, dt / 2), p);
	const k4 = derivatives(addScaled(s, k3, dt), p);
	return {
		theta1: s.theta1 + (dt / 6) * (k1.dTheta1 + 2 * k2.dTheta1 + 2 * k3.dTheta1 + k4.dTheta1),
		theta2: s.theta2 + (dt / 6) * (k1.dTheta2 + 2 * k2.dTheta2 + 2 * k3.dTheta2 + k4.dTheta2),
		omega1: s.omega1 + (dt / 6) * (k1.dOmega1 + 2 * k2.dOmega1 + 2 * k3.dOmega1 + k4.dOmega1),
		omega2: s.omega2 + (dt / 6) * (k1.dOmega2 + 2 * k2.dOmega2 + 2 * k3.dOmega2 + k4.dOmega2)
	};
}

/** Cartesian positions of both bobs, pivot at the origin, y pointing downward. */
export function bobPositions(s: PendulumState, p: PendulumPhysics): BobPositions {
	const x1 = p.l1 * Math.sin(s.theta1);
	const y1 = p.l1 * Math.cos(s.theta1);
	const x2 = x1 + p.l2 * Math.sin(s.theta2);
	const y2 = y1 + p.l2 * Math.cos(s.theta2);
	return { x1, y1, x2, y2 };
}

/** Euclidean distance between the second bobs of two systems sharing physics `p`. */
export function divergence(a: PendulumState, b: PendulumState, p: PendulumPhysics): number {
	const pa = bobPositions(a, p);
	const pb = bobPositions(b, p);
	return Math.hypot(pa.x2 - pb.x2, pa.y2 - pb.y2);
}

/** Fresh initial conditions: angles uniform in [-PI, PI], zero velocity. RNG injectable. */
export function randomizeInitialConditions(rng: () => number = Math.random): PendulumState {
	return {
		theta1: (rng() * 2 - 1) * Math.PI,
		theta2: (rng() * 2 - 1) * Math.PI,
		omega1: 0,
		omega2: 0
	};
}

/**
 * Wrap an angle into [-PI, PI]. Safe for this system because `derivatives`
 * only consumes angles through sin/cos (2π-periodic), so wrapping never
 * changes the physics — it only prevents floating-point precision loss in
 * long-running loops where theta accumulates beyond many full turns.
 */
export function wrapAngle(a: number): number {
	return Math.atan2(Math.sin(a), Math.cos(a));
}

/** True when every field is finite (used to detect NaN/Infinity blow-up). */
export function isFiniteState(s: PendulumState): boolean {
	return (
		Number.isFinite(s.theta1) &&
		Number.isFinite(s.theta2) &&
		Number.isFinite(s.omega1) &&
		Number.isFinite(s.omega2)
	);
}
