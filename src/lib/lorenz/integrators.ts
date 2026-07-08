// src/lib/lorenz/integrators.ts
import type { LorenzSolver } from '$lib/types';

export type Solver = LorenzSolver;

export interface LorenzPoint {
	x: number;
	y: number;
	z: number;
}

export interface LorenzIntegrationParams {
	sigma: number;
	rho: number;
	beta: number;
	x0: number;
	y0: number;
	z0: number;
	solver: Solver;
	dt: number;
	steps: number;
}

export interface LorenzResult {
	/** Flat [x, y, z, …], length = steps * 3, ready for BufferGeometry.setAttribute('position', …). */
	positions: Float32Array;
	/** |derivative| at each integrated point, length = steps. */
	speeds: Float32Array;
	/** True if integration stopped early because a value became non-finite. */
	diverged: boolean;
}

interface Derivatives {
	dx: number;
	dy: number;
	dz: number;
}

export function lorenzDeriv(
	x: number,
	y: number,
	z: number,
	sigma: number,
	rho: number,
	beta: number
): Derivatives {
	return {
		dx: sigma * (y - x),
		dy: x * (rho - z) - y,
		dz: x * y - beta * z
	};
}

/** Advance one integration step using the selected solver. */
export function step(state: LorenzPoint, p: LorenzIntegrationParams): LorenzPoint {
	const { sigma, rho, beta, dt, solver } = p;
	const { x, y, z } = state;
	const k1 = lorenzDeriv(x, y, z, sigma, rho, beta);

	if (solver === 'euler') {
		return { x: x + dt * k1.dx, y: y + dt * k1.dy, z: z + dt * k1.dz };
	}

	if (solver === 'rk2') {
		// Midpoint method.
		const k2 = lorenzDeriv(
			x + (dt / 2) * k1.dx,
			y + (dt / 2) * k1.dy,
			z + (dt / 2) * k1.dz,
			sigma,
			rho,
			beta
		);
		return { x: x + dt * k2.dx, y: y + dt * k2.dy, z: z + dt * k2.dz };
	}

	// rk4 (classic 4th-order Runge–Kutta).
	const k2 = lorenzDeriv(
		x + (dt / 2) * k1.dx,
		y + (dt / 2) * k1.dy,
		z + (dt / 2) * k1.dz,
		sigma,
		rho,
		beta
	);
	const k3 = lorenzDeriv(
		x + (dt / 2) * k2.dx,
		y + (dt / 2) * k2.dy,
		z + (dt / 2) * k2.dz,
		sigma,
		rho,
		beta
	);
	const k4 = lorenzDeriv(x + dt * k3.dx, y + dt * k3.dy, z + dt * k3.dz, sigma, rho, beta);
	return {
		x: x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
		y: y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy),
		z: z + (dt / 6) * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz)
	};
}

/**
 * Integrate the Lorenz system into flat typed arrays.
 * Stops early and sets `diverged = true` on any non-finite component, leaving
 * the remainder of the buffers as zeros so geometry never receives NaN/Infinity.
 */
export function integrate(p: LorenzIntegrationParams): LorenzResult {
	const steps = Math.max(0, Math.floor(p.steps));
	const positions = new Float32Array(steps * 3);
	const speeds = new Float32Array(steps);

	let x = p.x0;
	let y = p.y0;
	let z = p.z0;

	for (let i = 0; i < steps; i++) {
		const next = step({ x, y, z }, p);
		if (!Number.isFinite(next.x) || !Number.isFinite(next.y) || !Number.isFinite(next.z)) {
			return { positions, speeds, diverged: true };
		}
		x = next.x;
		y = next.y;
		z = next.z;
		positions[i * 3] = x;
		positions[i * 3 + 1] = y;
		positions[i * 3 + 2] = z;
		const d = lorenzDeriv(x, y, z, p.sigma, p.rho, p.beta);
		speeds[i] = Math.sqrt(d.dx * d.dx + d.dy * d.dy + d.dz * d.dz);
	}

	return { positions, speeds, diverged: false };
}
