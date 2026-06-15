import { describe, it, expect } from 'vitest';
import {
	derivatives,
	rk4Step,
	bobPositions,
	divergence,
	randomizeInitialConditions,
	isFiniteState,
	wrapAngle,
	type PendulumState,
	type PendulumPhysics
} from './double-pendulum';

const PHYS: PendulumPhysics = { l1: 1, l2: 1, m1: 1, m2: 1, gravity: 9.81, damping: 0 };

function totalEnergy(s: PendulumState, p: PendulumPhysics): number {
	// Kinetic + potential energy of a double pendulum (y measured downward,
	// so potential energy uses -cos(theta) relative to the pivot).
	const { l1, l2, m1, m2, gravity: g } = p;
	const v1sq = l1 * l1 * s.omega1 * s.omega1;
	const v2sq =
		l1 * l1 * s.omega1 * s.omega1 +
		l2 * l2 * s.omega2 * s.omega2 +
		2 * l1 * l2 * s.omega1 * s.omega2 * Math.cos(s.theta1 - s.theta2);
	const ke = 0.5 * m1 * v1sq + 0.5 * m2 * v2sq;
	const y1 = -l1 * Math.cos(s.theta1);
	const y2 = -l1 * Math.cos(s.theta1) - l2 * Math.cos(s.theta2);
	const pe = m1 * g * y1 + m2 * g * y2;
	return ke + pe;
}

describe('derivatives', () => {
	it('returns zero angular acceleration at stable rest (hanging straight down)', () => {
		const d = derivatives({ theta1: 0, theta2: 0, omega1: 0, omega2: 0 }, PHYS);
		expect(d.dTheta1).toBe(0);
		expect(d.dTheta2).toBe(0);
		expect(Math.abs(d.dOmega1)).toBeLessThan(1e-9);
		expect(Math.abs(d.dOmega2)).toBeLessThan(1e-9);
	});

	it('feeds omega into dTheta', () => {
		const d = derivatives({ theta1: 0.3, theta2: -0.2, omega1: 1.5, omega2: -0.7 }, PHYS);
		expect(d.dTheta1).toBe(1.5);
		expect(d.dTheta2).toBe(-0.7);
	});

	it('applies viscous damping to angular acceleration', () => {
		const damped: PendulumPhysics = { ...PHYS, damping: 0.5 };
		const s: PendulumState = { theta1: 0, theta2: 0, omega1: 2, omega2: 2 };
		const undampedD = derivatives(s, PHYS);
		const dampedD = derivatives(s, damped);
		expect(dampedD.dOmega1).toBeCloseTo(undampedD.dOmega1 - 0.5 * 2, 9);
		expect(dampedD.dOmega2).toBeCloseTo(undampedD.dOmega2 - 0.5 * 2, 9);
	});
});

describe('rk4Step', () => {
	it('keeps a pendulum at rest at rest', () => {
		const s: PendulumState = { theta1: 0, theta2: 0, omega1: 0, omega2: 0 };
		const next = rk4Step(s, PHYS, 0.01);
		expect(next.theta1).toBeCloseTo(0, 9);
		expect(next.theta2).toBeCloseTo(0, 9);
		expect(next.omega1).toBeCloseTo(0, 9);
		expect(next.omega2).toBeCloseTo(0, 9);
	});

	it('approximately conserves energy with damping = 0 over many steps', () => {
		// Use a non-degenerate start: at theta1=theta2=PI/2 the total energy is
		// exactly 0, which makes a *relative* tolerance check meaningless.
		let s: PendulumState = { theta1: 1, theta2: 0.5, omega1: 0, omega2: 0 };
		const e0 = totalEnergy(s, PHYS);
		for (let i = 0; i < 2000; i++) s = rk4Step(s, PHYS, 0.005);
		const e1 = totalEnergy(s, PHYS);
		expect(Math.abs(e1 - e0)).toBeLessThan(0.05 * Math.abs(e0));
	});

	it('produces finite output for an energetic start', () => {
		let s: PendulumState = { theta1: 3, theta2: -3, omega1: 5, omega2: -5 };
		for (let i = 0; i < 500; i++) s = rk4Step(s, PHYS, 0.005);
		expect(isFiniteState(s)).toBe(true);
	});
});

describe('bobPositions', () => {
	it('hangs straight down at theta = 0 (y positive downward)', () => {
		const pos = bobPositions({ theta1: 0, theta2: 0, omega1: 0, omega2: 0 }, PHYS);
		expect(pos.x1).toBeCloseTo(0, 9);
		expect(pos.y1).toBeCloseTo(1, 9);
		expect(pos.x2).toBeCloseTo(0, 9);
		expect(pos.y2).toBeCloseTo(2, 9);
	});

	it('points horizontally at theta = PI/2', () => {
		const pos = bobPositions(
			{ theta1: Math.PI / 2, theta2: Math.PI / 2, omega1: 0, omega2: 0 },
			PHYS
		);
		expect(pos.x1).toBeCloseTo(1, 9);
		expect(pos.y1).toBeCloseTo(0, 9);
		expect(pos.x2).toBeCloseTo(2, 9);
		expect(pos.y2).toBeCloseTo(0, 9);
	});
});

describe('divergence', () => {
	it('is zero for identical states', () => {
		const s: PendulumState = { theta1: 1, theta2: 0.5, omega1: 0, omega2: 0 };
		expect(divergence(s, s, PHYS)).toBe(0);
	});

	it('is positive and symmetric for differing states', () => {
		const a: PendulumState = { theta1: 1, theta2: 0.5, omega1: 0, omega2: 0 };
		const b: PendulumState = { theta1: 1.1, theta2: 0.5, omega1: 0, omega2: 0 };
		expect(divergence(a, b, PHYS)).toBeGreaterThan(0);
		expect(divergence(a, b, PHYS)).toBeCloseTo(divergence(b, a, PHYS), 12);
	});
});

describe('randomizeInitialConditions', () => {
	it('returns angles in [-PI, PI] and zero velocities using an injected RNG', () => {
		const ic = randomizeInitialConditions(() => 0.75);
		expect(ic.theta1).toBeCloseTo(Math.PI * 0.5, 9); // (0.75*2 - 1) * PI = 0.5*PI
		expect(ic.theta2).toBeCloseTo(Math.PI * 0.5, 9);
		expect(ic.omega1).toBe(0);
		expect(ic.omega2).toBe(0);
	});
});

describe('isFiniteState', () => {
	it('rejects NaN and Infinity', () => {
		expect(isFiniteState({ theta1: NaN, theta2: 0, omega1: 0, omega2: 0 })).toBe(false);
		expect(isFiniteState({ theta1: 0, theta2: 0, omega1: Infinity, omega2: 0 })).toBe(false);
		expect(isFiniteState({ theta1: 0, theta2: 0, omega1: 0, omega2: 0 })).toBe(true);
	});
});

describe('wrapAngle', () => {
	it('leaves angles already in [-PI, PI] unchanged', () => {
		expect(wrapAngle(0)).toBeCloseTo(0, 12);
		expect(wrapAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2, 12);
		expect(wrapAngle(-Math.PI / 3)).toBeCloseTo(-Math.PI / 3, 12);
	});

	it('wraps a full turn back to zero', () => {
		expect(wrapAngle(2 * Math.PI)).toBeCloseTo(0, 9);
		expect(wrapAngle(-2 * Math.PI)).toBeCloseTo(0, 9);
	});

	it('wraps large accumulated angles into [-PI, PI]', () => {
		const large = 12345.678;
		const wrapped = wrapAngle(large);
		expect(wrapped).toBeGreaterThanOrEqual(-Math.PI);
		expect(wrapped).toBeLessThanOrEqual(Math.PI);
		// Same position on the unit circle as the unwrapped value.
		expect(Math.sin(wrapped)).toBeCloseTo(Math.sin(large), 6);
		expect(Math.cos(wrapped)).toBeCloseTo(Math.cos(large), 6);
	});

	it('is 2π-periodic (physics invariance)', () => {
		const a = 0.7;
		expect(wrapAngle(a + 2 * Math.PI)).toBeCloseTo(wrapAngle(a), 12);
		expect(wrapAngle(a - 2 * Math.PI)).toBeCloseTo(wrapAngle(a), 12);
	});
});
