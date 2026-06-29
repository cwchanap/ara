# Gumowski–Mira Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Gumowski–Mira map as a full-featured 2D chaotic-map visualization module at `/gumowski-mira`, matching the richness of the Ikeda module.

**Architecture:** A 2D discrete nonlinear iterative map rendered as a D3-axes + Canvas point-cloud. Compute offloads to the existing `chaosMapsWorker` for multi-seed mode, with a main-thread fallback. The module integrates with the existing save/share/snapshot/compare/config-loading infrastructure.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript (strict), D3.js (axes + canvas), TailwindCSS v4, Vitest (node + jsdom projects), Drizzle ORM / PostgreSQL (config persistence).

## Global Constraints

- **Map type identifier:** `'gumowski-mira'` (lowercase, hyphenated) everywhere — union type, validation, DB, URLs.
- **Display name:** `'GUMOWSKI–MIRA_MAP'` (en-dash `–` U+2013, matching the homepage card title `Gumowski–Mira Map`).
- **VALID_MAP_TYPES order:** insert `'gumowski-mira'` immediately AFTER `'chaos-esthetique'` and before `'lyapunov'`.
- **Naming convention:** module files use `gumowski-mira` (kebab-case) for routes and lib files; TypeScript identifiers use `GumowskiMira` (PascalCase) and `gumowskiMira` (camelCase).
- **Test framework:** Vitest. `*.test.ts` runs in the node project; `*.svelte.test.ts` runs in the jsdom project.
- **Run commands:** `bun run check` (svelte-check typecheck), `bun run lint` (eslint+prettier), `bun run test` (full suite). Single file: `bun run vitest run <path>`.
- **No comments** in implementation code unless the existing file already documents that pattern (doc comments on public compute functions are OK — `ikeda.ts` and `clifford.ts` both use them).
- **Sci-fi styling:** neon cyan `#00f3ff` primary, magenta `#ff00ff` accent, Orbitron headings, Rajdhani body. Corner borders, glow effects, UPPERCASE labels.

---

## File Structure

### Create

| File                                                            | Responsibility                                            |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| `src/lib/gumowski-mira.ts`                                      | Pure compute: single-orbit + multi-seed point generation. |
| `src/lib/gumowski-mira.test.ts`                                 | Unit tests for compute (node project).                    |
| `src/lib/gumowski-mira-presets.ts`                              | 5 presets + lookup/detect helpers.                        |
| `src/lib/gumowski-mira-presets.test.ts`                         | Preset tests (node project).                              |
| `src/lib/components/visualizations/GumowskiMiraRenderer.svelte` | D3 axes + Canvas point-cloud renderer.                    |
| `src/routes/gumowski-mira/+page.svelte`                         | Main visualization page.                                  |
| `src/routes/gumowski-mira/compare/+page.svelte`                 | 2-panel compare page.                                     |
| `src/routes/gumowski-mira-config-loading.svelte.test.ts`        | Config-loading tests (jsdom).                             |
| `src/routes/gumowski-mira-page-interactions.svelte.test.ts`     | Page interaction tests (jsdom).                           |
| `src/routes/gumowski-mira-compare-interactions.svelte.test.ts`  | Compare page tests (jsdom).                               |
| `drizzle/0010_add_gumowski_mira_map_type.sql`                   | DB migration: CHECK constraints.                          |

### Modify

| File                                      | Change                                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/types.ts`                        | Add map type, parameter interface, color/render mode types, display name, VALID_MAP_TYPES entry, SavedConfiguration union member. |
| `src/lib/chaos-validation.ts`             | Add stability ranges + optional fields for `gumowski-mira`.                                                                       |
| `src/lib/workers/types.ts`                | Add request/response interfaces + union members.                                                                                  |
| `src/lib/workers/chaosMapsHandler.ts`     | Add `gumowskiMira` dispatch branch.                                                                                               |
| `src/lib/comparison-url-state.ts`         | Add import + `getDefaultParameters` case.                                                                                         |
| `src/routes/+page.svelte`                 | Add homepage card.                                                                                                                |
| `src/lib/workers/chaosMapsWorker.test.ts` | Add assertions for the new message type.                                                                                          |

---

## Task 1: Types and Validation

**Files:**

- Modify: `src/lib/types.ts`
- Modify: `src/lib/chaos-validation.ts`
- Test: `src/lib/chaos-validation.ts` (existing tests exercise validation; the new map type is covered by the union completeness check in `schema.test.ts`)

**Interfaces:**

- Produces: `GumowskiMiraParameters`, `GumowskiMiraColorMode`, `GumowskiMiraRenderMode` types; `'gumowski-mira'` in `ChaosMapType` union; stability ranges consumable by `checkParameterStability('gumowski-mira', ...)`.

- [ ] **Step 1: Add map type to `ChaosMapType` union**

In `src/lib/types.ts`, add `'gumowski-mira'` to the `ChaosMapType` union immediately after `'chaos-esthetique'`:

```typescript
export type ChaosMapType =
	| 'lorenz'
	| 'rossler'
	| 'henon'
	| 'lozi'
	| 'ikeda'
	| 'clifford'
	| 'logistic'
	| 'newton'
	| 'standard'
	| 'bifurcation-logistic'
	| 'bifurcation-henon'
	| 'chaos-esthetique'
	| 'gumowski-mira'
	| 'lyapunov'
	| 'chua'
	| 'double-pendulum';
```

- [ ] **Step 2: Add color/render mode types and parameter interface**

In `src/lib/types.ts`, add after the `CliffordParameters` interface (before `LogisticParameters`):

```typescript
export type GumowskiMiraRenderMode = 'single' | 'multi';
export type GumowskiMiraColorMode = 'single' | 'iteration' | 'seed' | 'radius';

export interface GumowskiMiraParameters {
	type: 'gumowski-mira';
	mu: number;
	a: number;
	b: number;
	x0: number;
	y0: number;
	iterations: number;
	burnIn: number;
	renderMode?: GumowskiMiraRenderMode;
	seeds?: number;
	colorMode?: GumowskiMiraColorMode;
	pointSize?: number;
	opacity?: number;
}
```

- [ ] **Step 3: Add to the `ChaosMapParameters` union**

In `src/lib/types.ts`, add `| GumowskiMiraParameters` to the `ChaosMapParameters` union (after the `CliffordParameters` line):

```typescript
export type ChaosMapParameters =
	| LorenzParameters
	| RosslerParameters
	| HenonParameters
	| LoziParameters
	| IkedaParameters
	| CliffordParameters
	| GumowskiMiraParameters
	| LogisticParameters
	| NewtonParameters
	| StandardParameters
	| BifurcationLogisticParameters
	| BifurcationHenonParameters
	| ChaosEsthetiqueParameters
	| LyapunovParameters
	| ChuaParameters
	| DoublePendulumParameters;
```

- [ ] **Step 4: Add display name**

In `src/lib/types.ts`, add to `CHAOS_MAP_DISPLAY_NAMES` (after the `'chaos-esthetique'` line):

```typescript
	'gumowski-mira': 'GUMOWSKI–MIRA_MAP',
```

- [ ] **Step 5: Add to `VALID_MAP_TYPES`**

In `src/lib/types.ts`, add `'gumowski-mira'` to the `VALID_MAP_TYPES` array (after `'chaos-esthetique'`):

```typescript
export const VALID_MAP_TYPES: ChaosMapType[] = [
	'lorenz',
	'rossler',
	'henon',
	'lozi',
	'ikeda',
	'clifford',
	'logistic',
	'newton',
	'standard',
	'bifurcation-logistic',
	'bifurcation-henon',
	'chaos-esthetique',
	'gumowski-mira',
	'lyapunov',
	'chua',
	'double-pendulum'
];
```

- [ ] **Step 6: Add to `SavedConfiguration` union**

In `src/lib/types.ts`, add a new member to the `SavedConfiguration` discriminated union (after the clifford member, before logistic):

```typescript
	| {
			mapType: 'gumowski-mira';
			parameters: GumowskiMiraParameters;
	  }
```

- [ ] **Step 7: Add stability ranges to `chaos-validation.ts`**

In `src/lib/chaos-validation.ts`, add to the `STABLE_RANGES` record (after the `'chaos-esthetique'` entry):

```typescript
	'gumowski-mira': {
		mu: { min: -1, max: 1 },
		a: { min: 0, max: 1 },
		b: { min: 0, max: 0.5 },
		x0: { min: -20, max: 20 },
		y0: { min: -20, max: 20 },
		iterations: { min: 1, max: 250000 },
		burnIn: { min: 0, max: 10000 }
	},
```

- [ ] **Step 8: Add optional fields to `chaos-validation.ts`**

In `src/lib/chaos-validation.ts`, add to the `OPTIONAL_FIELDS` record (after the `clifford` entry):

```typescript
	'gumowski-mira': {
		renderMode: { kind: 'enum', values: ['single', 'multi'] },
		seeds: { kind: 'number', min: 1, max: 5000 },
		colorMode: { kind: 'enum', values: ['single', 'iteration', 'seed', 'radius'] },
		pointSize: { kind: 'number', min: 0.5, max: 6 },
		opacity: { kind: 'number', min: 0, max: 1 }
	}
```

- [ ] **Step 9: Run typecheck to verify types compile**

Run: `bun run check`
Expected: PASS (no type errors — the new union members are self-consistent).

- [ ] **Step 10: Commit**

```bash
git add src/lib/types.ts src/lib/chaos-validation.ts
git commit -m "feat: add gumowski-mira map types and validation ranges (HPA-65)"
```

---

## Task 2: Compute Module

**Files:**

- Create: `src/lib/gumowski-mira.ts`
- Test: `src/lib/gumowski-mira.test.ts`

**Interfaces:**

- Consumes: `mulberry32` from `$lib/ikeda` (shared deterministic PRNG).
- Produces: `gumowskiMiraStep`, `calculateGumowskiMiraTuples`, `calculateGumowskiMiraMultiSeed`, `GumowskiMiraParams`, `GumowskiMiraMultiSeedParams`, `GumowskiMiraMultiSeedResult`.

- [ ] **Step 1: Write the failing test file**

Create `src/lib/gumowski-mira.test.ts`:

```typescript
import { describe, test, expect } from 'vitest';
import {
	gumowskiMiraStep,
	calculateGumowskiMiraTuples,
	calculateGumowskiMiraMultiSeed
} from './gumowski-mira';

describe('gumowskiMiraStep', () => {
	test('produces a deterministic result for known inputs', () => {
		const [x, y] = gumowskiMiraStep(0.1, 0, 0.31, 0.008, 0.05);
		expect(x).toBeCloseTo(0.0446634, 5);
		expect(y).toBeCloseTo(-0.083407, 5);
	});

	test('g(x) = μ·x + 2(1−μ)·x²/(1+x²) at x=0 returns 0', () => {
		// g(0) = 0 for any μ; step from (0,0) with a=0 means xNew = 0 + 0 + g(0) = 0
		const [x, y] = gumowskiMiraStep(0, 0, 0.5, 0, 0.05);
		expect(x).toBe(0);
		expect(y).toBe(0); // -x + g(xNew) = -0 + g(0) = 0
	});
});

describe('calculateGumowskiMiraTuples', () => {
	test('returns empty array for zero iterations', () => {
		const points = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 0,
			burnIn: 0
		});
		expect(points).toEqual([]);
	});

	test('returns empty array for negative iterations', () => {
		const points = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: -5,
			burnIn: 0
		});
		expect(points).toEqual([]);
	});

	test('produces the correct number of points (minus burn-in)', () => {
		const points = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 100,
			burnIn: 20
		});
		expect(points.length).toBe(80);
	});

	test('burn-in discards the first N points', () => {
		const burned = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 50,
			burnIn: 10
		});
		const full = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 50,
			burnIn: 0
		});
		expect(burned[0]).toEqual(full[10]);
	});

	test('all points are finite for stable parameters', () => {
		const points = calculateGumowskiMiraTuples({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 1000,
			burnIn: 0
		});
		for (const [x, y] of points) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
	});
});

describe('calculateGumowskiMiraMultiSeed', () => {
	test('returns empty for non-positive seeds', () => {
		const result = calculateGumowskiMiraMultiSeed({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 100,
			burnIn: 0,
			seeds: 0
		});
		expect(result.points).toEqual([]);
		expect(result.seedIndices).toEqual([]);
	});

	test('returns empty for non-positive iterations', () => {
		const result = calculateGumowskiMiraMultiSeed({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 0,
			burnIn: 0,
			seeds: 10
		});
		expect(result.points).toEqual([]);
	});

	test('returns empty for non-positive maxPoints', () => {
		const result = calculateGumowskiMiraMultiSeed({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 100,
			burnIn: 0,
			seeds: 10,
			maxPoints: 0
		});
		expect(result.points).toEqual([]);
	});

	test('is deterministic — same params produce identical points', () => {
		const params = {
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 200,
			burnIn: 20,
			seeds: 30
		};
		const r1 = calculateGumowskiMiraMultiSeed(params);
		const r2 = calculateGumowskiMiraMultiSeed(params);
		expect(r1.points).toEqual(r2.points);
		expect(r1.seedIndices).toEqual(r2.seedIndices);
	});

	test('seedIndices parallel points', () => {
		const result = calculateGumowskiMiraMultiSeed({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 50,
			burnIn: 0,
			seeds: 5
		});
		expect(result.points.length).toBe(result.seedIndices.length);
		const uniqueSeeds = new Set(result.seedIndices);
		expect(uniqueSeeds.size).toBeLessThanOrEqual(5);
	});

	test('respects maxPoints cap', () => {
		const result = calculateGumowskiMiraMultiSeed({
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 100,
			burnIn: 0,
			seeds: 50,
			maxPoints: 100
		});
		expect(result.points.length).toBeLessThanOrEqual(100);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run src/lib/gumowski-mira.test.ts`
Expected: FAIL — `Cannot find module './gumowski-mira'`

- [ ] **Step 3: Write the compute module**

Create `src/lib/gumowski-mira.ts`:

```typescript
/**
 * Gumowski–Mira Map Calculation
 *
 * The Gumowski–Mira map is a 2D discrete nonlinear system:
 *   g(x)   = μ·x + 2(1−μ)·x² / (1 + x²)
 *   x(n+1) = y + a·(1 − b·y²)·y + g(x)
 *   y(n+1) = −x + g(x(n+1))
 *
 * Depending on μ the system moves between smooth invariant curves (μ < 0),
 * island chains (0 < μ < ~0.5), and fully chaotic seas (μ > ~0.5).
 * Multi-seed scattering uses a deterministic PRNG so saved/shared configs
 * reproduce exactly.
 */

import { mulberry32 } from './ikeda';

export interface GumowskiMiraParams {
	mu: number;
	a: number;
	b: number;
	x0: number;
	y0: number;
	iterations: number;
	burnIn: number;
}

export interface GumowskiMiraMultiSeedParams {
	mu: number;
	a: number;
	b: number;
	iterations: number;
	burnIn: number;
	seeds: number;
	/** Optional cap on total collected points; stops early once reached. */
	maxPoints?: number;
}

export interface GumowskiMiraMultiSeedResult {
	points: [number, number][];
	/** Parallel to `points`: which seed (0-based) each point came from. */
	seedIndices: number[];
}

/** The Gumowski function g(x) = μ·x + 2(1−μ)·x²/(1+x²). */
export function gumowskiFunction(x: number, mu: number): number {
	return mu * x + (2 * (1 - mu) * x * x) / (1 + x * x);
}

/** One iteration of the Gumowski–Mira map. */
export function gumowskiMiraStep(
	x: number,
	y: number,
	mu: number,
	a: number,
	b: number
): [number, number] {
	const gx = gumowskiFunction(x, mu);
	const xNew = y + a * (1 - b * y * y) * y + gx;
	const gxNew = gumowskiFunction(xNew, mu);
	const yNew = -x + gxNew;
	return [xNew, yNew];
}

/**
 * Single-orbit trajectory as [x, y] tuples (Canvas/D3-friendly). The first
 * `burnIn` iterations are discarded as transient. Stops early if a value
 * becomes non-finite.
 */
export function calculateGumowskiMiraTuples(params: GumowskiMiraParams): [number, number][] {
	const { mu, a, b, x0, y0, iterations, burnIn } = params;
	if (iterations <= 0) return [];
	const points: [number, number][] = [];
	let x = x0;
	let y = y0;
	for (let i = 0; i < iterations; i++) {
		[x, y] = gumowskiMiraStep(x, y, mu, a, b);
		if (!Number.isFinite(x) || !Number.isFinite(y)) break;
		if (i >= burnIn) points.push([x, y]);
	}
	return points;
}

/** Fixed seed so the multi-seed attractor is byte-identical across runs. */
const MULTI_SEED_RNG_SEED = 0x9e60f101; // gumowski-mira dedicated seed

/**
 * Multi-seed attractor: scatter `seeds` deterministic starting points across a
 * bounded box, iterate each, discard the first `burnIn` points per orbit, and
 * collect the rest into one point cloud.
 */
export function calculateGumowskiMiraMultiSeed(
	params: GumowskiMiraMultiSeedParams
): GumowskiMiraMultiSeedResult {
	const { mu, a, b, iterations, burnIn, seeds, maxPoints } = params;
	if (seeds <= 0 || iterations <= 0) return { points: [], seedIndices: [] };
	if (typeof maxPoints === 'number' && maxPoints <= 0) return { points: [], seedIndices: [] };
	const cap = maxPoints ?? Infinity;
	const points: [number, number][] = [];
	const seedIndices: number[] = [];
	const rand = mulberry32(MULTI_SEED_RNG_SEED);
	for (let s = 0; s < seeds && points.length < cap; s++) {
		let x = rand() * 2 - 1;
		let y = rand() * 2 - 1;
		for (let i = 0; i < iterations; i++) {
			[x, y] = gumowskiMiraStep(x, y, mu, a, b);
			if (!Number.isFinite(x) || !Number.isFinite(y)) break;
			if (i >= burnIn) {
				points.push([x, y]);
				seedIndices.push(s);
				if (points.length >= cap) break;
			}
		}
	}
	return { points, seedIndices };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run src/lib/gumowski-mira.test.ts`
Expected: PASS — all tests green.

Note: The `gumowskiMiraStep` expected values in Step 1 were computed from the equations. If a test fails on the close-to assertion, recompute the expected values from the actual step function output and update the test constants — the equations are the source of truth, not the hand-computed literals. Run this one-liner to get the actual values if needed:

```bash
bun -e "import {gumowskiMiraStep} from './src/lib/gumowski-mira'; console.log(gumowskiMiraStep(0.1,0,0.31,0.008,0.05))"
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/gumowski-mira.ts src/lib/gumowski-mira.test.ts
git commit -m "feat: add gumowski-mira compute module with single/multi-seed (HPA-65)"
```

---

## Task 3: Presets

**Files:**

- Create: `src/lib/gumowski-mira-presets.ts`
- Test: `src/lib/gumowski-mira-presets.test.ts`

**Interfaces:**

- Produces: `GumowskiMiraPreset`, `GumowskiMiraPresetState`, `GUMOWSKI_MIRA_PRESETS`, `DEFAULT_GUMOWSKI_MIRA_PRESET_ID`, `getPreset`, `detectPresetId`.

- [ ] **Step 1: Write the failing test file**

Create `src/lib/gumowski-mira-presets.test.ts`:

```typescript
import { describe, test, expect } from 'vitest';
import {
	GUMOWSKI_MIRA_PRESETS,
	getPreset,
	detectPresetId,
	DEFAULT_GUMOWSKI_MIRA_PRESET_ID
} from './gumowski-mira-presets';

describe('GUMOWSKI_MIRA_PRESETS', () => {
	test('has at least 5 presets', () => {
		expect(GUMOWSKI_MIRA_PRESETS.length).toBeGreaterThanOrEqual(5);
	});

	test('every preset has a unique id', () => {
		const ids = GUMOWSKI_MIRA_PRESETS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test('every preset has a label', () => {
		for (const p of GUMOWSKI_MIRA_PRESETS) {
			expect(typeof p.label).toBe('string');
			expect(p.label.length).toBeGreaterThan(0);
		}
	});
});

describe('getPreset', () => {
	test('returns the preset for a known id', () => {
		const preset = getPreset('island-structure');
		expect(preset).toBeDefined();
		expect(preset?.id).toBe('island-structure');
	});

	test('returns undefined for unknown id', () => {
		expect(getPreset('does-not-exist')).toBeUndefined();
	});
});

describe('DEFAULT_GUMOWSKI_MIRA_PRESET_ID', () => {
	test('resolves to a valid preset', () => {
		expect(getPreset(DEFAULT_GUMOWSKI_MIRA_PRESET_ID)).toBeDefined();
	});
});

describe('detectPresetId', () => {
	test('detects an exact preset state match', () => {
		const preset = getPreset('island-structure')!;
		expect(detectPresetId(preset.state)).toBe('island-structure');
	});

	test('returns null for a non-matching (custom) state', () => {
		const preset = getPreset('island-structure')!;
		const modified = { ...preset.state, mu: 0.999 };
		expect(detectPresetId(modified)).toBeNull();
	});

	test('detects every preset in the list', () => {
		for (const preset of GUMOWSKI_MIRA_PRESETS) {
			expect(detectPresetId(preset.state)).toBe(preset.id);
		}
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run src/lib/gumowski-mira-presets.test.ts`
Expected: FAIL — `Cannot find module './gumowski-mira-presets'`

- [ ] **Step 3: Write the presets module**

Create `src/lib/gumowski-mira-presets.ts`:

```typescript
import type { GumowskiMiraColorMode, GumowskiMiraRenderMode } from '$lib/types';

/** The full set of user-controllable Gumowski–Mira state (everything that affects the render). */
export interface GumowskiMiraPresetState {
	mu: number;
	a: number;
	b: number;
	x0: number;
	y0: number;
	iterations: number;
	burnIn: number;
	renderMode: GumowskiMiraRenderMode;
	seeds: number;
	colorMode: GumowskiMiraColorMode;
	pointSize: number;
	opacity: number;
}

export interface GumowskiMiraPreset {
	id: string;
	label: string;
	state: GumowskiMiraPresetState;
}

export const GUMOWSKI_MIRA_PRESETS: GumowskiMiraPreset[] = [
	{
		id: 'ordered-curves',
		label: 'Ordered Curves',
		state: {
			mu: -0.4,
			a: 0.008,
			b: 0.5,
			x0: 0.1,
			y0: 0,
			iterations: 12000,
			burnIn: 500,
			renderMode: 'multi',
			seeds: 300,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'island-structure',
		label: 'Island Structure',
		state: {
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 15000,
			burnIn: 500,
			renderMode: 'multi',
			seeds: 300,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'transitional',
		label: 'Transitional',
		state: {
			mu: 0.4,
			a: 0.02,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 15000,
			burnIn: 500,
			renderMode: 'multi',
			seeds: 300,
			colorMode: 'seed',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'dense-chaos',
		label: 'Dense Chaos',
		state: {
			mu: 0.55,
			a: 0.05,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 18000,
			burnIn: 500,
			renderMode: 'multi',
			seeds: 500,
			colorMode: 'radius',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'spiral-sweep',
		label: 'Spiral Sweep',
		state: {
			mu: -0.827,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 15000,
			burnIn: 500,
			renderMode: 'multi',
			seeds: 300,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6
		}
	}
];

/** The preset that defines the default page state. */
export const DEFAULT_GUMOWSKI_MIRA_PRESET_ID = 'island-structure';

export function getPreset(id: string): GumowskiMiraPreset | undefined {
	return GUMOWSKI_MIRA_PRESETS.find((p) => p.id === id);
}

function numbersClose(x: number, y: number): boolean {
	return Math.abs(x - y) < 1e-9;
}

/**
 * Return the id of the preset whose state matches `state` exactly, or null
 * (meaning the user is in a "Custom" state).
 */
export function detectPresetId(state: GumowskiMiraPresetState): string | null {
	for (const preset of GUMOWSKI_MIRA_PRESETS) {
		const s = preset.state;
		if (
			numbersClose(s.mu, state.mu) &&
			numbersClose(s.a, state.a) &&
			numbersClose(s.b, state.b) &&
			numbersClose(s.x0, state.x0) &&
			numbersClose(s.y0, state.y0) &&
			s.iterations === state.iterations &&
			s.burnIn === state.burnIn &&
			s.renderMode === state.renderMode &&
			s.seeds === state.seeds &&
			s.colorMode === state.colorMode &&
			numbersClose(s.pointSize, state.pointSize) &&
			numbersClose(s.opacity, state.opacity)
		) {
			return preset.id;
		}
	}
	return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run src/lib/gumowski-mira-presets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/gumowski-mira-presets.ts src/lib/gumowski-mira-presets.test.ts
git commit -m "feat: add gumowski-mira presets showcasing order→chaos spectrum (HPA-65)"
```

---

## Task 4: Worker Integration

**Files:**

- Modify: `src/lib/workers/types.ts`
- Modify: `src/lib/workers/chaosMapsHandler.ts`
- Test: `src/lib/workers/chaosMapsWorker.test.ts` (add assertions)

**Interfaces:**

- Consumes: `calculateGumowskiMiraMultiSeed` from `$lib/gumowski-mira` (produced in Task 2).
- Produces: `GumowskiMiraRequest`, `GumowskiMiraResponse` in the worker type unions; handler dispatches `type: 'gumowskiMira'`.

- [ ] **Step 1: Add request/response types**

In `src/lib/workers/types.ts`, add the request interface (after `CliffordRequest`):

```typescript
export interface GumowskiMiraRequest {
	type: 'gumowskiMira';
	id: number;
	mu: number;
	a: number;
	b: number;
	iterations: number;
	burnIn: number;
	seeds: number;
	maxPoints: number;
}
```

Add the response interface (after `CliffordResponse`):

```typescript
export interface GumowskiMiraResponse {
	type: 'gumowskiMiraResult';
	id: number;
	points: [number, number][];
	seedIndices: number[];
}
```

Add both to the union types:

```typescript
export type ChaosMapsWorkerRequest =
	| StandardMapRequest
	| ChaosEsthetiqueRequest
	| IkedaRequest
	| CliffordRequest
	| GumowskiMiraRequest;

export type ChaosMapsWorkerResponse =
	| StandardMapResponse
	| ChaosEsthetiqueResponse
	| IkedaResponse
	| CliffordResponse
	| GumowskiMiraResponse
	| ErrorResponse;
```

- [ ] **Step 2: Add the handler branch**

In `src/lib/workers/chaosMapsHandler.ts`, add the import at the top (after the clifford import):

```typescript
import { calculateGumowskiMiraMultiSeed } from '../gumowski-mira';
```

Add the dispatch branch in `handleWorkerMessage`, after the `clifford` branch and before the `else`:

```typescript
	} else if (data.type === 'gumowskiMira') {
		const { points, seedIndices } = calculateGumowskiMiraMultiSeed({
			mu: data.mu,
			a: data.a,
			b: data.b,
			iterations: data.iterations,
			burnIn: data.burnIn,
			seeds: data.seeds,
			maxPoints: data.maxPoints
		});
		return { type: 'gumowskiMiraResult', id: data.id, points, seedIndices };
	}
```

- [ ] **Step 3: Add worker handler test assertions**

In `src/lib/workers/chaosMapsWorker.test.ts`, add a new `describe` block for the gumowski-mira message type. Append:

```typescript
describe('handleWorkerMessage — gumowskiMira', () => {
	test('returns gumowskiMiraResult with points and seedIndices', () => {
		const result = handleWorkerMessage({
			type: 'gumowskiMira',
			id: 42,
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 200,
			burnIn: 20,
			seeds: 30,
			maxPoints: 5000
		});
		expect(result.type).toBe('gumowskiMiraResult');
		if (result.type !== 'gumowskiMiraResult') return;
		expect(result.id).toBe(42);
		expect(result.points.length).toBeGreaterThan(0);
		expect(result.seedIndices.length).toBe(result.points.length);
	});

	test('is deterministic across calls', () => {
		const req = {
			type: 'gumowskiMira' as const,
			id: 1,
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 100,
			burnIn: 0,
			seeds: 10,
			maxPoints: 1000
		};
		const r1 = handleWorkerMessage(req);
		const r2 = handleWorkerMessage(req);
		if (r1.type !== 'gumowskiMiraResult' || r2.type !== 'gumowskiMiraResult') {
			throw new Error('unexpected response type');
		}
		expect(r1.points).toEqual(r2.points);
	});

	test('returns empty for non-positive seeds', () => {
		const result = handleWorkerMessage({
			type: 'gumowskiMira',
			id: 7,
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 100,
			burnIn: 0,
			seeds: 0,
			maxPoints: 1000
		});
		if (result.type !== 'gumowskiMiraResult') throw new Error('unexpected type');
		expect(result.points).toEqual([]);
	});
});
```

- [ ] **Step 4: Run worker tests**

Run: `bun run vitest run src/lib/workers/chaosMapsWorker.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `bun run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/workers/types.ts src/lib/workers/chaosMapsHandler.ts src/lib/workers/chaosMapsWorker.test.ts
git commit -m "feat: add gumowski-mira to chaos maps worker (HPA-65)"
```

---

## Task 5: Comparison URL State

**Files:**

- Modify: `src/lib/comparison-url-state.ts`

**Interfaces:**

- Consumes: `getPreset`, `DEFAULT_GUMOWSKI_MIRA_PRESET_ID` from `$lib/gumowski-mira-presets` (produced in Task 3).
- Produces: `getDefaultParameters('gumowski-mira')` returning a `GumowskiMiraParameters` object (consumed by the compare page in Task 9).

- [ ] **Step 1: Add the import**

In `src/lib/comparison-url-state.ts`, add after the clifford preset import:

```typescript
import {
	getPreset as getGumowskiMiraPreset,
	DEFAULT_GUMOWSKI_MIRA_PRESET_ID
} from './gumowski-mira-presets';
```

- [ ] **Step 2: Add the getDefaultParameters case**

In `src/lib/comparison-url-state.ts`, add a new case in the `getDefaultParameters` switch (after the `clifford` case, before the closing brace):

```typescript
		case 'gumowski-mira': {
			const preset = getGumowskiMiraPreset(DEFAULT_GUMOWSKI_MIRA_PRESET_ID);
			if (!preset)
				throw new Error(
					`Missing default Gumowski-Mira preset: ${DEFAULT_GUMOWSKI_MIRA_PRESET_ID}`
				);
			return { type: 'gumowski-mira', ...preset.state };
		}
```

- [ ] **Step 3: Run typecheck and existing comparison tests**

Run: `bun run check && bun run vitest run src/lib/comparison-url-state.test.ts`
Expected: PASS (the switch is now exhaustive; existing tests still pass).

- [ ] **Step 4: Commit**

```bash
git add src/lib/comparison-url-state.ts
git commit -m "feat: add gumowski-mira default params to comparison state (HPA-65)"
```

---

## Task 6: Renderer Component

**Files:**

- Create: `src/lib/components/visualizations/GumowskiMiraRenderer.svelte`

**Interfaces:**

- Consumes: `calculateGumowskiMiraTuples`, `calculateGumowskiMiraMultiSeed` from `$lib/gumowski-mira` (Task 2); `GumowskiMiraColorMode`, `GumowskiMiraRenderMode` from `$lib/types` (Task 1); `ChaosMapsWorkerResponse` from `$lib/workers/types` (Task 4).
- Produces: `<GumowskiMiraRenderer>` Svelte component with bindable props consumed by the page (Task 7) and compare page (Task 9).

- [ ] **Step 1: Create the renderer component**

Create `src/lib/components/visualizations/GumowskiMiraRenderer.svelte`. This is a direct adaptation of `IkedaRenderer.svelte` (same architecture: D3 axes + Canvas point cloud, worker offload for multi-seed, main-thread fallback, `$effect` split). Copy the IkedaRenderer structure and substitute the gumowski-mira parameters and compute calls:

```svelte
<!--
  GumowskiMiraRenderer Component - Canvas point cloud for the Gumowski–Mira map (D3 axes).
  Multi-seed compute offloads to chaosMapsWorker with a main-thread fallback.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { calculateGumowskiMiraTuples, calculateGumowskiMiraMultiSeed } from '$lib/gumowski-mira';
	import type { GumowskiMiraColorMode, GumowskiMiraRenderMode } from '$lib/types';
	import type { ChaosMapsWorkerResponse } from '$lib/workers/types';

	interface Props {
		mu?: number;
		a?: number;
		b?: number;
		x0?: number;
		y0?: number;
		iterations?: number;
		burnIn?: number;
		renderMode?: GumowskiMiraRenderMode;
		seeds?: number;
		colorMode?: GumowskiMiraColorMode;
		pointSize?: number;
		opacity?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}

	let {
		mu = $bindable(0.31),
		a = $bindable(0.008),
		b = $bindable(0.05),
		x0 = $bindable(0.1),
		y0 = $bindable(0),
		iterations = $bindable(15000),
		burnIn = $bindable(500),
		renderMode = $bindable<GumowskiMiraRenderMode>('multi'),
		seeds = $bindable(300),
		colorMode = $bindable<GumowskiMiraColorMode>('iteration'),
		pointSize = $bindable(1.5),
		opacity = $bindable(0.6),
		height = 500,
		containerElement = $bindable()
	}: Props = $props();

	let container = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		containerElement = container;
	});

	const MAX_POINTS = 200000;
	const DEBOUNCE_MS = 250;

	type Computed = { points: [number, number][]; seedIndices: number[]; maxRadius: number };

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

	function colorFor(
		i: number,
		point: [number, number],
		seedIndex: number,
		total: number,
		seedCount: number,
		maxRadius: number
	): string {
		switch (colorMode) {
			case 'single':
				return '#00f3ff';
			case 'seed': {
				const t = seedCount > 1 ? seedIndex / (seedCount - 1) : 0;
				return interpCyanMagenta(t);
			}
			case 'radius': {
				const r = Math.hypot(point[0], point[1]);
				const t = maxRadius > 0 ? Math.min(1, r / maxRadius) : 0;
				return interpMagentaViolet(t);
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

	function buildComputed(points: [number, number][], seedIndices: number[]): Computed {
		return { points, seedIndices, maxRadius: computeMaxRadius(points) };
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
		const seedIndices = capped ? computed.seedIndices.slice(0, MAX_POINTS) : computed.seedIndices;
		if (points.length === 0) {
			return;
		}

		const xExtentRaw = d3.extent(points, (d) => d[0]);
		const yExtentRaw = d3.extent(points, (d) => d[1]);
		const xExtent: [number, number] = [xExtentRaw[0] ?? -1, xExtentRaw[1] ?? 1];
		const yExtent: [number, number] = [yExtentRaw[0] ?? -1, yExtentRaw[1] ?? 1];

		const xScale = d3
			.scaleLinear()
			.domain([xExtent[0] - 0.5, xExtent[1] + 0.5])
			.range([0, width]);
		const yScale = d3
			.scaleLinear()
			.domain([yExtent[0] - 0.5, yExtent[1] + 0.5])
			.range([chartHeight, 0]);

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

		let seedCount = 1;
		for (const s of seedIndices) {
			if (s + 1 > seedCount) seedCount = s + 1;
		}

		const canvas = canvasSelection.node() as HTMLCanvasElement | null;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) {
			console.warn('GumowskiMiraRenderer: canvas or 2D context unavailable');
			return;
		}

		const maxRadius = computed.maxRadius;

		ctx.clearRect(0, 0, width, chartHeight);
		ctx.globalAlpha = Math.min(1, Math.max(0, opacity));
		const r = Math.max(0.5, pointSize);

		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const cx = xScale(p[0]);
			const cy = yScale(p[1]);
			ctx.fillStyle = colorFor(i, p, seedIndices[i] ?? 0, points.length, seedCount, maxRadius);
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	function computeMainThread(): Computed {
		if (renderMode === 'single') {
			const points = calculateGumowskiMiraTuples({ mu, a, b, x0, y0, iterations, burnIn });
			return buildComputed(
				points,
				points.map(() => 0)
			);
		}
		const { points, seedIndices } = calculateGumowskiMiraMultiSeed({
			mu,
			a,
			b,
			iterations,
			burnIn,
			seeds,
			maxPoints: MAX_POINTS
		});
		return buildComputed(points, seedIndices);
	}

	function paramsValid(): boolean {
		const values = [mu, a, b, x0, y0, iterations, burnIn, seeds, pointSize, opacity];
		return values.every(Number.isFinite) && iterations > 0;
	}

	function requestPoints() {
		if (!paramsValid()) {
			console.warn('GumowskiMiraRenderer: invalid parameters, skipping render');
			latest = buildComputed([], []);
			isComputing = false;
			render(latest);
			return;
		}

		if (renderMode === 'multi' && worker && workerAvailable) {
			const id = ++workerRequestId;
			latestWorkerRequestId = id;
			isComputing = true;
			worker.postMessage({
				type: 'gumowskiMira',
				id,
				mu,
				a,
				b,
				iterations,
				burnIn,
				seeds,
				maxPoints: MAX_POINTS
			});
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
						console.error('Gumowski-Mira worker error response:', data.message);
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

					if (data.type !== 'gumowskiMiraResult') return;
					if (data.id !== latestWorkerRequestId) return;
					isComputing = false;
					latest = buildComputed(data.points, data.seedIndices);
					render(latest);
					if (hasPendingRender) {
						hasPendingRender = false;
						scheduleRender();
					}
				};
				worker.onerror = (event: ErrorEvent) => {
					console.error('Gumowski-Mira worker error:', event.message);
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
				console.error('Failed to initialize gumowski-mira web worker:', error);
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

	$effect(() => {
		void mu;
		void a;
		void b;
		void x0;
		void y0;
		void iterations;
		void burnIn;
		void renderMode;
		void seeds;
		scheduleRender();
	});

	$effect(() => {
		void colorMode;
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

- [ ] **Step 2: Run typecheck**

Run: `bun run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/visualizations/GumowskiMiraRenderer.svelte
git commit -m "feat: add GumowskiMiraRenderer component (HPA-65)"
```

---

## Task 7: Main Page and Homepage Card

**Files:**

- Create: `src/routes/gumowski-mira/+page.svelte`
- Modify: `src/routes/+page.svelte`

**Interfaces:**

- Consumes: `GumowskiMiraRenderer` (Task 6), presets (Task 3), validation (Task 1), save/share/snapshot infrastructure, `comparison-url-state` (Task 5).
- Produces: the `/gumowski-mira` route; homepage card linking to it.

- [ ] **Step 1: Create the main page**

Create `src/routes/gumowski-mira/+page.svelte`. This mirrors `src/routes/ikeda/+page.svelte` exactly in structure (header, presets bar, system parameters, render controls, renderer, data log, save/share dialogs). The complete file:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import GumowskiMiraRenderer from '$lib/components/visualizations/GumowskiMiraRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type {
		GumowskiMiraParameters,
		GumowskiMiraColorMode,
		GumowskiMiraRenderMode
	} from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';
	import {
		GUMOWSKI_MIRA_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_GUMOWSKI_MIRA_PRESET_ID,
		type GumowskiMiraPresetState
	} from '$lib/gumowski-mira-presets';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();

	const defaultPreset = getPreset(DEFAULT_GUMOWSKI_MIRA_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default Gumowski-Mira preset: ${DEFAULT_GUMOWSKI_MIRA_PRESET_ID}`);
	const defaultState = defaultPreset.state;
	let mu = $state(defaultState.mu);
	let a = $state(defaultState.a);
	let b = $state(defaultState.b);
	let x0 = $state(defaultState.x0);
	let y0 = $state(defaultState.y0);
	let iterations = $state(defaultState.iterations);
	let burnIn = $state(defaultState.burnIn);
	let renderMode = $state<GumowskiMiraRenderMode>(defaultState.renderMode);
	let seeds = $state(defaultState.seeds);
	let colorMode = $state<GumowskiMiraColorMode>(defaultState.colorMode);
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

	function currentPresetState(): GumowskiMiraPresetState {
		return {
			mu,
			a,
			b,
			x0,
			y0,
			iterations,
			burnIn,
			renderMode,
			seeds,
			colorMode,
			pointSize,
			opacity
		};
	}

	const activePresetId = $derived(detectPresetId(currentPresetState()));
	const activePresetLabel = $derived(
		activePresetId ? (getPreset(activePresetId)?.label ?? 'CUSTOM') : 'CUSTOM'
	);

	function applyPreset(id: string) {
		const preset = getPreset(id);
		if (!preset) return;
		const s = preset.state;
		mu = s.mu;
		a = s.a;
		b = s.b;
		x0 = s.x0;
		y0 = s.y0;
		iterations = s.iterations;
		burnIn = s.burnIn;
		renderMode = s.renderMode;
		seeds = s.seeds;
		colorMode = s.colorMode;
		pointSize = s.pointSize;
		opacity = s.opacity;

		stabilityWarnings = [];
		showStabilityWarning = false;
		const stability = checkParameterStability('gumowski-mira', {
			type: 'gumowski-mira',
			mu,
			a,
			b,
			x0,
			y0,
			iterations,
			burnIn
		});
		if (!stability.isStable) {
			stabilityWarnings = stability.warnings;
			showStabilityWarning = true;
		}
	}

	function randomize() {
		mu = Math.random() * 1.8 - 0.9;
		a = Math.random() * 0.05;
		b = Math.random() * 0.5;
		x0 = Math.random() * 2 - 1;
		y0 = Math.random() * 2 - 1;
	}

	function reset() {
		applyPreset(DEFAULT_GUMOWSKI_MIRA_PRESET_ID);
	}

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
					let result: ReturnType<typeof loadSavedConfigParameters<'gumowski-mira'>> extends Promise<
						infer T
					>
						? T
						: never | undefined;

					if (shareCode) {
						result = await loadSharedConfigParameters({
							shareCode,
							mapType: 'gumowski-mira',
							base,
							fetchFn: fetchWithSignal
						});
					} else {
						result = await loadSavedConfigParameters({
							configId: configId!,
							mapType: 'gumowski-mira',
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

				const parsed = parseConfigParam({ mapType: 'gumowski-mira', configParam });
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

	function applyParameters(p: GumowskiMiraParameters) {
		mu = p.mu;
		a = p.a;
		b = p.b;
		x0 = p.x0;
		y0 = p.y0;
		iterations = p.iterations;
		burnIn = p.burnIn;
		renderMode = p.renderMode ?? renderMode;
		seeds = p.seeds ?? seeds;
		colorMode = p.colorMode ?? colorMode;
		pointSize = p.pointSize ?? pointSize;
		opacity = p.opacity ?? opacity;

		const stability = checkParameterStability('gumowski-mira', {
			type: 'gumowski-mira',
			mu,
			a,
			b,
			x0,
			y0,
			iterations,
			burnIn
		});
		if (!stability.isStable) {
			stabilityWarnings = stability.warnings;
			showStabilityWarning = true;
		} else {
			stabilityWarnings = [];
			showStabilityWarning = false;
		}
	}

	function getParameters(): GumowskiMiraParameters {
		return {
			type: 'gumowski-mira',
			mu,
			a,
			b,
			x0,
			y0,
			iterations,
			burnIn,
			renderMode,
			seeds,
			colorMode,
			pointSize,
			opacity
		};
	}

	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'gumowski-mira',
		saveState,
		getParameters
	);
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'gumowski-mira',
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
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				GUMOWSKI–MIRA_MAP
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				NONLINEAR_ITERATIVE_MAP // ORDER_AND_CHAOS
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={rendererContainer} targetType="container" mapType="gumowski-mira" />
			<a
				href={buildComparisonUrl(
					base,
					'gumowski-mira',
					createComparisonStateFromCurrent('gumowski-mira', getParameters())
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
			{#each GUMOWSKI_MIRA_PRESETS as preset (preset.id)}
				<button
					onclick={() => applyPreset(preset.id)}
					aria-pressed={activePresetId === preset.id}
					data-testid="preset-button"
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

		<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
			<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
			SYSTEM_PARAMETERS
		</h2>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<!-- μ (emphasized) -->
			<div class="space-y-2 border border-primary/40 rounded-sm p-4 bg-primary/5">
				<div class="flex justify-between items-end">
					<label for="mu" class="text-primary text-sm uppercase tracking-widest font-bold">
						Mu (μ)
					</label>
					<span data-testid="value-mu" class="font-mono text-accent text-lg">{mu.toFixed(3)}</span>
				</div>
				<input
					id="mu"
					data-testid="slider-mu"
					type="range"
					bind:value={mu}
					min="-1"
					max="1"
					step="0.001"
					class="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
			<!-- a (emphasized) -->
			<div class="space-y-2 border border-primary/40 rounded-sm p-4 bg-primary/5">
				<div class="flex justify-between items-end">
					<label for="a" class="text-primary text-sm uppercase tracking-widest font-bold">
						Alpha (a)
					</label>
					<span data-testid="value-a" class="font-mono text-accent text-lg">{a.toFixed(4)}</span>
				</div>
				<input
					id="a"
					data-testid="slider-a"
					type="range"
					bind:value={a}
					min="0"
					max="1"
					step="0.0001"
					class="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="b" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Beta (b)
					</label>
					<span class="font-mono text-accent">{b.toFixed(4)}</span>
				</div>
				<input
					id="b"
					type="range"
					bind:value={b}
					min="0"
					max="0.5"
					step="0.001"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
			<div
				class="space-y-2"
				class:opacity-40={renderMode === 'multi'}
				class:pointer-events-none={renderMode === 'multi'}
			>
				<div class="flex justify-between items-end">
					<label for="x0" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>x₀</label
					>
					<span class="font-mono text-accent">{x0.toFixed(2)}</span>
				</div>
				<input
					id="x0"
					type="range"
					bind:value={x0}
					disabled={renderMode === 'multi'}
					min="-20"
					max="20"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
				{#if renderMode === 'multi'}
					<span class="text-[10px] text-primary/50">Single Orbit only</span>
				{/if}
			</div>
			<div
				class="space-y-2"
				class:opacity-40={renderMode === 'multi'}
				class:pointer-events-none={renderMode === 'multi'}
			>
				<div class="flex justify-between items-end">
					<label for="y0" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>y₀</label
					>
					<span class="font-mono text-accent">{y0.toFixed(2)}</span>
				</div>
				<input
					id="y0"
					type="range"
					bind:value={y0}
					disabled={renderMode === 'multi'}
					min="-20"
					max="20"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
				{#if renderMode === 'multi'}
					<span class="text-[10px] text-primary/50">Single Orbit only</span>
				{/if}
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label
						for="iterations"
						class="text-primary/80 text-xs uppercase tracking-widest font-bold">Iterations</label
					>
					<span class="font-mono text-accent">{iterations}</span>
				</div>
				<input
					id="iterations"
					type="range"
					bind:value={iterations}
					min="100"
					max="100000"
					step="500"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="burnIn" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Burn-in</label
					>
					<span class="font-mono text-accent">{burnIn}</span>
				</div>
				<input
					id="burnIn"
					type="range"
					bind:value={burnIn}
					min="0"
					max="5000"
					step="50"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div class="flex gap-3">
			<button
				data-testid="reset-button"
				onclick={reset}
				class="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-xs font-bold transition-all"
			>
				↺ Reset
			</button>
			<button
				data-testid="randomize-button"
				onclick={randomize}
				class="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm uppercase tracking-widest text-xs font-bold transition-all"
			>
				⚄ Randomize
			</button>
		</div>

		<div
			class="grid grid-cols-1 gap-2 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>g(x) = μ·x + 2(1−μ)·x² / (1 + x²)</p>
			<p>x(n+1) = y + a·(1 − b·y²)·y + g(x)</p>
			<p>y(n+1) = −x + g(x(n+1))</p>
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
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
			<div class="space-y-2">
				<label for="renderMode" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>Render Mode</label
				>
				<select
					id="renderMode"
					data-testid="select-render-mode"
					bind:value={renderMode}
					class="w-full bg-black/40 border border-primary/30 text-primary text-sm rounded-sm px-2 py-1"
				>
					<option value="multi">Multi-Seed</option>
					<option value="single">Single Orbit</option>
				</select>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="seeds" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Density (seeds)</label
					>
					<span class="font-mono text-accent">{seeds}</span>
				</div>
				<input
					id="seeds"
					type="range"
					bind:value={seeds}
					min="1"
					max="1500"
					step="1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
				/>
			</div>
			<div class="space-y-2">
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
					min="0.5"
					max="6"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
				/>
			</div>
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
					<option value="iteration">Iteration</option>
					<option value="single">Single</option>
					<option value="seed">Seed</option>
					<option value="radius">Radius</option>
				</select>
			</div>
			<div class="space-y-2">
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
					min="0"
					max="1"
					step="0.05"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
				/>
			</div>
		</div>
	</div>

	<GumowskiMiraRenderer
		bind:containerElement={rendererContainer}
		bind:mu
		bind:a
		bind:b
		bind:x0
		bind:y0
		bind:iterations
		bind:burnIn
		bind:renderMode
		bind:seeds
		bind:colorMode
		bind:pointSize
		bind:opacity
		height={VIZ_CONTAINER_HEIGHT}
	/>

	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: GUMOWSKI–MIRA_MAP
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Gumowski–Mira map is a two-dimensional discrete nonlinear system studied for its rich
			transitions between order and chaos. The parameter μ (mu) controls the shape of the Gumowski
			function g(x): negative values produce smooth invariant curves, values near zero create
			KAM-island chains where regular orbits coexist with chaotic layers, and larger positive values
			fill phase space with a chaotic sea. The damping coefficient a governs how far orbits spread,
			while b shapes the nonlinear term. Unlike continuous attractors such as Lorenz or Rössler,
			this map advances in discrete steps, making it a cousin of the Hénon, Ikeda, and Chaos
			Esthetique modules — but with a uniquely broad spectrum of visually distinct behaviors.
		</p>
	</div>
</div>

<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="gumowski-mira"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="gumowski-mira"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
```

- [ ] **Step 2: Add the homepage card**

In `src/routes/+page.svelte`, add a new entry to the `visualizations` array (after the Clifford entry):

```typescript
		{
			name: 'Gumowski–Mira Map',
			description: 'A nonlinear map with rich transitions between order, islands, and chaos',
			url: '/gumowski-mira',
			color: 'from-fuchsia-500 to-pink-600'
		},
```

- [ ] **Step 3: Run typecheck and lint**

Run: `bun run check && bun run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/gumowski-mira/+page.svelte src/routes/+page.svelte
git commit -m "feat: add gumowski-mira route and homepage card (HPA-65)"
```

---

## Task 8: Database Migration

**Files:**

- Create: `drizzle/0010_add_gumowski_mira_map_type.sql`

- [ ] **Step 1: Create the migration**

Create `drizzle/0010_add_gumowski_mira_map_type.sql`:

```sql
-- Add the gumowski-mira map type to both configuration table constraints
-- (positioned after chaos-esthetique to match VALID_MAP_TYPES order)

-- Update saved_configurations constraint with all 16 map types
ALTER TABLE "saved_configurations"
DROP CONSTRAINT IF EXISTS "check_valid_map_type";

ALTER TABLE "saved_configurations"
ADD CONSTRAINT "check_valid_map_type"
CHECK ("map_type" IN (
    'lorenz',
    'rossler',
    'henon',
    'lozi',
    'ikeda',
    'clifford',
    'logistic',
    'newton',
    'standard',
    'bifurcation-logistic',
    'bifurcation-henon',
    'chaos-esthetique',
    'gumowski-mira',
    'lyapunov',
    'chua',
    'double-pendulum'
));

-- Update shared_configurations constraint with all 16 map types
ALTER TABLE "shared_configurations"
DROP CONSTRAINT IF EXISTS "chk_shared_configurations_map_type";

ALTER TABLE "shared_configurations"
ADD CONSTRAINT "chk_shared_configurations_map_type"
CHECK ("map_type" IN (
    'lorenz',
    'rossler',
    'henon',
    'lozi',
    'ikeda',
    'clifford',
    'logistic',
    'newton',
    'standard',
    'bifurcation-logistic',
    'bifurcation-henon',
    'chaos-esthetique',
    'gumowski-mira',
    'lyapunov',
    'chua',
    'double-pendulum'
));
```

- [ ] **Step 2: Verify the schema test still passes**

The schema test (`drizzle/schema.test.ts`) asserts the migration list matches `VALID_MAP_TYPES`. Run:

Run: `bun run vitest run drizzle/schema.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add drizzle/0010_add_gumowski_mira_map_type.sql
git commit -m "feat: add gumowski-mira map type database migration (HPA-65)"
```

---

## Task 9: Compare Page

**Files:**

- Create: `src/routes/gumowski-mira/compare/+page.svelte`

**Interfaces:**

- Consumes: `GumowskiMiraRenderer` (Task 6), `decodeComparisonState`/`getDefaultParameters`/`encodeComparisonState` (Task 5), `getStableRanges` (Task 1), `ComparisonLayout` + `ComparisonParameterPanel` (existing shared components).

- [ ] **Step 1: Create the compare page**

Create `src/routes/gumowski-mira/compare/+page.svelte`. This mirrors `src/routes/ikeda/compare/+page.svelte` exactly in structure — two panels with math parameter controls and shared styling. The complete file:

```svelte
<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import GumowskiMiraRenderer from '$lib/components/visualizations/GumowskiMiraRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges } from '$lib/chaos-validation';
	import type { GumowskiMiraParameters, GumowskiMiraRenderMode } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'gumowski-mira');
	const defaultParams = getDefaultParameters('gumowski-mira') as GumowskiMiraParameters;
	const ranges = getStableRanges('gumowski-mira')!;

	const clampValue = (value: number, min: number, max: number, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	const clampParams = (params?: GumowskiMiraParameters | null): GumowskiMiraParameters => {
		const source = params ?? defaultParams;
		return {
			type: 'gumowski-mira',
			mu: clampValue(source.mu, ranges.mu.min, ranges.mu.max, defaultParams.mu),
			a: clampValue(source.a, ranges.a.min, ranges.a.max, defaultParams.a),
			b: clampValue(source.b, ranges.b.min, ranges.b.max, defaultParams.b),
			x0: clampValue(source.x0, ranges.x0.min, ranges.x0.max, defaultParams.x0),
			y0: clampValue(source.y0, ranges.y0.min, ranges.y0.max, defaultParams.y0),
			iterations: clampValue(
				source.iterations,
				ranges.iterations.min,
				ranges.iterations.max,
				defaultParams.iterations
			),
			burnIn: clampValue(source.burnIn, ranges.burnIn.min, ranges.burnIn.max, defaultParams.burnIn),
			renderMode: source.renderMode ?? defaultParams.renderMode,
			seeds: source.seeds ?? defaultParams.seeds,
			colorMode: source.colorMode ?? defaultParams.colorMode,
			pointSize: source.pointSize ?? defaultParams.pointSize,
			opacity: source.opacity ?? defaultParams.opacity
		};
	};

	const leftInitial = clampParams(initialState?.left as GumowskiMiraParameters | null);
	const rightInitial = clampParams(initialState?.right as GumowskiMiraParameters | null);

	let leftMu = $state(leftInitial.mu);
	let leftA = $state(leftInitial.a);
	let leftB = $state(leftInitial.b);
	let leftX0 = $state(leftInitial.x0);
	let leftY0 = $state(leftInitial.y0);
	let leftIterations = $state(leftInitial.iterations);
	let leftBurnIn = $state(leftInitial.burnIn);
	let leftRenderMode = $state<GumowskiMiraRenderMode>(leftInitial.renderMode ?? 'multi');

	let rightMu = $state(rightInitial.mu);
	let rightA = $state(rightInitial.a);
	let rightB = $state(rightInitial.b);
	let rightX0 = $state(rightInitial.x0);
	let rightY0 = $state(rightInitial.y0);
	let rightIterations = $state(rightInitial.iterations);
	let rightBurnIn = $state(rightInitial.burnIn);
	let rightRenderMode = $state<GumowskiMiraRenderMode>(rightInitial.renderMode ?? 'multi');

	const seeds = leftInitial.seeds ?? defaultParams.seeds!;
	const colorMode = leftInitial.colorMode ?? defaultParams.colorMode!;
	const pointSize = leftInitial.pointSize ?? defaultParams.pointSize!;
	const opacity = leftInitial.opacity ?? defaultParams.opacity!;

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftMu;
		void leftA;
		void leftB;
		void leftX0;
		void leftY0;
		void leftIterations;
		void leftBurnIn;
		void leftRenderMode;
		void rightMu;
		void rightA;
		void rightB;
		void rightX0;
		void rightY0;
		void rightIterations;
		void rightBurnIn;
		void rightRenderMode;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: getLeftParams(),
				right: getRightParams()
			};
			goto(`${base}/gumowski-mira/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): GumowskiMiraParameters {
		return {
			type: 'gumowski-mira',
			mu: leftMu,
			a: leftA,
			b: leftB,
			x0: leftX0,
			y0: leftY0,
			iterations: leftIterations,
			burnIn: leftBurnIn,
			renderMode: leftRenderMode,
			seeds,
			colorMode,
			pointSize,
			opacity
		};
	}
	function getRightParams(): GumowskiMiraParameters {
		return {
			type: 'gumowski-mira',
			mu: rightMu,
			a: rightA,
			b: rightB,
			x0: rightX0,
			y0: rightY0,
			iterations: rightIterations,
			burnIn: rightBurnIn,
			renderMode: rightRenderMode,
			seeds,
			colorMode,
			pointSize,
			opacity
		};
	}

	function handleLeftParamsChange(p: GumowskiMiraParameters) {
		leftMu = p.mu;
		leftA = p.a;
		leftB = p.b;
		leftX0 = p.x0;
		leftY0 = p.y0;
		leftIterations = p.iterations;
		leftBurnIn = p.burnIn;
		leftRenderMode = p.renderMode ?? leftRenderMode;
	}
	function handleRightParamsChange(p: GumowskiMiraParameters) {
		rightMu = p.mu;
		rightA = p.a;
		rightB = p.b;
		rightX0 = p.x0;
		rightY0 = p.y0;
		rightIterations = p.iterations;
		rightBurnIn = p.burnIn;
		rightRenderMode = p.renderMode ?? rightRenderMode;
	}
</script>

<ComparisonLayout
	mapType="gumowski-mira"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as GumowskiMiraParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as GumowskiMiraParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-mu"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">mu</label
							>
							<span class="font-mono text-accent text-sm">{leftMu.toFixed(3)}</span>
						</div>
						<input
							id="left-mu"
							type="range"
							bind:value={leftMu}
							min="-1"
							max="1"
							step="0.001"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-a"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">a</label
								>
								<span class="font-mono text-accent text-sm">{leftA.toFixed(4)}</span>
							</div>
							<input
								id="left-a"
								type="range"
								bind:value={leftA}
								min="0"
								max="1"
								step="0.0001"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-b"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">b</label
								>
								<span class="font-mono text-accent text-sm">{leftB.toFixed(4)}</span>
							</div>
							<input
								id="left-b"
								type="range"
								bind:value={leftB}
								min="0"
								max="0.5"
								step="0.001"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div
						class="grid grid-cols-2 gap-3"
						class:opacity-40={leftRenderMode === 'multi'}
						class:pointer-events-none={leftRenderMode === 'multi'}
					>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-x0"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">x0</label
								>
								<span class="font-mono text-accent text-sm">{leftX0.toFixed(2)}</span>
							</div>
							<input
								id="left-x0"
								type="range"
								bind:value={leftX0}
								disabled={leftRenderMode === 'multi'}
								min="-20"
								max="20"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-y0"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">y0</label
								>
								<span class="font-mono text-accent text-sm">{leftY0.toFixed(2)}</span>
							</div>
							<input
								id="left-y0"
								type="range"
								bind:value={leftY0}
								disabled={leftRenderMode === 'multi'}
								min="-20"
								max="20"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
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
								min="100"
								max="100000"
								step="500"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-burnIn"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">Burn-in</label
								>
								<span class="font-mono text-accent text-sm">{leftBurnIn}</span>
							</div>
							<input
								id="left-burnIn"
								type="range"
								bind:value={leftBurnIn}
								min="0"
								max="5000"
								step="50"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="space-y-1">
						<label
							for="left-renderMode"
							class="text-primary/80 text-xs uppercase tracking-widest font-bold">Render Mode</label
						>
						<select
							id="left-renderMode"
							bind:value={leftRenderMode}
							class="w-full bg-black/40 border border-primary/30 text-primary text-sm rounded-sm px-2 py-1"
						>
							<option value="multi">Multi-Seed</option>
							<option value="single">Single Orbit</option>
						</select>
					</div>
				</div>
				{#snippet equations()}
					<p>g(x) = μx + 2(1−μ)x²/(1+x²)</p>
					<p>x' = y + a(1−by²)y + g(x)</p>
					<p>y' = −x + g(x')</p>
				{/snippet}
			</ComparisonParameterPanel>
			<GumowskiMiraRenderer
				bind:mu={leftMu}
				bind:a={leftA}
				bind:b={leftB}
				bind:x0={leftX0}
				bind:y0={leftY0}
				bind:iterations={leftIterations}
				bind:burnIn={leftBurnIn}
				bind:renderMode={leftRenderMode}
				{seeds}
				{colorMode}
				{pointSize}
				{opacity}
				height={400}
			/>
		</div>
	{/snippet}

	{#snippet rightPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="RIGHT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-mu"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">mu</label
							>
							<span class="font-mono text-accent text-sm">{rightMu.toFixed(3)}</span>
						</div>
						<input
							id="right-mu"
							type="range"
							bind:value={rightMu}
							min="-1"
							max="1"
							step="0.001"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-a"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">a</label
								>
								<span class="font-mono text-accent text-sm">{rightA.toFixed(4)}</span>
							</div>
							<input
								id="right-a"
								type="range"
								bind:value={rightA}
								min="0"
								max="1"
								step="0.0001"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-b"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">b</label
								>
								<span class="font-mono text-accent text-sm">{rightB.toFixed(4)}</span>
							</div>
							<input
								id="right-b"
								type="range"
								bind:value={rightB}
								min="0"
								max="0.5"
								step="0.001"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div
						class="grid grid-cols-2 gap-3"
						class:opacity-40={rightRenderMode === 'multi'}
						class:pointer-events-none={rightRenderMode === 'multi'}
					>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-x0"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">x0</label
								>
								<span class="font-mono text-accent text-sm">{rightX0.toFixed(2)}</span>
							</div>
							<input
								id="right-x0"
								type="range"
								bind:value={rightX0}
								disabled={rightRenderMode === 'multi'}
								min="-20"
								max="20"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-y0"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">y0</label
								>
								<span class="font-mono text-accent text-sm">{rightY0.toFixed(2)}</span>
							</div>
							<input
								id="right-y0"
								type="range"
								bind:value={rightY0}
								disabled={rightRenderMode === 'multi'}
								min="-20"
								max="20"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
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
								min="100"
								max="100000"
								step="500"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-burnIn"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">Burn-in</label
								>
								<span class="font-mono text-accent text-sm">{rightBurnIn}</span>
							</div>
							<input
								id="right-burnIn"
								type="range"
								bind:value={rightBurnIn}
								min="0"
								max="5000"
								step="50"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="space-y-1">
						<label
							for="right-renderMode"
							class="text-primary/80 text-xs uppercase tracking-widest font-bold">Render Mode</label
						>
						<select
							id="right-renderMode"
							bind:value={rightRenderMode}
							class="w-full bg-black/40 border border-primary/30 text-primary text-sm rounded-sm px-2 py-1"
						>
							<option value="multi">Multi-Seed</option>
							<option value="single">Single Orbit</option>
						</select>
					</div>
				</div>
				{#snippet equations()}
					<p>g(x) = μx + 2(1−μ)x²/(1+x²)</p>
					<p>x' = y + a(1−by²)y + g(x)</p>
					<p>y' = −x + g(x')</p>
				{/snippet}
			</ComparisonParameterPanel>
			<GumowskiMiraRenderer
				bind:mu={rightMu}
				bind:a={rightA}
				bind:b={rightB}
				bind:x0={rightX0}
				bind:y0={rightY0}
				bind:iterations={rightIterations}
				bind:burnIn={rightBurnIn}
				bind:renderMode={rightRenderMode}
				{seeds}
				{colorMode}
				{pointSize}
				{opacity}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
```

- [ ] **Step 2: Run typecheck**

Run: `bun run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/routes/gumowski-mira/compare/+page.svelte
git commit -m "feat: add gumowski-mira compare page (HPA-65)"
```

---

## Task 10: Integration Tests

**Files:**

- Create: `src/routes/gumowski-mira-config-loading.svelte.test.ts`
- Create: `src/routes/gumowski-mira-page-interactions.svelte.test.ts`
- Create: `src/routes/gumowski-mira-compare-interactions.svelte.test.ts`

These tests follow the established patterns in the existing `ikeda-config-loading.svelte.test.ts`, `ikeda-page-interactions.svelte.test.ts`, and `clifford-compare-interactions.svelte.test.ts` files. Reference those files for the exact test harness setup (mock worker, mock fetch, Svelte component mounting via `@testing-library/svelte`).

- [ ] **Step 1: Read an existing config-loading test for the harness pattern**

Read `src/routes/ikeda-config-loading.svelte.test.ts` to understand the test setup: how the worker is mocked, how `$app/stores` and `$app/paths` are mocked, and how config URL params are tested. Use this as the template.

- [ ] **Step 2: Write the config-loading test**

Create `src/routes/gumowski-mira-config-loading.svelte.test.ts`. Mirror the ikeda config-loading test but substitute `'gumowski-mira'` for `'ikeda'` and use gumowski-mira parameter names (`mu`, `a`, `b`, `x0`, `y0`, `iterations`, `burnIn`). Key test cases:

- Valid `?config=` URL param loads parameters correctly
- Invalid JSON in config param shows error alert
- Missing required fields in config param shows validation error
- Empty config param handled gracefully

Follow the exact import/setup/mock structure from `ikeda-config-loading.svelte.test.ts`.

- [ ] **Step 3: Write the page-interactions test**

Create `src/routes/gumowski-mira-page-interactions.svelte.test.ts`. Mirror `ikeda-page-interactions.svelte.test.ts`. Key test cases:

- Page renders with title `GUMOWSKI–MIRA_MAP`
- Default preset label (`ISLAND STRUCTURE`) shows in active-preset indicator
- Clicking a preset button updates the active preset
- Sliders for `mu`, `a`, `b` exist and update values
- Reset button restores defaults
- Randomize button changes parameter values
- Compare/Share/Save/Return buttons are present
- Render mode select toggles between multi/single

- [ ] **Step 4: Write the compare-interactions test**

Create `src/routes/gumowski-mira-compare-interactions.svelte.test.ts`. Mirror `clifford-compare-interactions.svelte.test.ts`. Key test cases:

- Compare page renders two renderer panels
- Left and right parameter panels are present
- Sliders in left panel are independent from right panel

- [ ] **Step 5: Run the full test suite**

Run: `bun run test`
Expected: PASS — all existing tests still pass, new tests pass.

- [ ] **Step 6: Run lint and typecheck**

Run: `bun run check && bun run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/routes/gumowski-mira-config-loading.svelte.test.ts src/routes/gumowski-mira-page-interactions.svelte.test.ts src/routes/gumowski-mira-compare-interactions.svelte.test.ts
git commit -m "test: add gumowski-mira integration tests (HPA-65)"
```

---

## Final Verification

- [ ] **Step 1: Run the complete suite**

```bash
bun run check && bun run lint && bun run test
```

Expected: all green.

- [ ] **Step 2: Manual smoke test (dev server)**

```bash
bun run dev
```

Open `http://localhost:5173/gumowski-mira` and verify:

- Default render shows island structure
- Sliders update the visualization
- Each preset produces a visually distinct result
- Reset and Randomize work
- Compare link navigates to the compare page
- No console errors

- [ ] **Step 3: Verify the homepage card links correctly**

Open `http://localhost:5173/` and confirm the Gumowski–Mira Map card appears and links to `/gumowski-mira`.
