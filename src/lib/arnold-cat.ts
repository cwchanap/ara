export const TWO_32 = 4294967296;

export type ArnoldCatSimState = {
	xs: Uint32Array;
	ys: Uint32Array;
	acc: number;
	iterationCount: number;
	paused: boolean;
};

export function applyArnoldCatStepInPlace(
	xs: Uint32Array,
	ys: Uint32Array,
	count = xs.length
): void {
	const n = Math.min(count, xs.length, ys.length);
	for (let i = 0; i < n; i++) {
		const x = xs[i];
		const y = ys[i];
		xs[i] = (x + y) >>> 0;
		ys[i] = (x + 2 * y) >>> 0;
	}
}

export function applyArnoldCatInverseInPlace(
	xs: Uint32Array,
	ys: Uint32Array,
	count = xs.length
): void {
	const n = Math.min(count, xs.length, ys.length);
	for (let i = 0; i < n; i++) {
		const x = xs[i];
		const y = ys[i];
		xs[i] = (2 * x - y) >>> 0;
		ys[i] = (-x + y) >>> 0;
	}
}

export function torusToPixel(coord: number, dim: number): number {
	if (dim <= 1) return 0;
	const u = (coord >>> 0) / TWO_32;
	return Math.min(dim - 1, Math.floor(u * dim));
}

export function torusToPixelY(coord: number, dim: number): number {
	if (dim <= 1) return 0;
	const v = (coord >>> 0) / TWO_32;
	return Math.min(dim - 1, Math.floor((1 - v) * dim));
}

/**
 * Advance discrete Cat Map simulation by wall-clock dt (seconds).
 * Returns whole steps applied this call.
 */
export function advanceArnoldCatSimulation(
	state: ArnoldCatSimState,
	dtSeconds: number,
	stepsPerSec: number,
	maxFrameDt: number,
	maxStepsPerFrame: number
): number {
	if (state.paused) return 0;
	let frameDt = dtSeconds;
	if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;
	const rate = Number.isFinite(stepsPerSec) ? stepsPerSec : 0;
	state.acc += Math.min(frameDt, maxFrameDt) * rate;
	// Snap near-integers so n×(1/n) frame chains (e.g. 30×1/30) yield exact whole steps.
	const nearest = Math.round(state.acc);
	if (Math.abs(state.acc - nearest) < 1e-9) {
		state.acc = nearest;
	}
	let steps = 0;
	while (state.acc >= 1 && steps < maxStepsPerFrame) {
		applyArnoldCatStepInPlace(state.xs, state.ys);
		state.iterationCount += 1;
		state.acc -= 1;
		steps += 1;
	}
	return steps;
}
