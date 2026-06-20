# Clifford Attractor Module — Design

**Linear ticket:** [HPA-64 — Add Clifford Attractor visualization module](https://linear.app/cwchanap/issue/HPA-64/add-clifford-attractor-visualization-module)
**Parent:** HPA-58 · **PRD:** [Additional Chaotic Map Visualizations](https://linear.app/cwchanap/document/prd-additional-chaotic-map-visualizations-1a69b476e276)
**Date:** 2026-06-19
**Status:** Approved (ready for implementation planning)

## Summary

Add a new **Clifford Attractor** module to the Chaos Theory Visualizations app:
a 2D iterative attractor formed from sine/cosine recurrences that produces dense,
highly aesthetic generative-art point clouds. The module follows the app's
existing sci-fi/cyberpunk visual identity and integrates fully with the existing
save, share, compare, and snapshot infrastructure.

The closest existing analog is the **Ikeda Map** (recent 2D point-cloud module).
The renderer is modeled directly on `IkedaRenderer` (D3 axes + Canvas + optional
Web Worker with main-thread fallback), with one Clifford-specific addition: a
**density** render path (per-pixel hit accumulation + log color ramp) for the
classic glowing-attractor look.

This design covers the full HPA-64 scope at **full Ikeda parity**: Clifford
becomes a first-class `ChaosMapType` wired through the entire generic
save/share/compare/snapshot stack.

## Goals

- New 2D iterative attractor with a distinct generative-art visual identity.
- Compelling default visualization on page load (a known-good attractor).
- Direct control over `a`, `b`, `c`, `d`, iteration count, zoom, and color mode;
  reset and randomize actions; presets for quick exploration.
- Full integration with existing save / share / compare / snapshot flows.
- Concise educational copy explaining the sine/cosine recurrence and generative
  chaotic structure.
- Responsive and safe under default and extreme settings (desktop and mobile).

## Non-Goals

- Progressive/animated frame-by-frame "drawing" of the orbit (see Rendering —
  we deliberately reuse the proven debounced compute-then-render model).
- Exposing initial conditions `x0`/`y0` as user controls (the attractor is
  independent of them — fixed internally).
- Any server-side rendering; all computation is client-side.

## The Math (`src/lib/clifford.ts` — new)

Standard Clifford attractor recurrence:

```text
x₍ₙ₊₁₎ = sin(a·yₙ) + c·cos(a·xₙ)
y₍ₙ₊₁₎ = sin(b·xₙ) + d·cos(b·yₙ)
```

- `a`, `b`, `c`, `d` are the four shape parameters (the user controls).
- **Inherently bounded**: because `sin`/`cos` ∈ [−1, 1], every iterate satisfies
  `x ∈ [−(1+|c|), 1+|c|]` and `y ∈ [−(1+|d|), 1+|d|]`. The recurrence can never
  diverge or produce `NaN`/`Infinity` from finite inputs. The PRD/issue's
  NaN/runaway guards are therefore satisfied structurally; `Number.isFinite`
  checks in the renderer remain as belt-and-suspenders.
- **Independent of initial conditions**: any seed converges to the same
  attractor, so `x0`/`y0` are fixed internally (`0.1, 0.1`) and not persisted or
  exposed.

### Functions

Mirrors the shape of `ikeda.ts` (tuple-producing primitive):

- `calculateCliffordTuples(params): [number, number][]` — a single sequential
  orbit of `iterations` steps (capped at `maxPoints`), D3/canvas tuple form.
  Stops early if a value becomes non-finite (defensive only).

There is **no multi-seed variant** — a Clifford attractor is a single long
orbit. This is the key structural difference from Ikeda.

### Determinism (save/share reproducibility)

The orbit is fully deterministic given `a, b, c, d, iterations` (fixed internal
seed `x0,y0`). Same parameters ⇒ byte-identical point cloud ⇒ reproducible
saves, shares, and snapshots. **Randomize** picks fresh `a,b,c,d` via
`Math.random`; the resulting concrete values are what get persisted, so
reproducibility is preserved.

## Rendering (`src/lib/components/visualizations/CliffordRenderer.svelte` — new)

Follows the `IkedaRenderer` pattern:

- **Canvas** for the dense point cloud; **SVG axes** with cyan (`#00f3ff`)
  sci-fi styling.
- Orbit computation offloaded to the **Web Worker** (`chaosMapsWorker.ts`) with
  graceful main-thread fallback (`workerAvailable` pattern).
- Request-id guarding so stale async worker results are dropped
  (`workerRequestId` / `latestWorkerRequestId`).
- Debounced re-render on input change; render-only changes (color mode, zoom,
  point size, opacity, height) re-render the cached point cloud without
  recompute.
- `MAX_POINTS = 250000` defensive cap on both transfer and render cost.

### Compute model — match Ikeda, not progressive batching

The issue permits frame-batching "if needed"; we deliberately do **not** add a
progressive renderer. A 250k-point Clifford orbit is a few ms of `sin`/`cos` in
the worker, so the main thread never blocks. Reusing the established
compute-in-worker → render-once model keeps the module architecturally
consistent with every other map and avoids a bespoke animation loop.

### Render paths (keyed on `colorMode`)

1. **Per-point modes** (`single`, `iteration`, `radius`, `angle`): draw an arc
   per point with `pointSize` / `opacity`, reusing the existing
   `d3.interpolate` cyan→magenta ramps.
   - `single` — static neon cyan.
   - `iteration` — colored by step index (orbit progression).
   - `radius` — colored by distance from origin.
   - `angle` — polar-angle hue.
   - Dense low-opacity overlap already yields a density-like glow for free.
2. **Density mode** (`density`): allocate a `Uint32Array` hit-grid sized to the
   canvas pixels; increment the mapped cell per point; then map
   `log(1 + count) / log(1 + maxCount)` through a color ramp into an `ImageData`
   and `putImageData` — the classic glowing Clifford look. `pointSize` /
   `opacity` are inert here and are visually dimmed in the UI (mirroring how the
   Ikeda page dims `x0`/`y0` in multi-seed mode).

### Render controls

- **Color mode** (single / iteration / radius / angle / density)
- **Zoom** — render-only; scales the auto-fit domain by `1/zoom` around its
  centre. `zoom ∈ [0.5, 5]`, default `1`.
- **Point size** (per-point modes)
- **Opacity** (per-point modes)

## Module Page (`src/routes/clifford/+page.svelte` — new)

Structurally copied from the Ikeda page, which already wires the full reuse
surface.

- **Header:** `CLIFFORD_ATTRACTOR`
- **Subheading:** `SINE-COSINE_RECURRENCE // GENERATIVE_CHAOTIC_ATTRACTOR`

### Reused as-is (no changes to these components/hooks)

- `SaveConfigDialog`, `ShareDialog`, `SnapshotButton`, `VisualizationAlerts`
- `use-visualization-save` (`createSaveHandler`, `createInitialSaveState`)
- `use-visualization-share` (`createShareHandler`, `createInitialShareState`)
- `saved-config-loader` (`loadSavedConfigParameters`,
  `loadSharedConfigParameters`, `parseConfigParam`) — URL `config` / `configId`
  / `share` loading, including the abort-controller + `lastAppliedConfigKey`
  guard pattern.
- `checkParameterStability` (stability warnings).

### Primary controls

| Control | Field |
| -- | -- |
| Shape parameter a | `a` |
| Shape parameter b | `b` |
| Shape parameter c | `c` |
| Shape parameter d | `d` |
| Iteration count | `iterations` |

Plus **Reset** (returns to the default preset / known-good state) and
**Randomize** (`a,b,c,d` ← uniform random in `[−2, 2]`, a range that reliably
produces attractors) action buttons.

### Presets — 5

| Preset | `a` | `b` | `c` | `d` |
| -- | -- | -- | -- | -- |
| **Classic** (default) | −1.4 | 1.6 | 1.0 | 0.7 |
| Wings | 1.7 | 1.7 | 0.6 | 1.2 |
| Web | −1.7 | 1.3 | −0.1 | −1.21 |
| Swirl | 1.5 | −1.8 | 1.6 | 0.9 |
| Ribbons | −1.8 | −2.0 | −0.5 | −0.9 |

Each preset also carries its render settings (color mode, zoom, point size,
opacity). Selecting a preset updates the visualization immediately and
highlights the active preset; editing any parameter transitions to **Custom**.
"Classic" doubles as the reset-to-default known-good state. Exact parameter sets
get a visual sanity-check during implementation and may be tuned.

### Educational copy

`DATA_LOG: CLIFFORD_ATTRACTOR` section plus a formula display block showing the
two recurrence equations. Plain-language explanation of how repeatedly applying
the sine/cosine map folds a single point's trajectory into a dense, intricate
generative-art structure, and how it differs from continuous flows (Lorenz /
Rössler) and from other discrete maps.

## Compare Page (`src/routes/clifford/compare/+page.svelte` — new)

Copied from `src/routes/ikeda/compare/+page.svelte`, reusing `buildComparisonUrl`
and `createComparisonStateFromCurrent`. Supports comparing two parameter sets,
preset vs custom, and different color modes side by side.

## Persisted Parameter Shape (`CliffordParameters`)

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
	// Registered via the existing OPTIONAL_FIELDS mechanism (as with Ikeda).
	colorMode?: CliffordColorMode;
	zoom?: number;
	pointSize?: number;
	opacity?: number;
}
```

Optional fields are backward-compatible: a config with only the required fields
still loads and renders with sensible defaults.

## Registration Touch-Points (modify)

The save / share / compare / snapshot stack is **generic** and registry-driven.
Adding `clifford` to the registries below makes the application stack work
automatically. `saved-config-loader.ts`, `use-visualization-save`, and
`use-visualization-share` need **no changes**.

**One database migration IS required** (`drizzle/0009_add_clifford_map_type.sql`):
although `map_type` is a `text` column, both `saved_configurations` and
`shared_configurations` enforce it through `CHECK` constraints that live in the
migration files (not in `schema.ts`, by design — see the comment in
`src/lib/server/db/schema.ts`). The migration drops and re-adds the
`check_valid_map_type` / `chk_shared_configurations_map_type` constraints so
their `IN (...)` lists include `'clifford'` alongside the other 14 map types,
keeping the DB allow-list in lock-step with `VALID_MAP_TYPES` (`schema.test.ts`
asserts the migration list matches `VALID_MAP_TYPES` exactly). At the API layer,
the save-config endpoint additionally validates against `VALID_MAP_TYPES` +
`validateParameters`, and the loaders are generic over `ChaosMapType`.

- `src/lib/types.ts`
  - `CliffordColorMode` type + `CliffordParameters` interface
  - add `'clifford'` to `ChaosMapType` and the `ChaosMapParameters` union
  - `CHAOS_MAP_DISPLAY_NAMES.clifford = 'CLIFFORD_ATTRACTOR'`
  - add `'clifford'` to `VALID_MAP_TYPES`
  - add the `clifford` arm to the `SavedConfiguration` union
- `src/lib/chaos-validation.ts`
  - `STABLE_RANGES.clifford` — ranges for `a, b, c, d, iterations`
  - `OPTIONAL_FIELDS.clifford` — `colorMode` (enum), `zoom` (number),
    `pointSize` (number), `opacity` (number)
  - No special `checkParameterStability` switch case (always bounded).
- `src/lib/type-guards.ts` — `isCliffordParameters` (+ import)
- `src/lib/comparison-url-state.ts` — `getDefaultParameters` `case 'clifford'`
  (TS exhaustiveness requires it), sourced from the default preset.
- `src/lib/clifford-presets.ts` (new) — `CliffordPresetState`, the 5 presets,
  `DEFAULT_CLIFFORD_PRESET_ID = 'classic'`, `getPreset`, `detectPresetId`
  (mirrors `ikeda-presets.ts`).
- `src/lib/workers/types.ts` — `CliffordRequest`
  (`{ type: 'clifford', id, a, b, c, d, iterations, maxPoints }`) and
  `CliffordResponse` (`{ type: 'cliffordResult', id, points }`) added to the
  request/response unions.
- `src/lib/workers/chaosMapsHandler.ts` — `clifford` branch calling
  `calculateCliffordTuples` (+ import).
- `src/routes/+page.svelte` (home) — new card. Name "Clifford Attractor";
  description "A generative chaotic attractor formed from sine and cosine
  iteration"; a distinct gradient color not already used.

### Indicative validation ranges

(Exact bounds finalized during implementation.)

- `a`, `b`, `c`, `d`: −3 – 3
- `iterations`: 1 – 250000 (slider default ~120000)
- `zoom`: 0.5 – 5
- `pointSize`: small positive range (e.g. 0.5 – 6)
- `opacity`: 0 – 1

## Safety / Performance

- Recurrence is structurally bounded (no divergence possible); `Number.isFinite`
  guards remain defensively.
- `MAX_POINTS = 250000` caps worker transfer and render cost.
- Worker compute keeps the main thread responsive; debounced re-render on slider
  changes.
- Density mode accumulates into a fixed-size pixel grid (canvas-sized), so its
  cost is bounded by canvas resolution, not iteration count.
- "Classic" preset provides one-click return to a known-good default.

## Testing Strategy

Follows existing conventions (Vitest node + jsdom projects; filename selects
environment).

### Node (`*.test.ts`)

- `src/lib/clifford.test.ts` — determinism (identical output across runs for the
  same params), bounded/finite output for a range of parameter sets, `maxPoints`
  cap honored, empty result for non-positive iterations.
- `src/lib/clifford-presets.test.ts` — `detectPresetId` round-trips each preset,
  returns `null` for custom state, default preset resolves.
- `validateParameters('clifford', …)` cases added to the chaos-validation tests
  (required keys, optional-field enum/number validation, rejection of unexpected
  keys, out-of-range warnings).
- `isCliffordParameters` added to the type-guards tests.
- `comparison-url-state` clifford default + case.
- `chaosMapsWorker.test.ts` — `clifford` request handled; unknown-type fallback
  unaffected.
- `types.test.ts` — display name + `VALID_MAP_TYPES` membership.

### jsdom (`*.svelte.test.ts`)

- `CliffordRenderer.svelte.test.ts` — mounts, draws to canvas, reacts to
  param / color-mode / zoom changes, exercises both the per-point and density
  render paths, worker fallback path — mirroring `IkedaRenderer.svelte.test.ts`.
- `clifford-page-interactions.svelte.test.ts` — presets apply, Custom transition
  on edit, sliders bound, Reset and Randomize work, color-mode switch — mirroring
  existing `*-page-interactions.svelte.test.ts`.
- Compare page coverage — mirroring the existing compare-page tests.
- Homepage card present in `page.svelte.test.ts`.

## Acceptance Criteria (restated from HPA-64)

1. Home page includes a Clifford Attractor card linking to `/clifford`.
2. `/clifford` renders without errors.
3. The default parameter set produces a visually compelling attractor.
4. `a`, `b`, `c`, `d`, iterations, zoom, and color-mode controls update the
   visualization.
5. Reset and Randomize actions work.
6. The route includes short explanatory copy.
7. The module remains usable on desktop and mobile.
8. (Parity) Snapshot, Save (signed-in), Share link, and Compare all work.
