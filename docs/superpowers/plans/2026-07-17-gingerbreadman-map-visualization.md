# Gingerbreadman Map Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Gingerbreadman Map module at `/gingerbreadman` (+ `/gingerbreadman/compare`) with IC-driven point-cloud rendering, full sibling registration, ParameterSlider fidelity/draft pipeline, orbit-rich presets, and manual DB migration `0014`.

**Architecture:** Product surface mirrors Tinkerbell (worker point cloud, 5 color modes, presets, save/share). Controls use the responsiveness pipeline Tinkerbell has not migrated to: page-owned `ParameterSlider` with `preview`/`live` policies, page-local draft state for compute params, renderer `fidelity` + `onRenderStateChange`. Compare URL sync follows Arnold Cat `untrack` and also syncs shared styling.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Canvas + d3 axes, chaosMapsWorker, Vitest (node + jsdom), Bun, manual Drizzle SQL migrations.

**Spec:** `docs/superpowers/specs/2026-07-16-gingerbreadman-map-visualization-design.md`

## Global Constraints

- **Runtime:** Bun (`bun run test`, `bun run check`, `bun run vitest run …`)
- **Language:** TypeScript strict mode
- **Framework:** Svelte 5 runes (`$state`, `$effect`, `$props`, `$bindable`, `$derived`)
- **Styling:** Sci-fi aesthetic (cyan primary, Orbitron/Rajdhani, corner borders)
- **Testing:** `*.test.ts` → node; `*.svelte.test.ts` → jsdom
- **Map type id:** `gingerbreadman` (no hyphen); display `GINGERBREADMAN_MAP`
- **Recurrence:** `x' = 1 - y + |x|`, `y' = x`
- **Guards:** non-finite + `|coord| > 1e4` drop point and stop; `maxPoints` cap
- **Append-at-end:** add `'gingerbreadman'` after `'arnold-cat'` in `VALID_MAP_TYPES`, CHECK lists, expected-type arrays
- **Migration:** Manual SQL + full journal entry only — **no** `drizzle-kit generate`, **no** snapshot
- **Drafts:** `paramDefs={[]}` ⇒ page-local `ondraft` mirrors required for preview
- **Orbit-richness:** 0.001 grid (`Math.round(x * 1000)` keys), ≥ 1000 unique @ 100k iterates
- **Base path:** `{base}` from `$app/paths`
- **Color constants:** `$lib/constants` (`COLOR_PRIMARY`, `COLOR_MAGENTA`, `VIZ_CONTAINER_HEIGHT`)

## File map

| File                                                                             | Responsibility                                        |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `src/lib/gingerbreadman.ts`                                                      | Orbit math + `countUniqueOrbitPoints` / `orbitKey`    |
| `src/lib/gingerbreadman.test.ts`                                                 | Math + orbit-richness tests                           |
| `src/lib/gingerbreadman-presets.ts`                                              | IC-focused presets                                    |
| `src/lib/types.ts`                                                               | Types + registration (append end)                     |
| `src/lib/chaos-validation.ts`                                                    | `STABLE_RANGES` + `OPTIONAL_FIELDS`                   |
| `src/lib/comparison-url-state.ts`                                                | Default params from preset                            |
| `src/lib/workers/types.ts`                                                       | Request/response unions                               |
| `src/lib/workers/chaosMapsHandler.ts`                                            | `case 'gingerbreadman'`                               |
| `src/lib/components/visualizations/GingerbreadmanRenderer.svelte`                | Canvas + worker + fidelity                            |
| `src/lib/components/visualizations/GingerbreadmanRenderer.svelte.test.ts`        | Smoke + **required** fidelity tests                   |
| `src/lib/components/visualizations/GingerbreadmanRenderer.worker.svelte.test.ts` | Worker path (mirror Tinkerbell)                       |
| `src/routes/gingerbreadman/+page.svelte`                                         | Main page + ParameterSlider + drafts                  |
| `src/routes/gingerbreadman/compare/+page.svelte`                                 | Compare + styling URL sync                            |
| `src/routes/+page.svelte`                                                        | Homepage card                                         |
| `CLAUDE.md`                                                                      | 19→20 map list (`Agents.md`/`AGENTS.md` are symlinks) |
| `drizzle/0014_add_gingerbreadman_map_type.sql`                                   | CHECK constraints (20 types)                          |
| `drizzle/meta/_journal.json`                                                     | Full idx 14 entry                                     |
| Interaction / config / registration tests                                        | See tasks below                                       |

---

### Task 1: Math module + orbit-richness

Pure orbit computation and the deterministic uniqueness helper used by preset tests.

**Files:**

- Create: `src/lib/gingerbreadman.ts`
- Create: `src/lib/gingerbreadman.test.ts`

**Interfaces:**

- Produces:

```typescript
export interface GingerbreadmanParams {
	x0: number;
	y0: number;
	iterations: number;
	maxPoints?: number;
}

export const MAGNITUDE_CAP = 1e4;

export function orbitKey(x: number, y: number): string;
export function countUniqueOrbitPoints(x0: number, y0: number, iterations?: number): number;
export function calculateGingerbreadmanTuples(params: GingerbreadmanParams): [number, number][];
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/gingerbreadman.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { calculateGingerbreadmanTuples, countUniqueOrbitPoints, orbitKey } from './gingerbreadman';

const CLASSIC = { x0: -0.1, y0: 0 };

describe('orbitKey / countUniqueOrbitPoints', () => {
	test('orbitKey uses 0.001 grid integer keys', () => {
		expect(orbitKey(1.2344, -2.3456)).toBe('1234,-2346');
	});

	test('shipped-like seeds are orbit-rich (≥ 1000 unique @ 1e5, 0.001 grid)', () => {
		expect(countUniqueOrbitPoints(-0.1, 0)).toBeGreaterThanOrEqual(1000);
		expect(countUniqueOrbitPoints(-0.3, 0)).toBeGreaterThanOrEqual(1000);
		expect(countUniqueOrbitPoints(-0.75, 0.1)).toBeGreaterThanOrEqual(1000);
		expect(countUniqueOrbitPoints(-2.13, 0.47)).toBeGreaterThanOrEqual(1000);
	});

	test('dyadic short cycles fail the richness bar', () => {
		expect(countUniqueOrbitPoints(0.5, -0.5)).toBeLessThan(1000);
		expect(countUniqueOrbitPoints(3, -2)).toBeLessThan(1000);
	});
});

describe('calculateGingerbreadmanTuples', () => {
	test('returns empty for non-positive iterations', () => {
		expect(calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 0 })).toEqual([]);
		expect(calculateGingerbreadmanTuples({ ...CLASSIC, iterations: -1 })).toEqual([]);
	});

	test('returns empty when maxPoints is non-positive', () => {
		expect(calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 100, maxPoints: 0 })).toEqual(
			[]
		);
	});

	test('honors maxPoints cap', () => {
		const pts = calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 1000, maxPoints: 50 });
		expect(pts.length).toBe(50);
	});

	test('is deterministic and applies one-step recurrence', () => {
		const pts = calculateGingerbreadmanTuples({ x0: -0.1, y0: 0, iterations: 1 });
		// x' = 1 - 0 + |-0.1| = 1.1; y' = -0.1
		expect(pts).toEqual([[1.1, -0.1]]);
		expect(calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 200 })).toEqual(
			calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 200 })
		);
	});

	test('classic seed produces many finite points', () => {
		const pts = calculateGingerbreadmanTuples({ ...CLASSIC, iterations: 2000 });
		expect(pts.length).toBe(2000);
		for (const [x, y] of pts) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
	});

	test('breaks without collecting when magnitude exceeds cap', () => {
		// Huge start: first step may already exceed cap depending on values;
		// use x0 large enough that an early iterate blows past 1e4.
		const pts = calculateGingerbreadmanTuples({
			x0: 1e5,
			y0: 0,
			iterations: 100
		});
		expect(pts.length).toBeLessThan(100);
		for (const [x, y] of pts) {
			expect(Math.abs(x)).toBeLessThanOrEqual(1e4);
			expect(Math.abs(y)).toBeLessThanOrEqual(1e4);
		}
	});

	test('stops when iterate is non-finite', () => {
		const pts = calculateGingerbreadmanTuples({
			x0: Number.NaN,
			y0: 0,
			iterations: 10
		});
		// First step from NaN yields non-finite → empty
		expect(pts).toEqual([]);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
bun run vitest run --project node src/lib/gingerbreadman.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/gingerbreadman.ts`**

```typescript
/**
 * Gingerbreadman Map Calculation
 *
 * Fixed piecewise-linear map:
 *   x(n+1) = 1 − y(n) + |x(n)|
 *   y(n+1) = x(n)
 *
 * Initial conditions are user-facing. Guards: non-finite and magnitude cap
 * (1e4) — runaway points are not collected.
 */

export interface GingerbreadmanParams {
	x0: number;
	y0: number;
	iterations: number;
	maxPoints?: number;
}

export const MAGNITUDE_CAP = 1e4;

/** Quantize to a 0.001 grid via integer keys (orbit-richness tests). */
export function orbitKey(x: number, y: number): string {
	return `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
}

/**
 * Count unique orbit points under the 0.001 grid after `iterations` steps
 * (default 100_000). Stops early on non-finite or magnitude > MAGNITUDE_CAP.
 */
export function countUniqueOrbitPoints(x0: number, y0: number, iterations = 100_000): number {
	const seen = new Set<string>();
	let x = x0;
	let y = y0;
	for (let i = 0; i < iterations; i++) {
		const xNew = 1 - y + Math.abs(x);
		const yNew = x;
		if (
			!Number.isFinite(xNew) ||
			!Number.isFinite(yNew) ||
			Math.abs(xNew) > MAGNITUDE_CAP ||
			Math.abs(yNew) > MAGNITUDE_CAP
		) {
			break;
		}
		x = xNew;
		y = yNew;
		seen.add(orbitKey(x, y));
	}
	return seen.size;
}

export function calculateGingerbreadmanTuples(params: GingerbreadmanParams): [number, number][] {
	const { x0, y0, iterations } = params;
	if (iterations <= 0) return [];
	const cap = params.maxPoints ?? Infinity;
	if (cap <= 0) return [];

	const points: [number, number][] = [];
	let x = x0;
	let y = y0;
	for (let i = 0; i < iterations && points.length < cap; i++) {
		const xNew = 1 - y + Math.abs(x);
		const yNew = x;
		if (
			!Number.isFinite(xNew) ||
			!Number.isFinite(yNew) ||
			Math.abs(xNew) > MAGNITUDE_CAP ||
			Math.abs(yNew) > MAGNITUDE_CAP
		) {
			break;
		}
		x = xNew;
		y = yNew;
		points.push([x, y]);
	}
	return points;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
bun run vitest run --project node src/lib/gingerbreadman.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/gingerbreadman.ts src/lib/gingerbreadman.test.ts
git commit -m "feat(gingerbreadman): add orbit math and richness helpers (HPA-61)"
```

---

### Task 2: Presets

**Files:**

- Create: `src/lib/gingerbreadman-presets.ts`
- Modify: `src/lib/gingerbreadman.test.ts` (assert every preset passes richness)

**Interfaces:**

- Produces: `GINGERBREADMAN_PRESETS`, `DEFAULT_GINGERBREADMAN_PRESET_ID = 'classic'`, `getPreset`, `detectPresetId`
- Produces: `GingerbreadmanPresetState` with `x0,y0,iterations,colorMode,zoom,pointSize,opacity`

- [ ] **Step 1: Create presets file**

```typescript
// src/lib/gingerbreadman-presets.ts
import type { GingerbreadmanColorMode } from '$lib/types';

export interface GingerbreadmanPresetState {
	x0: number;
	y0: number;
	iterations: number;
	colorMode: GingerbreadmanColorMode;
	zoom: number;
	pointSize: number;
	opacity: number;
}

export interface GingerbreadmanPreset {
	id: string;
	label: string;
	state: GingerbreadmanPresetState;
}

export const GINGERBREADMAN_PRESETS: GingerbreadmanPreset[] = [
	{
		id: 'classic',
		label: 'Classic',
		state: {
			x0: -0.1,
			y0: 0,
			iterations: 100000,
			colorMode: 'iteration',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'near-origin',
		label: 'Near Origin',
		state: {
			x0: -0.3,
			y0: 0,
			iterations: 100000,
			colorMode: 'density',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'offset',
		label: 'Offset Seed',
		state: {
			x0: -0.75,
			y0: 0.1,
			iterations: 100000,
			colorMode: 'radius',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'far-field',
		label: 'Far Field',
		state: {
			x0: -2.13,
			y0: 0.47,
			iterations: 100000,
			colorMode: 'angle',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	}
];

export const DEFAULT_GINGERBREADMAN_PRESET_ID = 'classic';

export function getPreset(id: string): GingerbreadmanPreset | undefined {
	return GINGERBREADMAN_PRESETS.find((p) => p.id === id);
}

function numbersClose(a: number, b: number): boolean {
	return Math.abs(a - b) < 1e-9;
}

export function detectPresetId(state: GingerbreadmanPresetState): string | null {
	for (const preset of GINGERBREADMAN_PRESETS) {
		const s = preset.state;
		if (
			numbersClose(s.x0, state.x0) &&
			numbersClose(s.y0, state.y0) &&
			s.iterations === state.iterations &&
			s.colorMode === state.colorMode &&
			numbersClose(s.zoom, state.zoom) &&
			numbersClose(s.pointSize, state.pointSize) &&
			numbersClose(s.opacity, state.opacity)
		) {
			return preset.id;
		}
	}
	return null;
}
```

Note: `GingerbreadmanColorMode` is defined in Task 3. If implementing Tasks 2–3 in order, either (a) temporarily use a local string union in presets and re-import after Task 3, or (b) do Task 3 type registration first then this file. **Preferred order: Task 3 types first if the compiler blocks the import.**

If types are not yet present, implement Task 3 before finishing this file.

- [ ] **Step 2: Add preset richness test**

In `gingerbreadman.test.ts`:

```typescript
import { GINGERBREADMAN_PRESETS } from './gingerbreadman-presets';

test('every shipped preset IC is orbit-rich', () => {
	for (const p of GINGERBREADMAN_PRESETS) {
		expect(countUniqueOrbitPoints(p.state.x0, p.state.y0), `preset ${p.id}`).toBeGreaterThanOrEqual(
			1000
		);
	}
});
```

- [ ] **Step 3: Run tests**

```bash
bun run vitest run --project node src/lib/gingerbreadman.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/gingerbreadman-presets.ts src/lib/gingerbreadman.test.ts
git commit -m "feat(gingerbreadman): add orbit-rich IC presets (HPA-61)"
```

---

### Task 3: Types, validation, comparison defaults, list tests

**Append** `'gingerbreadman'` at the **end** of every ordered type list (after `'arnold-cat'`).

**Files:**

- Modify: `src/lib/types.ts`
- Modify: `src/lib/chaos-validation.ts`
- Modify: `src/lib/comparison-url-state.ts`
- Modify: `src/lib/types.test.ts`
- Modify: `src/lib/api-validation.test.ts`
- Modify: `src/lib/chaos-validation.test.ts`
- Modify: `src/lib/comparison-url-state.test.ts`
- Create: `src/lib/comparison-url-state-gingerbreadman-preset.test.ts`

**Interfaces:**

```typescript
export const GINGERBREADMAN_COLOR_MODES = [
	'density',
	'iteration',
	'radius',
	'angle',
	'single'
] as const satisfies readonly string[];

export type GingerbreadmanColorMode = (typeof GINGERBREADMAN_COLOR_MODES)[number];

export interface GingerbreadmanParameters {
	type: 'gingerbreadman';
	x0: number;
	y0: number;
	iterations: number;
	colorMode?: GingerbreadmanColorMode;
	zoom?: number;
	pointSize?: number;
	opacity?: number;
}
```

`STABLE_RANGES.gingerbreadman`:

```typescript
gingerbreadman: {
	x0: { min: -10, max: 10 },
	y0: { min: -10, max: 10 },
	iterations: { min: 1, max: 250000 }
}
```

`OPTIONAL_FIELDS.gingerbreadman`:

```typescript
gingerbreadman: {
	colorMode: { kind: 'enum', values: [...GINGERBREADMAN_COLOR_MODES] },
	zoom: { kind: 'number', min: 0.5, max: 5 },
	pointSize: { kind: 'number', min: 0.5, max: 6 },
	opacity: { kind: 'number', min: 0, max: 1 }
}
```

`getDefaultParameters`:

```typescript
case 'gingerbreadman': {
	const preset = getGingerbreadmanPreset(DEFAULT_GINGERBREADMAN_PRESET_ID);
	if (!preset)
		throw new Error(`Missing default Gingerbreadman preset: ${DEFAULT_GINGERBREADMAN_PRESET_ID}`);
	return { type: 'gingerbreadman', ...preset.state };
}
```

- [ ] **Step 1: Write failing validation + types list tests**

Append to `chaos-validation.test.ts` a `describe('gingerbreadman parameter validation')` mirroring tinkerbell/arnold-cat: valid params, missing `x0`/`y0`/`iterations`, stability out of range for `x0` and `iterations`, in-range pass.

In `types.test.ts`, append `'gingerbreadman'` to `EXPECTED_MAP_TYPES` (end of array).

In `api-validation.test.ts`, append `'gingerbreadman'` to `expectedTypes` (end).

- [ ] **Step 2: Implement type + validation + comparison-url-state changes**

Also update:

- `ChaosMapType` union
- `ChaosMapParameters` union
- `SavedConfiguration` arm
- `CHAOS_MAP_DISPLAY_NAMES.gingerbreadman = 'GINGERBREADMAN_MAP'`
- `VALID_MAP_TYPES` append

- [ ] **Step 3: comparison-url-state tests**

Mirror tinkerbell round-trip in `comparison-url-state.test.ts`. Create:

```typescript
// src/lib/comparison-url-state-gingerbreadman-preset.test.ts
import { describe, expect, test, vi } from 'vitest';
import { getDefaultParameters } from './comparison-url-state';

vi.mock('./gingerbreadman-presets', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./gingerbreadman-presets')>();
	return {
		...actual,
		getPreset: vi.fn(() => undefined)
	};
});

describe('getDefaultParameters gingerbreadman preset fallback', () => {
	test('throws when gingerbreadman default preset is missing', () => {
		expect(() => getDefaultParameters('gingerbreadman')).toThrow(
			'Missing default Gingerbreadman preset'
		);
	});
});
```

- [ ] **Step 4: Run node tests**

```bash
bun run vitest run --project node src/lib/types.test.ts src/lib/api-validation.test.ts src/lib/chaos-validation.test.ts src/lib/comparison-url-state.test.ts src/lib/comparison-url-state-gingerbreadman-preset.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/types.test.ts src/lib/chaos-validation.ts src/lib/chaos-validation.test.ts src/lib/comparison-url-state.ts src/lib/comparison-url-state.test.ts src/lib/comparison-url-state-gingerbreadman-preset.test.ts src/lib/api-validation.test.ts src/lib/gingerbreadman-presets.ts
git commit -m "feat(gingerbreadman): register types, validation, and defaults (HPA-61)"
```

---

### Task 4: Worker request/response + handler

**Files:**

- Modify: `src/lib/workers/types.ts`
- Modify: `src/lib/workers/chaosMapsHandler.ts`
- Modify: `src/lib/workers/chaosMapsWorker.test.ts`

**Interfaces:**

```typescript
export interface GingerbreadmanRequest {
	type: 'gingerbreadman';
	id: number;
	x0: number;
	y0: number;
	iterations: number;
	maxPoints: number;
}

export interface GingerbreadmanResponse {
	type: 'gingerbreadmanResult';
	id: number;
	points: [number, number][];
}
```

Add both to `ChaosMapsWorkerRequest` / `ChaosMapsWorkerResponse` unions.

Handler branch:

```typescript
} else if (data.type === 'gingerbreadman') {
	const points = calculateGingerbreadmanTuples({
		x0: data.x0,
		y0: data.y0,
		iterations: data.iterations,
		maxPoints: data.maxPoints
	});
	return { type: 'gingerbreadmanResult', id: data.id, points };
}
```

- [ ] **Step 1: Write/extend worker test** for a gingerbreadman request → `gingerbreadmanResult` with finite points (mirror tinkerbell case in `chaosMapsWorker.test.ts`).

- [ ] **Step 2: Implement types + handler**

- [ ] **Step 3: Run**

```bash
bun run vitest run --project node src/lib/workers/chaosMapsWorker.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/workers/types.ts src/lib/workers/chaosMapsHandler.ts src/lib/workers/chaosMapsWorker.test.ts
git commit -m "feat(gingerbreadman): add worker handler path (HPA-61)"
```

---

### Task 5: DB migration + journal + CLAUDE.md count

**Files:**

- Create: `drizzle/0014_add_gingerbreadman_map_type.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/lib/server/db/schema.test.ts`
- Modify: `CLAUDE.md` (19 → 20; append Gingerbreadman to parenthetical list)

- [ ] **Step 1: SQL migration**

Copy `drizzle/0013_add_arnold_cat_map_type.sql`, append `'gingerbreadman'` after `'arnold-cat'` in **both** CHECK lists, change comments to **“all 20 map types”**.

- [ ] **Step 2: Journal — full entry (no generate)**

Append to `drizzle/meta/_journal.json` entries:

```json
{
	"idx": 14,
	"version": "7",
	"when": 1784217600000,
	"tag": "0014_add_gingerbreadman_map_type",
	"breakpoints": true
}
```

Use a `when` **strictly greater** than the 0013 entry (`1784131200000`). **Do not** run `drizzle-kit generate`. **No** new snapshot file.

- [ ] **Step 3: Schema test — parallel, do not replace 0013**

Add:

```typescript
test('drizzle journal registers the 0014 gingerbreadman migration', () => {
	const journal = JSON.parse(
		readFileSync(resolve(migrationDir, 'meta/_journal.json'), 'utf-8')
	) as { entries: { idx: number; tag: string }[] };
	const entry = journal.entries.find((e) => e.tag === '0014_add_gingerbreadman_map_type');
	expect(entry).toBeDefined();
	expect(entry!.idx).toBe(14);
	// keep existing file/tag consistency loop if present in 0013 test pattern
});
```

Keep the existing 0013 arnold-cat journal test intact.

- [ ] **Step 4: CLAUDE.md**

Change “visualizes 19 different…” → **20**, append “Gingerbreadman” to the map list (e.g. after Tinkerbell or at end before closing paren).

- [ ] **Step 5: Run**

```bash
bun run vitest run --project node src/lib/server/db/schema.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add drizzle/0014_add_gingerbreadman_map_type.sql drizzle/meta/_journal.json src/lib/server/db/schema.test.ts CLAUDE.md
git commit -m "feat(gingerbreadman): add map_type migration 0014 and docs count (HPA-61)"
```

---

### Task 6: GingerbreadmanRenderer + fidelity tests

Clone Tinkerbell’s canvas/color/worker wiring; **add** fidelity + status + style-cache path.

**Files:**

- Create: `src/lib/components/visualizations/GingerbreadmanRenderer.svelte`
- Create: `src/lib/components/visualizations/GingerbreadmanRenderer.svelte.test.ts`
- Create: `src/lib/components/visualizations/GingerbreadmanRenderer.worker.svelte.test.ts` (mirror Tinkerbell worker test)

**Interfaces:**

```typescript
import type { Fidelity, RenderState } from '$lib/slider-drag-manager.svelte';

interface Props {
	x0?: number;
	y0?: number;
	iterations?: number;
	colorMode?: GingerbreadmanColorMode;
	zoom?: number;
	pointSize?: number;
	opacity?: number;
	height?: number;
	containerElement?: HTMLDivElement;
	fidelity?: Fidelity; // default 'full'
	onRenderStateChange?: (state: RenderState) => void; // default () => {}
}
```

**Behavior contract:**

| Condition                                                              | Action                                                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Compute props change (`x0`,`y0`,`iterations`) + `fidelity==='preview'` | Worker/main with `maxPoints = min(iterations, 25000)` (and/or effective iterations capped similarly)              |
| Compute change + `fidelity==='full'`                                   | Up to `MAX_POINTS = 250000`                                                                                       |
| Style-only change                                                      | No new worker compute if `latest` cache exists; sampled paint (~every Nth point → ~25k) then debounced full paint |
| Any paint path                                                         | `onRenderStateChange('rendering')` at start; `'complete'` when full-quality (or empty) finishes                   |
| Compare/default                                                        | `fidelity='full'`, noop status                                                                                    |

Implementation approach:

1. Copy `TinkerbellRenderer.svelte` → rename symbols to gingerbreadman / `calculateGingerbreadmanTuples` / worker type `'gingerbreadman'` / result `'gingerbreadmanResult'`.
2. Add `fidelity` + `onRenderStateChange` props with defaults.
3. Diff previous compute keys vs style keys; branch recompute vs repaint.
4. Replace fixed debounce-only path: when fidelity is preview, schedule compute with reduced budget; when full after drag, full budget.
5. Call status callbacks around compute/paint.

- [ ] **Step 1: Write required fidelity tests** (jsdom)

In `GingerbreadmanRenderer.svelte.test.ts`, cover at minimum:

1. Mounts without throwing with defaults.
2. **Preview budget:** pass `fidelity="preview"`, spy or intercept worker/main path so effective maxPoints/iterations ≤ 25000 for large `iterations` (e.g. 100000). Prefer spying `calculateGingerbreadmanTuples` if main-thread fallback is forced in test env.
3. **Full budget:** `fidelity="full"` allows larger collection (or requests maxPoints near iterations/MAX_POINTS).
4. **Status callbacks:** mock `onRenderStateChange`; after a render cycle, expect `'rendering'` then `'complete'` (use `vi.waitFor` / flush timers as Tinkerbell tests do).
5. **Style-only:** after an initial compute, change only `pointSize` or `colorMode`; assert compute is **not** called again (spy call count stable) while status still completes.

Mirror `TinkerbellRenderer.worker.svelte.test.ts` for worker message shape if the project uses that pattern.

- [ ] **Step 2: Implement renderer**

- [ ] **Step 3: Run**

```bash
bun run vitest run --project jsdom src/lib/components/visualizations/GingerbreadmanRenderer
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/visualizations/GingerbreadmanRenderer.svelte src/lib/components/visualizations/GingerbreadmanRenderer.svelte.test.ts src/lib/components/visualizations/GingerbreadmanRenderer.worker.svelte.test.ts
git commit -m "feat(gingerbreadman): add fidelity-aware point-cloud renderer (HPA-61)"
```

---

### Task 7: Main page (`/gingerbreadman`)

**Files:**

- Create: `src/routes/gingerbreadman/+page.svelte`

**Key wiring (do not clone Tinkerbell raw ranges):**

```svelte
<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import ParameterSlider from '$lib/components/ui/ParameterSlider.svelte';
	import GingerbreadmanRenderer from '$lib/components/visualizations/GingerbreadmanRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { createStabilityReporter } from '$lib/stability-reporter';
	import type {
		GingerbreadmanParameters,
		GingerbreadmanColorMode,
		ChaosMapParameters
	} from '$lib/types';
	import {
		GINGERBREADMAN_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_GINGERBREADMAN_PRESET_ID,
		type GingerbreadmanPresetState
	} from '$lib/gingerbreadman-presets';

	let { data } = $props();
	const defaultPreset = getPreset(DEFAULT_GINGERBREADMAN_PRESET_ID)!;
	const d = defaultPreset.state;

	// Committed
	let x0 = $state(d.x0);
	let y0 = $state(d.y0);
	let iterations = $state(d.iterations);
	// Drafts (preview)
	let draftX0 = $state(d.x0);
	let draftY0 = $state(d.y0);
	let draftIterations = $state(d.iterations);
	// Live style
	let colorMode = $state<GingerbreadmanColorMode>(d.colorMode);
	let zoom = $state(d.zoom);
	let pointSize = $state(d.pointSize);
	let opacity = $state(d.opacity);

	function syncDraftsFromCommitted() {
		draftX0 = x0;
		draftY0 = y0;
		draftIterations = iterations;
	}

	function applyPreset(id: string) {
		const p = getPreset(id);
		if (!p) return;
		const s = p.state;
		x0 = s.x0;
		y0 = s.y0;
		iterations = s.iterations;
		colorMode = s.colorMode;
		zoom = s.zoom;
		pointSize = s.pointSize;
		opacity = s.opacity;
		syncDraftsFromCommitted();
	}

	function clamp(n: number, min: number, max: number) {
		if (!Number.isFinite(n)) return min;
		return Math.min(max, Math.max(min, n));
	}

	function buildParameters(): GingerbreadmanParameters {
		return { type: 'gingerbreadman', x0, y0, iterations, colorMode, zoom, pointSize, opacity };
	}

	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'gingerbreadman') return;
		x0 = clamp(p.x0, -10, 10);
		y0 = clamp(p.y0, -10, 10);
		iterations = clamp(p.iterations, 1, 250000);
		if (p.colorMode) colorMode = p.colorMode;
		if (p.zoom != null) zoom = clamp(p.zoom, 0.5, 5);
		if (p.pointSize != null) pointSize = clamp(p.pointSize, 0.5, 6);
		if (p.opacity != null) opacity = clamp(p.opacity, 0, 1);
		syncDraftsFromCommitted();
	}

	const stability = createStabilityReporter({
		mapType: 'gingerbreadman',
		getParams: () => buildParameters(),
		reactive: true
	});
	$effect(() => {
		void x0;
		void y0;
		void iterations;
		stability.triggerReactive();
		return () => stability.cleanupReactive();
	});

	function randomizeParameters() {
		const r = () => Math.round((Math.random() * 10 - 5) * 100) / 100; // [-5,5] 2dp
		x0 = r();
		y0 = r();
		syncDraftsFromCommitted();
	}
</script>
```

`extraControls`: presets bar; `ParameterSlider` for x0/y0 (`preview`, min -10 max 10 step 0.01 decimals 2); iterations (`preview`, min 10000 max 250000 step 10000); zoom/pointSize/opacity (`live`); colorMode select; randomize/reset.

Renderer snippet:

```svelte
{#snippet renderer({ container, fidelity, onRenderStateChange })}
	{@const renderX0 = fidelity === 'preview' ? draftX0 : x0}
	{@const renderY0 = fidelity === 'preview' ? draftY0 : y0}
	{@const renderIterations = fidelity === 'preview' ? draftIterations : iterations}
	<GingerbreadmanRenderer
		x0={renderX0}
		y0={renderY0}
		iterations={renderIterations}
		{colorMode}
		{zoom}
		{pointSize}
		{opacity}
		{fidelity}
		{onRenderStateChange}
		bind:containerElement={container.el}
		height={VIZ_CONTAINER_HEIGHT}
	/>
{/snippet}
```

Shell props: `mapType="gingerbreadman"`, `title="GINGERBREADMAN_MAP"`, `paramDefs={[]}`, formula lines for the recurrence, educational description per spec, `buildParameters`, `onExtraParametersLoaded`, `stabilityReporter={stability.register}`, `isAuthenticated={!!data?.session}`.

- [ ] **Step 1: Implement page**

- [ ] **Step 2: Smoke via check**

```bash
bun run check
```

Fix type errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/gingerbreadman/+page.svelte
git commit -m "feat(gingerbreadman): add main route with draft/fidelity sliders (HPA-61)"
```

---

### Task 8: Compare page with styling URL sync

**Files:**

- Create: `src/routes/gingerbreadman/compare/+page.svelte`

**Critical differences from Tinkerbell compare:**

1. Shared styling is **`$state`**, not `const` from initial only.
2. Arnold Cat–style `$effect` with `untrack` that applies **left/right compute and shared styling** from `$page.url`.
3. Debounced `goto` includes styling in both left and right params.
4. Cleanup debounce on teardown.

Sketch:

```typescript
import { untrack } from 'svelte';
// ...
let leftX0 = $state(...);
let leftY0 = $state(...);
let leftIterations = $state(...);
// right same

let colorMode = $state<GingerbreadmanColorMode>(leftInitial.colorMode ?? 'iteration');
let zoom = $state(leftInitial.zoom ?? 1);
let pointSize = $state(leftInitial.pointSize ?? 1.5);
let opacity = $state(leftInitial.opacity ?? 0.6);

$effect(() => {
	const url = $page.url;
	untrack(() => {
		const incoming = decodeComparisonState(url, 'gingerbreadman');
		const L = clampParams(incoming?.left as GingerbreadmanParameters | null);
		const R = clampParams(incoming?.right as GingerbreadmanParameters | null);
		if (L.x0 !== leftX0) leftX0 = L.x0;
		// ... y0, iterations left/right ...
		if ((L.colorMode ?? 'iteration') !== colorMode) colorMode = L.colorMode ?? 'iteration';
		if ((L.zoom ?? 1) !== zoom) zoom = L.zoom ?? 1;
		if ((L.pointSize ?? 1.5) !== pointSize) pointSize = L.pointSize ?? 1.5;
		if ((L.opacity ?? 0.6) !== opacity) opacity = L.opacity ?? 0.6;
	});
});

// debounce write tracks left/right compute AND colorMode/zoom/pointSize/opacity
```

`clampParams` clamps x0/y0/iterations and optional style fields to stable ranges.

Two `GingerbreadmanRenderer` at `height={400}` with left/right compute and shared style props (defaults full fidelity).

- [ ] **Step 1: Implement compare page**

- [ ] **Step 2: `bun run check`**

- [ ] **Step 3: Commit**

```bash
git add src/routes/gingerbreadman/compare/+page.svelte
git commit -m "feat(gingerbreadman): add compare route with reactive styling URL sync (HPA-61)"
```

---

### Task 9: Homepage card + page test counts

**Files:**

- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/page.svelte.test.ts`

Add card (visual placement near Tinkerbell is fine):

```typescript
{
	name: 'Gingerbreadman Map',
	description: 'A simple chaotic map whose orbit forms a distinctive fractal-like figure',
	url: '/gingerbreadman',
	color: 'from-amber-500 to-rose-600'
}
```

Bump card/CTA `toHaveLength(19)` → **`20`**. Add assertion for name + `/gingerbreadman` link. Update local visualizations array in the test if it hardcodes the list.

- [ ] **Step 1: Edit homepage + tests**

- [ ] **Step 2: Run**

```bash
bun run vitest run --project jsdom src/routes/page.svelte.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte src/routes/page.svelte.test.ts
git commit -m "feat(gingerbreadman): add homepage card (HPA-61)"
```

---

### Task 10: Page interaction + config-loading tests

**Files:**

- Create: `src/routes/gingerbreadman-page-interactions.svelte.test.ts`
- Create: `src/routes/gingerbreadman-config-loading.svelte.test.ts`

Mirror `tinkerbell-page-interactions.svelte.test.ts` and `tinkerbell-config-loading.svelte.test.ts`:

- Preset apply updates committed + draft + active preset label
- Reset restores classic
- Randomize changes x0/y0
- ParameterSlider present with expected test ids
- Config load clamps out-of-range x0/iterations
- `buildParameters` / save payload uses **committed** values (not mid-drag drafts)

Also assert draft path if test harness can fire `ondraft` (optional if hard; at minimum page test documents syncDrafts on preset).

- [ ] **Step 1: Port and adapt tinkerbell interaction tests**

- [ ] **Step 2: Run**

```bash
bun run vitest run --project jsdom src/routes/gingerbreadman-page-interactions.svelte.test.ts src/routes/gingerbreadman-config-loading.svelte.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/gingerbreadman-page-interactions.svelte.test.ts src/routes/gingerbreadman-config-loading.svelte.test.ts
git commit -m "test(gingerbreadman): page interactions and config loading (HPA-61)"
```

---

### Task 11: Compare interaction tests (including styling URL sync)

**Files:**

- Create: `src/routes/gingerbreadman-compare-interactions.svelte.test.ts`

Mirror tinkerbell/arnold-cat compare tests, **plus**:

```typescript
test('external URL change updates shared styling state', async () => {
	// Mount compare page with URL A (colorMode iteration, zoom 1)
	// Navigate/set $page.url (or remount) with encoded state colorMode density, zoom 2
	// Expect UI / renderer props to reflect density + zoom 2
});
```

Also: encode/decode round-trip, clamp, swap, defaults when no state.

- [ ] **Step 1: Write tests**

- [ ] **Step 2: Run**

```bash
bun run vitest run --project jsdom src/routes/gingerbreadman-compare-interactions.svelte.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/gingerbreadman-compare-interactions.svelte.test.ts
git commit -m "test(gingerbreadman): compare URL sync including styling (HPA-61)"
```

---

### Task 12: Full verification gate

- [ ] **Step 1: Run full suite**

```bash
bun run check
bun run test
bun run lint
```

Expected: all pass. Fix any residual list misses (grep for `arnold-cat` exhaustive switches and append `gingerbreadman` after them).

- [ ] **Step 2: Grep registration hygiene**

```bash
rg -n "arnold-cat" src --glob '*.{ts,svelte}' | head -80
```

For every exhaustive list/switch that includes arnold-cat, ensure gingerbreadman is present after it where appropriate.

- [ ] **Step 3: Final commit only if fixes were needed**

```bash
git add -A
git commit -m "fix(gingerbreadman): address remaining registration and check issues (HPA-61)"
```

---

## Spec coverage checklist

| Spec requirement                           | Task |
| ------------------------------------------ | ---- |
| Math + guards + maxPoints                  | 1    |
| Orbit-richness 0.001 grid + preset bar     | 1–2  |
| Types / VALID_MAP_TYPES append             | 3    |
| Validation + optional fields               | 3    |
| Comparison defaults + preset fallback test | 3    |
| Worker path                                | 4    |
| Migration 0014 full journal, no generate   | 5    |
| CLAUDE.md 20 maps                          | 5    |
| Renderer fidelity/status/style cache       | 6    |
| Page ParameterSlider + drafts              | 7    |
| Compare styling URL sync                   | 8    |
| Homepage 20 cards                          | 9    |
| Interaction + config tests                 | 10   |
| Compare styling external-URL test          | 11   |
| Full check/test/lint                       | 12   |

## Self-review notes

- No dependency on migrating Tinkerbell itself.
- Draft wiring is mandatory; shell `draftValues` unused with `paramDefs={[]}`.
- Fidelity tests are required in Task 6 (not optional).
- Short-cycle presets `(0.5,-0.5)` / `(3,-2)` must never ship.
  )
