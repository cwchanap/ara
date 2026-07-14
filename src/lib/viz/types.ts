export type UpdatePolicy = 'live' | 'preview' | 'commit';

export interface ParamDef {
	/** Field name in the map's ChaosMapParameters union member. */
	key: string;
	/** DOM id / label `for`. Defaults to `key` when omitted. */
	id?: string;
	/** Visible slider label (must match the page's current label text). */
	label: string;
	min: number;
	max: number;
	step: number;
	/** value.toFixed(decimals); omit ⇒ integer display (decimals = 0). */
	decimals?: number;
	default: number;
	/** Per-control drag policy. Defaults to 'live' (immediate updates). */
	updatePolicy?: UpdatePolicy;
}

export function paramDefaults(defs: ParamDef[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const d of defs) out[d.key] = d.default;
	return out;
}

export function clampToDef(def: ParamDef, value: number): number {
	return Math.min(def.max, Math.max(def.min, value));
}

export function applyLoadedValues(
	defs: ParamDef[],
	values: Record<string, number>,
	loaded: Record<string, unknown>
): void {
	for (const d of defs) {
		const v = loaded[d.key];
		if (typeof v === 'number' && Number.isFinite(v)) {
			// Preserve the loaded value as-is — do NOT clamp to the slider's
			// [min, max] range. A saved/shared/direct config may contain values
			// that are valid per validateParameters (within the map's stable
			// range) but outside the UI slider range (e.g. Newton xMin=-2 with
			// slider [-1,0], or Standard k=8 with slider [0,5]). Clamping here
			// would silently change the value before the renderer and
			// getParameters() see it, causing re-saves to persist a different
			// config without any warning (stability is checked against the raw
			// loaded params, which are in the stable range). The slider input
			// is browser-clamped for display, but the state preserves the real
			// value so rendering and re-saving are faithful to the source.
			values[d.key] = v;
		}
	}
}
