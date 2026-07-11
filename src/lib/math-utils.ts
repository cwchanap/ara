/**
 * Clamp a value to an integer within [min, max].
 * Falls back to min when the value is not finite.
 */
export function clampInt(v: number, min: number, max: number): number {
	if (!Number.isFinite(v)) return min;
	return Math.min(max, Math.max(min, Math.round(v)));
}
