# Baker's Map Visualization Module

**Linear Issue:** [HPA-63](https://linear.app/cwchanap/issue/HPA-63/add-bakers-map-visualization-module)
**PRD:** [Additional Chaotic Map Visualizations](https://linear.app/cwchanap/document/prd-additional-chaotic-map-visualizations-1a69b476e276)
**Date:** 2026-07-10

## Summary

Implement **Baker's Map** as a new chaotic map visualization module at `/bakers-map`. Unlike the existing maps that compute orbits and render static point clouds or fractals, Baker's Map is an **animated mixing demonstration** — it repeatedly stretches, cuts, and stacks the unit square `[0,1]x[0,1]`, turning an initial distribution of points into progressively finer horizontal stripes.

### Mathematical Definition

The Baker's Map transforms a point `(x, y)` in the unit square:

```
B(x, y) = (2x mod 1, (y + floor(2x)) / 2)
```

Each application:
1. **Stretch**: Double the x-coordinate horizontally.
2. **Cut**: When `x >= 0.5`, wrap it back (the "cut" at the midpoint).
3. **Stack**: Place the right half on top of the left half (adjust y accordingly).

After n iterations, the initial distribution of points becomes increasingly fine horizontal stripes — demonstrating chaotic mixing.

## Files

### New files

| File | Purpose |
|------|---------|
| `src/routes/bakers-map/+page.svelte` | Route page with `VisualizationShell` and page-managed controls |
| `src/lib/components/visualizations/BakersMapRenderer.svelte` | Canvas-based animated renderer |

### Modified files

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `BakersMapParameters` interface; register in `ChaosMapType`, `ChaosMapParameters`, `CHAOS_MAP_DISPLAY_NAMES`, `VALID_MAP_TYPES`, `SavedConfiguration` |
| `src/lib/chaos-validation.ts` | Add `'bakers-map'` entry in `STABLE_RANGES` |
| `src/routes/+page.svelte` | Add homepage card |

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

### Renderer (`src/lib/components/visualizations/BakersMapRenderer.svelte`)

A canvas-based animated component.

**Data structures (preallocated, no per-frame allocations):**

- `Float32Array` for current x-coordinates (length = `pointCount`)
- `Float32Array` for current y-coordinates (length = `pointCount`)
- `Float32Array` for initial y-positions (used for color gradient — so horizontal stripes are visible as mixing progresses)

**Animation loop (`requestAnimationFrame`):**

- Each frame applies `speed` Baker's Map steps to all points
- Renders all points to canvas with color = `d3.interpolate(COLOR_PRIMARY, COLOR_MAGENTA)(initialY)` (using constants from `$lib/constants`) — this makes the mixing visually obvious as colored stripes form
- Displays current iteration count as overlay text (`ITERATION: N`)
- `paused` flag controls whether the RAF loop applies steps or just idles

**Canvas layout:**

- Unit square `[0,1]x[0,1]` mapped to the full canvas area (no D3 axes — the unit square is self-explanatory; the stripe pattern is the visual)
- Sci-fi styled frame: corner borders, `LIVE_RENDER // CANVAS_2D` badge — consistent with `BifurcationLogisticRenderer` and `BifurcationHenonRenderer`
- Dark background (`bg-black/40`)

**Props:**

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `height` | `number` | `VIZ_CONTAINER_HEIGHT` | Canvas height |
| `containerElement` | `HTMLDivElement` (bindable) | — | For `VisualizationShell` snapshot binding |
| `pointCount` | `number` (bindable) | `3000` | Number of points |
| `speed` | `number` (bindable) | `1` | Baker's Map steps per animation frame |
| `paused` | `boolean` (bindable) | `false` | Animation pause/resume |

**Methods exposed to page (via `bind:this`):**

- `step()` — Apply exactly one Baker's Map iteration to all points
- `reset()` — Reset all points to their initial positions
- `randomize()` — Generate a new random initial distribution in `[0,1]^2`

**Initial distribution:** Uniform random points in `[0,1]^2`. The `randomize()` action generates a new random set.

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
- `Float32Array` for all point data (no array allocations in animation loop)
- Single `ctx.fillRect(x, y, 1, 1)` per point per frame (fastest canvas primitive)
- Cleanup: cancel `requestAnimationFrame` on unmount

**Reactive behavior:**

- When `pointCount` changes: reinitialize point arrays and distribution
- When `speed` changes: takes effect on next animation frame (no reinitialization needed)
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
- `description`: Concise educational copy explaining stretch/cut/stack chaotic mixing
- `isAuthenticated`: `!!data?.session`

**Page-owned `$state`:**

| State | Type | Default | Range |
|-------|------|---------|-------|
| `pointCount` | `number` | `3000` | 100–10,000 (step 100) |
| `speed` | `number` | `1` | 1–10 (step 1) |
| `paused` | `boolean` | `false` | — |

**Controls (in `extraControls` snippet):**

| Control | Element | Action |
|---------|---------|--------|
| Point Count | Range slider | Bind `pointCount` |
| Speed | Range slider | Bind `speed` |
| Pause/Resume | Button | Toggle `paused` |
| Step | Button | Call `renderer.step()` (only enabled when paused) |
| Reset | Button | Call `renderer.reset()` |
| Randomize | Button | Call `renderer.randomize()` |

**`buildParameters()`:**

```typescript
function buildParameters(): BakersMapParameters {
    return { type: 'bakers-map', pointCount, speed };
}
```

**`onExtraParametersLoaded(p)`:** Restores `pointCount` and `speed` from saved/shared configs. Animation state (`paused`, iteration count) is session-local — not persisted, same approach as Chua's `dt`/`trailLength` and Double Pendulum's `speed`/`showTrail`.

**Session/auth:** `data.session` from root layout's `+layout.server.ts`. No separate `+page.server.ts` needed (same as Tinkerbell).

### Homepage Card (`src/routes/+page.svelte`)

Add to `visualizations` array:

```javascript
{
    name: "Baker's Map",
    description: 'A stretch-cut-stack map that demonstrates chaotic mixing in phase space',
    url: '/bakers-map',
    color: 'from-amber-500 to-orange-600'
}
```

## Acceptance Criteria

(from Linear issue HPA-63)

- [ ] The homepage includes a Baker's Map card linking to `/bakers-map`.
- [ ] `/bakers-map` renders without errors.
- [ ] The visualization clearly shows stretch/cut/stack mixing over iterations.
- [ ] Iteration, reset, randomize, and pause/resume controls work.
- [ ] The route includes short explanatory copy.
- [ ] The module remains usable on desktop and mobile.
