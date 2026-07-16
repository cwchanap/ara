# Arnold Cat Map Visualization Module

**Linear Issue:** [HPA-62](https://linear.app/cwchanap/issue/HPA-62/add-arnold-cat-map-visualization-module)
**PRD:** [Additional Chaotic Map Visualizations](https://linear.app/cwchanap/document/prd-additional-chaotic-map-visualizations-1a69b476e276)
**Date:** 2026-07-15

## Summary

Implement **Arnold Cat Map** as a new chaotic map visualization module at `/arnold-cat`. Architecture mirrors **Baker's Map** (HPA-63): an animated **random point-cloud** on the unit square/torus, colored by initial position, with pause / step / reset / randomize controls. The map itself is the classic fixed area-preserving torus map (no image-scramble mode, no generalized matrix parameters in v1).

### Mathematical Definition

On the unit torus `[0,1)²`:

```text
Γ(x, y) = (x + y  mod 1,  x + 2y  mod 1)
```

Matrix form (determinant 1 → area-preserving / measure-preserving):

```text
[x'] = [1 1] [x]   (mod 1)
[y']   [1 2] [y]
```

Each application shears the plane then wraps via modular identification (torus topology). Nearby points diverge exponentially; density of a uniform sample remains uniform. Points colored by **initial** y-position make the stretch-and-fold dynamics visible as colors shear and mix.

### Product decisions (v1)

| Decision | Choice |
|----------|--------|
| Visualization mode | Random point cloud (not image scramble, not lattice) |
| Map parameters | Classic fixed Γ only (not generalized `k` / `a,b`) |
| Animation controls | Baker-style: `pointCount`, `speed`, pause, step, reset, randomize |
| Persisted params | `pointCount`, `speed` only |
| Auto-reset cycle | **None** (unlike Baker's binary-collapse auto-reset; mod-1 keeps points on the torus) |

### Explicit non-goals (v1)

- Image scramble / discrete `N×N` pixel mode
- Generalized Cat Map parameters
- Recurrence detection UI
- Silent auto-reset after a max iteration count

## Files

### New files

| File | Purpose |
|------|---------|
| `src/routes/arnold-cat/+page.svelte` | Route page with `VisualizationShell` and page-managed controls |
| `src/routes/arnold-cat/compare/+page.svelte` | Side-by-side comparison route |
| `src/lib/components/visualizations/ArnoldCatRenderer.svelte` | Canvas-based animated renderer |
| `src/lib/components/visualizations/ArnoldCatRenderer.svelte.test.ts` | Renderer unit tests |
| `drizzle/0013_add_arnold_cat_map_type.sql` | DB migration: add `'arnold-cat'` to both CHECK constraints |

### Modified files

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `ArnoldCatParameters`; register in `ChaosMapType`, `ChaosMapParameters`, `CHAOS_MAP_DISPLAY_NAMES`, `VALID_MAP_TYPES`, `SavedConfiguration` |
| `src/lib/chaos-validation.ts` | Add `'arnold-cat'` entry in `STABLE_RANGES` |
| `src/lib/comparison-url-state.ts` | Add `'arnold-cat'` case in exhaustive `getDefaultParameters` switch |
| `src/routes/+page.svelte` | Add homepage card |
| `drizzle/meta/_journal.json` | Add entry `{ idx: 13, tag: '0013_add_arnold_cat_map_type' }` |
| `src/lib/server/db/schema.test.ts` | Update journal test tag from `0012` to `0013` |
| `src/lib/types.test.ts` (and any exhaustive map-type lists) | Expect `'arnold-cat'` |

## Design

### Type System Integration (`src/lib/types.ts`)

New parameter interface:

```typescript
export interface ArnoldCatParameters {
	type: 'arnold-cat';
	pointCount: number; // number of points (capped at 10,000)
	speed: number; // Cat Map steps per animation frame (1–10)
}
```

Registered in:

- `ChaosMapType` union: add `'arnold-cat'`
- `ChaosMapParameters` union: add `ArnoldCatParameters`
- `CHAOS_MAP_DISPLAY_NAMES`: add `'arnold-cat': 'ARNOLD_CAT_MAP'`
- `VALID_MAP_TYPES`: add `'arnold-cat'`
- `SavedConfiguration`: add discriminated union arm `{ mapType: 'arnold-cat'; parameters: ArnoldCatParameters }`

### Validation Integration (`src/lib/chaos-validation.ts`)

New entry in `STABLE_RANGES`:

```typescript
'arnold-cat': {
	pointCount: { min: 100, max: 10000 },
	speed: { min: 1, max: 10 }
}
```

No `OPTIONAL_FIELDS` entry — both persisted fields are core range fields.

Classic Cat Map on the unit torus is always mathematically well-behaved for finite inputs in range, so no dedicated `checkParameterStability` case is required. The generic range check handles validation.

**Boundary clamping (critical):** `validateParameters` only checks for finite numeric values — it does not clamp or reject out-of-range values (that's `checkParameterStability`'s job, which produces debounced warnings, not synchronous rejection). A loaded/shared/comparison config could therefore set `speed` or `pointCount` to extreme values. Both must be clamped to their declared ranges at every boundary:

- In `onExtraParametersLoaded`: clamp loaded values before assigning to `$state`
- In the renderer's RAF loop: clamp `speed` to `[1, 10]` and `pointCount` to `[100, 10000]` defensively
- In `getDefaultParameters` (comparison-url-state.ts): defaults are already in range

### Comparison URL State (`src/lib/comparison-url-state.ts`)

The `getDefaultParameters` function has an exhaustive `switch(mapType)` with no default — adding `'arnold-cat'` to `ChaosMapType` without a case is a compile error. Additionally, `createComparisonStateFromCurrent` calls it on every page mount via the shell's `$derived` `comparisonUrl`, so a missing case would crash at runtime.

New case:

```typescript
case 'arnold-cat':
	return { type: 'arnold-cat', pointCount: 3000, speed: 1 };
```

### DB Migration (`drizzle/0013_add_arnold_cat_map_type.sql`)

Mirror the `0012_add_bakers_map_map_type.sql` pattern: drop and re-add both CHECK constraints (`check_valid_map_type` on `saved_configurations`, `chk_shared_configurations_map_type` on `shared_configurations`) listing all **19** map types (existing 18 plus `'arnold-cat'`), wrapped in `BEGIN`/`COMMIT`. Without this, runtime Save/Share fails with a CHECK violation and `schema.test.ts` fails (it asserts the latest migration's constraint list matches `VALID_MAP_TYPES` exactly).

Add the journal entry to `drizzle/meta/_journal.json` manually (`{ idx: 13, when: <timestamp>, tag: '0013_add_arnold_cat_map_type', breakpoints: true }`). **Do NOT run `drizzle-kit generate`** — the metadata snapshots stop at `0002_snapshot.json`; migrations `0003`–`0012` are manual SQL + journal entries only. Running `drizzle-kit generate` against the stale snapshot chain would create an unrelated or additional migration. Mirror `0012` exactly: SQL file + journal entry, no snapshot.

Update `schema.test.ts` journal tag from `'0012_add_bakers_map_map_type'` to `'0013_add_arnold_cat_map_type'` and `idx` from `12` to `13`.

### Renderer (`src/lib/components/visualizations/ArnoldCatRenderer.svelte`)

A canvas-based animated component, architecturally parallel to `BakersMapRenderer.svelte`.

**Data structures (preallocated, no per-frame allocations):**

- `Float64Array` for current x-coordinates (length = `pointCount`)
- `Float64Array` for current y-coordinates (length = `pointCount`)
- `Float64Array` for initial x-coordinates (length = `pointCount`) — used by reset
- `Float64Array` for initial y-coordinates (length = `pointCount`) — used for color and reset
- `pointColors: string[]` — precomputed at init/randomize from initial y

**Precision / iteration policy:**

Unlike Baker's Map (which left-shifts binary digits of `x` and collapses after ~52 iterations in Float64), Arnold Cat Map uses modular arithmetic and keeps points on the torus indefinitely. **Do not implement a silent auto-reset cycle.** The iteration counter increments without wrapping; the user uses **Reset** or **Randomize** to restart the demo.

**Color interpolation (precomputed at component scope):**

```typescript
import * as d3 from 'd3';
import { COLOR_PRIMARY, COLOR_MAGENTA } from '$lib/constants';

const interpCyanMagenta = d3.interpolate(COLOR_PRIMARY, COLOR_MAGENTA);
```

At init/randomize: `pointColors[i] = interpCyanMagenta(initialY[i])`. Colors are fixed for the lifetime of a distribution so material identity is preserved while positions mix.

**Arnold Cat Map step:**

```typescript
function applyArnoldCat(x: number, y: number): [number, number] {
	// Inputs stay in [0,1) for classic forward orbit from uniform samples
	const nx = (x + y) % 1;
	const ny = (x + 2 * y) % 1;
	return [nx, ny];
}
```

**Animation loop (`requestAnimationFrame`):**

- Each frame applies `clampInt(speed, 1, 10)` Cat Map steps to all points when not paused
- Renders all points with `ctx.fillRect(px, py, 1, 1)` where `px = x * canvasWidth` and `py = (1 - y) * canvasHeight`
- `paused` freezes stepping; idle RAF may still redraw if needed, but must not advance iteration
- Iteration label via direct `textContent` updates (not `$state`), throttled to ~100ms

```typescript
let iterationLabel: HTMLDivElement;
let lastLabelUpdate = 0;
// Inside RAF loop:
if (timestamp - lastLabelUpdate > 100) {
	iterationLabel.textContent = `ITERATION: ${iterationCount}`;
	lastLabelUpdate = timestamp;
}
```

Static badge: `LIVE_RENDER // CANVAS_2D` (alongside the dynamic iteration label).

**Canvas layout:**

- Unit square `[0,1]×[0,1]` mapped to full canvas pixel area (y-axis flipped so 0 is bottom)
- Sci-fi frame: corner-friendly container classes matching Baker / bifurcation renderers
- Dark background (`bg-black/40`)

**Props:**

All page-to-renderer communication uses bindable props + signal counters — no `bind:this` imperative methods.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `height` | `number` | `600` (`VIZ_CONTAINER_HEIGHT` from `$lib/constants`) | Canvas height |
| `containerElement` | `HTMLDivElement` (bindable) | — | For `VisualizationShell` snapshot binding |
| `pointCount` | `number` (bindable) | `3000` | Changing reinitializes arrays + distribution |
| `speed` | `number` (bindable) | `1` | Steps per animation frame |
| `paused` | `boolean` (bindable) | `false` | Animation pause/resume |
| `resetSignal` | `number` | `0` | Increment to restore initial positions |
| `randomizeSignal` | `number` | `0` | Increment to new random distribution |
| `stepSignal` | `number` | `0` | Increment to apply exactly one map step |

The renderer watches `resetSignal`, `randomizeSignal`, and `stepSignal` via `$effect`. **Critical:** Svelte 5 `$effect` fires once during component initialization, so each signal effect must track its previous value and skip the initial execution:

```typescript
let prevReset = resetSignal;
$effect(() => {
	if (resetSignal === prevReset) return; // skip initial run
	prevReset = resetSignal;
	doReset();
});
```

Apply the same prev-value guard to `randomizeSignal` and `stepSignal`. Tests must verify the initial iteration count is 0 (no spurious step on mount).

**Initial distribution:** Uniform random points in `[0,1)²`. Incrementing `randomizeSignal` generates a new random set.

**Performance guards:**

- Cap point count at 10,000
- `Float64Array` for all point data (no array allocations in the animation loop)
- Single `ctx.fillRect` per point per frame
- Cleanup: cancel `requestAnimationFrame` on unmount; set unmounted flag so late RAF callbacks no-op
- `ResizeObserver` on container for responsive canvas sizing

**Reactive behavior:**

- When `pointCount` changes: reinitialize arrays and distribution, reset iteration count
- When `speed` changes: takes effect on next animation frame (no reinitialization)
- When `resetSignal` changes: copy initial → current, reset iteration count
- When `randomizeSignal` changes: new random initial + current, reset iteration count
- When `stepSignal` changes: apply one Cat Map step, increment iteration count

### Route Page (`src/routes/arnold-cat/+page.svelte`)

Uses `VisualizationShell` with page-managed sliders (same pattern as Baker's Map / Tinkerbell / Clifford).

**Shell configuration:**

- `mapType`: `'arnold-cat'`
- `title`: `'ARNOLD_CAT_MAP'`
- `paramDefs`: `[]` (all controls are page-owned, rendered in `extraControls`)
- `paramColumns`: `1`
- `stabilityReporter`: Registered via `createStabilityReporter({ mapType: 'arnold-cat', getParams: () => buildParameters(), reactive: true })`
- `formula`: `["x' = (x + y) mod 1", "y' = (x + 2y) mod 1"]`
- `formulaColumns`: `2`
- `description`: `{ heading: 'DATA_LOG: ARNOLD_CAT_MAP', body: 'Arnold\'s Cat Map is an area-preserving linear map on the unit torus. Each step shears the square via the matrix [[1,1],[1,2]] (determinant 1) and wraps coordinates mod 1. The map stretches and folds phase space so nearby points diverge exponentially while overall density stays uniform — the same stretch-and-fold mechanism that classically scrambles images. Points here are colored by their initial height so the shearing and mixing remain visible as iterations proceed.' }` (must be `{ heading: string; body: string }` per `VisualizationShell` Props)
- `isAuthenticated`: `!!data?.session`

**Page-owned `$state`:**

| State | Type | Default | Range |
|-------|------|---------|-------|
| `pointCount` | `number` | `3000` | 100–10,000 (step 100) |
| `speed` | `number` | `1` | 1–10 (step 1) |
| `paused` | `boolean` | `false` | — |
| `resetSignal` | `number` | `0` | increment to trigger |
| `randomizeSignal` | `number` | `0` | increment to trigger |
| `stepSignal` | `number` | `0` | increment to trigger |

**Controls (in `extraControls` snippet):**

| Control | Element | Action |
|---------|---------|--------|
| Point Count | Range slider | Bind `pointCount` |
| Speed | Range slider | Bind `speed` |
| Pause/Resume | Button | Toggle `paused` |
| Step | Button | `stepSignal++` (only enabled when `paused`) |
| Reset | Button | `resetSignal++` |
| Randomize | Button | `randomizeSignal++` |

**`buildParameters()`:**

```typescript
function buildParameters(): ArnoldCatParameters {
	return { type: 'arnold-cat', pointCount, speed };
}
```

**`onExtraParametersLoaded(p)`:** Restores `pointCount` and `speed` from saved/shared configs, **clamped** to `[100, 10000]` and `[1, 10]` respectively. Animation state (`paused`, iteration count, signal counters) is session-local — not persisted (same approach as Baker's Map and Double Pendulum optional fields).

**Session/auth:** `data.session` from root layout's `+layout.server.ts`. No separate `+page.server.ts` needed.

### Compare Route (`src/routes/arnold-cat/compare/+page.svelte`)

Every map's `VisualizationShell` renders a Compare button linking to `/{mapType}/compare`. Follow the established compare page pattern (see `src/routes/bakers-map/compare/+page.svelte` and `src/routes/tinkerbell/compare/+page.svelte`): two side-by-side `ArnoldCatRenderer` instances with their own parameter panels, URL state via `decodeComparisonState` / `encodeComparisonState`, left/right `pointCount` and `speed` sliders, debounced URL sync.

### Homepage Card (`src/routes/+page.svelte`)

Add to `visualizations` array. Color distinct from Baker's `from-yellow-500 to-amber-600` and Chua's `from-red-500 to-amber-600`:

```javascript
{
	name: 'Arnold Cat Map',
	description:
		'An area-preserving map that scrambles images through stretch-and-fold dynamics',
	url: '/arnold-cat',
	color: 'from-rose-500 to-orange-500'
}
```

CTA styling follows existing cards (`Initialize Module` pattern already on the home page).

### Tests (`src/lib/components/visualizations/ArnoldCatRenderer.svelte.test.ts`)

Following the repo's testing conventions (Vitest + jsdom for `.svelte.test.ts` files):

- **Mount/unmount**: component mounts without errors; canvas element is created
- **RAF cleanup**: `cancelAnimationFrame` is called on unmount (no leaked frames)
- **Signal props**: incrementing `resetSignal`, `randomizeSignal`, `stepSignal` triggers the corresponding behavior
- **Signal init skip**: initial mount does NOT trigger reset/randomize/step — iteration count starts at 0
- **pointCount resize**: changing `pointCount` reinitializes arrays without errors
- **paused state**: when `paused=true`, RAF loop does not advance iteration count
- **No auto-reset test** (unlike Baker's Map — Cat Map has no silent `MAX_ITERATIONS` reseed)

Additionally:

- `schema.test.ts` must pass after migration + journal updates (latest constraint-bearing migration is `0013`)
- `types.test.ts` / comparison-url-state tests must include `'arnold-cat'`
- `bun run check` must pass (exhaustive switches)

No new Playwright e2e is required for v1 unless a later pass wants home-card or route smoke coverage.

### Error handling

| Concern | Handling |
|---------|----------|
| Out-of-range loaded/shared params | Clamp in `onExtraParametersLoaded` + defensive RAF clamp |
| Invalid config payload | Existing `useConfigLoader` / `validateParameters` |
| Stability warnings | `createStabilityReporter` + shell alert (range only) |
| Renderer failure | `VisualizationErrorBoundary` via shell |
| Leaked animation | `cancelAnimationFrame` + unmounted flag |
| Save/Share DB CHECK | Migration adds `'arnold-cat'` to both constraints |

## Acceptance Criteria

(from Linear issue HPA-62, plus project norms)

- [ ] The homepage includes an Arnold Cat Map card linking to `/arnold-cat`.
- [ ] `/arnold-cat` renders without errors.
- [ ] The visualization clearly shows repeated stretching/shearing/wrapping over iterations.
- [ ] Iteration controls and reset work correctly (plus pause, step, randomize).
- [ ] The route includes short explanatory copy.
- [ ] The module remains usable on desktop and mobile.
- [ ] Compare button links to `/arnold-cat/compare` (not a 404).
- [ ] `bun run check` passes (no TS errors from exhaustive switch).
- [ ] `bun run test` passes (schema tests, renderer tests, type registration).
