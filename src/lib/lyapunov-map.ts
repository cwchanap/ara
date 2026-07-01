/**
 * Calculates the Lyapunov exponent for the logistic map at a given parameter r.
 *
 * The logistic map is: x_{n+1} = r * x_n * (1 - x_n)
 *
 * The Lyapunov exponent is computed as the average log of the absolute derivative:
 *   λ = (1/N) * Σ log(|dx/dx_n|) = (1/N) * Σ log(|r * (1 - 2*x)|)
 *
 * @param r - The parameter (typically 0 to 4 for logistic map)
 * @param iterations - Number of iterations to compute the exponent
 * @param transientIterations - Number of transient iterations to discard before sampling
 * @returns The Lyapunov exponent (positive → chaotic, negative → stable) or null if no valid iterations
 */
export function calculateLyapunovExponent(
	r: number,
	iterations: number,
	transientIterations: number
): number | null {
	let x = 0.5;

	for (let i = 0; i < transientIterations; i++) {
		x = r * x * (1 - x);
		if (x < 1e-10 || x > 1 - 1e-10) x = 0.5;
	}

	let sum = 0;
	let validIterations = 0;

	for (let i = 0; i < iterations; i++) {
		x = r * x * (1 - x);
		const derivative = Math.abs(r * (1 - 2 * x));
		if (derivative > 0 && x > 1e-10 && x < 1 - 1e-10) {
			sum += Math.log(derivative);
			validIterations++;
		} else if (x < 1e-10 || x > 1 - 1e-10) {
			x = 0.5;
		}
	}

	return validIterations > 0 ? sum / validIterations : null;
}
