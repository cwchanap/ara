// src/lib/lorenz/colors.ts
import type { LorenzResult } from './integrators';
import type { LorenzColorMode } from '$lib/types';

// Neon palette (matches existing Lorenz gradient): cyan -> magenta.
const CYAN = { r: 0x00 / 255, g: 0xf3 / 255, b: 0xff / 255 };
const MAGENTA = { r: 0xbc / 255, g: 0x13 / 255, b: 0xfe / 255 };

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function clamp01(v: number): number {
	return v < 0 ? 0 : v > 1 ? 1 : v;
}

function writeGradient(colors: Float32Array, i: number, t: number): void {
	const c = clamp01(t);
	colors[i * 3] = lerp(CYAN.r, MAGENTA.r, c);
	colors[i * 3 + 1] = lerp(CYAN.g, MAGENTA.g, c);
	colors[i * 3 + 2] = lerp(CYAN.b, MAGENTA.b, c);
}

function writeSingle(colors: Float32Array, i: number): void {
	colors[i * 3] = CYAN.r;
	colors[i * 3 + 1] = CYAN.g;
	colors[i * 3 + 2] = CYAN.b;
}

/**
 * Per-vertex RGB color buffer for the given mode. Length = points * 3.
 * Divergence mode requires `opts.ghost`; without it, falls back to single color.
 */
export function computeColors(
	result: LorenzResult,
	mode: LorenzColorMode,
	opts: { ghost?: LorenzResult } = {}
): Float32Array {
	const n = result.speeds.length;
	const colors = new Float32Array(n * 3);
	if (n === 0) return colors;

	if (mode === 'single') {
		for (let i = 0; i < n; i++) writeSingle(colors, i);
		return colors;
	}

	if (mode === 'time') {
		for (let i = 0; i < n; i++) writeGradient(colors, i, i / (n - 1 || 1));
		return colors;
	}

	if (mode === 'speed') {
		let max = 0;
		for (let i = 0; i < n; i++) if (result.speeds[i] > max) max = result.speeds[i];
		for (let i = 0; i < n; i++) writeGradient(colors, i, max > 0 ? result.speeds[i] / max : 0);
		return colors;
	}

	if (mode === 'zheight') {
		let min = Infinity;
		let max = -Infinity;
		for (let i = 0; i < n; i++) {
			const z = result.positions[i * 3 + 2];
			if (z < min) min = z;
			if (z > max) max = z;
		}
		const range = max - min || 1;
		for (let i = 0; i < n; i++) {
			writeGradient(colors, i, (result.positions[i * 3 + 2] - min) / range);
		}
		return colors;
	}

	// divergence
	const ghost = opts.ghost;
	if (!ghost) {
		for (let i = 0; i < n; i++) writeSingle(colors, i);
		return colors;
	}
	const m = Math.min(n, ghost.speeds.length);
	const dist = new Float32Array(n);
	let max = 0;
	for (let i = 0; i < m; i++) {
		const dx = result.positions[i * 3] - ghost.positions[i * 3];
		const dy = result.positions[i * 3 + 1] - ghost.positions[i * 3 + 1];
		const dz = result.positions[i * 3 + 2] - ghost.positions[i * 3 + 2];
		const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
		dist[i] = d;
		if (d > max) max = d;
	}
	for (let i = 0; i < n; i++) writeGradient(colors, i, max > 0 ? dist[i] / max : 0);
	return colors;
}
