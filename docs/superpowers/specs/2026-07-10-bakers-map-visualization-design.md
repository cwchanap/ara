# Baker's Map Visualization Module

**Linear Issue:** [HPA-63](https://linear.app/cwchanap/issue/HPA-63/add-bakers-map-visualization-module)
**PRD:** [Additional Chaotic Map Visualizations](https://linear.app/cwchanap/document/prd-additional-chaotic-map-visualizations-1a69b476e276)
**Date:** 2026-07-10

## Summary

Implement **Baker's Map** as a new chaotic map visualization module at `/bakers-map`. Unlike the existing maps that compute orbits and render static point clouds or fractals, Baker's Map is an **animated mixing demonstration** — it repeatedly stretches, cuts, and stacks the unit square `[0,1]x[0,1]`. Points are colored by their initial y-position; as iterations proceed, these colors interleave into progressively finer horizontal bands, making the mixing mechanism visible. The map is measure-preserving, so the point *density* remains uniform throughout — the "stripes" are a color/material mixing effect, not a density change.

### Mathematical Definition

The Baker's Map transforms a point `(x, y)` in the unit square:

```text
B(x, y) = (2x mod 1, (y + floor(2x)) / 2)
```

Each application:
1. **Stretch**: Double the x-coordinate horizontally.
2. **Cut**: When `x >= 0.5`, wrap it back (the "cut" at the midpoint).
3. **Stack**: Place the right half on top of the left half (adjust y accordingly).

After n iterations, points colored by their initial y-position interleave into progressively finer horizontal color bands — making the stretch/cut/stack mixing mechanism visually obvious. The underlying point density remains uniform (the map is measure-preserving); the visual mixing is a *color* effect, not a density change.

## Files

### New files

| File | Purpose |
|------|---------|
| `src/routes/bakers-map/+page.svelte` | Route page with `VisualizationShell` and page-managed controls |
| `src/routes/bakers-map/compare/+page.svelte` | Side-by-side comparison route (every map has one) |
| `src/lib/components/visualizations/BakersMapRenderer.svelte` | Canvas-based animated renderer |
| `src/lib/components/visualizations/BakersMapRenderer.svelte.test.ts` | Renderer unit tests (mount/unmount, RAF cleanup, signal props) |
| `drizzle/0012_add_bakers_map_map_type.sql` | DB migration: add `'bakers-map'` to both CHECK constraints |

### Modified files

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `BakersMapParameters` interface; register in `ChaosMapType`, `ChaosMapParameters`, `CHAOS_MAP_DISPLAY_NAMES`, `VALID_MAP_TYPES`, `SavedConfiguration` |
| `src/lib/chaos-validation.ts` | Add `'bakers-map'` entry in `STABLE_RANGES` |
| `src/lib/comparison-url-state.ts` | Add `'bakers-map'` case in exhaustive `getDefaultParameters` switch |
| `src/routes/+page.svelte` | Add homepage card |
| `drizzle/meta/_journal.json` | Add entry `{ idx: 12, tag: '0012_add_bakers_map_map_type' }` |
| `src/lib/server/db/schema.test.ts` | Update journal test tag from `0011` to `0012` |

## Design

### Type System Integration (`src/lib/types.ts`)

New parameter interface:

```typescript
export interface BakersMapParameters {
    type: 'bakers-map';
    pointCount: number;   // number of points (capped at 10,000)
    speed: number;         // Baker's Map steps per animation frame (1-10)
}
```

Registered in:
- `ChaosMapType` union: add `'bakers-map'`
- `ChaosMapParameters` union: add `BakersMapParameters`
- `CHAOS_MAP_DISPLAY_NAMES`: add `'bakers-map': 'BAKERS_MAP'`
- `VALID_MAP_TYPES`: add `'bakers-map'`
- `SavedConfiguration`: add discriminated union arm `{ mapType: 'bakers-map'; parameters: BakersMapParameters }`

### Validation Integration (`src/lib/chaos-validation.ts`)

New entry in `STABLE_RANGES`:

```typescript
'bakers-map': {
    pointCount: { min: 100, max: 10000 },
    speed: { min: 1, max: 10 }
}
```

No `OPTIONAL_FIELDS` entry needed — both persisted fields are core range fields.

Baker's Map on the unit square is always mathematically stable (points stay in `[0,1]^2` by definition), so no `checkParameterStability` case is needed. The generic range check handles validation.

**Boundary clamping (critical):** `validateParameters` only checks for finite numeric values — it does not clamp or reject out-of-range values (that's `checkParameterStability`'s job, which produces debounced warnings, not synchronous rejection). A loaded/shared/comparison config could therefore set `speed` to an enormous value, freezing the render loop before any warning appears. Both `speed` and `pointCount` must be clamped to their declared ranges at every boundary:

- In `onExtraParametersLoaded`: clamp loaded values before assigning to `$state`
- In the renderer's RAF loop: clamp `speed` to `[1, 10]` and `pointCount` to `[100, 10000]` as a defensive measure
- In `getDefaultParameters` (comparison-url-state.ts): defaults are already in range, no extra clamping needed

### Comparison URL State (`src/lib/comparison-url-state.ts`)

The `getDefaultParameters` function has an exhaustive `switch(mapType)` with no default — adding `'bakers-map'` to `ChaosMapType` without a case is a compile error. Additionally, `createComparisonStateFromCurrent` calls it on every page mount via the shell's `$derived` `comparisonUrl`, so a missing case would crash at runtime.

New case:

```typescript
case 'bakers-map':
    return { type: 'bakers-map', pointCount: 3000, speed: 1 };
```

### DB Migration (`drizzle/0012_add_bakers_map_map_type.sql`)

Mirror the `0011_add_tinkerbell_map_type.sql` pattern: drop and re-add both CHECK constraints (`check_valid_map_type` on `saved_configurations`, `chk_shared_configurations_map_type` on `shared_configurations`) listing all 18 map types, wrapped in `BEGIN`/`COMMIT`. Without this, runtime Save/Share fails with a CHECK violation and `schema.test.ts` fails (it asserts the latest migration's constraint list matches `VALID_MAP_TYPES` exactly).

Add the journal entry to `drizzle/meta/_journal.json` manually (`{ idx: 12, when: <timestamp>, tag: '0012_add_bakers_map_map_type', breakpoints: true }`). **Do NOT run `drizzle-kit generate`** — the metadata snapshots stop at `0002_snapshot.json`; migrations `0003`–`0011` are manual SQL + journal entries only. Running `drizzle-kit generate` against the stale snapshot chain would create an unrelated or additional migration. Mirror `0011` exactly: SQL file + journal entry, no snapshot.

Update `schema.test.ts:77` journal tag from `'0011_add_tinkerbell_map_type'` to `'0012_add_bakers_map_map_type'` and `idx` from `11` to `12`.

### Renderer (`src/lib/components/visualizations/BakersMapRenderer.svelte`)

A canvas-based animated component.

**Data structures (preallocated, no per-frame allocations):**

- `Float64Array` for current x-coordinates (length = `pointCount`)
- `Float64Array` for current y-coordinates (length = `pointCount`)
- `Float64Array` for initial x-coordinates (length = `pointCount`) — used by reset to restore original distribution
- `Float64Array` for initial y-coordinates (length = `pointCount`) — used for color gradient and by reset

**Precision management (critical):**

Each Baker's Map step left-shifts one binary digit out of `x` (doubles and truncates). With `Float32` (23-bit mantissa), every `x` collapses to zero after ~24 iterations. `Float64Array` (52-bit mantissa) extends this to ~52 iterations, but the collapse is still inevitable. The visualization must handle this:

- Use `Float64Array` for all point data (doubles the useful iteration horizon vs Float32)
- **Auto-reset cycle**: after a configurable number of iterations (`MAX_ITERATIONS`, default 50), the renderer automatically reseeds with a fresh random distribution and resets the iteration counter. This creates a continuous "mixing loop" that never hits the precision wall. The auto-reset is silent (no user-visible interruption) — the visual resets to a fresh uniform distribution and the mixing restarts.
- The iteration counter display shows the current cycle's iteration count (0 to `MAX_ITERATIONS`)

**Color interpolation (precomputed at component scope):**

Following the TinkerbellRenderer pattern (`TinkerbellRenderer.svelte:65`), precompute the interpolator once rather than per-point per-frame:

```typescript
import * as d3 from 'd3';
import { COLOR_PRIMARY, COLOR_MAGENTA } from '$lib/constants';

const interpCyanMagenta = d3.interpolate(COLOR_PRIMARY, COLOR_MAGENTA);
```

Then in the render loop: `ctx.fillStyle = interpCyanMagenta(initialY)`. No per-frame closure allocations.

**Animation loop (`requestAnimationFrame`):**

- Each frame applies `speed` Baker's Map steps to all points
- Renders all points to canvas using the precomputed `interpCyanMagenta(initialY)` — this makes the mixing visually obvious as colored stripes form
- `paused` flag controls whether the RAF loop applies steps or just idles
- Displays current iteration count via a separate DOM element's `textContent` (see below)

**Iteration overlay mechanism:**

Use a `<div>` ref whose `textContent` is updated directly inside the RAF loop (not via `$state`/`$effect`, which would be perf-hostile at animation framerates). Throttle to update at most every ~100ms to avoid layout thrash:

```typescript
let iterationLabel: HTMLDivElement;
let lastLabelUpdate = 0;
// Inside RAF loop:
if (timestamp - lastLabelUpdate > 100) {
    iterationLabel.textContent = `ITERATION: ${iterationCount}`;
    lastLabelUpdate = timestamp;
}
```

The existing `LIVE_RENDER // CANVAS_2D` badge is a static element alongside this.

**Canvas layout:**

- Unit square `[0,1]x[0,1]` mapped to the full canvas pixel area: `px = x * canvasWidth`, `py = (1 - y) * canvasHeight` (y-axis flipped so 0 is bottom)
- Sci-fi styled frame: corner borders, `LIVE_RENDER // CANVAS_2D` badge + dynamic iteration counter — consistent with `BifurcationLogisticRenderer` and `BifurcationHenonRenderer`
- Dark background (`bg-black/40`)

**Props:**

All page-to-renderer communication uses bindable props + signal counters — no `bind:this` imperative methods (no existing renderer in this codebase uses that pattern; signal props keep everything reactive and testable).

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `height` | `number` | `VIZ_CONTAINER_HEIGHT` | Canvas height |
| `containerElement` | `HTMLDivElement` (bindable) | — | For `VisualizationShell` snapshot binding |
| `pointCount` | `number` (bindable) | `3000` | Number of points; changing reinitializes arrays + distribution |
| `speed` | `number` (bindable) | `1` | Baker's Map steps per animation frame |
| `paused` | `boolean` (bindable) | `false` | Animation pause/resume |
| `resetSignal` | `number` | `0` | Increment to reset all points to initial positions |
| `randomizeSignal` | `number` | `0` | Increment to generate new random distribution + reset iteration |
| `stepSignal` | `number` | `0` | Increment to apply exactly one Baker's Map step |

The renderer watches `resetSignal`, `randomizeSignal`, and `stepSignal` via `$effect`. **Critical:** Svelte 5 `$effect` fires once during component initialization (before any prop change), so naive implementations would reset, randomize, and step on mount. Each signal effect must track its previous value and skip the initial execution:

```typescript
let prevReset = resetSignal;
$effect(() => {
    if (resetSignal === prevReset) return; // skip initial run
    prevReset = resetSignal;
    doReset();
});
```

Apply the same prev-value guard to `randomizeSignal` and `stepSignal` effects. Tests should verify the initial iteration count is 0 (no spurious step on mount).

**Initial distribution:** Uniform random points in `[0,1]^2`. Incrementing `randomizeSignal` generates a new random set.

**Baker's Map step (applied to each point):**

```typescript
function applyBakersMap(x: number, y: number): [number, number] {
    const doubled = 2 * x;
    if (doubled < 1) {
        return [doubled, y / 2];
    } else {
        return [doubled - 1, (y + 1) / 2];
    }
}
```

**Performance guards:**

- Cap point count at 10,000
- `Float64Array` for all point data (no array allocations in animation loop; 52-bit mantissa gives ~50 useful iterations before precision collapse)
- Auto-reset cycle at `MAX_ITERATIONS` (default 50) prevents precision-collapse stall
- Single `ctx.fillRect(px, py, 1, 1)` per point per frame where `px = x * canvasWidth` and `py = (1 - y) * canvasHeight` (fastest canvas primitive, coords scaled to canvas pixels)
- Cleanup: cancel `requestAnimationFrame` on unmount

**Reactive behavior:**

- When `pointCount` changes: reinitialize `Float64Array`s and distribution, reset iteration count
- When `speed` changes: takes effect on next animation frame (no reinitialization needed)
- When `resetSignal` changes: copy initial positions back to current arrays, reset iteration count
- When `randomizeSignal` changes: generate new initial positions, copy to current arrays, reset iteration count
- When `stepSignal` changes: apply one Baker's Map step to all points, increment iteration count
- `ResizeObserver` on container for responsive canvas sizing

### Route Page (`src/routes/bakers-map/+page.svelte`)

Uses `VisualizationShell` with page-managed sliders (same pattern as Tinkerbell, Clifford).

**Shell configuration:**

- `mapType`: `'bakers-map'`
- `title`: `'BAKERS_MAP'`
- `paramDefs`: `[]` (all controls are page-owned, rendered in `extraControls`)
- `paramColumns`: `1`
- `stabilityReporter`: Registered via `createStabilityReporter({ mapType: 'bakers-map', getParams: () => buildParameters(), reactive: true })`
- `formula`: `['x(n+1) = 2x(n) mod 1', 'y(n+1) = (y(n) + floor(2x(n))) / 2']`
- `formulaColumns`: `2`
- `description`: `{ heading: 'DATA_LOG: BAKERS_MAP', body: 'The Baker\u2019s Map is the simplest model of chaotic mixing. Each step stretches the unit square horizontally by a factor of two, cuts it at the midpoint, and stacks the right half on top of the left. The map is measure-preserving, so a uniform distribution stays uniform forever \u2014 but points colored by their initial height interleave into ever-finer horizontal bands, making the stretch/cut/stack mechanism visible. This is the same kneading action that gives chaotic systems their mixing property: after enough folds, any two nearby points end up far apart.' }` (must be `{ heading: string; body: string }` per `VisualizationShell` Props type at line 52)
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
function buildParameters(): BakersMapParameters {
    return { type: 'bakers-map', pointCount, speed };
}
```

**`onExtraParametersLoaded(p)`:** Restores `pointCount` and `speed` from saved/shared configs, **clamped** to `[100, 10000]` and `[1, 10]` respectively (validateParameters only checks finite-numeric, not range — see Boundary Clamping above). Animation state (`paused`, iteration count, signal counters) is session-local — not persisted, same approach as Chua's `dt`/`trailLength` and Double Pendulum's `speed`/`showTrail`.

**Session/auth:** `data.session` from root layout's `+layout.server.ts`. No separate `+page.server.ts` needed (same as Tinkerbell).

### Compare Route (`src/routes/bakers-map/compare/+page.svelte`)

Every map's `VisualizationShell` renders a Compare button linking to `/{mapType}/compare` (via `buildComparisonUrl`). All 17 existing maps have a compare route. Baker's Map needs one too.

Follow the established compare page pattern (see `src/routes/tinkerbell/compare/+page.svelte`): two side-by-side `BakersMapRenderer` instances with their own parameter panels, URL state encoded/decoded via `decodeComparisonState`/`encodeComparisonState`, left/right `pointCount` and `speed` sliders, debounced URL sync.

### Homepage Card (`src/routes/+page.svelte`)

Add to `visualizations` array. Use a color distinct from Newton's `from-amber-400 to-orange-600` and Chua's `from-red-500 to-amber-600`:

```javascript
{
    name: "Baker's Map",
    description: 'A stretch-cut-stack map that demonstrates chaotic mixing in phase space',
    url: '/bakers-map',
    color: 'from-yellow-500 to-amber-600'
}
```

### Tests (`src/lib/components/visualizations/BakersMapRenderer.svelte.test.ts`)

Following the repo's testing conventions (Vitest + jsdom for `.svelte.test.ts` files):

- **Mount/unmount**: component mounts without errors, canvas element is created
- **RAF cleanup**: `cancelAnimationFrame` is called on unmount (no leaked frames)
- **Signal props**: incrementing `resetSignal`, `randomizeSignal`, `stepSignal` triggers the corresponding behavior (verifiable via iteration count or spy)
- **Signal init skip**: initial mount does NOT trigger reset/randomize/step — iteration count starts at 0 (prev-value guard works)
- **Auto-reset cycle**: after `MAX_ITERATIONS` steps, renderer silently reseeds and iteration counter resets to 0
- **pointCount resize**: changing `pointCount` reinitializes arrays without errors
- **paused state**: when `paused=true`, RAF loop does not advance iteration count

Additionally, the existing `schema.test.ts` must continue to pass after the migration + journal updates (it auto-detects the latest constraint-bearing migration, so it will pick up `0012` automatically once the journal entry exists).

## Acceptance Criteria

(from Linear issue HPA-63)

- [ ] The homepage includes a Baker's Map card linking to `/bakers-map`.
- [ ] `/bakers-map` renders without errors.
- [ ] The visualization clearly shows stretch/cut/stack mixing over iterations.
- [ ] Iteration, reset, randomize, and pause/resume controls work.
- [ ] The route includes short explanatory copy.
- [ ] The module remains usable on desktop and mobile.
- [ ] Compare button links to `/bakers-map/compare` (not a 404).
- [ ] `bun run check` passes (no TS errors from exhaustive switch).
- [ ] `bun run test` passes (schema tests, renderer tests).
