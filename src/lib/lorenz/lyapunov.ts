// src/lib/lorenz/lyapunov.ts
import { classifyLyapunov, type LyapunovEstimate } from '$lib/chua';
import { lorenzDeriv, type LorenzIntegrationParams, type LorenzPoint } from './integrators';

/**
 * Fixed step budget for the λ₁ estimate, independent of the display trail length.
 * The Benettin estimate converges slowly from the off-attractor start (0.1, 0, 0):
 * ~0.37 at 8k steps but ~0.82 (near the textbook 0.9056) by 20k steps, where it
 * plateaus. 20k keeps the displayed value meaningful at ~1ms compute cost.
 */
export const LYAPUNOV_STEPS = 20000;

function rk4(
	state: LorenzPoint,
	sigma: number,
	rho: number,
	beta: number,
	dt: number
): LorenzPoint {
	const { x, y, z } = state;
	const k1 = lorenzDeriv(x, y, z, sigma, rho, beta);
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
 * Estimate the largest Lyapunov exponent with the Benettin two-trajectory
 * method (mirrors `$lib/chua`). Always uses RK4 internally for a stable estimate
 * even when the display solver is Euler/RK2, and its own fixed step budget.
 */
export function estimateLargestLyapunov(params: LorenzIntegrationParams): LyapunovEstimate {
	const { sigma, rho, beta, x0, y0, z0, dt } = params;
	const steps = params.steps > 0 ? params.steps : LYAPUNOV_STEPS;
	const d0 = 1e-8;

	let b: LorenzPoint = { x: x0, y: y0, z: z0 };
	let p: LorenzPoint = { x: x0 + d0, y: y0, z: z0 };

	const transient = Math.min(2000, Math.floor(steps * 0.1));
	let sumLog = 0;
	let count = 0;

	for (let i = 0; i < steps; i++) {
		const nb = rk4(b, sigma, rho, beta, dt);
		const np = rk4(p, sigma, rho, beta, dt);
		if (
			!Number.isFinite(nb.x) ||
			!Number.isFinite(nb.y) ||
			!Number.isFinite(nb.z) ||
			!Number.isFinite(np.x) ||
			!Number.isFinite(np.y) ||
			!Number.isFinite(np.z)
		) {
			return { value: NaN, classification: 'marginal', diverged: true };
		}
		b = nb;
		p = np;

		if (i >= transient) {
			const dx = p.x - b.x;
			const dy = p.y - b.y;
			const dz = p.z - b.z;
			const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (Number.isFinite(dist) && dist > 0) {
				sumLog += Math.log(dist / d0);
				count++;
				const factor = d0 / dist;
				p = { x: b.x + dx * factor, y: b.y + dy * factor, z: b.z + dz * factor };
			}
		}
	}

	const value = count > 0 ? sumLog / (count * dt) : 0;
	return { value, classification: classifyLyapunov(value), diverged: false };
}
