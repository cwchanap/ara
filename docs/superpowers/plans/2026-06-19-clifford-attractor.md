# Clifford Attractor Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class **Clifford Attractor** visualization module (`/clifford`) at full parity with the existing Ikeda module — registered through the generic save/share/compare/snapshot stack, with a dense 2D point-cloud renderer that includes a density-accumulation color mode.

**Architecture:** A pure-logic single-orbit math module feeds a Web-Worker-offloaded Canvas+D3 renderer (modeled on `IkedaRenderer`) with two render paths (per-point arcs and a per-pixel density buffer). Registering `clifford` in the shared type/validation/comparison/worker registries makes save, share, compare, and snapshot work automatically. A page and a compare page mirror the Ikeda routes.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript (strict), D3.js, Canvas 2D, Web Workers, Vitest (node + jsdom projects), Testing Library.

## Global Constraints

- Runtime/test commands use **Bun**: `bun run test`, `bun run check`, `bun run lint`.
- Test file naming selects environment: `*.test.ts` → node project (pure logic); `*.svelte.test.ts` → jsdom project (components/DOM).
- All routes use `{base}` from `$app/paths` for links.
- Visual identity: primary neon cyan `#00f3ff`, accent magenta; `Orbitron` headings; UPPERCASE_SNAKE_CASE titles; corner-border/backdrop-blur panels.
- Map type id: **`clifford`**. Display name: **`CLIFFORD_ATTRACTOR`**. Route: **`/clifford`**.
- Homepage card copy (verbatim): title `Clifford Attractor`, description `A generative chaotic attractor formed from sine and cosine iteration`.
- Recurrence (verbatim): `x(n+1) = sin(a·y) + c·cos(a·x)`, `y(n+1) = sin(b·x) + d·cos(b·y)`.
- Defaults: `a=-1.4, b=1.6, c=1.0, d=0.7`, `iterations=120000`, `colorMode='density'`, `zoom=1`, `pointSize=1.5`, `opacity=0.6`. Internal fixed seed `x0=0.1, y0=0.1` (not exposed/persisted).
- `MAX_POINTS = 250000` (defensive cap; equals iterations slider max).
- Commit after every task. The working branch is `jack65786656/hpa-64-add-clifford-attractor-visualization-module` (already created; the design spec is already committed there).
- Pre-commit hooks run prettier/eslint via lint-staged — expect files to be reformatted on commit; that is normal.

---

## File Structure

**New files:**

- `src/lib/clifford.ts` — single-orbit math primitive (own param interface, like `ikeda.ts`).
- `src/lib/clifford.test.ts` — node tests for the math.
- `src/lib/clifford-presets.ts` — preset list + `getPreset`/`detectPresetId` (like `ikeda-presets.ts`).
- `src/lib/clifford-presets.test.ts` — node tests for presets.
- `src/lib/components/visualizations/CliffordRenderer.svelte` — Canvas+D3 renderer (per-point + density paths).
- `src/lib/components/visualizations/CliffordRenderer.svelte.test.ts` — jsdom renderer tests.
- `src/routes/clifford/+page.svelte` — module page.
- `src/routes/clifford/compare/+page.svelte` — compare page.
- `src/routes/clifford-page-interactions.svelte.test.ts` — jsdom page interaction tests.

**Modified files:**

- `src/lib/types.ts` — register `clifford` in the type system.
- `src/lib/types.test.ts` — assert display name + valid-type membership.
- `src/lib/chaos-validation.ts` — `STABLE_RANGES.clifford` + `OPTIONAL_FIELDS.clifford`.
- `src/lib/chaos-validation.test.ts` — validation tests.
- `src/lib/type-guards.ts` — `isCliffordParameters`.
- `src/lib/type-guards.test.ts` — type-guard test.
- `src/lib/comparison-url-state.ts` — `getDefaultParameters` `case 'clifford'`.
- `src/lib/comparison-url-state.test.ts` — default-params + round-trip test.
- `src/lib/workers/types.ts` — `CliffordRequest` / `CliffordResponse` + unions.
- `src/lib/workers/chaosMapsHandler.ts` — `clifford` branch.
- `src/lib/workers/chaosMapsWorker.test.ts` — handler test.
- `src/routes/+page.svelte` — homepage card.
- `src/routes/page.svelte.test.ts` — card count 14→15 + Clifford card test.

---

## Task 1: Clifford math primitive

**Files:**

- Create: `src/lib/clifford.ts`
- Test: `src/lib/clifford.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `export interface CliffordParams { a: number; b: number; c: number; d: number; iterations: number; maxPoints?: number; }`
  - `export function calculateCliffordTuples(params: CliffordParams): [number, number][]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/clifford.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { calculateCliffordTuples } from './clifford';

const CLASSIC = { a: -1.4, b: 1.6, c: 1.0, d: 0.7 };

describe('calculateCliffordTuples', () => {
	test('returns an empty array for non-positive iterations', () => {
		expect(calculateCliffordTuples({ ...CLASSIC, iterations: 0 })).toEqual([]);
		expect(calculateCliffordTuples({ ...CLASSIC, iterations: -5 })).toEqual([]);
	});

	test('is deterministic for identical parameters', () => {
		const a = calculateCliffordTuples({ ...CLASSIC, iterations: 500 });
		const b = calculateCliffordTuples({ ...CLASSIC, iterations: 500 });
		expect(a).toEqual(b);
		expect(a.length).toBe(500);
	});

	test('honors the maxPoints cap', () => {
		const pts = calculateCliffordTuples({ ...CLASSIC, iterations: 1000, maxPoints: 100 });
		expect(pts.length).toBe(100);
	});

	test('returns empty when maxPoints is non-positive', () => {
		expect(calculateCliffordTuples({ ...CLASSIC, iterations: 1000, maxPoints: 0 })).toEqual([]);
	});

	test('every point is finite and within the analytic bounds for several parameter sets', () => {
		const paramSets = [
			CLASSIC,
			{ a: 1.7, b: 1.7, c: 0.6, d: 1.2 },
			{ a: 3, b: 3, c: 3, d: 3 },
			{ a: -3, b: -3, c: -3, d: -3 }
		];
		for (const p of paramSets) {
			const pts = calculateCliffordTuples({ ...p, iterations: 2000 });
			const xBound = 1 + Math.abs(p.c);
			const yBound = 1 + Math.abs(p.d);
			for (const [x, y] of pts) {
				expect(Number.isFinite(x)).toBe(true);
				expect(Number.isFinite(y)).toBe(true);
				expect(Math.abs(x)).toBeLessThanOrEqual(xBound + 1e-9);
				expect(Math.abs(y)).toBeLessThanOrEqual(yBound + 1e-9);
			}
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/clifford.test.ts`
Expected: FAIL — `Failed to resolve import "./clifford"` / `calculateCliffordTuples is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/clifford.ts`:

```ts
/**
 * Clifford Attractor Calculation
 *
 * The Clifford attractor is a 2D iterative map:
 *   xₙ₊₁ = sin(a·yₙ) + c·cos(a·xₙ)
 *   yₙ₊₁ = sin(b·xₙ) + d·cos(b·yₙ)
 *
 * Because sin/cos ∈ [−1, 1], every iterate is bounded
 * (|x| ≤ 1+|c|, |y| ≤ 1+|d|) and can never diverge or become non-finite from
 * finite inputs. The attractor is independent of the initial point, so a fixed
 * internal seed is used and is neither exposed nor persisted.
 */

export interface CliffordParams {
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	/** Optional cap on collected points; stops early once reached. */
	maxPoints?: number;
}

/** Fixed internal seed — the attractor is independent of initial conditions. */
const START_X = 0.1;
const START_Y = 0.1;

/**
 * A single Clifford orbit of `iterations` steps as [x, y] tuples (Canvas/D3
 * friendly). Capped at `maxPoints` when provided. Stops early if a value
 * becomes non-finite (defensive only — the map is analytically bounded).
 */
export function calculateCliffordTuples(params: CliffordParams): [number, number][] {
	const { a, b, c, d, iterations } = params;
	if (iterations <= 0) return [];
	const cap = params.maxPoints ?? Infinity;
	if (cap <= 0) return [];

	const points: [number, number][] = [];
	let x = START_X;
	let y = START_Y;
	for (let i = 0; i < iterations && points.length < cap; i++) {
		const xNew = Math.sin(a * y) + c * Math.cos(a * x);
		const yNew = Math.sin(b * x) + d * Math.cos(b * y);
		if (!Number.isFinite(xNew) || !Number.isFinite(yNew)) break;
		x = xNew;
		y = yNew;
		points.push([x, y]);
	}
	return points;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/lib/clifford.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clifford.ts src/lib/clifford.test.ts
git commit -m "feat: add Clifford attractor math primitive (HPA-64)"
```

---

## Task 2: Register the `clifford` type

**Files:**

- Modify: `src/lib/types.ts`
- Test: `src/lib/types.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `export type CliffordColorMode = 'single' | 'iteration' | 'radius' | 'angle' | 'density'`
  - `export interface CliffordParameters { type: 'clifford'; a: number; b: number; c: number; d: number; iterations: number; colorMode?: CliffordColorMode; zoom?: number; pointSize?: number; opacity?: number; }`
  - `'clifford'` is a member of `ChaosMapType`, `CHAOS_MAP_DISPLAY_NAMES`, `VALID_MAP_TYPES`, the `ChaosMapParameters` union, and the `SavedConfiguration` union.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/types.test.ts` (append inside the existing top-level `describe`, or add a new `describe`):

```ts
import { CHAOS_MAP_DISPLAY_NAMES, VALID_MAP_TYPES } from './types';

describe('clifford registration', () => {
	test('clifford is a valid map type with the correct display name', () => {
		expect(VALID_MAP_TYPES).toContain('clifford');
		expect(CHAOS_MAP_DISPLAY_NAMES.clifford).toBe('CLIFFORD_ATTRACTOR');
	});
});
```

(If `describe`/`test`/`expect` are already imported at the top of the file, do not re-import them.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/types.test.ts`
Expected: FAIL — `VALID_MAP_TYPES` does not contain `'clifford'` / `CHAOS_MAP_DISPLAY_NAMES.clifford` is undefined.

- [ ] **Step 3: Write the implementation**

In `src/lib/types.ts`:

1. Add `| 'clifford'` to the `ChaosMapType` union (place after `'ikeda'`):

```ts
	| 'ikeda'
	| 'clifford'
```

2. Add the color-mode type and parameter interface near the other 2D-map interfaces (e.g. right after the Ikeda block):

```ts
export type CliffordColorMode = 'single' | 'iteration' | 'radius' | 'angle' | 'density';

export interface CliffordParameters {
	type: 'clifford';
	// Required shape + iteration parameters
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	// Optional render state — persisted so save/share/snapshot reproduce exactly.
	colorMode?: CliffordColorMode;
	zoom?: number;
	pointSize?: number;
	opacity?: number;
}
```

3. Add `| CliffordParameters` to the `ChaosMapParameters` union (after `| IkedaParameters`).

4. Add to `CHAOS_MAP_DISPLAY_NAMES` (after the `ikeda` entry):

```ts
	ikeda: 'IKEDA_MAP',
	clifford: 'CLIFFORD_ATTRACTOR',
```

5. Add `'clifford'` to `VALID_MAP_TYPES` (after `'ikeda'`).

6. Add the arm to the `SavedConfiguration` union (after the `ikeda` arm):

```ts
		| {
				mapType: 'clifford';
				parameters: CliffordParameters;
		  }
```

- [ ] **Step 4: Run test + typecheck to verify pass**

Run: `bun run vitest run src/lib/types.test.ts`
Expected: PASS.
Run: `bun run check`
Expected: 0 errors. (Exhaustiveness will now flag `comparison-url-state.ts` — that is fixed in Task 6. If `bun run check` reports the missing `clifford` case there, that is expected at this point; proceed. To keep `check` green per-task, do Tasks 2 and 6 back-to-back, or temporarily run only the focused vitest in Step 4 and defer the full `check` to Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/types.test.ts
git commit -m "feat: register clifford in the chaos map type system (HPA-64)"
```

---

## Task 3: Validation ranges + optional fields

**Files:**

- Modify: `src/lib/chaos-validation.ts`
- Test: `src/lib/chaos-validation.test.ts`

**Interfaces:**

- Consumes: `ChaosMapType` (with `clifford`) from Task 2.
- Produces: `STABLE_RANGES.clifford` (keys `a,b,c,d,iterations`) and `OPTIONAL_FIELDS.clifford` (`colorMode`, `zoom`, `pointSize`, `opacity`) such that `validateParameters('clifford', …)` and `checkParameterStability('clifford', …)` behave like the other maps.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/chaos-validation.test.ts` (a new `describe`; reuse the file's existing imports of `validateParameters` / `checkParameterStability`):

```ts
describe('clifford validation', () => {
	const valid = { type: 'clifford' as const, a: -1.4, b: 1.6, c: 1.0, d: 0.7, iterations: 120000 };

	test('accepts a valid clifford config', () => {
		const result = validateParameters('clifford', valid);
		expect(result.isValid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test('reports missing required parameters', () => {
		const { a: _a, ...missingA } = valid;
		const result = validateParameters('clifford', { ...missingA, type: 'clifford' });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toMatch(/Missing required parameters/);
	});

	test('rejects an invalid colorMode enum value', () => {
		const result = validateParameters('clifford', { ...valid, colorMode: 'rainbow' });
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toMatch(/colorMode/);
	});

	test('accepts a valid colorMode and clamps zoom into range', () => {
		const result = validateParameters('clifford', { ...valid, colorMode: 'density', zoom: 999 });
		expect(result.isValid).toBe(true);
		expect((result.parameters as Record<string, number>).zoom).toBe(5);
	});

	test('warns when a shape parameter is outside the stable range', () => {
		const result = checkParameterStability('clifford', { ...valid, a: 99 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/a \(99\)/);
	});

	test('classic defaults are stable', () => {
		expect(checkParameterStability('clifford', valid).isStable).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/chaos-validation.test.ts`
Expected: FAIL — `Unknown map type: clifford` (no `STABLE_RANGES.clifford`).

- [ ] **Step 3: Write the implementation**

In `src/lib/chaos-validation.ts`:

1. Add to the `STABLE_RANGES` object (after the `ikeda` entry):

```ts
	clifford: {
		a: { min: -3, max: 3 },
		b: { min: -3, max: 3 },
		c: { min: -3, max: 3 },
		d: { min: -3, max: 3 },
		iterations: { min: 1, max: 250000 }
	},
```

2. Add to the `OPTIONAL_FIELDS` object (after the `ikeda` entry):

```ts
	clifford: {
		colorMode: { kind: 'enum', values: ['single', 'iteration', 'radius', 'angle', 'density'] },
		zoom: { kind: 'number', min: 0.5, max: 5 },
		pointSize: { kind: 'number', min: 0.5, max: 6 },
		opacity: { kind: 'number', min: 0, max: 1 }
	},
```

No `checkParameterStability` switch case is needed (the map is analytically bounded; range warnings alone are correct).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/lib/chaos-validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chaos-validation.ts src/lib/chaos-validation.test.ts
git commit -m "feat: add clifford parameter validation ranges (HPA-64)"
```

---

## Task 4: Type guard

**Files:**

- Modify: `src/lib/type-guards.ts`
- Test: `src/lib/type-guards.test.ts`

**Interfaces:**

- Consumes: `CliffordParameters` from Task 2.
- Produces: `export function isCliffordParameters(params): params is CliffordParameters`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/type-guards.test.ts` (a new `describe`; reuse existing imports, adding `isCliffordParameters` to the import from `./type-guards`):

```ts
describe('isCliffordParameters', () => {
	test('returns true for clifford params', () => {
		const p = { type: 'clifford', a: -1.4, b: 1.6, c: 1, d: 0.7, iterations: 1000 } as const;
		expect(isCliffordParameters(p)).toBe(true);
	});

	test('returns false for a different map type', () => {
		const p = { type: 'ikeda', u: 0.9, x0: 0.1, y0: 0, iterations: 800, burnIn: 100 } as const;
		expect(isCliffordParameters(p)).toBe(false);
	});

	test('returns false for null/undefined', () => {
		expect(isCliffordParameters(null)).toBe(false);
		expect(isCliffordParameters(undefined)).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/type-guards.test.ts`
Expected: FAIL — `isCliffordParameters` is not exported.

- [ ] **Step 3: Write the implementation**

In `src/lib/type-guards.ts`:

1. Add `CliffordParameters` to the import list from `$lib/types`.
2. Add (after `isIkedaParameters`):

```ts
/**
 * Type guard for Clifford parameters.
 */
export function isCliffordParameters(
	params: ChaosMapParameters | null | undefined
): params is CliffordParameters {
	return params?.type === 'clifford';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/lib/type-guards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/type-guards.ts src/lib/type-guards.test.ts
git commit -m "feat: add isCliffordParameters type guard (HPA-64)"
```

---

## Task 5: Presets

**Files:**

- Create: `src/lib/clifford-presets.ts`
- Test: `src/lib/clifford-presets.test.ts`

**Interfaces:**

- Consumes: `CliffordColorMode` from Task 2.
- Produces:
  - `export interface CliffordPresetState { a; b; c; d; iterations; colorMode: CliffordColorMode; zoom; pointSize; opacity }` (all numbers except `colorMode`)
  - `export interface CliffordPreset { id: string; label: string; state: CliffordPresetState }`
  - `export const CLIFFORD_PRESETS: CliffordPreset[]`
  - `export const DEFAULT_CLIFFORD_PRESET_ID = 'classic'`
  - `export function getPreset(id: string): CliffordPreset | undefined`
  - `export function detectPresetId(state: CliffordPresetState): string | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/clifford-presets.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
	CLIFFORD_PRESETS,
	DEFAULT_CLIFFORD_PRESET_ID,
	getPreset,
	detectPresetId,
	type CliffordPresetState
} from './clifford-presets';

describe('CLIFFORD_PRESETS', () => {
	test('contains the 5 required presets in order', () => {
		expect(CLIFFORD_PRESETS.map((p) => p.id)).toEqual([
			'classic',
			'wings',
			'web',
			'swirl',
			'ribbons'
		]);
	});

	test('every preset has a label and in-range shape parameters', () => {
		for (const p of CLIFFORD_PRESETS) {
			expect(p.label.length).toBeGreaterThan(0);
			for (const v of [p.state.a, p.state.b, p.state.c, p.state.d]) {
				expect(v).toBeGreaterThanOrEqual(-3);
				expect(v).toBeLessThanOrEqual(3);
			}
		}
	});

	test('default preset id resolves', () => {
		expect(getPreset(DEFAULT_CLIFFORD_PRESET_ID)).toBeDefined();
	});
});

describe('detectPresetId', () => {
	test('round-trips every preset', () => {
		for (const p of CLIFFORD_PRESETS) {
			expect(detectPresetId(p.state)).toBe(p.id);
		}
	});

	test('returns null for a custom state', () => {
		const classic = getPreset('classic')!;
		const edited: CliffordPresetState = { ...classic.state, a: classic.state.a + 0.05 };
		expect(detectPresetId(edited)).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/clifford-presets.test.ts`
Expected: FAIL — cannot resolve `./clifford-presets`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/clifford-presets.ts`:

```ts
import type { CliffordColorMode } from '$lib/types';

/** The full set of user-controllable Clifford state (everything that affects the render). */
export interface CliffordPresetState {
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	colorMode: CliffordColorMode;
	zoom: number;
	pointSize: number;
	opacity: number;
}

export interface CliffordPreset {
	id: string;
	label: string;
	state: CliffordPresetState;
}

export const CLIFFORD_PRESETS: CliffordPreset[] = [
	{
		id: 'classic',
		label: 'Classic',
		state: {
			a: -1.4,
			b: 1.6,
			c: 1.0,
			d: 0.7,
			iterations: 120000,
			colorMode: 'density',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'wings',
		label: 'Wings',
		state: {
			a: 1.7,
			b: 1.7,
			c: 0.6,
			d: 1.2,
			iterations: 120000,
			colorMode: 'iteration',
			zoom: 1,
			pointSize: 1.2,
			opacity: 0.55
		}
	},
	{
		id: 'web',
		label: 'Web',
		state: {
			a: -1.7,
			b: 1.3,
			c: -0.1,
			d: -1.21,
			iterations: 150000,
			colorMode: 'density',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'swirl',
		label: 'Swirl',
		state: {
			a: 1.5,
			b: -1.8,
			c: 1.6,
			d: 0.9,
			iterations: 120000,
			colorMode: 'angle',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'ribbons',
		label: 'Ribbons',
		state: {
			a: -1.8,
			b: -2.0,
			c: -0.5,
			d: -0.9,
			iterations: 120000,
			colorMode: 'radius',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	}
];

/** The preset that defines the default page state. */
export const DEFAULT_CLIFFORD_PRESET_ID = 'classic';

export function getPreset(id: string): CliffordPreset | undefined {
	return CLIFFORD_PRESETS.find((p) => p.id === id);
}

function numbersClose(a: number, b: number): boolean {
	return Math.abs(a - b) < 1e-9;
}

/**
 * Return the id of the preset whose state matches `state` exactly, or null
 * (meaning the user is in a "Custom" state).
 */
export function detectPresetId(state: CliffordPresetState): string | null {
	for (const preset of CLIFFORD_PRESETS) {
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

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/lib/clifford-presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clifford-presets.ts src/lib/clifford-presets.test.ts
git commit -m "feat: add clifford presets (HPA-64)"
```

---

## Task 6: Comparison default parameters

**Files:**

- Modify: `src/lib/comparison-url-state.ts`
- Test: `src/lib/comparison-url-state.test.ts`

**Interfaces:**

- Consumes: `getPreset` + `DEFAULT_CLIFFORD_PRESET_ID` from Task 5; `CliffordParameters` from Task 2.
- Produces: `getDefaultParameters('clifford')` returns the classic preset as `CliffordParameters`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/comparison-url-state.test.ts` (new `describe`; reuse existing imports of `getDefaultParameters` / `encodeComparisonState` / `decodeComparisonState`):

```ts
describe('clifford comparison defaults', () => {
	test('getDefaultParameters returns the classic clifford preset', () => {
		const params = getDefaultParameters('clifford');
		expect(params.type).toBe('clifford');
		expect(params).toMatchObject({ a: -1.4, b: 1.6, c: 1.0, d: 0.7 });
	});

	test('round-trips a clifford comparison state through the URL', () => {
		const left = getDefaultParameters('clifford');
		const right = { ...getDefaultParameters('clifford'), a: 1.5 } as typeof left;
		const encoded = encodeComparisonState({ compare: true, left, right });
		const url = new URL(`http://localhost/clifford/compare?${encoded.toString()}`);
		const decoded = decodeComparisonState(url, 'clifford');
		expect(decoded?.left).toMatchObject({ type: 'clifford', a: -1.4 });
		expect(decoded?.right).toMatchObject({ type: 'clifford', a: 1.5 });
		expect(decoded?.corrected).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/comparison-url-state.test.ts`
Expected: FAIL — `getDefaultParameters` has no `clifford` case (returns `undefined`).

- [ ] **Step 3: Write the implementation**

In `src/lib/comparison-url-state.ts`:

1. Extend the existing preset import. The file already imports `getPreset` (ikeda) and `getPreset as getDoublePendulumPreset`. Add a third aliased import:

```ts
import { getPreset as getCliffordPreset, DEFAULT_CLIFFORD_PRESET_ID } from './clifford-presets';
```

2. Add the case to `getDefaultParameters` (after the `ikeda` case):

```ts
		case 'clifford': {
			const preset = getCliffordPreset(DEFAULT_CLIFFORD_PRESET_ID);
			if (!preset)
				throw new Error(`Missing default Clifford preset: ${DEFAULT_CLIFFORD_PRESET_ID}`);
			return { type: 'clifford', ...preset.state };
		}
```

- [ ] **Step 4: Run test + typecheck to verify pass**

Run: `bun run vitest run src/lib/comparison-url-state.test.ts`
Expected: PASS.
Run: `bun run check`
Expected: 0 errors (the `getDefaultParameters` switch is now exhaustive).

- [ ] **Step 5: Commit**

```bash
git add src/lib/comparison-url-state.ts src/lib/comparison-url-state.test.ts
git commit -m "feat: add clifford comparison default parameters (HPA-64)"
```

---

## Task 7: Web worker support

**Files:**

- Modify: `src/lib/workers/types.ts`
- Modify: `src/lib/workers/chaosMapsHandler.ts`
- Test: `src/lib/workers/chaosMapsWorker.test.ts`

**Interfaces:**

- Consumes: `calculateCliffordTuples` from Task 1.
- Produces:
  - `CliffordRequest` (`{ type: 'clifford'; id: number; a; b; c; d; iterations; maxPoints: number }`) added to `ChaosMapsWorkerRequest`.
  - `CliffordResponse` (`{ type: 'cliffordResult'; id: number; points: [number, number][] }`) added to `ChaosMapsWorkerResponse`.
  - `handleWorkerMessage` returns a `cliffordResult` for a `clifford` request.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/workers/chaosMapsWorker.test.ts` (new `describe`; reuse existing import of `handleWorkerMessage`):

```ts
describe('handleWorkerMessage — clifford', () => {
	test('returns a cliffordResult capped at maxPoints', () => {
		const res = handleWorkerMessage({
			type: 'clifford',
			id: 7,
			a: -1.4,
			b: 1.6,
			c: 1.0,
			d: 0.7,
			iterations: 1000,
			maxPoints: 50
		});
		expect(res.type).toBe('cliffordResult');
		expect(res.id).toBe(7);
		if (res.type === 'cliffordResult') {
			expect(res.points.length).toBe(50);
			expect(res.points[0].length).toBe(2);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/workers/chaosMapsWorker.test.ts`
Expected: FAIL — `clifford` request falls through to the `error` branch (`res.type` is `'error'`), or TS rejects the unknown request shape.

- [ ] **Step 3: Write the implementation**

In `src/lib/workers/types.ts`:

1. Add the request interface (after `IkedaRequest`):

```ts
export interface CliffordRequest {
	type: 'clifford';
	id: number;
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	maxPoints: number;
}
```

2. Add `CliffordRequest` to the `ChaosMapsWorkerRequest` union.

3. Add the response interface (after `IkedaResponse`):

```ts
export interface CliffordResponse {
	type: 'cliffordResult';
	id: number;
	points: [number, number][];
}
```

4. Add `CliffordResponse` to the `ChaosMapsWorkerResponse` union.

In `src/lib/workers/chaosMapsHandler.ts`:

1. Add the import (next to the existing `calculateIkedaMultiSeed` import):

```ts
import { calculateCliffordTuples } from '../clifford';
```

2. Add the branch inside `handleWorkerMessage` (before the final `else` error branch):

```ts
	} else if (data.type === 'clifford') {
		const points = calculateCliffordTuples({
			a: data.a,
			b: data.b,
			c: data.c,
			d: data.d,
			iterations: data.iterations,
			maxPoints: data.maxPoints
		});
		return { type: 'cliffordResult', id: data.id, points };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/lib/workers/chaosMapsWorker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workers/types.ts src/lib/workers/chaosMapsHandler.ts src/lib/workers/chaosMapsWorker.test.ts
git commit -m "feat: add clifford web worker compute support (HPA-64)"
```

---

## Task 8: Renderer component

**Files:**

- Create: `src/lib/components/visualizations/CliffordRenderer.svelte`
- Test: `src/lib/components/visualizations/CliffordRenderer.svelte.test.ts`

**Interfaces:**

- Consumes: `calculateCliffordTuples` (Task 1), `CliffordColorMode` (Task 2), `ChaosMapsWorkerResponse` (Task 7).
- Produces: a Svelte component with `$bindable` props `a, b, c, d, iterations, colorMode, zoom, pointSize, opacity, height, containerElement`. Renders an `<svg>` (axes) + `<canvas>` into a container div. Two render paths keyed on `colorMode` (`density` uses an accumulation buffer + `putImageData`; others draw per-point arcs).

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/visualizations/CliffordRenderer.svelte.test.ts`:

```ts
import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import CliffordRenderer from './CliffordRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;
	const ctx = {
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		fillStyle: '' as string,
		globalAlpha: 1,
		createImageData: (w: number, h: number) => ({
			data: new Uint8ClampedArray(w * h * 4),
			width: w,
			height: h
		}),
		putImageData: vi.fn()
	};
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () => ctx
	});
});

afterAll(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: originalGetContext
	});
});

// Worker is unavailable in jsdom, so the component uses the main-thread fallback.
vi.mock('$lib/clifford', () => ({
	calculateCliffordTuples: vi.fn(() => [
		[0, 0],
		[0.5, -0.2],
		[1, 0.5]
	])
}));

const baseProps = {
	a: -1.4,
	b: 1.6,
	c: 1.0,
	d: 0.7,
	iterations: 1000,
	zoom: 1,
	pointSize: 1.5,
	opacity: 0.6,
	height: 200
};

describe('CliffordRenderer', () => {
	afterEach(() => cleanup());

	it('renders an svg (axes) and a canvas in density mode', async () => {
		const { container } = render(CliffordRenderer, {
			props: { ...baseProps, colorMode: 'density' as const }
		});
		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('renders per-point color modes without throwing', async () => {
		for (const colorMode of ['single', 'iteration', 'radius', 'angle'] as const) {
			const { container, unmount } = render(CliffordRenderer, {
				props: { ...baseProps, colorMode }
			});
			await waitFor(() => {
				expect(container.querySelector('canvas')).not.toBeNull();
			});
			unmount();
		}
	});

	it('does not throw on non-finite parameters (renders blank)', async () => {
		const { container } = render(CliffordRenderer, {
			props: { ...baseProps, a: Number.NaN, colorMode: 'iteration' as const }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/components/visualizations/CliffordRenderer.svelte.test.ts`
Expected: FAIL — cannot resolve `./CliffordRenderer.svelte`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/components/visualizations/CliffordRenderer.svelte`:

```svelte
<!--
  CliffordRenderer Component — Canvas point cloud for the Clifford attractor.
  Single-orbit compute offloads to chaosMapsWorker with a main-thread fallback.
  Two render paths: per-point arcs (single/iteration/radius/angle) and a
  per-pixel density-accumulation buffer (density).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { calculateCliffordTuples } from '$lib/clifford';
	import type { CliffordColorMode } from '$lib/types';
	import type { ChaosMapsWorkerResponse } from '$lib/workers/types';

	interface Props {
		a?: number;
		b?: number;
		c?: number;
		d?: number;
		iterations?: number;
		colorMode?: CliffordColorMode;
		zoom?: number;
		pointSize?: number;
		opacity?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}

	let {
		a = $bindable(-1.4),
		b = $bindable(1.6),
		c = $bindable(1.0),
		d = $bindable(0.7),
		iterations = $bindable(120000),
		colorMode = $bindable<CliffordColorMode>('density'),
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

	const interpCyanMagenta = d3.interpolate('#00f3ff', '#ff00ff');
	const interpMagentaViolet = d3.interpolate('#ff00ff', '#8a2be2');
	const densityRamp = d3.interpolateRgbBasis([
		'#000814',
		'#003a4d',
		'#00f3ff',
		'#ff00ff',
		'#ffffff'
	]);

	function colorFor(i: number, point: [number, number], total: number, maxRadius: number): string {
		switch (colorMode) {
			case 'single':
				return '#00f3ff';
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
		if (points.length === 0 || width <= 0 || chartHeight <= 0) return;

		const xExtentRaw = d3.extent(points, (p) => p[0]);
		const yExtentRaw = d3.extent(points, (p) => p[1]);
		const xExtent: [number, number] = [xExtentRaw[0] ?? -1, xExtentRaw[1] ?? 1];
		const yExtent: [number, number] = [yExtentRaw[0] ?? -1, yExtentRaw[1] ?? 1];

		const xDomain = zoomedDomain(xExtent[0] - 0.5, xExtent[1] + 0.5);
		const yDomain = zoomedDomain(yExtent[0] - 0.5, yExtent[1] + 0.5);
		const xScale = d3.scaleLinear().domain(xDomain).range([0, width]);
		const yScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]);

		const xAxis = d3.axisBottom(xScale).tickSize(-chartHeight).tickPadding(10);
		const yAxis = d3.axisLeft(yScale).tickSize(-width).tickPadding(10);

		svg
			.append('g')
			.attr('transform', `translate(0,${chartHeight})`)
			.call(xAxis)
			.call((g) => {
				g.select('.domain').remove();
				g.selectAll('line').attr('stroke', '#00f3ff').attr('stroke-opacity', 0.1);
				g.selectAll('text').attr('fill', '#00f3ff').attr('font-family', 'Rajdhani');
			});

		svg
			.append('g')
			.call(yAxis)
			.call((g) => {
				g.select('.domain').remove();
				g.selectAll('line').attr('stroke', '#00f3ff').attr('stroke-opacity', 0.1);
				g.selectAll('text').attr('fill', '#00f3ff').attr('font-family', 'Rajdhani');
			});

		const canvas = canvasSelection.node() as HTMLCanvasElement | null;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) {
			console.warn('CliffordRenderer: canvas or 2D context unavailable');
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
		const points = calculateCliffordTuples({ a, b, c, d, iterations, maxPoints: MAX_POINTS });
		return buildComputed(points);
	}

	function requestPoints() {
		if (!paramsValid()) {
			console.warn('CliffordRenderer: invalid parameters, skipping render');
			latest = buildComputed([]);
			isComputing = false;
			render(latest);
			return;
		}

		if (worker && workerAvailable) {
			const id = ++workerRequestId;
			latestWorkerRequestId = id;
			isComputing = true;
			worker.postMessage({ type: 'clifford', id, a, b, c, d, iterations, maxPoints: MAX_POINTS });
			return;
		}

		isComputing = true;
		latest = computeMainThread();
		render(latest);
		isComputing = false;
		if (hasPendingRender) {
			hasPendingRender = false;
			scheduleRender();
		}
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
						console.error('Clifford worker error response:', data.message);
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

					if (data.type !== 'cliffordResult') return;
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
					console.error('Clifford worker error:', event.message);
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
				console.error('Failed to initialize clifford web worker:', error);
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

> Note on jsdom: `container.clientWidth` is `0` in jsdom, so the early `width <= 0` return means the per-point/density loops are not exercised in the unit test — the test asserts the component mounts and creates `<svg>`/`<canvas>` without throwing across all color modes. The compute path is covered by `clifford.test.ts` and the worker test.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/lib/components/visualizations/CliffordRenderer.svelte.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/visualizations/CliffordRenderer.svelte src/lib/components/visualizations/CliffordRenderer.svelte.test.ts
git commit -m "feat: add CliffordRenderer with density and per-point color modes (HPA-64)"
```

---

## Task 9: Module page

**Files:**

- Create: `src/routes/clifford/+page.svelte`
- Test: `src/routes/clifford-page-interactions.svelte.test.ts`

**Interfaces:**

- Consumes: `CLIFFORD_PRESETS` / `getPreset` / `detectPresetId` / `DEFAULT_CLIFFORD_PRESET_ID` (Task 5); `CliffordRenderer` (Task 8); `CliffordParameters` / `CliffordColorMode` (Task 2); the existing generic save/share/snapshot/alerts/config-loader modules; `checkParameterStability`; `buildComparisonUrl` / `createComparisonStateFromCurrent`.
- Produces: the `/clifford` page with testids `slider-a/b/c/d`, `value-a/b/c/d`, `value-iterations`, `select-color-mode`, `active-preset`, `btn-reset`, `btn-randomize`, and preset buttons labeled Classic/Wings/Web/Swirl/Ribbons.

- [ ] **Step 1: Write the failing test**

Create `src/routes/clifford-page-interactions.svelte.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	createUnauthedPageData,
	resetMockPageStore,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import CliffordPage from './clifford/+page.svelte';

vi.mock('$app/stores', async () => {
	const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
	return { page: mockPageStore };
});

vi.mock('$app/paths', async () => {
	const { BASE_PATH } = await import('$lib/components/testing/page-test-helpers');
	return { base: BASE_PATH };
});

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

vi.mock('$lib/components/ui/SaveConfigDialog.svelte', async () => {
	const m = await import('$lib/components/testing/DialogStub.svelte');
	return { default: m.default };
});

vi.mock('$lib/components/ui/ShareDialog.svelte', async () => {
	const m = await import('$lib/components/testing/DialogStub.svelte');
	return { default: m.default };
});

vi.mock('$lib/components/ui/SnapshotButton.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});

vi.mock('$lib/components/ui/VisualizationAlerts.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});

vi.mock('$lib/components/visualizations/CliffordRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});

describe('Clifford page interactions', () => {
	beforeEach(() => {
		resetMockPageStore('http://localhost/clifford', createUnauthedPageData());
	});

	afterEach(() => cleanup());

	it('renders the CLIFFORD_ATTRACTOR header and shape controls', () => {
		render(CliffordPage, { props: unauthedPageProps });
		expect(screen.getByRole('heading', { level: 1, name: /CLIFFORD_ATTRACTOR/i })).toBeTruthy();
		expect(screen.getByTestId('slider-a')).toBeTruthy();
		expect(screen.getByTestId('slider-d')).toBeTruthy();
	});

	it('shows the default active preset as Classic', () => {
		render(CliffordPage, { props: unauthedPageProps });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/classic/i);
	});

	it('displays the default a value', () => {
		render(CliffordPage, { props: unauthedPageProps });
		expect(screen.getByTestId('value-a').textContent).toBe('-1.40');
	});

	it('applies the Wings preset when clicked', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByRole('button', { name: /Wings/i }));
		expect(screen.getByTestId('active-preset').textContent).toMatch(/wings/i);
		expect((screen.getByTestId('slider-a') as HTMLInputElement).value).toBe('1.7');
	});

	it('switches to CUSTOM when a shape slider changes', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		await fireEvent.input(screen.getByTestId('slider-a'), { target: { value: '0.5' } });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/custom/i);
	});

	it('resets to the Classic default', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		await fireEvent.input(screen.getByTestId('slider-a'), { target: { value: '0.5' } });
		await fireEvent.click(screen.getByTestId('btn-reset'));
		expect((screen.getByTestId('slider-a') as HTMLInputElement).value).toBe('-1.4');
		expect(screen.getByTestId('active-preset').textContent).toMatch(/classic/i);
	});

	it('randomizes shape parameters into [-2, 2] and becomes CUSTOM', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByTestId('btn-randomize'));
		for (const id of ['slider-a', 'slider-b', 'slider-c', 'slider-d']) {
			const v = Number((screen.getByTestId(id) as HTMLInputElement).value);
			expect(v).toBeGreaterThanOrEqual(-2);
			expect(v).toBeLessThanOrEqual(2);
		}
		expect(screen.getByTestId('active-preset').textContent).toMatch(/custom/i);
	});

	it('changes color mode via select', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		const select = screen.getByTestId('select-color-mode') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'iteration' } });
		expect(select.value).toBe('iteration');
	});

	it('renders all five preset buttons', () => {
		render(CliffordPage, { props: unauthedPageProps });
		for (const name of [/Classic/i, /Wings/i, /Web/i, /Swirl/i, /Ribbons/i]) {
			expect(screen.getByRole('button', { name })).toBeTruthy();
		}
	});

	it('displays the recurrence equations and the data log', () => {
		render(CliffordPage, { props: unauthedPageProps });
		expect(screen.getByText(/sin\(a/i)).toBeTruthy();
		expect(screen.getByText(/DATA_LOG: CLIFFORD_ATTRACTOR/i)).toBeTruthy();
	});

	it('renders Compare / Return links and Share / Save buttons', () => {
		render(CliffordPage, { props: unauthedPageProps });
		expect(screen.getByRole('link', { name: /Compare/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /Return/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Share/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Save/i })).toBeTruthy();
	});

	it('opens and closes the save dialog', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
		expect(screen.getByTestId('dialog-stub-clifford')).toBeTruthy();
		await fireEvent.click(screen.getByTestId('dialog-close-clifford'));
		expect(screen.queryByTestId('dialog-stub-clifford')).toBeNull();
	});

	it('cleans up on unmount without throwing', () => {
		const { unmount } = render(CliffordPage, { props: unauthedPageProps });
		expect(() => unmount()).not.toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/routes/clifford-page-interactions.svelte.test.ts`
Expected: FAIL — cannot resolve `./clifford/+page.svelte`.

- [ ] **Step 3: Write the implementation**

Create `src/routes/clifford/+page.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import CliffordRenderer from '$lib/components/visualizations/CliffordRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { CliffordParameters, CliffordColorMode } from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';
	import {
		CLIFFORD_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_CLIFFORD_PRESET_ID,
		type CliffordPresetState
	} from '$lib/clifford-presets';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();

	const defaultPreset = getPreset(DEFAULT_CLIFFORD_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default Clifford preset: ${DEFAULT_CLIFFORD_PRESET_ID}`);
	const defaultState = defaultPreset.state;
	let a = $state(defaultState.a);
	let b = $state(defaultState.b);
	let c = $state(defaultState.c);
	let d = $state(defaultState.d);
	let iterations = $state(defaultState.iterations);
	let colorMode = $state<CliffordColorMode>(defaultState.colorMode);
	let zoom = $state(defaultState.zoom);
	let pointSize = $state(defaultState.pointSize);
	let opacity = $state(defaultState.opacity);

	let lastAppliedConfigKey: string | null = null;
	let configLoadAbortController: AbortController | null = null;
	let isUnmounted = false;

	const saveState = $state(createInitialSaveState());
	const shareState = $state(createInitialShareState());

	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	function currentPresetState(): CliffordPresetState {
		return { a, b, c, d, iterations, colorMode, zoom, pointSize, opacity };
	}

	const activePresetId = $derived(detectPresetId(currentPresetState()));
	const activePresetLabel = $derived(
		activePresetId ? (getPreset(activePresetId)?.label ?? 'CUSTOM') : 'CUSTOM'
	);

	function checkStability() {
		const stability = checkParameterStability('clifford', {
			type: 'clifford',
			a,
			b,
			c,
			d,
			iterations
		});
		if (!stability.isStable) {
			stabilityWarnings = stability.warnings;
			showStabilityWarning = true;
		} else {
			stabilityWarnings = [];
			showStabilityWarning = false;
		}
	}

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
		checkStability();
	}

	function resetToDefault() {
		applyPreset(DEFAULT_CLIFFORD_PRESET_ID);
	}

	function randomizeParameters() {
		const rand = () => Math.round((Math.random() * 4 - 2) * 100) / 100; // [-2, 2], 2dp
		a = rand();
		b = rand();
		c = rand();
		d = rand();
		checkStability();
	}

	// Load config from URL reactively (mirrors the Ikeda page).
	$effect(() => {
		const configId = $page.url.searchParams.get('configId');
		const shareCode = $page.url.searchParams.get('share');
		const configParam = $page.url.searchParams.get('config');
		const configKey = shareCode
			? `share:${shareCode}`
			: configId
				? `id:${configId}`
				: configParam
					? `param:${configParam}`
					: null;
		if (configKey === lastAppliedConfigKey) return;
		lastAppliedConfigKey = configKey;

		configLoadAbortController?.abort();
		configLoadAbortController = null;

		if (shareCode || configId) {
			configErrors = [];
			showConfigError = false;
			stabilityWarnings = [];
			showStabilityWarning = false;
			const controller = new AbortController();
			configLoadAbortController = controller;
			const { signal } = controller;
			const currentConfigKey = configKey;

			void (async () => {
				const _fetch = fetch as typeof fetch & { preconnect?: typeof fetch };
				const fetchWithSignal: typeof fetch = Object.assign(
					(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
						fetch(input, { ...init, signal }),
					{ preconnect: _fetch.preconnect }
				);

				try {
					let result: ReturnType<typeof loadSavedConfigParameters<'clifford'>> extends Promise<
						infer T
					>
						? T
						: never | undefined;

					if (shareCode) {
						result = await loadSharedConfigParameters({
							shareCode,
							mapType: 'clifford',
							base,
							fetchFn: fetchWithSignal
						});
					} else {
						result = await loadSavedConfigParameters({
							configId: configId!,
							mapType: 'clifford',
							base,
							fetchFn: fetchWithSignal
						});
					}

					if (isUnmounted || signal.aborted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;
					if (!result) {
						lastAppliedConfigKey = null;
						configErrors = ['Failed to load configuration'];
						showConfigError = true;
						return;
					}
					if (!result.ok) {
						lastAppliedConfigKey = null;
						configErrors = result.errors;
						showConfigError = true;
						return;
					}

					applyParameters(result.parameters);
				} catch (e) {
					if (e instanceof Error && e.name === 'AbortError') return;
					console.error('Failed to load configuration:', e);
					if (isUnmounted || signal.aborted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;
					lastAppliedConfigKey = null;
					configErrors = [
						'Failed to load configuration: ' + (e instanceof Error ? e.message : 'Unknown error')
					];
					showConfigError = true;
				}
			})();
		} else if (configParam) {
			try {
				configErrors = [];
				showConfigError = false;
				stabilityWarnings = [];
				showStabilityWarning = false;

				const parsed = parseConfigParam({ mapType: 'clifford', configParam });
				if (!parsed.ok) {
					console.error(parsed.logMessage, parsed.logDetails);
					configErrors = parsed.errors;
					showConfigError = true;
					return;
				}
				applyParameters(parsed.parameters);
			} catch (e) {
				console.error('Invalid config parameter:', e);
				configErrors = ['Failed to parse configuration parameters'];
				showConfigError = true;
			}
		}
	});

	function applyParameters(p: CliffordParameters) {
		a = p.a;
		b = p.b;
		c = p.c;
		d = p.d;
		iterations = p.iterations;
		colorMode = p.colorMode ?? colorMode;
		zoom = p.zoom ?? zoom;
		pointSize = p.pointSize ?? pointSize;
		opacity = p.opacity ?? opacity;
		checkStability();
	}

	function getParameters(): CliffordParameters {
		return { type: 'clifford', a, b, c, d, iterations, colorMode, zoom, pointSize, opacity };
	}

	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'clifford',
		saveState,
		getParameters
	);
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'clifford',
		shareState,
		getParameters
	);

	onMount(() => {
		return () => {
			cleanupSaveHandler();
			cleanupShareHandler();
			configLoadAbortController?.abort();
			configLoadAbortController = null;
			isUnmounted = true;
		};
	});

	const shapeControls = [
		{ key: 'a', label: 'a' },
		{ key: 'b', label: 'b' },
		{ key: 'c', label: 'c' },
		{ key: 'd', label: 'd' }
	] as const;
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				CLIFFORD_ATTRACTOR
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				SINE-COSINE_RECURRENCE // GENERATIVE_CHAOTIC_ATTRACTOR
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={rendererContainer} targetType="container" mapType="clifford" />
			<a
				href={buildComparisonUrl(
					base,
					'clifford',
					createComparisonStateFromCurrent('clifford', getParameters())
				)}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				⊞ Compare
			</a>
			<button
				onclick={() => (shareState.showShareDialog = true)}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				🔗 Share
			</button>
			<button
				onclick={() => (saveState.showSaveDialog = true)}
				class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				💾 Save
			</button>
			<a
				href={base + '/'}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				← Return
			</a>
		</div>
	</div>

	<VisualizationAlerts
		saveSuccess={saveState.saveSuccess}
		saveError={saveState.saveError}
		{configErrors}
		{showConfigError}
		onDismissConfigError={() => (showConfigError = false)}
		{stabilityWarnings}
		{showStabilityWarning}
		onDismissStabilityWarning={() => (showStabilityWarning = false)}
		onDismissSaveError={() => (saveState.saveError = null)}
		onDismissSaveSuccess={() => (saveState.saveSuccess = false)}
	/>

	<!-- Presets -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-4 relative"
	>
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
				<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
				PRESETS
			</h2>
			<span
				class="text-xs uppercase tracking-widest text-accent font-mono"
				data-testid="active-preset"
			>
				{activePresetLabel}
			</span>
		</div>
		<div class="flex flex-wrap gap-3">
			{#each CLIFFORD_PRESETS as preset (preset.id)}
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

	<!-- System parameters -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative overflow-hidden group"
	>
		<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
		<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
		<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

		<div class="flex items-center justify-between">
			<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
				<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
				SYSTEM_PARAMETERS
			</h2>
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
			{#each shapeControls as ctrl (ctrl.key)}
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label
							for={ctrl.key}
							class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>{ctrl.label}</label
						>
						<span data-testid="value-{ctrl.key}" class="font-mono text-accent">
							{#if ctrl.key === 'a'}{a.toFixed(2)}{:else if ctrl.key === 'b'}{b.toFixed(
									2
								)}{:else if ctrl.key === 'c'}{c.toFixed(2)}{:else}{d.toFixed(2)}{/if}
						</span>
					</div>
					{#if ctrl.key === 'a'}
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
					{:else if ctrl.key === 'b'}
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
					{:else if ctrl.key === 'c'}
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
					{:else}
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
					{/if}
				</div>
			{/each}
		</div>

		<div class="space-y-2">
			<div class="flex justify-between items-end">
				<label for="iterations" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>Iterations</label
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

		<div
			class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>x(n+1) = sin(a·y) + c·cos(a·x)</p>
			<p>y(n+1) = sin(b·x) + d·cos(b·y)</p>
		</div>
	</div>

	<!-- Render controls -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative"
	>
		<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
			<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
			RENDER_CONTROLS
		</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
			<div class="space-y-2">
				<label for="colorMode" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>Color Mode</label
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
					<label for="pointSize" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Point Size</label
					>
					<span class="font-mono text-accent">{pointSize.toFixed(1)}</span>
				</div>
				<input
					id="pointSize"
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
					<label for="opacity" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Opacity</label
					>
					<span class="font-mono text-accent">{opacity.toFixed(2)}</span>
				</div>
				<input
					id="opacity"
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

	<CliffordRenderer
		bind:containerElement={rendererContainer}
		bind:a
		bind:b
		bind:c
		bind:d
		bind:iterations
		bind:colorMode
		bind:zoom
		bind:pointSize
		bind:opacity
		height={VIZ_CONTAINER_HEIGHT}
	/>

	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: CLIFFORD_ATTRACTOR
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Clifford Attractor is a two-dimensional iterative map built from sine and cosine
			functions. Starting from a single point, each step folds the trajectory back on itself, and
			over hundreds of thousands of iterations the orbit traces out a dense, intricate strange
			attractor. Because sine and cosine are bounded, the system can never fly off to infinity —
			instead it settles into a generative structure whose shape is governed entirely by the four
			parameters a, b, c, and d. Small parameter changes can transform the figure completely, making
			it a favourite source of algorithmic art. Unlike continuous flows such as the Lorenz or
			Rössler attractors, the Clifford map advances in discrete steps, like the Hénon, Lozi, and
			Ikeda maps.
		</p>
	</div>
</div>

<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="clifford"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="clifford"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/routes/clifford-page-interactions.svelte.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/clifford/+page.svelte src/routes/clifford-page-interactions.svelte.test.ts
git commit -m "feat: add Clifford module page with controls, reset and randomize (HPA-64)"
```

---

## Task 10: Compare page

**Files:**

- Create: `src/routes/clifford/compare/+page.svelte`

**Interfaces:**

- Consumes: `decodeComparisonState` / `getDefaultParameters` / `encodeComparisonState` (Task 6), `getStableRanges` (Task 3), `CliffordRenderer` (Task 8), `CliffordParameters` / `CliffordColorMode` (Task 2), the existing `ComparisonLayout` / `ComparisonParameterPanel` components.
- Produces: the `/clifford/compare` route. (Covered by `bun run check` + the renderer/page tests; no dedicated new test file — matches how some existing compare routes rely on the shared compare-page tests and typechecking.)

- [ ] **Step 1: Write the implementation**

Create `src/routes/clifford/compare/+page.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import CliffordRenderer from '$lib/components/visualizations/CliffordRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges } from '$lib/chaos-validation';
	import type { CliffordParameters, CliffordColorMode } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'clifford');
	const defaultParams = getDefaultParameters('clifford') as CliffordParameters;
	const ranges = getStableRanges('clifford');

	const clampValue = (value: number, min: number, max: number, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	const clampParams = (params?: CliffordParameters | null): CliffordParameters => {
		const source = params ?? defaultParams;
		if (!ranges) return source;
		return {
			type: 'clifford',
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

	const leftInitial = clampParams(initialState?.left as CliffordParameters | null);
	const rightInitial = clampParams(initialState?.right as CliffordParameters | null);

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
	const colorMode: CliffordColorMode =
		leftInitial.colorMode ?? defaultParams.colorMode ?? 'density';
	const zoom = leftInitial.zoom ?? defaultParams.zoom ?? 1;
	const pointSize = leftInitial.pointSize ?? defaultParams.pointSize ?? 1.5;
	const opacity = leftInitial.opacity ?? defaultParams.opacity ?? 0.6;

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
			goto(`${base}/clifford/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): CliffordParameters {
		return {
			type: 'clifford',
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
	function getRightParams(): CliffordParameters {
		return {
			type: 'clifford',
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

	function handleLeftParamsChange(p: CliffordParameters) {
		leftA = p.a;
		leftB = p.b;
		leftC = p.c;
		leftD = p.d;
		leftIterations = p.iterations;
	}
	function handleRightParamsChange(p: CliffordParameters) {
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
	mapType="clifford"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as CliffordParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as CliffordParameters)}
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
				{#snippet equations()}<p>x(n+1) = sin(a·y) + c·cos(a·x)</p>
					<p>y(n+1) = sin(b·x) + d·cos(b·y)</p>{/snippet}
			</ComparisonParameterPanel>
			<CliffordRenderer
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
				{#snippet equations()}<p>x(n+1) = sin(a·y) + c·cos(a·x)</p>
					<p>y(n+1) = sin(b·x) + d·cos(b·y)</p>{/snippet}
			</ComparisonParameterPanel>
			<CliffordRenderer
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

- [ ] **Step 2: Typecheck the new route**

Run: `bun run check`
Expected: 0 errors.

> If `bun run check` reports that `ComparisonLayout`/`ComparisonParameterPanel` expect a prop shape this file does not provide, open `src/routes/ikeda/compare/+page.svelte` and match its exact prop usage (the components are generic over `mapType` and accept `leftParams`/`rightParams` as `ChaosMapParameters`). Do not change the shared components.

- [ ] **Step 3: Run the existing compare test suite to confirm no regressions**

Run: `bun run vitest run src/routes/compare-pages.svelte.test.ts src/routes/compare-pages-interaction.svelte.test.ts`
Expected: PASS (these iterate the registered map types; `clifford` is now decodable via Task 6).

- [ ] **Step 4: Commit**

```bash
git add src/routes/clifford/compare/+page.svelte
git commit -m "feat: add Clifford compare page (HPA-64)"
```

---

## Task 11: Homepage card

**Files:**

- Modify: `src/routes/+page.svelte`
- Test: `src/routes/page.svelte.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: a Clifford card in the homepage `visualizations` array linking to `/clifford`.

- [ ] **Step 1: Write the failing test**

In `src/routes/page.svelte.test.ts`:

1. Change both `toHaveLength(14)` assertions to `toHaveLength(15)` (the "renders all 14 visualization cards" test and the "Initialize Module ... toHaveLength(14)" test). Update the first test's title to `renders all 15 visualization cards`.
2. Add `{ name: 'Clifford Attractor', url: '/clifford' }` to the `visualizations` array in the test (after the Ikeda entry).
3. Add a focused test after the Ikeda card test:

```ts
it('shows the Clifford Attractor card linking to /clifford', () => {
	render(Page);
	const link = screen.getByRole('link', { name: /Clifford Attractor/i });
	expect(link.getAttribute('href')).toContain('/clifford');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/routes/page.svelte.test.ts`
Expected: FAIL — only 14 links found; no Clifford card.

- [ ] **Step 3: Write the implementation**

In `src/routes/+page.svelte`, add to the `visualizations` array immediately after the `Ikeda Map` entry:

```ts
		{
			name: 'Clifford Attractor',
			description: 'A generative chaotic attractor formed from sine and cosine iteration',
			url: '/clifford',
			color: 'from-purple-500 to-fuchsia-600'
		},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/routes/page.svelte.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte src/routes/page.svelte.test.ts
git commit -m "feat: add Clifford Attractor homepage card (HPA-64)"
```

---

## Task 12: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full type check**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Run lint**

Run: `bun run lint`
Expected: passes (Prettier + ESLint clean).

- [ ] **Step 3: Run the entire test suite**

Run: `bun run test`
Expected: all node + jsdom tests pass, including the new `clifford*` files and the updated homepage/worker/validation/type-guard/comparison tests.

- [ ] **Step 4: Manual visual smoke check**

Run: `bun run dev`
Then in a browser:

1. Confirm the homepage shows a **Clifford Attractor** card; click it.
2. `/clifford` renders a dense attractor by default (Classic preset, density mode).
3. Drag `a`/`b`/`c`/`d` and Iterations — the visualization updates and the active preset switches to CUSTOM.
4. Switch Color Mode through density / iteration / radius / angle / single — each renders.
5. Adjust Zoom — the attractor scales.
6. Click each preset (Classic/Wings/Web/Swirl/Ribbons) — confirm each produces a distinct, non-empty attractor. **If any preset looks empty or weak, tune its `a,b,c,d` in `src/lib/clifford-presets.ts`** and re-run `bun run vitest run src/lib/clifford-presets.test.ts`.
7. Click Reset (returns to Classic) and Randomize (new in-range attractor).
8. Snapshot, Share, Save, and Compare (⊞) buttons all work.
9. Narrow the viewport to mobile width — layout remains usable.

- [ ] **Step 5: Final commit (only if Step 4 required preset tuning)**

```bash
git add src/lib/clifford-presets.ts
git commit -m "chore: tune Clifford preset parameters after visual check (HPA-64)"
```

---

## Self-Review

**Spec coverage** (each spec section → task):

- Math `src/lib/clifford.ts`, bounded, no multi-seed, fixed seed → **Task 1**.
- Compute model = worker offload, `MAX_POINTS=250000` → **Tasks 7, 8**.
- Renderer per-point modes + **density** path → **Task 8**.
- Page (header, controls a/b/c/d/iterations, formula, Reset, Randomize, DATA_LOG, save/share/snapshot/compare links, URL config loading) → **Task 9**.
- Zoom + point size + opacity + color-mode render controls → **Tasks 8, 9**.
- Presets (5, Classic default, detectPresetId) → **Task 5**.
- Type registration (union, display name, valid types, SavedConfiguration) → **Task 2**.
- Validation `STABLE_RANGES` + `OPTIONAL_FIELDS` → **Task 3**.
- Type guard → **Task 4**.
- Comparison `getDefaultParameters` case → **Task 6**.
- Worker request/response/handler → **Task 7**.
- Compare page → **Task 10**.
- Homepage card → **Task 11**.
- Test coverage (clifford, presets, renderer, page, worker, validation, type-guards, comparison, homepage) → spread across all tasks.
- Acceptance criteria 1–8 → verified in **Task 12**.

No spec requirement is left without a task.

**Placeholder scan:** No `TBD`/`TODO`/"similar to"/"add error handling" placeholders — every code step contains complete code; the only deferred item is optional preset _visual tuning_, which is an explicit, bounded Task 12 step with concrete values already provided.

**Type consistency:** `calculateCliffordTuples(CliffordParams)` (Task 1) is consumed identically in Tasks 7 and 8. `CliffordParameters` fields (`a,b,c,d,iterations,colorMode?,zoom?,pointSize?,opacity?`) from Task 2 are used consistently in validation (Task 3), guards (Task 4), comparison (Task 6), page (Task 9), and compare page (Task 10). Worker message types `clifford` / `cliffordResult` match between `types.ts`, `chaosMapsHandler.ts` (Task 7) and the renderer (Task 8). Preset field set in `CliffordPresetState` (Task 5) matches `detectPresetId`'s comparison and the page's `currentPresetState()` (Task 9).
