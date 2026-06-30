# Gumowski–Mira Map Visualization Module

**Linear issue:** [HPA-65](https://linear.app/cwchanap/issue/HPA-65/add-gumowskimira-map-visualization-module)
**PRD:** [Additional Chaotic Map Visualizations](https://linear.app/cwchanap/document/prd-additional-chaotic-map-visualizations-1a69b476e276)
**Route:** `/gumowski-mira`
**Status:** Implemented — module shipped (see Acceptance Criteria)

## Summary

Add the **Gumowski–Mira map** as a new 2D chaotic-map visualization module. The map is a discrete nonlinear system renowned for the rich visual transitions it produces between smooth invariant curves, KAM island chains, and fully chaotic seas. This module matches the feature richness of the Ikeda and Clifford modules (presets, compare page, worker offloading, multi-seed render, color modes).

## Background

The Gumowski–Mira map is structurally a 2D point-cloud iterative map, the same architectural family as Chaos Esthetique, Ikeda, and Clifford. It must be **mathematically distinct** from the existing Chaos Esthetique map (which shares the same `g(x)` rational function). The distinction comes from the Gumowski–Mira map's signature nonlinear damping term `a(1 − b·y²)·y` in the x-update and its application of `g()` to the *new* `x(n+1)` in the y-update, which produces dynamics (island structures, invariant curves) that Chaos Esthetique cannot.

## The Map (Math)

```text
g(x)   = μ·x + 2(1−μ)·x² / (1 + x²)            ← the Gumowski function
x(n+1) = y + a·(1 − b·y²)·y + g(x)
y(n+1) = −x + g(x(n+1))
```

### Parameters

| Param | Role | Slider range | Default | Notes |
|---|---|---|---|---|
| `mu` (μ) | Gumowski function shape | `[−1, 1]` | `0.31` | **Primary** control. Slides between smooth invariant curves (μ < 0) and chaotic seas (μ > 0). |
| `a` (alpha) | Nonlinear damping / step | `[0, 1]` | `0.008` | **Primary** control. Governs orbital radius and how far orbits spread. |
| `b` (beta) | y² damping coefficient | `[0, 0.5]` | `0.05` | Secondary. Affects the curvature of the damping term. |
| `x0` | Initial x | `[−20, 20]` | `0.1` | Single-orbit start point. |
| `y0` | Initial y | `[−20, 20]` | `0` | Single-orbit start point. |
| `iterations` | Steps per orbit | `[100, 250000]` | `15000` | Capped by `MAX_POINTS` at render time. |
| `burnIn` | Transient discard | `[0, 10000]` | `500` | First N points per orbit are dropped. |

**Default produces** a rich multi-island structure on first load (`island-structure` preset).

## Architecture

### Files to create

| File | Purpose |
|---|---|
| `src/lib/gumowski-mira.ts` | Pure compute functions: single-orbit + multi-seed (mirrors `src/lib/ikeda.ts`). Exports `gumowskiMiraStep`, `calculateGumowskiMiraTuples`, `calculateGumowskiMiraMultiSeed`, re-exports `mulberry32` from ikeda.ts. |
| `src/lib/gumowski-mira.test.ts` | Unit tests for compute functions. |
| `src/lib/gumowski-mira-presets.ts` | 5 presets + `getPreset`, `detectPresetId`, `DEFAULT_GUMOWSKI_MIRA_PRESET_ID`. |
| `src/lib/gumowski-mira-presets.test.ts` | Preset tests. |
| `src/lib/components/visualizations/GumowskiMiraRenderer.svelte` | D3 axes + Canvas point-cloud renderer. |
| `src/routes/gumowski-mira/+page.svelte` | Main visualization page. |
| `src/routes/gumowski-mira/compare/+page.svelte` | 2-panel compare page. |
| `src/routes/gumowski-mira-config-loading.svelte.test.ts` | Config-loading tests. |
| `src/routes/gumowski-mira-page-interactions.svelte.test.ts` | Page interaction tests. |
| `src/routes/gumowski-mira-compare-interactions.svelte.test.ts` | Compare page tests. |
| `drizzle/0010_add_gumowski_mira_map_type.sql` | DB migration adding `'gumowski-mira'` to CHECK constraints. |

### Files to modify

| File | Change |
|---|---|
| `src/lib/types.ts` | Add `'gumowski-mira'` to `ChaosMapType` union; add `GumowskiMiraParameters` interface; add `GumowskiMiraColorMode`, `GumowskiMiraRenderMode` types; add display name `'GUMOWSKI–MIRA_MAP'`; add to `VALID_MAP_TYPES` (positioned after `'chaos-esthetique'`); add to `SavedConfiguration` union. |
| `src/lib/chaos-validation.ts` | Add stability ranges for `'gumowski-mira'` in `STABLE_RANGES`; add optional fields (`renderMode`, `seeds`, `colorMode`, `pointSize`, `opacity`) in `OPTIONAL_FIELDS`. |
| `src/lib/workers/types.ts` | Add `GumowskiMiraRequest` + `GumowskiMiraResponse` interfaces; add to request/response unions. |
| `src/lib/workers/chaosMapsHandler.ts` | Add `gumowskiMira` branch calling `calculateGumowskiMiraMultiSeed`. |
| `src/routes/+page.svelte` | Add homepage card. |
| `drizzle/schema.ts` | No change (map_type is a free text column; CHECK constraints live in migration SQL). |

## Component Design

### `gumowski-mira.ts` (compute)

```typescript
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
    maxPoints?: number;
}

export interface GumowskiMiraMultiSeedResult {
    points: [number, number][];
    seedIndices: number[];
}
```

- `gumowskiMiraStep(x, y, mu, a, b)`: one iteration. Computes `g(x)`, then `xNew`, then `g(xNew)`, then `yNew`. Guards against non-finite.
- `calculateGumowskiMiraTuples(params)`: single orbit, burn-in discard, NaN/∞ break.
- `calculateGumowskiMiraMultiSeed(params)`: deterministic `mulberry32` scatter of `seeds` starting points across a box `[−1, 1] × [−1, 1]` (the typical attractor extent). Returns `{ points, seedIndices }`. Mirrors `calculateIkedaMultiSeed` exactly. Uses `mulberry32` re-exported from `ikeda.ts` (shared PRNG utility) but a **dedicated** `MULTI_SEED_RNG_SEED` constant defined in `gumowski-mira.ts` so each map's seed scatter is independently deterministic.

### `GumowskiMiraRenderer.svelte`

Direct adaptation of `IkedaRenderer.svelte`:

- **Props** (all `$bindable`): `mu`, `a`, `b`, `x0`, `y0`, `iterations`, `burnIn`, `renderMode`, `seeds`, `colorMode`, `pointSize`, `opacity`, `height`, `containerElement`.
- **Render**: D3 SVG axes (sci-fi cyan `#00f3ff`, Rajdhani font) + Canvas 2D point-cloud overlay. Same margins, scale, axis styling as Ikeda.
- **Color modes** (4): `single` (cyan), `iteration` (cyan→magenta by index, default), `seed` (cyan→magenta by seed index), `radius` (magenta→violet by distance from origin).
- **MAX_POINTS** = `200000`; defensive cap in render before drawing.
- **Worker offload**: multi-seed compute posts to `chaosMapsWorker`; single-orbit computes on main thread (cheap). Full worker-error fallback to main-thread compute, exactly like Ikeda.
- **`$effect` split**: recompute when `mu/a/b/x0/y0/iterations/burnIn/renderMode/seeds` change; re-render-only (no recompute) when `colorMode/pointSize/opacity/height` change.
- **250ms debounce** on compute scheduling.

### Presets (`gumowski-mira-presets.ts`)

| id | label | μ | a | b | iterations | burnIn | renderMode | seeds | colorMode | Visual |
|---|---|---|---|---|---|---|---|---|---|---|
| `ordered-curves` | Ordered Curves | −0.4 | 0.008 | 0.5 | 12000 | 500 | multi | 300 | iteration | Smooth closed invariant curves |
| `island-structure` | Island Structure | 0.31 | 0.008 | 0.05 | 15000 | 500 | multi | 300 | iteration | Classic multi-island image (**default**) |
| `transitional` | Transitional | 0.4 | 0.02 | 0.05 | 15000 | 500 | multi | 300 | seed | Curves breaking into island chains |
| `dense-chaos` | Dense Chaos | 0.55 | 0.05 | 0.05 | 18000 | 500 | multi | 500 | radius | Fully chaotic sea |
| `spiral-sweep` | Spiral Sweep | −0.827 | 0.008 | 0.05 | 15000 | 500 | multi | 300 | iteration | Sweeping spiral structure |

All presets share `pointSize: 1.5`, `opacity: 0.6`. Includes `getPreset(id)`, `detectPresetId(state)` (exact-match with `1e-9` tolerance on numbers, matching the Ikeda-presets pattern), and `DEFAULT_GUMOWSKI_MIRA_PRESET_ID = 'island-structure'`.

### Page (`/gumowski-mira/+page.svelte`)

Structure mirrors `ikeda/+page.svelte`:

1. **Header**: title `GUMOWSKI–MIRA_MAP`, subtitle `NONLINEAR_ITERATIVE_MAP // ORDER_AND_CHAOS`. Buttons: Snapshot, Compare (links to `/gumowski-mira/compare`), Share, Save, Return.
2. **VisualizationAlerts**: save success/error, config errors, stability warnings.
3. **Presets bar**: 5 preset buttons with active-preset highlight (`data-testid="active-preset"`).
4. **SYSTEM_PARAMETERS** (corner-bordered panel): `μ` and `a` in emphasized bordered boxes (like Ikeda's feedback slider); `b`, `x0`, `y0`, `iterations`, `burnIn` in a responsive grid (`x0`/`y0` disabled in multi-seed mode).
5. **Formula display**: monospace box showing all four equations.
6. **RENDER_CONTROLS**: render mode select, seeds density, point size, color mode select, opacity.
7. **Reset** button (restores default preset state) + **Randomize** button (μ∈[−0.9, 0.9], a∈[0, 0.05], b∈[0, 0.5], random x0/y0 in [−1, 1]).
8. **Renderer**: `<GumowskiMiraRenderer ... />` with all bindable params + `height={VIZ_CONTAINER_HEIGHT}`.
9. **DATA_LOG**: educational copy explaining the order→chaos spectrum and what μ controls.
10. **SaveConfigDialog** + **ShareDialog**.

Config loading from URL (`configId`, `share`, `config` params) follows the exact Ikeda pattern: reactive `$effect`, abort-controller, `applyParameters()` helper, stability check on load.

### Compare page (`/gumowski-mira/compare/+page.svelte`)

2-panel side-by-side compare view mirroring `ikeda/compare/+page.svelte`. Loads two configurations from URL query params and renders both side by side with shared parameter controls.

## Data Model

### `GumowskiMiraParameters`

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

Required fields are persisted (math + iteration params); optional fields (render state) persist when present and default on the page when absent.

### Validation ranges (`chaos-validation.ts`)

```typescript
'gumowski-mira': {
    mu: { min: -1, max: 1 },
    a: { min: 0, max: 1 },
    b: { min: 0, max: 0.5 },
    x0: { min: -20, max: 20 },
    y0: { min: -20, max: 20 },
    iterations: { min: 1, max: 250000 },
    burnIn: { min: 0, max: 10000 }
}
```

Optional fields:
```typescript
'gumowski-mira': {
    renderMode: { kind: 'enum', values: ['single', 'multi'] },
    seeds: { kind: 'number', min: 1, max: 5000 },
    colorMode: { kind: 'enum', values: ['single', 'iteration', 'seed', 'radius'] },
    pointSize: { kind: 'number', min: 0.5, max: 6 },
    opacity: { kind: 'number', min: 0, max: 1 }
}
```

### Database migration (`0010_add_gumowski_mira_map_type.sql`)

Re-creates both `check_valid_map_type` (saved_configurations) and `chk_shared_configurations_map_type` (shared_configurations) CHECK constraints with `'gumowski-mira'` inserted after `'chaos-esthetique'` (16 total types), matching the `VALID_MAP_TYPES` order.

New full map-type list:
```text
lorenz, rossler, henon, lozi, ikeda, clifford, logistic, newton, standard,
bifurcation-logistic, bifurcation-henon, chaos-esthetique, gumowski-mira,
lyapunov, chua, double-pendulum
```

### Worker integration

**`types.ts`**:
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

export interface GumowskiMiraResponse {
    type: 'gumowskiMiraResult';
    id: number;
    points: [number, number][];
    seedIndices: number[];
}
```

**`chaosMapsHandler.ts`**: new `gumowskiMira` branch calling `calculateGumowskiMiraMultiSeed({ mu, a, b, iterations, burnIn, seeds, maxPoints })` and returning `{ type: 'gumowskiMiraResult', id, points, seedIndices }`.

### Homepage card

Added to `visualizations` array in `src/routes/+page.svelte`:
```typescript
{
    name: 'Gumowski–Mira Map',
    description: 'A nonlinear map with rich transitions between order, islands, and chaos',
    url: '/gumowski-mira',
    color: 'from-fuchsia-500 to-pink-600'
}
```

## Error Handling

- **NaN / Infinity**: compute breaks out of the iteration loop the moment a coordinate is non-finite (same guard as Ikeda / Chaos Esthetique).
- **Runaway coordinates**: `MAX_POINTS` cap (200000) on the renderer; point arrays are sliced before drawing.
- **Worker failure**: `onerror` / error-response handler terminates the worker, sets `workerAvailable = false`, and falls back to main-thread compute.
- **Invalid config params**: `parseConfigParam` + `validateParameters` reject and surface errors via `VisualizationAlerts`.
- **Empty result**: renderer draws blank canvas with axes present (no crash).

## Testing Strategy

1. **`gumowski-mira.test.ts`** (node): single-orbit step correctness against hand-computed values; multi-seed determinism (same params → byte-identical points); NaN/∞ early-break; burn-in discard; point-cap enforcement; empty-result on non-positive seeds/iterations.
2. **`gumowski-mira-presets.test.ts`** (node): every preset resolves via `getPreset`; default preset id exists; `detectPresetId` round-trips for each preset state; non-matching state returns `null`.
3. **`gumowski-mira-config-loading.svelte.test.ts`** (jsdom): URL `config` param parsing (valid/invalid/missing fields); saved/share loading via mocked fetch; abort on unmount; stability warnings surface.
4. **`gumowski-mira-page-interactions.svelte.test.ts`** (jsdom): slider changes update state; preset buttons switch params; reset restores defaults; randomize produces in-range values; save/share/snapshot/compare controls present and wired.
5. **`gumowski-mira-compare-interactions.svelte.test.ts`** (jsdom): compare page renders two panels from URL params.

Worker tests: the existing `chaosMapsWorker.test.ts` gains assertions for the new `gumowskiMira` message type.

## Acceptance Criteria (from HPA-65)

- [x] Homepage includes a Gumowski–Mira Map card linking to `/gumowski-mira`.
- [x] `/gumowski-mira` renders without errors.
- [x] The default parameter set (`island-structure` preset) produces a visually interesting orbit structure.
- [x] Parameter controls update the visualization.
- [x] Reset and randomize actions work.
- [x] The route includes short explanatory copy.
- [x] The module remains usable on desktop and mobile.
- [x] Save / share / snapshot / compare functionality integrated.
- [x] Presets showcase the order → islands → chaos spectrum.

## Non-goals

- Server-side rendering of the visualization.
- Long-form textbook mathematical proofs.
- Modifying existing map modules.
- Animated playback (the map renders as a static point-cloud per parameter set, like Ikeda/Clifford).
