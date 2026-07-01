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
			values[d.key] = clampToDef(d, v);
		}
	}
}
