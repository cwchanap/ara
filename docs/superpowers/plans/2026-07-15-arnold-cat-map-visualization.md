# Arnold Cat Map Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an Arnold Cat Map visualization module at `/arnold-cat` (and `/arnold-cat/compare`) with an exact discrete torus point-cloud animation, full type/validation/migration integration, homepage card, and tests that enforce steps/sec pacing and the Cat Map transform.

**Architecture:** UX shell mirrors Baker's Map (`VisualizationShell` + page-owned controls). Internals diverge: pure `$lib/arnold-cat.ts` mutates `Uint32Array` coords on the \(2^{32}\) torus; the renderer uses a time accumulator (`speed` = steps/sec) with `MAX_FRAME_DT` hitch cap; pixels map into `[0, dim-1]`.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Canvas 2D, d3-interpolate, Vitest + jsdom, Bun, manual Drizzle SQL migrations.

## Global Constraints

- **Runtime:** Bun (`bun run test`, `bun run check`, `bun run vitest run …`)
- **Language:** TypeScript strict mode
- **Framework:** Svelte 5 runes (`$state`, `$effect`, `$props`, `$bindable`)
- **Styling:** Sci-fi aesthetic (cyan primary, Orbitron/Rajdhani, corner borders)
- **Testing:** `*.test.ts` → node; `*.svelte.test.ts` → jsdom
- **Coordinates:** `Uint32Array` + `>>> 0` wrap — **not** `Float64` on `[0,1)`
- **Speed:** **steps per second** (default 5, range 1–30) — **not** steps per frame
- **Accumulator:** always `acc = 0` on reset, randomize, and `pointCount` reinit
- **Clamp `pointCount` before every allocation**; RAF clamps `speed` only
- **Migration:** Manual SQL + journal only — **no** `drizzle-kit generate`
- **Color constants:** `$lib/constants` (`COLOR_PRIMARY`, `COLOR_MAGENTA`, `VIZ_CONTAINER_HEIGHT`)
- **Base path:** `{base}` from `$app/paths`
- **Spec:** `docs/superpowers/specs/2026-07-15-arnold-cat-map-visualization-design.md`

## File map

| File                                                                 | Responsibility                                                                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/arnold-cat.ts`                                              | Pure in-place Cat Map + pixel mapping                                                                                                          |
| `src/lib/arnold-cat.test.ts`                                         | Deterministic math fixtures                                                                                                                    |
| `src/lib/types.ts`                                                   | `ArnoldCatParameters` + registrations                                                                                                          |
| `src/lib/chaos-validation.ts`                                        | `STABLE_RANGES['arnold-cat']`                                                                                                                  |
| `src/lib/comparison-url-state.ts`                                    | Default params case                                                                                                                            |
| `src/lib/components/visualizations/ArnoldCatRenderer.svelte`         | Canvas + RAF + time accumulator                                                                                                                |
| `src/lib/components/visualizations/ArnoldCatRenderer.svelte.test.ts` | Signals + **steps/sec timestamp tests**                                                                                                        |
| `src/routes/arnold-cat/+page.svelte`                                 | Main route                                                                                                                                     |
| `src/routes/arnold-cat/compare/+page.svelte`                         | Compare route + `clampParams`                                                                                                                  |
| `src/routes/+page.svelte`                                            | Homepage card                                                                                                                                  |
| `drizzle/0013_add_arnold_cat_map_type.sql`                           | CHECK constraints (19 types)                                                                                                                   |
| Test list updates                                                    | `types.test.ts`, `api-validation.test.ts`, `page.svelte.test.ts`, `schema.test.ts`, `chaos-validation.test.ts`, `comparison-url-state.test.ts` |
| Interaction tests                                                    | `arnold-cat-page-interactions.svelte.test.ts`, `arnold-cat-compare-interactions.svelte.test.ts`                                                |

---

### Task 1: Type system, validation ranges, comparison defaults

Register `'arnold-cat'` so exhaustive switches and `Record<ChaosMapType, …>` still typecheck. Update hard-coded map-type lists that assert length.

**Files:**

- Modify: `src/lib/types.ts`
- Modify: `src/lib/chaos-validation.ts` (`STABLE_RANGES`)
- Modify: `src/lib/comparison-url-state.ts` (`getDefaultParameters`)
- Modify: `src/lib/types.test.ts` (`EXPECTED_MAP_TYPES`)
- Modify: `src/lib/api-validation.test.ts` (`expectedTypes`)
- Modify: `src/lib/chaos-validation.test.ts` (new suite)
- Modify: `src/lib/comparison-url-state.test.ts` (round-trip suite + any exhaustive lists)

**Interfaces:**

- Produces: `ArnoldCatParameters = { type: 'arnold-cat'; pointCount: number; speed: number }`
- Produces: `STABLE_RANGES['arnold-cat'] = { pointCount: { min: 100, max: 10000 }, speed: { min: 1, max: 30 } }`
- Produces: `getDefaultParameters('arnold-cat')` → `{ type: 'arnold-cat', pointCount: 3000, speed: 5 }`

- [ ] **Step 1: Write failing validation tests**

Append to `src/lib/chaos-validation.test.ts`:

```typescript
describe('arnold-cat parameter validation', () => {
	const validParams = { type: 'arnold-cat' as const, pointCount: 3000, speed: 5 };

	test('validates correct arnold-cat parameters', () => {
		const result = validateParameters('arnold-cat', validParams);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('rejects missing speed', () => {
		const result = validateParameters('arnold-cat', {
			type: 'arnold-cat',
			pointCount: 3000
		});
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('speed'))).toBe(true);
	});

	test('rejects missing pointCount', () => {
		const result = validateParameters('arnold-cat', { type: 'arnold-cat', speed: 5 });
		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes('pointCount'))).toBe(true);
	});

	test('checkParameterStability reports out-of-range speed', () => {
		const result = checkParameterStability('arnold-cat', {
			type: 'arnold-cat',
			pointCount: 3000,
			speed: 100
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('speed'))).toBe(true);
	});

	test('checkParameterStability reports out-of-range pointCount', () => {
		const result = checkParameterStability('arnold-cat', {
			type: 'arnold-cat',
			pointCount: 999999,
			speed: 5
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('pointCount'))).toBe(true);
	});

	test('checkParameterStability passes for in-range values', () => {
		const result = checkParameterStability('arnold-cat', validParams);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});
});
```

Ensure `validateParameters` and `checkParameterStability` are already imported in that file.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
bun run vitest run src/lib/chaos-validation.test.ts -t "arnold-cat"
```

Expected: FAIL (unknown map type / missing `STABLE_RANGES` key).

- [ ] **Step 3: Register types in `src/lib/types.ts`**

1. Add to `ChaosMapType` union after `'bakers-map'`:

```typescript
| 'arnold-cat';
```

2. After `BakersMapParameters`:

```typescript
export interface ArnoldCatParameters {
	type: 'arnold-cat';
	pointCount: number;
	speed: number;
}
```

3. Add `ArnoldCatParameters` to the `ChaosMapParameters` union.

4. In `CHAOS_MAP_DISPLAY_NAMES`:

```typescript
'arnold-cat': 'ARNOLD_CAT_MAP',
```

5. In `VALID_MAP_TYPES` array, append `'arnold-cat'`.

6. In `SavedConfiguration` discriminated union, add arm:

```typescript
| {
		mapType: 'arnold-cat';
		parameters: ArnoldCatParameters;
  }
```

- [ ] **Step 4: Add `STABLE_RANGES` entry in `src/lib/chaos-validation.ts`**

After the `'bakers-map'` block:

```typescript
'arnold-cat': {
	pointCount: { min: 100, max: 10000 },
	speed: { min: 1, max: 30 }
}
```

- [ ] **Step 5: Add `getDefaultParameters` case in `src/lib/comparison-url-state.ts`**

```typescript
case 'arnold-cat':
	return { type: 'arnold-cat', pointCount: 3000, speed: 5 };
```

- [ ] **Step 6: Update hard-coded type lists**

In `src/lib/types.test.ts`, append `'arnold-cat'` to `EXPECTED_MAP_TYPES`. If there is a display-name assertion table, add `ARNOLD_CAT_MAP`.

In `src/lib/api-validation.test.ts`, append `'arnold-cat'` to the bi-directional `expectedTypes` array (same order as `VALID_MAP_TYPES` preferred).

- [ ] **Step 7: Add comparison URL round-trip tests**

Append to `src/lib/comparison-url-state.test.ts` (mirror bakers-map suite near the end; import `ArnoldCatParameters` if needed):

```typescript
describe('arnold-cat comparison URL round-trip', () => {
	test('getDefaultParameters returns correct arnold-cat defaults', () => {
		const params = getDefaultParameters('arnold-cat') as ArnoldCatParameters;
		expect(params.type).toBe('arnold-cat');
		expect(params.pointCount).toBe(3000);
		expect(params.speed).toBe(5);
	});

	test('round-trips a arnold-cat comparison state through the URL', () => {
		const left: ArnoldCatParameters = {
			type: 'arnold-cat',
			pointCount: 5000,
			speed: 10
		};
		const right: ArnoldCatParameters = {
			type: 'arnold-cat',
			pointCount: 1000,
			speed: 2
		};
		const encoded = encodeComparisonState({ compare: true, left, right });
		const url = new URL(`http://localhost/arnold-cat/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'arnold-cat');
		expect(decoded?.left).toMatchObject(left);
		expect(decoded?.right).toMatchObject(right);
	});

	test('buildComparisonUrl produces a parseable arnold-cat compare URL', () => {
		const left: ArnoldCatParameters = {
			type: 'arnold-cat',
			pointCount: 2000,
			speed: 3
		};
		const right: ArnoldCatParameters = {
			type: 'arnold-cat',
			pointCount: 8000,
			speed: 15
		};
		const urlString = buildComparisonUrl('', 'arnold-cat', {
			compare: true,
			left,
			right
		});
		expect(urlString).toContain('/arnold-cat/compare?');
		const url = new URL(urlString, 'http://localhost');
		const decoded = decodeComparisonState(url, 'arnold-cat');
		expect(decoded?.left).toMatchObject(left);
		expect(decoded?.right).toMatchObject(right);
	});

	test('createComparisonStateFromCurrent for arnold-cat uses defaults on right', () => {
		const current: ArnoldCatParameters = {
			type: 'arnold-cat',
			pointCount: 7000,
			speed: 8
		};
		const state = createComparisonStateFromCurrent('arnold-cat', current);
		expect(state.left).toMatchObject(current);
		expect(state.right).toMatchObject({
			type: 'arnold-cat',
			pointCount: 3000,
			speed: 5
		});
	});
});
```

If `comparison-url-state.test.ts` has an exhaustive list of map types (e.g. a loop over all types), add `'arnold-cat'` there too (search for `'bakers-map'` in that file).

- [ ] **Step 8: Run tests — expect PASS**

```bash
bun run vitest run src/lib/chaos-validation.test.ts -t "arnold-cat"
bun run vitest run src/lib/types.test.ts src/lib/api-validation.test.ts src/lib/comparison-url-state.test.ts -t "arnold-cat"
bun run check
```

Expected: PASS (check may still pass if no other missing cases).

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts src/lib/chaos-validation.ts src/lib/comparison-url-state.ts \
  src/lib/types.test.ts src/lib/api-validation.test.ts src/lib/chaos-validation.test.ts \
  src/lib/comparison-url-state.test.ts
git commit -m "feat: register arnold-cat map type and validation (HPA-62)"
```

---

### Task 2: Pure math module (`src/lib/arnold-cat.ts`)

Allocation-free buffer mutators + pixel helpers. Single source of truth for the transform.

**Files:**

- Create: `src/lib/arnold-cat.ts`
- Create: `src/lib/arnold-cat.test.ts`

**Interfaces:**

- Produces:
  - `TWO_32 = 4294967296` (constant export optional)
  - `applyArnoldCatStepInPlace(xs: Uint32Array, ys: Uint32Array, count?: number): void`
  - `applyArnoldCatInverseInPlace(xs: Uint32Array, ys: Uint32Array, count?: number): void`
  - `torusToPixel(coord: number, dim: number): number`
  - `torusToPixelY(coord: number, dim: number): number`
  - `advanceArnoldCatSimulation(state, dtSeconds, stepsPerSec, maxFrameDt, maxStepsPerFrame): number` (returns whole steps applied; used by renderer + timestamp tests)

Recommended simulation state type (export from same file):

```typescript
export type ArnoldCatSimState = {
	xs: Uint32Array;
	ys: Uint32Array;
	acc: number;
	iterationCount: number;
	paused: boolean;
};
```

- [ ] **Step 1: Write failing math fixtures**

Create `src/lib/arnold-cat.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import {
	applyArnoldCatStepInPlace,
	applyArnoldCatInverseInPlace,
	torusToPixel,
	torusToPixelY,
	advanceArnoldCatSimulation,
	type ArnoldCatSimState
} from './arnold-cat';

describe('applyArnoldCatStepInPlace', () => {
	test('maps known one-step pairs', () => {
		const xs = new Uint32Array([0, 1, 0, 5]);
		const ys = new Uint32Array([0, 0, 1, 7]);
		applyArnoldCatStepInPlace(xs, ys);
		// (x',y') = (x+y, x+2y) mod 2^32
		expect(Array.from(xs)).toEqual([0, 1, 1, 12]);
		expect(Array.from(ys)).toEqual([0, 1, 2, 19]);
	});

	test('wraps near 2^32', () => {
		const xs = new Uint32Array([0xffffffff, 0xfffffffe]);
		const ys = new Uint32Array([1, 3]);
		applyArnoldCatStepInPlace(xs, ys);
		expect(xs[0]).toBe(0); // ffffffff+1
		expect(ys[0]).toBe(1); // ffffffff + 2 = 1 (mod 2^32)
		expect(xs[1]).toBe(1); // fffffffe+3
		expect(ys[1]).toBe(4); // fffffffe + 6
	});

	test('respects count parameter', () => {
		const xs = new Uint32Array([1, 9]);
		const ys = new Uint32Array([0, 9]);
		applyArnoldCatStepInPlace(xs, ys, 1);
		expect(xs[0]).toBe(1);
		expect(ys[0]).toBe(1);
		expect(xs[1]).toBe(9);
		expect(ys[1]).toBe(9);
	});
});

describe('applyArnoldCatInverseInPlace', () => {
	test('recovers after k forward steps', () => {
		const n = 200;
		const xs = new Uint32Array(n);
		const ys = new Uint32Array(n);
		const ix = new Uint32Array(n);
		const iy = new Uint32Array(n);
		for (let i = 0; i < n; i++) {
			const x = (Math.imul(i + 1, 2654435761) >>> 0) >>> 0;
			const y = (Math.imul(i + 7, 1597334677) >>> 0) >>> 0;
			xs[i] = x;
			ys[i] = y;
			ix[i] = x;
			iy[i] = y;
		}
		const k = 1000;
		for (let s = 0; s < k; s++) applyArnoldCatStepInPlace(xs, ys);
		for (let s = 0; s < k; s++) applyArnoldCatInverseInPlace(xs, ys);
		expect(Array.from(xs)).toEqual(Array.from(ix));
		expect(Array.from(ys)).toEqual(Array.from(iy));
	});
});

describe('torusToPixel / torusToPixelY', () => {
	test('maps into [0, dim-1] and never returns dim', () => {
		const dim = 600;
		expect(torusToPixel(0, dim)).toBe(0);
		expect(torusToPixel(0xffffffff, dim)).toBeLessThan(dim);
		expect(torusToPixel(0x80000000, dim)).toBeGreaterThanOrEqual(0);
		expect(torusToPixelY(0, dim)).toBe(dim - 1); // y=0 at bottom
		expect(torusToPixelY(0xffffffff, dim)).toBeGreaterThanOrEqual(0);
		expect(torusToPixelY(0xffffffff, dim)).toBeLessThan(dim);
	});

	test('dim <= 1 returns 0', () => {
		expect(torusToPixel(123, 1)).toBe(0);
		expect(torusToPixelY(123, 0)).toBe(0);
	});
});

describe('advanceArnoldCatSimulation', () => {
	function makeState(overrides: Partial<ArnoldCatSimState> = {}): ArnoldCatSimState {
		return {
			xs: new Uint32Array([1]),
			ys: new Uint32Array([0]),
			acc: 0,
			iterationCount: 0,
			paused: false,
			...overrides
		};
	}

	const MAX_FRAME_DT = 0.05;
	const MAX_STEPS = 30;

	test('is display-rate independent for 30 vs 60 FPS over 1s at speed 5', () => {
		const a = makeState();
		const b = makeState();
		const speed = 5;
		// 60 FPS: 60 frames of 1/60 s
		for (let i = 0; i < 60; i++) {
			advanceArnoldCatSimulation(a, 1 / 60, speed, MAX_FRAME_DT, MAX_STEPS);
		}
		// 30 FPS: 30 frames of 1/30 s
		for (let i = 0; i < 30; i++) {
			advanceArnoldCatSimulation(b, 1 / 30, speed, MAX_FRAME_DT, MAX_STEPS);
		}
		expect(a.iterationCount).toBe(5);
		expect(b.iterationCount).toBe(5);
		expect(a.acc).toBeLessThan(1);
		expect(b.acc).toBeLessThan(1);
	});

	test('speed=1 for ~1s at 60 FPS applies 1 step not 60', () => {
		const s = makeState();
		for (let i = 0; i < 60; i++) {
			advanceArnoldCatSimulation(s, 1 / 60, 1, MAX_FRAME_DT, MAX_STEPS);
		}
		expect(s.iterationCount).toBe(1);
	});

	test('fractional accumulation across two 100ms frames at speed 5', () => {
		const s = makeState();
		advanceArnoldCatSimulation(s, 0.1, 5, MAX_FRAME_DT, MAX_STEPS);
		expect(s.iterationCount).toBe(0);
		expect(s.acc).toBeCloseTo(0.5, 8);
		advanceArnoldCatSimulation(s, 0.1, 5, MAX_FRAME_DT, MAX_STEPS);
		expect(s.iterationCount).toBe(1);
		expect(s.acc).toBeCloseTo(0, 8);
	});

	test('MAX_FRAME_DT discards hitch excess', () => {
		const s = makeState();
		advanceArnoldCatSimulation(s, 1.0, 30, MAX_FRAME_DT, MAX_STEPS);
		// credit min(1, 0.05)*30 = 1.5 → 1 whole step
		expect(s.iterationCount).toBe(1);
		expect(s.acc).toBeCloseTo(0.5, 8);
	});

	test('paused freezes iteration and acc', () => {
		const s = makeState({ acc: 0.25, paused: true });
		advanceArnoldCatSimulation(s, 0.1, 5, MAX_FRAME_DT, MAX_STEPS);
		expect(s.iterationCount).toBe(0);
		expect(s.acc).toBe(0.25);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
bun run vitest run src/lib/arnold-cat.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/arnold-cat.ts`**

```typescript
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
	let steps = 0;
	while (state.acc >= 1 && steps < maxStepsPerFrame) {
		applyArnoldCatStepInPlace(state.xs, state.ys);
		state.iterationCount += 1;
		state.acc -= 1;
		steps += 1;
	}
	return steps;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
bun run vitest run src/lib/arnold-cat.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/arnold-cat.ts src/lib/arnold-cat.test.ts
git commit -m "feat: pure arnold-cat discrete map helpers and fixtures (HPA-62)"
```

---

### Task 3: DB migration 0013

**Files:**

- Create: `drizzle/0013_add_arnold_cat_map_type.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/lib/server/db/schema.test.ts` (test name + tag + idx)

- [ ] **Step 1: Write migration SQL**

Create `drizzle/0013_add_arnold_cat_map_type.sql` by copying `0012_add_bakers_map_map_type.sql` and:

- Update the header comment to arnold-cat / 19 map types
- Append `'arnold-cat'` after `'bakers-map'` in **both** CHECK lists
- Keep `BEGIN` / `COMMIT`

- [ ] **Step 2: Journal entry**

In `drizzle/meta/_journal.json`, append:

```json
{
	"idx": 13,
	"version": "7",
	"when": 1784131200000,
	"tag": "0013_add_arnold_cat_map_type",
	"breakpoints": true
}
```

(Use any unique `when` ms timestamp ≥ previous entry.)

- [ ] **Step 3: Update `schema.test.ts`**

Replace the 0012 journal test:

```typescript
test('drizzle journal registers the 0013 arnold-cat migration', () => {
	const journal = JSON.parse(
		readFileSync(resolve(migrationDir, 'meta/_journal.json'), 'utf-8')
	) as { entries: { idx: number; tag: string }[] };
	const entry = journal.entries.find((e) => e.tag === '0013_add_arnold_cat_map_type');
	expect(entry).toBeDefined();
	expect(entry!.idx).toBe(13);
	const tags = journal.entries.map((e) => e.tag);
	const migrationFiles = readdirSync(migrationDir).filter((f) => f.endsWith('.sql'));
	expect(migrationFiles.length).toBeGreaterThan(0);
	for (const file of migrationFiles) {
		expect(tags).toContain(file.replace(/\.sql$/, ''));
	}
});
```

- [ ] **Step 4: Run schema tests**

```bash
bun run vitest run src/lib/server/db/schema.test.ts
```

Expected: PASS (constraint length matches `VALID_MAP_TYPES` which already includes arnold-cat from Task 1).

- [ ] **Step 5: Commit**

```bash
git add drizzle/0013_add_arnold_cat_map_type.sql drizzle/meta/_journal.json \
  src/lib/server/db/schema.test.ts
git commit -m "feat: add arnold-cat map type DB migration 0013 (HPA-62)"
```

---

### Task 4: `ArnoldCatRenderer` + steps/sec tests

**Files:**

- Create: `src/lib/components/visualizations/ArnoldCatRenderer.svelte`
- Create: `src/lib/components/visualizations/ArnoldCatRenderer.svelte.test.ts`

**Interfaces:**

- Consumes: pure helpers from `$lib/arnold-cat`
- Props: `height?`, `containerElement?` (bindable), `pointCount?` (bindable), `speed?` (bindable), `paused?` (bindable), `resetSignal?`, `randomizeSignal?`, `stepSignal?`
- Defaults: `height=600`, `pointCount=3000`, `speed=5`, `paused=false`, signals `0`

- [ ] **Step 1: Implement renderer**

Create `ArnoldCatRenderer.svelte`. Structural model: `BakersMapRenderer.svelte` (container, canvas, badge, iteration label, ResizeObserver, signal prev-guards). **Do not** copy Baker's steps-per-frame loop or Float64 arrays.

Key implementation rules:

1. Buffers: `Uint32Array` for `currentX/Y`, `initialX/Y`; `pointColors: string[]`.
2. `clampInt(pointCount, 100, 10000)` **before** every `new Uint32Array(...)`.
3. Init / randomize: fill with `(Math.random() * TWO_32) >>> 0` (or `crypto.getRandomValues`); `pointColors[i] = interpCyanMagenta(initialY[i] / TWO_32)`.
4. Hold sim fields: `acc`, `iterationCount`, `lastTimestamp`, `paused` prop.
5. RAF loop:

```typescript
const MAX_FRAME_DT = 0.05;
const MAX_STEPS_PER_FRAME = 30;

function renderFrame(now: number) {
	if (isUnmounted) return;
	if (lastTimestamp === 0) lastTimestamp = now;
	let frameDt = (now - lastTimestamp) / 1000;
	lastTimestamp = now;
	if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;

	const stepsPerSec = clampInt(speed, 1, 30);
	if (!paused) {
		// Prefer calling advanceArnoldCatSimulation on a state object wrapping the arrays
		advanceArnoldCatSimulation(
			{ xs: currentX, ys: currentY, acc, iterationCount, paused: false },
			frameDt,
			stepsPerSec,
			MAX_FRAME_DT,
			MAX_STEPS_PER_FRAME
		);
		// sync acc + iterationCount back from the state object fields you mutated
	}

	// draw:
	// px = torusToPixel(currentX[i], w)
	// py = torusToPixelY(currentY[i], h)
	// fillRect(px, py, 1, 1)

	// label every 100ms with eslint-disable svelte/no-dom-manipulating
	rafId = requestAnimationFrame(renderFrame);
}
```

**Note:** Because `advanceArnoldCatSimulation` mutates `state.acc` / `state.iterationCount`, keep a single mutable `sim` object owned by the component, or assign locals after the call:

```typescript
const sim = { xs: currentX, ys: currentY, acc, iterationCount, paused: false };
advanceArnoldCatSimulation(sim, frameDt, stepsPerSec, MAX_FRAME_DT, MAX_STEPS_PER_FRAME);
acc = sim.acc;
iterationCount = sim.iterationCount;
```

6. Signal handlers (prev-value guards):

- `doReset`: copy initial → current; `iterationCount = 0`; **`acc = 0`**
- `doRandomize`: reseed; `iterationCount = 0`; **`acc = 0`**
- `doStep`: one `applyArnoldCatStepInPlace`; `iterationCount++`; do **not** change `acc`
- `pointCount` change `$effect`: clamp → reallocate → reseed; `iterationCount = 0`; **`acc = 0`**

7. Markup: same sci-fi container as Baker (`bg-black/40`, `LIVE_RENDER // CANVAS_2D`, `ITERATION:` label with `bind:this={iterationLabel}`).

Optional export for tests: attach `data-testid="iteration-label"` on the iteration div so tests can read `textContent`.

- [ ] **Step 2: Write renderer tests**

Create `ArnoldCatRenderer.svelte.test.ts`. Start from Baker's canvas/RAF stubs (`getContext`, `requestAnimationFrame`, `cancelAnimationFrame`, `installRafPump`).

**Required cases:**

1. Mounts; canvas present; LIVE_RENDER badge
2. Unmount calls `cancelAnimationFrame`
3. Signal init skip: after mount, iteration label shows `0` (or no free step)
4. `stepSignal` increments iteration when pump runs (use async pump + `tick`)
5. `paused=true` does not advance via time pump
6. Extreme `pointCount` prop does not throw / does not allocate insane length — pass `pointCount={1e9}` and assert component still mounts (internal length ≤ 10000). Prefer exposing length via testid or inspecting that no exception is thrown and canvas still renders.
7. **Timestamp steps/sec tests:** if the pure `advanceArnoldCatSimulation` tests already cover 30/60 FPS math, the renderer test still needs to prove the **renderer wires** the accumulator (not steps-per-frame). Options (pick one and implement fully):

**Preferred:** Export or test through a thin integration:

- Mock RAF to invoke callback with controlled timestamps (`cb(0)`, `cb(1000/60)`, …)
- Read iteration label `textContent` after pumps

Example sketch:

```typescript
test('renderer applies ~5 steps over 1s at speed 5 regardless of frame count pattern', async () => {
	const timestamps: number[] = [];
	// 60 frames at 16.666ms
	for (let i = 0; i <= 60; i++) timestamps.push(i * (1000 / 60));

	let idx = 0;
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		const t = timestamps[Math.min(idx, timestamps.length - 1)];
		idx += 1;
		if (idx <= timestamps.length) queueMicrotask(() => cb(t));
		return idx;
	});

	const { container } = render(ArnoldCatRenderer, {
		props: { speed: 5, pointCount: 100, paused: false }
	});
	await new Promise((r) => setTimeout(r, 50));
	const label = container.querySelector('[data-testid="iteration-label"]');
	// allow off-by-one from first-frame lastTimestamp init
	const n = Number(label?.textContent?.replace(/\D/g, '') ?? -1);
	expect(n).toBeGreaterThanOrEqual(4);
	expect(n).toBeLessThanOrEqual(6);
});
```

Also test reset clears residual: force some runtime, fire `resetSignal` via reactive props helper (see `bakers-map-test-helpers.svelte.ts` / `createReactiveProps`), assert next short interval does not jump iteration from stale `acc`.

If `createReactiveProps` is Baker-specific, either reuse a generic helper or copy the pattern into `arnold-cat-test-helpers.svelte.ts`.

- [ ] **Step 3: Run renderer + pure tests**

```bash
bun run vitest run src/lib/arnold-cat.test.ts src/lib/components/visualizations/ArnoldCatRenderer.svelte.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/visualizations/ArnoldCatRenderer.svelte \
  src/lib/components/visualizations/ArnoldCatRenderer.svelte.test.ts \
  src/lib/components/visualizations/arnold-cat-test-helpers.svelte.ts
git commit -m "feat: ArnoldCatRenderer with discrete torus and steps/sec (HPA-62)"
```

---

### Task 5: Main route `/arnold-cat`

**Files:**

- Create: `src/routes/arnold-cat/+page.svelte`

- [ ] **Step 1: Create page**

Mirror `src/routes/bakers-map/+page.svelte` with these substitutions:

| Baker                                       | Arnold Cat                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `bakers-map`                                | `arnold-cat`                                                                       |
| `BakersMapRenderer` / `BakersMapParameters` | `ArnoldCatRenderer` / `ArnoldCatParameters`                                        |
| `speed` default `1`, max `10`               | default `5`, max **`30`**                                                          |
| Speed label `Speed`                         | `Speed (steps/sec)`                                                                |
| Formula baker strings                       | `["x' = (x + y) mod 1", "y' = (x + 2y) mod 1"]`                                    |
| description                                 | Spec DATA_LOG body (exact discrete model wording — **no** “faithful indefinitely”) |
| `onExtraParametersLoaded` clamps            | `pointCount` 100–10000, `speed` **1–30**                                           |

```typescript
function onExtraParametersLoaded(p: ChaosMapParameters) {
	if (p.type !== 'arnold-cat') return;
	pointCount = clampInt(p.pointCount, 100, 10000);
	speed = clampInt(p.speed, 1, 30);
}
```

Keep the same `data-testid`s as Baker (`slider-pointCount`, `slider-speed`, `btn-pause`, `btn-step`, `btn-reset`, `btn-randomize`, value spans) so interaction tests can mirror Baker.

- [ ] **Step 2: Manual smoke (optional)**

```bash
bun run dev
```

Open `/arnold-cat` — cloud should animate slowly (~5 steps/s), pause/step/reset/randomize work.

- [ ] **Step 3: Commit**

```bash
git add src/routes/arnold-cat/+page.svelte
git commit -m "feat: add /arnold-cat visualization page (HPA-62)"
```

---

### Task 6: Compare route

**Files:**

- Create: `src/routes/arnold-cat/compare/+page.svelte`

- [ ] **Step 1: Clone Baker compare page**

Copy `src/routes/bakers-map/compare/+page.svelte` → `src/routes/arnold-cat/compare/+page.svelte` and replace:

- `bakers-map` → `arnold-cat`
- `BakersMap*` → `ArnoldCat*`
- Speed slider max **30**, defaults from `getDefaultParameters`
- `clampParams` uses `getStableRanges('arnold-cat')` so speed max is 30

Keep:

- `ComparisonLayout`, `ComparisonParameterPanel`
- Debounced `goto` URL sync (~300ms)
- `clampParams` / `clampValue` for finite + range safety on URL load

- [ ] **Step 2: Commit**

```bash
git add src/routes/arnold-cat/compare/+page.svelte
git commit -m "feat: add /arnold-cat/compare route (HPA-62)"
```

---

### Task 7: Homepage card + homepage tests

**Files:**

- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/page.svelte.test.ts`

- [ ] **Step 1: Add card**

Append to `visualizations` array in `src/routes/+page.svelte`:

```javascript
{
	name: 'Arnold Cat Map',
	description:
		'An area-preserving map that scrambles images through stretch-and-fold dynamics',
	url: '/arnold-cat',
	color: 'from-slate-400 to-cyan-600'
}
```

Confirm `from-slate-400 to-cyan-600` is not already used (search the file). If collision, pick another unused pair.

- [ ] **Step 2: Update `page.svelte.test.ts`**

1. Change both `toHaveLength(18)` → `toHaveLength(19)`.
2. Add to local `visualizations` array:

```typescript
{ name: 'Arnold Cat Map', url: '/arnold-cat' }
```

3. Optionally add a dedicated link test like Ikeda if desired.

- [ ] **Step 3: Run homepage tests**

```bash
bun run vitest run src/routes/page.svelte.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte src/routes/page.svelte.test.ts
git commit -m "feat: homepage card for Arnold Cat Map (HPA-62)"
```

---

### Task 8: Page + compare interaction tests

**Files:**

- Create: `src/routes/arnold-cat-page-interactions.svelte.test.ts`
- Create: `src/routes/arnold-cat-compare-interactions.svelte.test.ts`

- [ ] **Step 1: Clone Baker interaction tests**

1. Copy `src/routes/bakers-map-page-interactions.svelte.test.ts` → `arnold-cat-page-interactions.svelte.test.ts`
2. Copy `src/routes/bakers-map-compare-interactions.svelte.test.ts` → `arnold-cat-compare-interactions.svelte.test.ts`
3. Global replace: `bakers-map` → `arnold-cat`, `BakersMap` → `ArnoldCat`, paths to `./arnold-cat/+page.svelte` and compare page
4. Adjust speed expectations: defaults **5**, max **30**, clamp tests for out-of-range speed use values `> 30` and expect clamp to 30
5. Config-load fixtures must use `type: 'arnold-cat'`

- [ ] **Step 2: Run interaction tests**

```bash
bun run vitest run src/routes/arnold-cat-page-interactions.svelte.test.ts \
  src/routes/arnold-cat-compare-interactions.svelte.test.ts
```

Expected: PASS. Fix any selector / mock path issues.

- [ ] **Step 3: Commit**

```bash
git add src/routes/arnold-cat-page-interactions.svelte.test.ts \
  src/routes/arnold-cat-compare-interactions.svelte.test.ts
git commit -m "test: arnold-cat page and compare interaction coverage (HPA-62)"
```

---

### Task 9: Full gate

- [ ] **Step 1: Typecheck**

```bash
bun run check
```

Expected: no errors (exhaustive switches satisfied).

- [ ] **Step 2: Full unit suite**

```bash
bun run test
```

Expected: all green.

- [ ] **Step 3: Manual AC checklist**

- [ ] Homepage card → `/arnold-cat`
- [ ] Cloud shows shear/mix at default 5 steps/sec (not washed out instantly)
- [ ] Pause / Step / Reset / Randomize work; step only when paused
- [ ] DATA_LOG copy present
- [ ] Compare link → `/arnold-cat/compare` works
- [ ] Mobile-width canvas still responds

- [ ] **Step 4: Final commit only if gate fixed stragglers**

```bash
git add -A
git status
# commit only if there are fixups
git commit -m "fix: arnold-cat gate cleanups (HPA-62)"
```

---

## Spec coverage self-check

| Spec requirement                                     | Task                               |
| ---------------------------------------------------- | ---------------------------------- |
| Pure Uint32 Cat Map + inverse + pixels               | Task 2                             |
| Steps/sec + MAX_FRAME_DT + 30/60 FPS tests           | Task 2 (+ renderer wire-up Task 4) |
| `acc = 0` on reset/randomize/reinit                  | Task 4                             |
| Clamp pointCount before allocate                     | Task 4                             |
| Types / STABLE_RANGES 1–30 / defaults speed 5        | Task 1                             |
| Migration 0013 + journal + schema test name          | Task 3                             |
| Main + compare routes, clampParams                   | Tasks 5–6                          |
| Homepage + 18→19 tests                               | Task 7                             |
| Page/compare interactions                            | Task 8                             |
| Math + list test updates                             | Tasks 1–2, 7–8                     |
| No image mode / no Float64 continuous                | Global constraints                 |
| Exact discrete wording (not “indefinitely faithful”) | Task 5 description                 |

## Placeholder scan

No TBD/TODO steps. All map-type strings, ranges, and file paths are concrete.

## Type consistency

- Map id: `'arnold-cat'` everywhere
- Params: `{ type: 'arnold-cat', pointCount, speed }`
- Speed range: **1–30**, default **5**
- Display name: `ARNOLD_CAT_MAP`
- Migration tag: `0013_add_arnold_cat_map_type`
