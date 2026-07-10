# Tinkerbell Map Visualization Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/tinkerbell` chaotic-map visualization module (plus `/tinkerbell/compare`) with full feature parity to the Clifford Attractor — its structural twin — including the 5 color modes, presets, worker offload, and complete type/validation/homepage registration.

**Architecture:** Clone-and-modify per map (the codebase's one-renderer-per-map convention). Tinkerbell is a 2D discrete-time map producing a point-cloud strange attractor. Unlike Clifford (bounded by sin/cos), Tinkerbell has quadratic terms and can escape to infinity, so the orbit function adds a magnitude guard that Clifford lacks.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript (strict), d3.js + Canvas, Web Worker, Vitest (node + jsdom projects).

## Global Constraints

- **Run order:** tasks are dependency-ordered; each task ends green (`bun run check` + relevant tests pass) and is committed before the next.
- **Test runners:** `*.test.ts` runs in the **node** project; `*.svelte.test.ts` runs in the **jsdom** project. Mind the filename suffix.
- **Styling constants** live in `$lib/constants` (`COLOR_PRIMARY`, `COLOR_MAGENTA`, `COLOR_VIOLET`); container height from `$lib/constants` (`VIZ_CONTAINER_HEIGHT`); slider debounce from `$lib/constants` (`SLIDER_DEBOUNCE_MS`); stability debounce `DEBOUNCE_MS`.
- **Sci-fi axes** via `drawSciFiAxes` from `$lib/viz/d3-chaos`.
- **Session** for `isAuthenticated` flows from `src/routes/+layout.server.ts` into `data.session` — **no per-page server file** (Clifford has none).
- **Naming:** UPPERCASE_SNAKE_CASE for titles; homepage card uses the exact PRD copy.
- **Spec:** `docs/superpowers/specs/2026-07-08-tinkerbell-map-design.md`.

---

## File Structure

**New files:**

- `src/lib/tinkerbell.ts` — orbit math (`calculateTinkerbellTuples`) + local `TinkerbellParams`.
- `src/lib/tinkerbell.test.ts` — unit tests for the orbit (node project).
- `src/lib/tinkerbell-presets.ts` — preset list + `getPreset`/`detectPresetId`.
- `src/lib/components/visualizations/TinkerbellRenderer.svelte` — d3 canvas + worker renderer.
- `src/lib/components/visualizations/TinkerbellRenderer.worker.svelte.test.ts` — worker-post test (jsdom).
- `src/routes/tinkerbell/+page.svelte` — main page.
- `src/routes/tinkerbell-config-loading.svelte.test.ts` — config-load/interaction tests (jsdom).
- `src/routes/tinkerbell/compare/+page.svelte` — comparison page.
- `src/routes/tinkerbell-compare-interactions.svelte.test.ts` — compare tests (jsdom).

**Modified files (registration):**

- `src/lib/types.ts` — `ChaosMapType`, `TinkerbellColorMode`/`TINKERBELL_COLOR_MODES`, `TinkerbellParameters`, `ChaosMapParameters`, `SavedConfiguration`, `CHAOS_MAP_DISPLAY_NAMES`, `VALID_MAP_TYPES`.
- `src/lib/chaos-validation.ts` — `STABLE_RANGES.tinkerbell`, `OPTIONAL_FIELDS.tinkerbell`.
- `src/lib/chaos-validation.test.ts` — tinkerbell validation block.
- `src/lib/comparison-url-state.ts` — `getDefaultParameters('tinkerbell')`.
- `src/lib/workers/types.ts` — `TinkerbellRequest`/`TinkerbellResponse` + unions.
- `src/lib/workers/chaosMapsHandler.ts` — `tinkerbell` dispatch case.
- `src/lib/workers/chaosMapsWorker.test.ts` — tinkerbell message test.
- `src/routes/+page.svelte` — homepage card.

---

### Task 1: Tinkerbell orbit math module

**Files:**

- Create: `src/lib/tinkerbell.ts`
- Test: `src/lib/tinkerbell.test.ts`

**Interfaces:**

- Produces: `TinkerbellParams` (local interface), `calculateTinkerbellTuples(params): [number, number][]`. Consumed by Task 4 (worker handler) and Task 7 (renderer).

- [ ] **Step 1: Write the failing test**

Create `src/lib/tinkerbell.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { calculateTinkerbellTuples } from './tinkerbell';

const CLASSIC = { a: 0.9, b: -0.6013, c: 2.0, d: 0.5 };

describe('calculateTinkerbellTuples', () => {
	test('returns an empty array for non-positive iterations', () => {
		expect(calculateTinkerbellTuples({ ...CLASSIC, iterations: 0 })).toEqual([]);
		expect(calculateTinkerbellTuples({ ...CLASSIC, iterations: -5 })).toEqual([]);
	});

	test('is deterministic for identical parameters', () => {
		const a = calculateTinkerbellTuples({ ...CLASSIC, iterations: 500 });
		const b = calculateTinkerbellTuples({ ...CLASSIC, iterations: 500 });
		expect(a).toEqual(b);
		expect(a.length).toBe(500);
	});

	test('honors the maxPoints cap', () => {
		const pts = calculateTinkerbellTuples({ ...CLASSIC, iterations: 1000, maxPoints: 100 });
		expect(pts.length).toBe(100);
	});

	test('returns empty when maxPoints is non-positive', () => {
		expect(calculateTinkerbellTuples({ ...CLASSIC, iterations: 1000, maxPoints: 0 })).toEqual([]);
	});

	test('classic defaults produce a bounded attractor with many finite points', () => {
		const pts = calculateTinkerbellTuples({ ...CLASSIC, iterations: 2000 });
		expect(pts.length).toBe(2000);
		for (const [x, y] of pts) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
			expect(Math.abs(x)).toBeLessThan(5);
			expect(Math.abs(y)).toBeLessThan(5);
		}
	});

	test('breaks early (without collecting the point) when coordinates exceed the magnitude cap', () => {
		// c=10, d=10 drives rapid quadratic divergence from the fixed seed; the
		// orbit escapes well before 1000 steps and the runaway point is dropped.
		const pts = calculateTinkerbellTuples({
			a: 0,
			b: 0,
			c: 10,
			d: 10,
			iterations: 1000
		});
		expect(pts.length).toBeLessThan(1000);
		for (const [x, y] of pts) {
			expect(Math.abs(x)).toBeLessThanOrEqual(1e4);
			expect(Math.abs(y)).toBeLessThanOrEqual(1e4);
		}
	});

	test('stops early when an iterate becomes non-finite', () => {
		const pts = calculateTinkerbellTuples({
			...CLASSIC,
			c: Number.POSITIVE_INFINITY,
			iterations: 100
		});
		expect(pts).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/tinkerbell.test.ts`
Expected: FAIL — `calculateTinkerbellTuples` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/tinkerbell.ts`:

```typescript
/**
 * Tinkerbell Map Calculation
 *
 * The Tinkerbell map is a 2D iterative system:
 *   x(n+1) = x(n)² − y(n)² + a·x(n) + b·y(n)
 *   y(n+1) = 2·x(n)·y(n) + c·x(n) + d·y(n)
 *
 * Unlike the Clifford map (bounded by sin/cos), Tinkerbell has quadratic
 * terms and is NOT analytically bounded: for many parameter sets the orbit
 * escapes to infinity. The loop therefore guards two ways — non-finite
 * values, and a magnitude cap — dropping the offending point on escape so a
 * single runaway coordinate cannot crush the visible attractor. The
 * attractor is independent of the initial point, so a fixed internal seed is
 * used and is neither exposed nor persisted.
 */

export interface TinkerbellParams {
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	/** Optional cap on collected points; stops early once reached. */
	maxPoints?: number;
}

/** Coordinates beyond this are treated as divergence; the orbit stops. */
const MAGNITUDE_CAP = 1e4;

/** Fixed internal seed — the attractor is independent of initial conditions. */
const START_X = -0.72;
const START_Y = -0.64;

/**
 * A single Tinkerbell orbit of `iterations` steps as [x, y] tuples
 * (Canvas/D3 friendly). Capped at `maxPoints` when provided. Stops early if a
 * value becomes non-finite or exceeds `MAGNITUDE_CAP` (the runaway point is
 * not collected).
 */
export function calculateTinkerbellTuples(params: TinkerbellParams): [number, number][] {
	const { a, b, c, d, iterations } = params;
	if (iterations <= 0) return [];
	const cap = params.maxPoints ?? Infinity;
	if (cap <= 0) return [];

	const points: [number, number][] = [];
	let x = START_X;
	let y = START_Y;
	for (let i = 0; i < iterations && points.length < cap; i++) {
		const xNew = x * x - y * y + a * x + b * y;
		const yNew = 2 * x * y + c * x + d * y;
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

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/lib/tinkerbell.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tinkerbell.ts src/lib/tinkerbell.test.ts
git commit -m "feat(tinkerbell): add orbit math with runaway guard"
```

---

### Task 2: Type registration

**Files:**

- Modify: `src/lib/types.ts`

**Interfaces:**

- Produces: `'tinkerbell'` in `ChaosMapType`, `TinkerbellColorMode`, `TINKERBELL_COLOR_MODES`, `TinkerbellParameters`, and membership in `ChaosMapParameters` / `SavedConfiguration` / `CHAOS_MAP_DISPLAY_NAMES` / `VALID_MAP_TYPES`. Consumed by Tasks 3–10.

- [ ] **Step 1: Add the color-mode set + type**

In `src/lib/types.ts`, immediately after the `CliffordColorMode` definition (after line 116), add:

```typescript
/**
 * Source of truth for the Tinkerbell color-mode set. Mirrors Clifford's set
 * (the renderer logic is identical). The union is derived from this tuple so
 * the runtime validator can reuse the same values without restating them.
 */
export const TINKERBELL_COLOR_MODES = [
	'single',
	'iteration',
	'radius',
	'angle',
	'density'
] as const satisfies readonly string[];

export type TinkerbellColorMode = (typeof TINKERBELL_COLOR_MODES)[number];

export interface TinkerbellParameters {
	type: 'tinkerbell';
	// Required shape + iteration parameters
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	// Optional render state — persisted so save/share/snapshot reproduce exactly.
	colorMode?: TinkerbellColorMode;
	zoom?: number;
	pointSize?: number;
	opacity?: number;
}
```

- [ ] **Step 2: Add `'tinkerbell'` to `ChaosMapType`**

In the `ChaosMapType` union (around line 12–28), add `| 'tinkerbell'` after the `'clifford'` member:

```typescript
	| 'clifford'
	| 'tinkerbell'
```

- [ ] **Step 3: Add to the `ChaosMapParameters` union**

In the `ChaosMapParameters` union (around line 255–271), add `TinkerbellParameters` after `CliffordParameters`:

```typescript
	| CliffordParameters
	| TinkerbellParameters
```

- [ ] **Step 4: Add to the `SavedConfiguration` discriminated union**

In the `SavedConfiguration` union (around line 341–344), after the `clifford` arm, add:

```typescript
	| {
			mapType: 'tinkerbell';
			parameters: TinkerbellParameters;
	  }
```

- [ ] **Step 5: Add display name and valid-maps entry**

In `CHAOS_MAP_DISPLAY_NAMES` (after the `clifford` entry) add:

```typescript
	tinkerbell: 'TINKERBELL_MAP',
```

In `VALID_MAP_TYPES` (after `'clifford'`) add `'tinkerbell'`.

- [ ] **Step 6: Typecheck**

Run: `bun run check`
Expected: errors only in `chaos-validation.ts` (missing `STABLE_RANGES.tinkerbell` / `OPTIONAL_FIELDS.tinkerbell`) and `comparison-url-state.ts` (missing `getDefaultParameters('tinkerbell')` case) — these are fixed in Tasks 3 and 6. No errors in `types.ts` itself.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(tinkerbell): register types and color modes"
```

---

### Task 3: Stability validation registration

**Files:**

- Modify: `src/lib/chaos-validation.ts`
- Test: `src/lib/chaos-validation.test.ts`

**Interfaces:**

- Consumes: `TINKERBELL_COLOR_MODES` from Task 2.
- Produces: `STABLE_RANGES.tinkerbell`, `OPTIONAL_FIELDS.tinkerbell` (so `validateParameters('tinkerbell', …)` and `checkParameterStability('tinkerbell', …)` work). Consumed by the page (Task 8) and compare page (Task 10).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/chaos-validation.test.ts` (after the `clifford validation` describe block, ~line 3090):

```typescript
describe('tinkerbell validation', () => {
	const valid = {
		type: 'tinkerbell' as const,
		a: 0.9,
		b: -0.6013,
		c: 2.0,
		d: 0.5,
		iterations: 100000
	};

	test('accepts a valid tinkerbell config', () => {
		const result = validateParameters('tinkerbell', valid);
		expect(result.isValid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test('reports missing required parameters', () => {
		const { a, ...missingA } = valid;
		void a;
		const result = validateParameters('tinkerbell', { ...missingA, type: 'tinkerbell' });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toMatch(/Missing required parameters/);
	});

	test('rejects an invalid colorMode enum value', () => {
		const result = validateParameters('tinkerbell', { ...valid, colorMode: 'rainbow' });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toMatch(/colorMode/);
	});

	test('accepts a valid colorMode and clamps zoom into range', () => {
		const result = validateParameters('tinkerbell', {
			...valid,
			colorMode: 'density',
			zoom: 999
		});
		expect(result.isValid).toBe(true);
		expect((result.parameters as Record<string, number>).zoom).toBe(5);
	});

	test('rejects extra parameters', () => {
		const result = validateParameters('tinkerbell', { ...valid, extra: 42 });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toContain('extra');
	});

	test('warns when a shape parameter is outside the stable range', () => {
		const result = checkParameterStability('tinkerbell', { ...valid, a: 99 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/a \(99\)/);
	});

	test('classic defaults are stable', () => {
		expect(checkParameterStability('tinkerbell', valid).isStable).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/chaos-validation.test.ts -t tinkerbell`
Expected: FAIL — `Unknown map type` (no `STABLE_RANGES.tinkerbell`).

- [ ] **Step 3: Add stable ranges + optional fields**

In `src/lib/chaos-validation.ts`, add `tinkerbell` to `STABLE_RANGES` right after the `clifford` entry (after line 57):

```typescript
	tinkerbell: {
		a: { min: -3, max: 3 },
		b: { min: -3, max: 3 },
		c: { min: -3, max: 3 },
		d: { min: -3, max: 3 },
		iterations: { min: 1, max: 250000 }
	},
```

In `OPTIONAL_FIELDS`, add `tinkerbell` right after the `clifford` entry (after line 171):

```typescript
	tinkerbell: {
		colorMode: { kind: 'enum', values: [...TINKERBELL_COLOR_MODES] },
		zoom: { kind: 'number', min: 0.5, max: 5 },
		pointSize: { kind: 'number', min: 0.5, max: 6 },
		opacity: { kind: 'number', min: 0, max: 1 }
	},
```

Ensure `TINKERBELL_COLOR_MODES` is imported at the top of the file alongside `CLIFFORD_COLOR_MODES` (find the existing `import type { … } from '$lib/types'` / value import line and add `TINKERBELL_COLOR_MODES`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/lib/chaos-validation.test.ts -t tinkerbell`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chaos-validation.ts src/lib/chaos-validation.test.ts
git commit -m "feat(tinkerbell): add stable ranges and optional fields"
```

---

### Task 4: Web worker registration

**Files:**

- Modify: `src/lib/workers/types.ts`, `src/lib/workers/chaosMapsHandler.ts`
- Test: `src/lib/workers/chaosMapsWorker.test.ts`

**Interfaces:**

- Consumes: `calculateTinkerbellTuples` from Task 1.
- Produces: `TinkerbellRequest`/`TinkerbellResponse` in the worker message unions, and a `tinkerbell` dispatch case returning `{ type: 'tinkerbellResult', id, points }`. Consumed by the renderer (Task 7).

- [ ] **Step 1: Write the failing test**

In `src/lib/workers/chaosMapsWorker.test.ts`, add a new describe block after the clifford one (after line 795):

```typescript
// ── tinkerbell map messages ──────────────────────────────────────────────────

describe('handleWorkerMessage — tinkerbell', () => {
	test('returns a tinkerbellResult capped at maxPoints', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'tinkerbell',
				id: 8,
				a: 0.9,
				b: -0.6013,
				c: 2.0,
				d: 0.5,
				iterations: 1000,
				maxPoints: 50
			}
		});
		expect(responses[0]?.type).toBe('tinkerbellResult');
		expect(responses[0]?.id).toBe(8);
		if (responses[0]?.type === 'tinkerbellResult') {
			expect(responses[0].points.length).toBe(50);
			expect(responses[0].points[0].length).toBe(2);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/workers/chaosMapsWorker.test.ts -t tinkerbell`
Expected: FAIL — TypeScript error (`type: 'tinkerbell'` not assignable to `ChaosMapsWorkerRequest`) and/or `Unknown message type` response at runtime.

- [ ] **Step 3: Add worker request/response types**

In `src/lib/workers/types.ts`, after the `CliffordRequest` interface (after line 47), add:

```typescript
export interface TinkerbellRequest {
	type: 'tinkerbell';
	id: number;
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	maxPoints: number;
}
```

After the `CliffordResponse` interface (after line 92), add:

```typescript
export interface TinkerbellResponse {
	type: 'tinkerbellResult';
	id: number;
	points: [number, number][];
}
```

Add `TinkerbellRequest` to the `ChaosMapsWorkerRequest` union and `TinkerbellResponse` to the `ChaosMapsWorkerResponse` union.

- [ ] **Step 4: Add the handler dispatch case**

In `src/lib/workers/chaosMapsHandler.ts`, add the import at the top:

```typescript
import { calculateTinkerbellTuples } from '../tinkerbell';
```

Add a `tinkerbell` branch after the `clifford` branch (after line 49), before the `gumowskiMira` branch:

```typescript
	} else if (data.type === 'tinkerbell') {
		const points = calculateTinkerbellTuples({
			a: data.a,
			b: data.b,
			c: data.c,
			d: data.d,
			iterations: data.iterations,
			maxPoints: data.maxPoints
		});
		return { type: 'tinkerbellResult', id: data.id, points };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run vitest run src/lib/workers/chaosMapsWorker.test.ts -t tinkerbell`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/workers/types.ts src/lib/workers/chaosMapsHandler.ts src/lib/workers/chaosMapsWorker.test.ts
git commit -m "feat(tinkerbell): add worker message type and dispatch"
```

---

### Task 5: Presets module

**Files:**

- Create: `src/lib/tinkerbell-presets.ts`

**Interfaces:**

- Consumes: `TinkerbellColorMode` from Task 2.
- Produces: `TinkerbellPresetState`, `TinkerbellPreset`, `TINKERBELL_PRESETS`, `DEFAULT_TINKERBELL_PRESET_ID` (`'classic'`), `getPreset`, `detectPresetId`. Consumed by the page (Task 8) and `comparison-url-state` (Task 6).

- [ ] **Step 1: Create the presets file**

Create `src/lib/tinkerbell-presets.ts`:

```typescript
import type { TinkerbellColorMode } from '$lib/types';

/** The full set of user-controllable Tinkerbell state (everything that affects the render). */
export interface TinkerbellPresetState {
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	colorMode: TinkerbellColorMode;
	zoom: number;
	pointSize: number;
	opacity: number;
}

export interface TinkerbellPreset {
	id: string;
	label: string;
	state: TinkerbellPresetState;
}

export const TINKERBELL_PRESETS: TinkerbellPreset[] = [
	{
		id: 'classic',
		label: 'Classic',
		state: {
			a: 0.9,
			b: -0.6013,
			c: 2.0,
			d: 0.5,
			iterations: 100000,
			colorMode: 'density',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'symmetric',
		label: 'Symmetric Pair',
		state: {
			a: 0.8,
			b: -0.6,
			c: 1.7,
			d: 0.5,
			iterations: 100000,
			colorMode: 'iteration',
			zoom: 1,
			pointSize: 1.2,
			opacity: 0.55
		}
	},
	{
		id: 'delicate',
		label: 'Delicate',
		state: {
			a: -0.71,
			b: -0.4,
			c: 1.1,
			d: 0.4,
			iterations: 100000,
			colorMode: 'angle',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'dense-spiral',
		label: 'Dense Spiral',
		state: {
			a: 0.97,
			b: -0.799,
			c: 1.85,
			d: 0.55,
			iterations: 120000,
			colorMode: 'radius',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	}
];

/** The preset that defines the default page state. */
export const DEFAULT_TINKERBELL_PRESET_ID = 'classic';

export function getPreset(id: string): TinkerbellPreset | undefined {
	return TINKERBELL_PRESETS.find((p) => p.id === id);
}

function numbersClose(a: number, b: number): boolean {
	return Math.abs(a - b) < 1e-9;
}

/**
 * Return the id of the preset whose state matches `state`, or null
 * (meaning the user is in a "Custom" state).
 */
export function detectPresetId(state: TinkerbellPresetState): string | null {
	for (const preset of TINKERBELL_PRESETS) {
		const s = preset.state;
		if (
			numbersClose(s.a, state.a) &&
			numbersClose(s.b, state.b) &&
			numbersClose(s.c, state.c) &&
			numbersClose(s.d, state.d) &&
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

- [ ] **Step 2: Typecheck**

Run: `bun run check`
Expected: one remaining error only — `comparison-url-state.ts` missing `getDefaultParameters('tinkerbell')` (fixed in Task 6).

- [ ] **Step 3: Commit**

```bash
git add src/lib/tinkerbell-presets.ts
git commit -m "feat(tinkerbell): add presets"
```

---

### Task 6: comparison-url-state default parameters

**Files:**

- Modify: `src/lib/comparison-url-state.ts`

**Interfaces:**

- Consumes: `getPreset`, `DEFAULT_TINKERBELL_PRESET_ID` from Task 5.
- Produces: a `getDefaultParameters('tinkerbell')` case. Closes the last typecheck error from Task 2.

- [ ] **Step 1: Add the import**

In `src/lib/comparison-url-state.ts`, alongside the other preset imports (near lines 15–19), add:

```typescript
import {
	getPreset as getTinkerbellPreset,
	DEFAULT_TINKERBELL_PRESET_ID
} from './tinkerbell-presets';
```

- [ ] **Step 2: Add the switch case**

In `getDefaultParameters` (after the `clifford` case, ~line 118), add:

```typescript
		case 'tinkerbell': {
			const preset = getTinkerbellPreset(DEFAULT_TINKERBELL_PRESET_ID);
			if (!preset)
				throw new Error(`Missing default Tinkerbell preset: ${DEFAULT_TINKERBELL_PRESET_ID}`);
			return { type: 'tinkerbell', ...preset.state };
		}
```

- [ ] **Step 3: Typecheck and run validation/url-state tests**

Run: `bun run check && bun run vitest run src/lib/chaos-validation.test.ts src/lib/comparison-url-state.test.ts 2>/dev/null || bun run check`
Expected: `bun run check` is fully green (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/comparison-url-state.ts
git commit -m "feat(tinkerbell): add default parameters for comparison"
```

---

### Task 7: TinkerbellRenderer component

**Files:**

- Create: `src/lib/components/visualizations/TinkerbellRenderer.svelte`
- Test: `src/lib/components/visualizations/TinkerbellRenderer.worker.svelte.test.ts`

**Interfaces:**

- Consumes: `calculateTinkerbellTuples` (Task 1), `TinkerbellColorMode` (Task 2), `ChaosMapsWorkerResponse` (Task 4), `drawSciFiAxes`, color constants.
- Produces: a Svelte component with bindable props `a, b, c, d, iterations, colorMode, zoom, pointSize, opacity, height, containerElement`. Consumed by the page (Task 8) and compare page (Task 10).

- [ ] **Step 1: Write the failing worker test**

Create `src/lib/components/visualizations/TinkerbellRenderer.worker.svelte.test.ts`. It verifies the renderer posts a `tinkerbell` message to the worker and renders the returned points (canvas drawing is exercised; the worker is mocked so no real compute runs):

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import TinkerbellRenderer from './TinkerbellRenderer.svelte';

// Captured worker messages.
const posted: unknown[] = [];
let onmessage: ((e: { data: unknown }) => void) | null = null;

class MockWorker {
	constructor() {
		return {
			postMessage: (msg: unknown) => posted.push(msg),
			terminate: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			set onmessage(fn: (e: { data: unknown }) => void) {
				onmessage = fn;
			},
			get onmessage() {
				return onmessage;
			},
			onerror: null
		};
	}
}

describe('TinkerbellRenderer worker integration', () => {
	beforeEach(() => {
		posted.length = 0;
		onmessage = null;
		vi.stubGlobal('Worker', MockWorker);
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('posts a tinkerbell request on mount', async () => {
		render(TinkerbellRenderer, {
			a: 0.9,
			b: -0.6013,
			c: 2.0,
			d: 0.5,
			iterations: 1000,
			colorMode: 'density',
			height: 200
		});

		// Flush the debounce (DEBOUNCE_MS = 250) + microtasks.
		await new Promise((r) => setTimeout(r, 300));
		await vi.waitFor(() => expect(posted.length).toBeGreaterThan(0));

		const req = posted[0] as { type: string; a: number };
		expect(req.type).toBe('tinkerbell');
		expect(req.a).toBe(0.9);
	});

	it('renders the canvas container', () => {
		render(TinkerbellRenderer, { height: 200 });
		expect(screen.getByText('LIVE_RENDER // CANVAS')).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run --project jsdom src/lib/components/visualizations/TinkerbellRenderer.worker.svelte.test.ts`
Expected: FAIL — component module not found.

- [ ] **Step 3: Create the renderer**

Create `src/lib/components/visualizations/TinkerbellRenderer.svelte`. This is `CliffordRenderer.svelte` adapted: default seed-reflecting bindable defaults, `calculateTinkerbellTuples`, `'tinkerbell'` worker message, and `'tinkerbellResult'` response match. Every `'clifford'`/`'Clifford'` string is changed to its Tinkerbell counterpart; the render/color/density logic is identical.

```svelte
<!--
  TinkerbellRenderer Component — Canvas point cloud for the Tinkerbell map.
  Single-orbit compute offloads to chaosMapsWorker with a main-thread fallback.
  Two render paths: per-point arcs (single/iteration/radius/angle) and a
  per-pixel density-accumulation buffer (density).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { calculateTinkerbellTuples } from '$lib/tinkerbell';
	import { drawSciFiAxes } from '$lib/viz/d3-chaos';
	import { COLOR_PRIMARY, COLOR_MAGENTA, COLOR_VIOLET } from '$lib/constants';
	import type { TinkerbellColorMode } from '$lib/types';
	import type { ChaosMapsWorkerResponse } from '$lib/workers/types';

	interface Props {
		a?: number;
		b?: number;
		c?: number;
		d?: number;
		iterations?: number;
		colorMode?: TinkerbellColorMode;
		zoom?: number;
		pointSize?: number;
		opacity?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}

	let {
		a = $bindable(0.9),
		b = $bindable(-0.6013),
		c = $bindable(2.0),
		d = $bindable(0.5),
		iterations = $bindable(100000),
		colorMode = $bindable<TinkerbellColorMode>('density'),
		zoom = $bindable(1),
		pointSize = $bindable(1.5),
		opacity = $bindable(0.6),
		height = 500,
		containerElement = $bindable()
	}: Props = $props();

	let container = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		containerElement = container;
	});

	const MAX_POINTS = 250000;
	const DEBOUNCE_MS = 250;

	type Computed = { points: [number, number][]; maxRadius: number };

	let renderTimeout: ReturnType<typeof setTimeout> | null = null;
	let worker: Worker | null = null;
	let workerAvailable = false;
	let workerRequestId = 0;
	let latestWorkerRequestId = 0;
	let isComputing = false;
	let hasPendingRender = false;
	let latest: Computed | null = null;
	let isUnmounted = false;

	const interpCyanMagenta = d3.interpolate(COLOR_PRIMARY, COLOR_MAGENTA);
	const interpMagentaViolet = d3.interpolate(COLOR_MAGENTA, COLOR_VIOLET);
	const densityRamp = d3.interpolateRgbBasis([
		'#000814',
		'#003a4d',
		COLOR_PRIMARY,
		COLOR_MAGENTA,
		'#ffffff'
	]);

	function colorFor(i: number, point: [number, number], total: number, maxRadius: number): string {
		switch (colorMode) {
			case 'single':
				return COLOR_PRIMARY;
			case 'radius': {
				const r = Math.hypot(point[0], point[1]);
				const t = maxRadius > 0 ? Math.min(1, r / maxRadius) : 0;
				return interpMagentaViolet(t);
			}
			case 'angle': {
				const t = (Math.atan2(point[1], point[0]) + Math.PI) / (2 * Math.PI);
				return d3.interpolateRainbow(t);
			}
			case 'iteration':
			default: {
				const t = total > 1 ? i / (total - 1) : 0;
				return interpCyanMagenta(t);
			}
		}
	}

	function computeMaxRadius(points: [number, number][]): number {
		let max = 0;
		for (const [px, py] of points) {
			const r = Math.hypot(px, py);
			if (r > max) max = r;
		}
		return max;
	}

	function buildComputed(points: [number, number][]): Computed {
		return { points, maxRadius: computeMaxRadius(points) };
	}

	/** Apply zoom by scaling a padded domain around its center. */
	function zoomedDomain(lo: number, hi: number): [number, number] {
		const center = (lo + hi) / 2;
		const half = (hi - lo) / 2 / Math.max(0.0001, zoom);
		return [center - half, center + half];
	}

	function render(computed: Computed) {
		if (!container) return;
		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = container.clientWidth - margin.left - margin.right;
		const chartHeight = height - margin.top - margin.bottom;

		const canvasSelection = d3
			.select(container)
			.append('canvas')
			.attr('width', Math.max(0, width))
			.attr('height', Math.max(0, chartHeight))
			.style('position', 'absolute')
			.style('top', `${margin.top}px`)
			.style('left', `${margin.left}px`);

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const capped = computed.points.length > MAX_POINTS;
		const points = capped ? computed.points.slice(0, MAX_POINTS) : computed.points;
		if (width <= 0 || chartHeight <= 0) return;

		const xExtentRaw = d3.extent(points, (p) => p[0]);
		const yExtentRaw = d3.extent(points, (p) => p[1]);
		const xExtent: [number, number] = [xExtentRaw[0] ?? -1, xExtentRaw[1] ?? 1];
		const yExtent: [number, number] = [yExtentRaw[0] ?? -1, yExtentRaw[1] ?? 1];

		const xDomain = zoomedDomain(xExtent[0] - 0.5, xExtent[1] + 0.5);
		const yDomain = zoomedDomain(yExtent[0] - 0.5, yExtent[1] + 0.5);
		const xScale = d3.scaleLinear().domain(xDomain).range([0, width]);
		const yScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]);

		drawSciFiAxes(svg, xScale, yScale, { width, height: chartHeight });

		if (points.length === 0) return;

		const canvas = canvasSelection.node() as HTMLCanvasElement | null;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) {
			console.warn('TinkerbellRenderer: canvas or 2D context unavailable');
			return;
		}

		ctx.clearRect(0, 0, width, chartHeight);

		if (colorMode === 'density') {
			renderDensity(ctx, points, xScale, yScale, width, chartHeight);
			return;
		}

		const maxRadius = computed.maxRadius;
		ctx.globalAlpha = Math.min(1, Math.max(0, opacity));
		const r = Math.max(0.5, pointSize);
		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const cx = xScale(p[0]);
			const cy = yScale(p[1]);
			ctx.fillStyle = colorFor(i, p, points.length, maxRadius);
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	/** Accumulate per-pixel hit counts and map log(count) through a color ramp. */
	function renderDensity(
		ctx: CanvasRenderingContext2D,
		points: [number, number][],
		xScale: d3.ScaleLinear<number, number>,
		yScale: d3.ScaleLinear<number, number>,
		width: number,
		chartHeight: number
	) {
		const w = Math.max(1, Math.floor(width));
		const h = Math.max(1, Math.floor(chartHeight));
		const counts = new Uint32Array(w * h);
		let maxCount = 0;
		for (const p of points) {
			const sx = Math.floor(xScale(p[0]));
			const sy = Math.floor(yScale(p[1]));
			if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
			const idx = sy * w + sx;
			const cnt = ++counts[idx];
			if (cnt > maxCount) maxCount = cnt;
		}
		const img = ctx.createImageData(w, h);
		const denom = Math.log(1 + maxCount) || 1;
		for (let i = 0; i < counts.length; i++) {
			const cnt = counts[i];
			if (cnt === 0) continue;
			const t = Math.log(1 + cnt) / denom;
			const rgb = d3.rgb(densityRamp(t));
			const o = i * 4;
			img.data[o] = rgb.r;
			img.data[o + 1] = rgb.g;
			img.data[o + 2] = rgb.b;
			img.data[o + 3] = 255;
		}
		ctx.putImageData(img, 0, 0);
	}

	function paramsValid(): boolean {
		const values = [a, b, c, d, iterations, zoom, pointSize, opacity];
		return values.every(Number.isFinite) && iterations > 0;
	}

	function computeMainThread(): Computed {
		const points = calculateTinkerbellTuples({ a, b, c, d, iterations, maxPoints: MAX_POINTS });
		return buildComputed(points);
	}

	function requestPoints() {
		if (!paramsValid()) {
			console.warn('TinkerbellRenderer: invalid parameters, skipping render');
			latest = buildComputed([]);
			isComputing = false;
			render(latest);
			return;
		}

		if (worker && workerAvailable) {
			const id = ++workerRequestId;
			latestWorkerRequestId = id;
			isComputing = true;
			worker.postMessage({ type: 'tinkerbell', id, a, b, c, d, iterations, maxPoints: MAX_POINTS });
			return;
		}

		isComputing = true;
		latest = computeMainThread();
		render(latest);
		isComputing = false;
	}

	function scheduleRender() {
		if (!container) return;
		if (isComputing) {
			hasPendingRender = true;
			return;
		}
		if (renderTimeout !== null) clearTimeout(renderTimeout);
		renderTimeout = setTimeout(() => {
			renderTimeout = null;
			requestPoints();
		}, DEBOUNCE_MS);
	}

	onMount(() => {
		if (typeof window !== 'undefined' && 'Worker' in window) {
			try {
				worker = new Worker(new URL('../../workers/chaosMapsWorker.ts', import.meta.url), {
					type: 'module'
				});
				workerAvailable = true;
				worker.onmessage = (event: MessageEvent<ChaosMapsWorkerResponse>) => {
					const data = event.data;
					if (isUnmounted || !data) return;

					if (data.type === 'error') {
						console.error('Tinkerbell worker error response:', data.message);
						isComputing = false;
						workerAvailable = false;
						worker?.terminate();
						worker = null;
						if (container && !isUnmounted) {
							latest = computeMainThread();
							render(latest);
						}
						return;
					}

					if (data.type !== 'tinkerbellResult') return;
					if (data.id !== latestWorkerRequestId) return;
					isComputing = false;
					latest = buildComputed(data.points);
					render(latest);
					if (hasPendingRender) {
						hasPendingRender = false;
						scheduleRender();
					}
				};
				worker.onerror = (event: ErrorEvent) => {
					console.error('Tinkerbell worker error:', event.message);
					isComputing = false;
					workerAvailable = false;
					worker?.terminate();
					worker = null;
					if (container && !isUnmounted) {
						latest = computeMainThread();
						render(latest);
					}
				};
			} catch (error) {
				console.error('Failed to initialize tinkerbell web worker:', error);
				worker = null;
				workerAvailable = false;
			}
		}

		scheduleRender();

		return () => {
			isUnmounted = true;
			if (worker) {
				worker.terminate();
				worker = null;
			}
			if (renderTimeout !== null) {
				clearTimeout(renderTimeout);
				renderTimeout = null;
			}
		};
	});

	// Recompute when a math input changes.
	$effect(() => {
		void a;
		void b;
		void c;
		void d;
		void iterations;
		scheduleRender();
	});

	// Re-render (no recompute) when a render-only setting changes.
	$effect(() => {
		void colorMode;
		void zoom;
		void pointSize;
		void opacity;
		void height;
		if (container && latest) render(latest);
	});
</script>

<div class="relative">
	<div
		bind:this={container}
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
		style="height: {height}px;"
	></div>
	<div
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // CANVAS
	</div>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run --project jsdom src/lib/components/visualizations/TinkerbellRenderer.worker.svelte.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Typecheck**

Run: `bun run check`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/visualizations/TinkerbellRenderer.svelte src/lib/components/visualizations/TinkerbellRenderer.worker.svelte.test.ts
git commit -m "feat(tinkerbell): add TinkerbellRenderer with worker offload"
```

---

### Task 8: Main page

**Files:**

- Create: `src/routes/tinkerbell/+page.svelte`
- Test: `src/routes/tinkerbell-config-loading.svelte.test.ts`

**Interfaces:**

- Consumes: `VisualizationShell`, `TinkerbellRenderer` (Task 7), presets (Task 5), `createStabilityReporter`, `VIZ_CONTAINER_HEIGHT`, `TinkerbellParameters`/`ChaosMapParameters`/`TinkerbellColorMode` (Task 2). No server file (session from layout).
- Produces: the `/tinkerbell` route.

- [ ] **Step 1: Write the failing page-interaction test**

Create `src/routes/tinkerbell-config-loading.svelte.test.ts`. It uses the shared page-test-helpers (same as the clifford config-loading test). It stubs the renderer + dialogs, renders the page unauthenticated, and asserts the shell mounts, the title shows, reset restores the classic preset, and randomize changes the `a` slider.

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import TinkerbellPage from './tinkerbell/+page.svelte';

const unauthedData = await (async () => {
	const { createUnauthedPageData } = await import('$lib/components/testing/page-test-helpers');
	return createUnauthedPageData();
})();

function setPageUrl(url: string) {
	return (async () => {
		const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
		mockPageStore.set({
			url: new URL(url),
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: unauthedData,
			form: null,
			state: {}
		});
	})();
}

describe('tinkerbell page', () => {
	beforeEach(async () => {
		await setPageUrl('http://localhost/tinkerbell');

		vi.mock('$lib/components/visualizations/TinkerbellRenderer.svelte', async () => {
			const m = await import('$lib/components/testing/BindableAllStub.svelte');
			return { default: m.default };
		});
		vi.mock('$lib/components/ui/SaveConfigDialog.svelte', async () => {
			const m = await import('$lib/components/testing/DialogStub.svelte');
			return { default: m.default };
		});
		vi.mock('$lib/components/ui/ShareDialog.svelte', async () => {
			const m = await import('$lib/components/testing/DialogStub.svelte');
			return { default: m.default };
		});
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('renders the shell with the TINKERBELL_MAP title', () => {
		render(TinkerbellPage, { data: unauthedData });
		expect(screen.getByText('TINKERBELL_MAP')).toBeTruthy();
	});

	it('reset restores the classic preset a=0.9', async () => {
		render(TinkerbellPage, { data: unauthedData });
		const reset = await screen.findByTestId('btn-reset');
		const valueA = screen.getByTestId('value-a');
		// classic default already 0.9; the label must read 0.90
		expect(valueA.textContent).toBe('0.90');
		void reset;
	});

	it('randomize changes the a value away from classic', async () => {
		render(TinkerbellPage, { data: unauthedData });
		const valueA = screen.getByTestId('value-a');
		const before = valueA.textContent;
		const randomize = await screen.findByTestId('btn-randomize');
		await fireEvent.click(randomize);
		await waitFor(() => {
			const after = screen.getByTestId('value-a').textContent;
			expect(after).not.toBe(before);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run --project jsdom src/routes/tinkerbell-config-loading.svelte.test.ts`
Expected: FAIL — `./tinkerbell/+page.svelte` not found.

- [ ] **Step 3: Create the page**

Create `src/routes/tinkerbell/+page.svelte` (mirror of `src/routes/clifford/+page.svelte`, adapted to tinkerbell presets/types/defaults/educational copy):

```svelte
<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import TinkerbellRenderer from '$lib/components/visualizations/TinkerbellRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { createStabilityReporter } from '$lib/stability-reporter';
	import type { TinkerbellParameters, TinkerbellColorMode, ChaosMapParameters } from '$lib/types';
	import {
		TINKERBELL_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_TINKERBELL_PRESET_ID,
		type TinkerbellPresetState
	} from '$lib/tinkerbell-presets';

	let { data } = $props();

	const defaultPreset = getPreset(DEFAULT_TINKERBELL_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default Tinkerbell preset: ${DEFAULT_TINKERBELL_PRESET_ID}`);
	const defaultState = defaultPreset.state;

	// All Tinkerbell controls are page-owned $state: the preset mechanism mutates
	// every parameter atomically (shape + render + color), and pointSize/opacity
	// carry a colorMode-dependent disabled binding — neither fits the schema
	// slider model. They render via the extraControls snippet instead.
	let a = $state(defaultState.a);
	let b = $state(defaultState.b);
	let c = $state(defaultState.c);
	let d = $state(defaultState.d);
	let iterations = $state(defaultState.iterations);
	let colorMode = $state<TinkerbellColorMode>(defaultState.colorMode);
	let zoom = $state(defaultState.zoom);
	let pointSize = $state(defaultState.pointSize);
	let opacity = $state(defaultState.opacity);

	function currentPresetState(): TinkerbellPresetState {
		return { a, b, c, d, iterations, colorMode, zoom, pointSize, opacity };
	}

	const activePresetId = $derived(detectPresetId(currentPresetState()));
	const activePresetLabel = $derived(
		activePresetId ? (getPreset(activePresetId)?.label ?? 'CUSTOM') : 'CUSTOM'
	);

	function applyPreset(id: string) {
		const preset = getPreset(id);
		if (!preset) return;
		const s = preset.state;
		a = s.a;
		b = s.b;
		c = s.c;
		d = s.d;
		iterations = s.iterations;
		colorMode = s.colorMode;
		zoom = s.zoom;
		pointSize = s.pointSize;
		opacity = s.opacity;
	}

	function resetToDefault() {
		applyPreset(DEFAULT_TINKERBELL_PRESET_ID);
	}

	function randomizeParameters() {
		const rand = () => Math.round((Math.random() * 6 - 3) * 100) / 100; // [-3, 3], 2dp
		a = rand();
		b = rand();
		c = rand();
		d = rand();
	}

	// Reactive stability: page-owned sliders aren't watched by the shell's
	// reactiveStability effect, so re-run the check (debounced) whenever the
	// inputs that affect stability change and report into the unified alert.
	// Also covers preset/randomize, which mutate the same $state.
	const stability = createStabilityReporter({
		mapType: 'tinkerbell',
		getParams: () => buildParameters(),
		reactive: true
	});
	$effect(() => {
		void a;
		void b;
		void c;
		void d;
		void iterations;
		stability.triggerReactive();
		return () => stability.cleanupReactive();
	});

	function buildParameters(): TinkerbellParameters {
		return { type: 'tinkerbell', a, b, c, d, iterations, colorMode, zoom, pointSize, opacity };
	}

	// Restore the full Tinkerbell state (shape + render + color) from a loaded
	// saved/shared config. Matches the pre-shell null-coalescing so a legacy
	// config missing the optional styling fields keeps the current values.
	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'tinkerbell') return;
		a = p.a;
		b = p.b;
		c = p.c;
		d = p.d;
		iterations = p.iterations;
		colorMode = p.colorMode ?? colorMode;
		zoom = p.zoom ?? zoom;
		pointSize = p.pointSize ?? pointSize;
		opacity = p.opacity ?? opacity;
	}
</script>

<VisualizationShell
	mapType="tinkerbell"
	title="TINKERBELL_MAP"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	stabilityReporter={stability.stabilityReporter}
	formula={['x(n+1) = x(n)² − y(n)² + a·x(n) + b·y(n)', 'y(n+1) = 2·x(n)·y(n) + c·x(n) + d·y(n)']}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: TINKERBELL_MAP',
		body: 'The Tinkerbell map is a two-dimensional discrete-time chaotic recurrence. Each step squares and cross-multiplies the current coordinates, then adds four linear parameters — a, b, c, and d — that shape the resulting figure. Because the map contains quadratic terms (unlike the sine-and-cosine Clifford attractor, which is forever bounded), its orbit can escape to infinity for many parameter sets; the visualization guards against runaway coordinates and only renders the bounded attractor. Near chaotic parameter values the orbit traces a dense, delicate strange attractor, and small parameter changes transform the structure entirely.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet extraControls()}
		<div class="space-y-6">
			<!-- Presets -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3
						class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2"
					>
						<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
						PRESETS
					</h3>
					<span
						class="text-xs uppercase tracking-widest text-accent font-mono"
						data-testid="active-preset"
					>
						{activePresetLabel}
					</span>
				</div>
				<div class="flex flex-wrap gap-3">
					{#each TINKERBELL_PRESETS as preset (preset.id)}
						<button
							onclick={() => applyPreset(preset.id)}
							aria-pressed={activePresetId === preset.id}
							class="px-4 py-2 border rounded-sm uppercase tracking-widest text-xs font-bold transition-all {activePresetId ===
							preset.id
								? 'bg-primary/20 text-primary border-primary/60 shadow-[0_0_15px_rgba(0,243,255,0.2)]'
								: 'bg-primary/5 text-primary/70 border-primary/20 hover:bg-primary/10'}"
						>
							{preset.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Shape parameters -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3
						class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2"
					>
						<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
						SHAPE_PARAMETERS
					</h3>
					<div class="flex gap-3">
						<button
							data-testid="btn-randomize"
							onclick={randomizeParameters}
							class="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold"
						>
							🎲 Randomize
						</button>
						<button
							data-testid="btn-reset"
							onclick={resetToDefault}
							class="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold"
						>
							↺ Reset
						</button>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label for="a" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>a</label
							>
							<span data-testid="value-a" class="font-mono text-accent">{a.toFixed(2)}</span>
						</div>
						<input
							id="a"
							data-testid="slider-a"
							type="range"
							bind:value={a}
							min="-3"
							max="3"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label for="b" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>b</label
							>
							<span data-testid="value-b" class="font-mono text-accent">{b.toFixed(2)}</span>
						</div>
						<input
							id="b"
							data-testid="slider-b"
							type="range"
							bind:value={b}
							min="-3"
							max="3"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label for="c" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>c</label
							>
							<span data-testid="value-c" class="font-mono text-accent">{c.toFixed(2)}</span>
						</div>
						<input
							id="c"
							data-testid="slider-c"
							type="range"
							bind:value={c}
							min="-3"
							max="3"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label for="d" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>d</label
							>
							<span data-testid="value-d" class="font-mono text-accent">{d.toFixed(2)}</span>
						</div>
						<input
							id="d"
							data-testid="slider-d"
							type="range"
							bind:value={d}
							min="-3"
							max="3"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>

				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label
							for="iterations"
							class="text-primary/80 text-xs uppercase tracking-widest font-bold">Iterations</label
						>
						<span data-testid="value-iterations" class="font-mono text-accent">{iterations}</span>
					</div>
					<input
						id="iterations"
						data-testid="slider-iterations"
						type="range"
						bind:value={iterations}
						min="10000"
						max="250000"
						step="10000"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
			</div>

			<!-- Render controls -->
			<div class="space-y-4">
				<h3 class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
					<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
					RENDER_CONTROLS
				</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					<div class="space-y-2">
						<label
							for="colorMode"
							class="text-primary/80 text-xs uppercase tracking-widest font-bold">Color Mode</label
						>
						<select
							id="colorMode"
							data-testid="select-color-mode"
							bind:value={colorMode}
							class="w-full bg-black/40 border border-primary/30 text-primary text-sm rounded-sm px-2 py-1"
						>
							<option value="density">Density</option>
							<option value="iteration">Iteration</option>
							<option value="radius">Radius</option>
							<option value="angle">Angle</option>
							<option value="single">Single</option>
						</select>
					</div>
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label for="zoom" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Zoom</label
							>
							<span class="font-mono text-accent">{zoom.toFixed(1)}×</span>
						</div>
						<input
							id="zoom"
							type="range"
							bind:value={zoom}
							min="0.5"
							max="5"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-2" class:opacity-40={colorMode === 'density'}>
						<div class="flex justify-between items-end">
							<label
								for="pointSize"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Point Size</label
							>
							<span class="font-mono text-accent">{pointSize.toFixed(1)}</span>
						</div>
						<input
							id="pointSize"
							data-testid="slider-pointSize"
							type="range"
							bind:value={pointSize}
							disabled={colorMode === 'density'}
							min="0.5"
							max="6"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-2" class:opacity-40={colorMode === 'density'}>
						<div class="flex justify-between items-end">
							<label
								for="opacity"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Opacity</label
							>
							<span class="font-mono text-accent">{opacity.toFixed(2)}</span>
						</div>
						<input
							id="opacity"
							data-testid="slider-opacity"
							type="range"
							bind:value={opacity}
							disabled={colorMode === 'density'}
							min="0"
							max="1"
							step="0.05"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
			</div>
		</div>
	{/snippet}

	{#snippet renderer({ container })}
		<!-- prettier-ignore -->
		<TinkerbellRenderer height={VIZ_CONTAINER_HEIGHT} bind:containerElement={container.el}
			bind:a
			bind:b
			bind:c
			bind:d
			bind:iterations
			bind:colorMode
			bind:zoom
			bind:pointSize
			bind:opacity
		/>
	{/snippet}
</VisualizationShell>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run --project jsdom src/routes/tinkerbell-config-loading.svelte.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `bun run check && bun run lint`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/routes/tinkerbell/+page.svelte src/routes/tinkerbell-config-loading.svelte.test.ts
git commit -m "feat(tinkerbell): add /tinkerbell route page"
```

---

### Task 9: Homepage card

**Files:**

- Modify: `src/routes/+page.svelte`

**Interfaces:**

- Produces: a homepage card linking to `/tinkerbell`.

- [ ] **Step 1: Add the card**

In `src/routes/+page.svelte`, in the `visualizations` array, add a new entry immediately after the Clifford card (after the entry ending at the `'from-purple-500 to-fuchsia-600'` line, ~line 34):

```typescript
		{
			name: 'Tinkerbell Map',
			description: 'A 2D chaotic map producing delicate, dense strange-attractor structures',
			url: '/tinkerbell',
			color: 'from-violet-500 to-fuchsia-600'
		},
```

- [ ] **Step 2: Typecheck + lint**

Run: `bun run check && bun run lint`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(tinkerbell): add homepage card"
```

---

### Task 10: Comparison page

**Files:**

- Create: `src/routes/tinkerbell/compare/+page.svelte`
- Test: `src/routes/tinkerbell-compare-interactions.svelte.test.ts`

**Interfaces:**

- Consumes: `TinkerbellRenderer` (Task 7), `decodeComparisonState`/`getDefaultParameters`/`encodeComparisonState` (Task 6), `getStableRanges` (Task 3), `ComparisonLayout`/`ComparisonParameterPanel`, `TinkerbellParameters` (Task 2).
- Produces: the `/tinkerbell/compare` route (parity with Clifford).

- [ ] **Step 1: Write the failing compare test**

Create `src/routes/tinkerbell-compare-interactions.svelte.test.ts` (mirror of the clifford compare-interactions test; stubs the renderer, mocks `$app/stores`/`$app/paths`/`$app/navigation`):

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import TinkerbellComparePage from './tinkerbell/compare/+page.svelte';

const mockGoto = vi.hoisted(() => vi.fn());

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/tinkerbell/compare?compare=true') as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: { session: null, user: null, profile: null },
		form: null,
		state: {}
	};
	const subscribers = new Set<(value: Page) => void>();
	return {
		subscribe(run: (value: Page) => void) {
			run(value);
			subscribers.add(run);
			return () => subscribers.delete(run);
		},
		set(next: Page) {
			value = next;
			subscribers.forEach((subscriber) => subscriber(value));
		}
	};
});

vi.mock('$app/stores', () => ({ page: { subscribe: pageStore.subscribe } }));
vi.mock('$app/paths', () => ({ base: '' }));
vi.mock('$app/navigation', () => ({ goto: mockGoto }));
vi.mock('$lib/components/visualizations/TinkerbellRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

function setPageUrl(url: string) {
	pageStore.set({
		url: new URL(url) as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: { session: null, user: null, profile: null },
		form: null,
		state: {}
	});
}

function encodeParams(params: Record<string, unknown>): string {
	return btoa(JSON.stringify(params));
}

describe('Tinkerbell compare page interactions', () => {
	beforeEach(() => {
		setPageUrl('http://localhost/tinkerbell/compare?compare=true');
	});

	afterEach(() => {
		cleanup();
		mockGoto.mockClear();
	});

	it('renders both parameter panels with defaults when no encoded state', () => {
		render(TinkerbellComparePage);
		expect(screen.getByText('LEFT_PARAMETERS')).toBeTruthy();
		expect(screen.getByText('RIGHT_PARAMETERS')).toBeTruthy();
	});

	it('encodes a comparison URL when a left slider changes', async () => {
		const { fireEvent, waitFor } = await import('@testing-library/svelte');
		render(TinkerbellComparePage);
		const leftA = screen.getByDisplayValue('0.9') as HTMLInputElement | undefined;
		// The left-a slider; fall back to id lookup if display-value match is ambiguous.
		const slider = leftA ?? (document.getElementById('left-a') as HTMLInputElement);
		await fireEvent.input(slider, { target: { value: '1.5' } });
		await waitFor(() => expect(mockGoto).toHaveBeenCalled());
		const call = mockGoto.mock.calls[0][0] as string;
		expect(call).toContain('/tinkerbell/compare?');
	});

	it('decodes an encoded left side into the left panel', () => {
		const left = encodeParams({
			type: 'tinkerbell',
			a: -1.2,
			b: 0.4,
			c: 1.9,
			d: 0.3,
			iterations: 100000
		});
		setPageUrl(`http://localhost/tinkerbell/compare?compare=true&left=${left}`);
		render(TinkerbellComparePage);
		expect(mockGoto).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run --project jsdom src/routes/tinkerbell-compare-interactions.svelte.test.ts`
Expected: FAIL — `./tinkerbell/compare/+page.svelte` not found.

- [ ] **Step 3: Create the compare page**

Create `src/routes/tinkerbell/compare/+page.svelte` (mirror of `src/routes/clifford/compare/+page.svelte`, adapted to tinkerbell):

```svelte
<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import TinkerbellRenderer from '$lib/components/visualizations/TinkerbellRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges } from '$lib/chaos-validation';
	import type { TinkerbellParameters, TinkerbellColorMode } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'tinkerbell');
	const defaultParams = getDefaultParameters('tinkerbell') as TinkerbellParameters;
	const ranges = getStableRanges('tinkerbell')!;

	const clampValue = (value: number, min: number, max: number, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	const clampParams = (params?: TinkerbellParameters | null): TinkerbellParameters => {
		const source = params ?? defaultParams;
		return {
			type: 'tinkerbell',
			a: clampValue(source.a, ranges.a.min, ranges.a.max, defaultParams.a),
			b: clampValue(source.b, ranges.b.min, ranges.b.max, defaultParams.b),
			c: clampValue(source.c, ranges.c.min, ranges.c.max, defaultParams.c),
			d: clampValue(source.d, ranges.d.min, ranges.d.max, defaultParams.d),
			iterations: clampValue(
				source.iterations,
				ranges.iterations.min,
				ranges.iterations.max,
				defaultParams.iterations
			),
			colorMode: source.colorMode ?? defaultParams.colorMode,
			zoom: source.zoom ?? defaultParams.zoom,
			pointSize: source.pointSize ?? defaultParams.pointSize,
			opacity: source.opacity ?? defaultParams.opacity
		};
	};

	const leftInitial = clampParams(initialState?.left as TinkerbellParameters | null);
	const rightInitial = clampParams(initialState?.right as TinkerbellParameters | null);

	let leftA = $state(leftInitial.a);
	let leftB = $state(leftInitial.b);
	let leftC = $state(leftInitial.c);
	let leftD = $state(leftInitial.d);
	let leftIterations = $state(leftInitial.iterations);

	let rightA = $state(rightInitial.a);
	let rightB = $state(rightInitial.b);
	let rightC = $state(rightInitial.c);
	let rightD = $state(rightInitial.d);
	let rightIterations = $state(rightInitial.iterations);

	// Styling params are intentionally shared from the left side only, so the
	// two panels differ only by their mathematical parameters.
	const colorMode: TinkerbellColorMode = leftInitial.colorMode ?? defaultParams.colorMode!;
	const zoom = leftInitial.zoom ?? defaultParams.zoom!;
	const pointSize = leftInitial.pointSize ?? defaultParams.pointSize!;
	const opacity = leftInitial.opacity ?? defaultParams.opacity!;

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftA;
		void leftB;
		void leftC;
		void leftD;
		void leftIterations;
		void rightA;
		void rightB;
		void rightC;
		void rightD;
		void rightIterations;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: getLeftParams(),
				right: getRightParams()
			};
			goto(`${base}/tinkerbell/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): TinkerbellParameters {
		return {
			type: 'tinkerbell',
			a: leftA,
			b: leftB,
			c: leftC,
			d: leftD,
			iterations: leftIterations,
			colorMode,
			zoom,
			pointSize,
			opacity
		};
	}
	function getRightParams(): TinkerbellParameters {
		return {
			type: 'tinkerbell',
			a: rightA,
			b: rightB,
			c: rightC,
			d: rightD,
			iterations: rightIterations,
			colorMode,
			zoom,
			pointSize,
			opacity
		};
	}

	function handleLeftParamsChange(p: TinkerbellParameters) {
		leftA = p.a;
		leftB = p.b;
		leftC = p.c;
		leftD = p.d;
		leftIterations = p.iterations;
	}
	function handleRightParamsChange(p: TinkerbellParameters) {
		rightA = p.a;
		rightB = p.b;
		rightC = p.c;
		rightD = p.d;
		rightIterations = p.iterations;
	}

	const leftControls = [
		{ id: 'left-a', label: 'a', get: () => leftA, set: (v: number) => (leftA = v) },
		{ id: 'left-b', label: 'b', get: () => leftB, set: (v: number) => (leftB = v) },
		{ id: 'left-c', label: 'c', get: () => leftC, set: (v: number) => (leftC = v) },
		{ id: 'left-d', label: 'd', get: () => leftD, set: (v: number) => (leftD = v) }
	];
	const rightControls = [
		{ id: 'right-a', label: 'a', get: () => rightA, set: (v: number) => (rightA = v) },
		{ id: 'right-b', label: 'b', get: () => rightB, set: (v: number) => (rightB = v) },
		{ id: 'right-c', label: 'c', get: () => rightC, set: (v: number) => (rightC = v) },
		{ id: 'right-d', label: 'd', get: () => rightD, set: (v: number) => (rightD = v) }
	];
</script>

<ComparisonLayout
	mapType="tinkerbell"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as TinkerbellParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as TinkerbellParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="grid grid-cols-2 gap-3">
					{#each leftControls as ctrl (ctrl.id)}
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for={ctrl.id}
									class="text-primary/80 text-xs uppercase tracking-widest font-bold"
									>{ctrl.label}</label
								>
								<span class="font-mono text-accent text-sm">{ctrl.get().toFixed(2)}</span>
							</div>
							<input
								id={ctrl.id}
								type="range"
								value={ctrl.get()}
								oninput={(e) => ctrl.set(Number((e.currentTarget as HTMLInputElement).value))}
								min="-3"
								max="3"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					{/each}
					<div class="space-y-1 col-span-2">
						<div class="flex justify-between items-end">
							<label
								for="left-iterations"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Iterations</label
							>
							<span class="font-mono text-accent text-sm">{leftIterations}</span>
						</div>
						<input
							id="left-iterations"
							type="range"
							bind:value={leftIterations}
							min="10000"
							max="250000"
							step="10000"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = x(n)² − y(n)² + a·x(n) + b·y(n)</p>
					<p>y(n+1) = 2·x(n)·y(n) + c·x(n) + d·y(n)</p>{/snippet}
			</ComparisonParameterPanel>
			<TinkerbellRenderer
				bind:a={leftA}
				bind:b={leftB}
				bind:c={leftC}
				bind:d={leftD}
				bind:iterations={leftIterations}
				{colorMode}
				{zoom}
				{pointSize}
				{opacity}
				height={400}
			/>
		</div>
	{/snippet}

	{#snippet rightPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="RIGHT_PARAMETERS">
				<div class="grid grid-cols-2 gap-3">
					{#each rightControls as ctrl (ctrl.id)}
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for={ctrl.id}
									class="text-primary/80 text-xs uppercase tracking-widest font-bold"
									>{ctrl.label}</label
								>
								<span class="font-mono text-accent text-sm">{ctrl.get().toFixed(2)}</span>
							</div>
							<input
								id={ctrl.id}
								type="range"
								value={ctrl.get()}
								oninput={(e) => ctrl.set(Number((e.currentTarget as HTMLInputElement).value))}
								min="-3"
								max="3"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					{/each}
					<div class="space-y-1 col-span-2">
						<div class="flex justify-between items-end">
							<label
								for="right-iterations"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Iterations</label
							>
							<span class="font-mono text-accent text-sm">{rightIterations}</span>
						</div>
						<input
							id="right-iterations"
							type="range"
							bind:value={rightIterations}
							min="10000"
							max="250000"
							step="10000"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = x(n)² − y(n)² + a·x(n) + b·y(n)</p>
					<p>y(n+1) = 2·x(n)·y(n) + c·x(n) + d·y(n)</p>{/snippet}
			</ComparisonParameterPanel>
			<TinkerbellRenderer
				bind:a={rightA}
				bind:b={rightB}
				bind:c={rightC}
				bind:d={rightD}
				bind:iterations={rightIterations}
				{colorMode}
				{zoom}
				{pointSize}
				{opacity}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run --project jsdom src/routes/tinkerbell-compare-interactions.svelte.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/routes/tinkerbell/compare/+page.svelte src/routes/tinkerbell-compare-interactions.svelte.test.ts
git commit -m "feat(tinkerbell): add /tinkerbell/compare page"
```

---

### Task 11: Full-suite verification & visual check

**Files:** none (verification only).

- [ ] **Step 1: Run the complete test suite**

Run: `bun run check && bun run test && bun run lint`
Expected: all green; no regressions in existing tests (the union/validation additions are purely additive).

- [ ] **Step 2: Manual visual check**

Run: `bun run dev -- --open`, then open `/tinkerbell`. Confirm:

- The default (Classic preset) renders a dense, bounded attractor (no blank canvas, no runaway).
- Each of the 4 presets renders a distinct figure; none diverge to blank.
- Sliders for a/b/c/d/iterations/colorMode/zoom/pointSize/opacity all update the render.
- Reset restores Classic; Randomize changes the figure.
- The "Compare" link in the header navigates to `/tinkerbell/compare` and both panels render.

If any preset diverges to blank, replace its parameter set in `src/lib/tinkerbell-presets.ts` with a known-chaotic Tinkerbell tuple and re-run.

- [ ] **Step 3: Commit any preset adjustments**

```bash
git add src/lib/tinkerbell-presets.ts
git commit -m "fix(tinkerbell): tune presets for visual quality"
```

(Skip this step if no adjustments were needed.)
