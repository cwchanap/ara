# Ikeda Map Module — Design

**Linear ticket:** [HPA-54 — Ikeda Map](https://linear.app/cwchanap/issue/HPA-54/ikeda-map)
**Date:** 2026-06-07
**Status:** Approved (ready for implementation planning)

## Summary

Add a new **Ikeda Map** module to the Chaos Theory Visualizations app: a 2D
discrete nonlinear-optical-feedback system that produces spiral, fractal-like
chaotic attractors. The module follows the app's existing sci-fi/cyberpunk
visual identity and integrates with the existing save, share, compare, and
snapshot infrastructure.

The closest existing analog is the **Lozi Map** (2D discrete map with
`x0`/`y0`/`iterations`). The dense point-cloud rendering approach is modeled on
the **Chaos Esthétique** renderer (Canvas + optional Web Worker).

This design covers the full PRD MVP, reusing existing features rather than
re-implementing them.

## Goals

- New 2D discrete chaotic map with a distinct spiral/fractal visual identity.
- Compelling default visualization on page load (multi-seed neon point cloud).
- Primary control over the feedback parameter `u`; presets for quick exploration.
- Full integration with existing save / share / compare / snapshot flows.
- Educational copy distinguishing discrete maps from continuous flows.
- Responsive and safe under default and extreme settings.

## Non-Goals (per PRD §4)

Lyapunov heatmap, basin-of-attraction rendering, GIF/video export, limit-points
render mode, and cross-module comparison with Hénon/Lozi/Standard are all
out of scope for this release (future enhancements).

## The Math (`src/lib/ikeda.ts` — new)

Standard feedback-parameter form of the Ikeda map:

```text
tₙ   = 0.4 − 6 / (1 + xₙ² + yₙ²)
xₙ₊₁ = 1 + u·(xₙ·cos tₙ − yₙ·sin tₙ)
yₙ₊₁ = u·(xₙ·sin tₙ + yₙ·cos tₙ)
```

- `u` is the **feedback parameter** — the emphasized primary user control.
  Simpler behavior at low `u` (~0.6); the classic chaotic attractor is at
  `u ≈ 0.918`.
- The module advances in discrete steps (a *map*, not a continuous flow), which
  is the conceptual point emphasized in the educational copy.

### Functions

Mirrors the shape of `lozi.ts`:

- `calculateIkeda(params): IkedaPoint[]` — single orbit from `(x0, y0)`.
- `calculateIkedaTuples(params): [number, number][]` — single orbit, D3/canvas
  tuple form.
- `calculateIkedaMultiSeed(params): [number, number][]` — many seeds, each
  iterated and concatenated into one attractor point cloud.
- Internal `mulberry32(seed)` deterministic PRNG.

### Determinism (critical for save/share reproducibility)

Multi-seed scatters starting points using a **deterministic seeded PRNG**
(`mulberry32` from a fixed constant seed) within a bounded box. Same parameters
⇒ byte-identical attractor. This guarantees that a saved or shared configuration
reproduces the exact same visual result, and that snapshots are reproducible.

`burnIn` (transient) iterations are discarded per orbit before points are
collected.

## Rendering (`src/lib/components/visualizations/IkedaRenderer.svelte` — new)

Follows the `ChaosEsthetiqueRenderer` pattern:

- **Canvas** for the dense point cloud (handles tens of thousands of points).
- **SVG axes** with the cyan (`#00f3ff`) sci-fi styling used elsewhere.
- Heavy multi-seed computation offloaded to the **Web Worker**
  (`chaosMapsWorker.ts`), with graceful main-thread fallback when the worker is
  unavailable (matching the existing renderer's `workerAvailable` pattern).
- Request-id guarding so stale async worker results are dropped (existing
  pattern: `workerRequestId` / `latestWorkerRequestId`).

### Render modes (PRD §7.6)

- **Single Orbit** — one starting point over many iterations (educational; easy
  to follow the discrete trajectory).
- **Multi-Seed Attractor** — many starting points showing the global attractor
  structure. **This is the default** (strongest aesthetic payoff).

(Limit-points mode is explicitly deferred to post-MVP per PRD §4 / open
question #3.)

### Color modes (4)

1. `single` — static neon gradient (cyan → magenta).
2. `iteration` — colored by step index within an orbit (shows time evolution).
3. `seed` — colored by which seed an orbit came from (multi-seed structure).
4. `radius` — colored by distance from origin / local density.

The visualization does not rely on color alone to convey meaning (axes, labels,
and parameter readouts carry the structural information) — satisfies
accessibility requirement PRD §9.5.

### Render controls (PRD §7.5)

- Render mode (single / multi-seed)
- Point density (number of points / seeds; clamped)
- Point size
- Color mode
- Opacity / intensity

## Module Page (`src/routes/ikeda/+page.svelte` — new)

Structurally copied from the Lozi page (`src/routes/lozi/+page.svelte`), which
already wires up the full reuse surface.

- **Header:** `IKEDA_MAP`
- **Subheading:** `NONLINEAR_OPTICAL_FEEDBACK // DISCRETE_CHAOTIC_MAP`

### Reused as-is (no changes to these components/hooks)

- `SaveConfigDialog`, `ShareDialog`, `SnapshotButton`, `VisualizationAlerts`
- `use-visualization-save` (`createSaveHandler`, `createInitialSaveState`)
- `use-visualization-share` (`createShareHandler`, `createInitialShareState`)
- `saved-config-loader` (`loadSavedConfigParameters`, `loadSharedConfigParameters`,
  `parseConfigParam`) — URL `config` / `configId` / `share` loading, including
  the abort-controller + `lastAppliedConfigKey` guard pattern.
- `checkParameterStability` (stability warnings).

### Primary controls (PRD §7.4)

| Control | Field |
| -- | -- |
| Feedback parameter (emphasized) | `u` |
| Initial X | `x0` |
| Initial Y | `y0` |
| Iteration count | `iterations` |
| Burn-in / transient removal | `burnIn` |

### Presets (PRD §7.7) — 5

| Preset | Intent | `u` (indicative) |
| -- | -- | -- |
| Low Feedback | Simpler / more stable behavior | ~0.6 |
| Transition | Movement toward complexity | ~0.85 |
| Structured Chaos | Readable chaotic structure | ~0.9 |
| **Classic Ikeda** (default) | Recommended attractor | ~0.918 |
| Dense Fractal | Richer, denser pattern | ~0.918 + higher density |

Selecting a preset updates the visualization immediately and highlights the
active preset. Editing any parameter transitions the state to **Custom**.
"Classic Ikeda" doubles as the reset-to-default known-good state (PRD §9.6).

### Educational copy (PRD §7.8)

`DATA_LOG: IKEDA_MAP` section using the PRD's recommended copy, explaining the
discrete rotation/scaling/shift transform and contrasting it with continuous
systems (Lorenz/Rössler) and other maps (Hénon/Lozi/Logistic/Standard).

## Compare Page (`src/routes/ikeda/compare/+page.svelte` — new)

Copied from `src/routes/lozi/compare/+page.svelte`, reusing
`buildComparisonUrl` and `createComparisonStateFromCurrent`. Supports comparing
two feedback values, preset vs custom, single-orbit vs multi-seed, and
burn-in on/off.

## Persisted Parameter Shape (`IkedaParameters`)

```ts
export interface IkedaParameters {
	type: 'ikeda';
	// Required (system + initial conditions)
	u: number;
	x0: number;
	y0: number;
	iterations: number;
	burnIn: number;
	// Optional render state — persisted so save/share/snapshot reproduce exactly.
	// Registered via the existing OPTIONAL_FIELDS mechanism (as with Lorenz).
	renderMode?: 'single' | 'multi';
	seeds?: number;
	colorMode?: 'single' | 'iteration' | 'seed' | 'radius';
	pointSize?: number;
	opacity?: number;
}
```

Optional fields are backward-compatible: a config with only the required fields
still loads and renders with sensible defaults.

## Registration Touch-Points (modify)

The save / share / compare / snapshot stack is **generic** and registry-driven.
Adding `ikeda` to the registries below makes the entire stack work
automatically — **no database migration** is required (`map_type` is a
free-text column; the save-config API validates against `VALID_MAP_TYPES` +
`validateParameters`, and the loaders are generic over `ChaosMapType`).

- `src/lib/types.ts`
  - `IkedaParameters` interface
  - add to `ChaosMapType`, `ChaosMapParameters` union
  - `CHAOS_MAP_DISPLAY_NAMES.ikeda = 'IKEDA_MAP'`
  - add `'ikeda'` to `VALID_MAP_TYPES`
  - add the `ikeda` arm to the `SavedConfiguration` union
- `src/lib/chaos-validation.ts`
  - `STABLE_RANGES.ikeda` — ranges for `u, x0, y0, iterations, burnIn`
  - `OPTIONAL_FIELDS.ikeda` — `renderMode` (enum), `seeds` (number),
    `colorMode` (enum), `pointSize` (number), `opacity` (number)
- `src/lib/type-guards.ts` — `isIkedaParameters`
- `src/lib/comparison-url-state.ts` — default Ikeda state + `case 'ikeda'`
- `src/routes/+page.svelte` (home) — new card, placed **after Lozi, before
  Logistic** (order: Hénon → Lozi → Ikeda → Logistic → Standard). Name
  "Ikeda Map"; description "A 2D nonlinear optical feedback map with spiral
  chaotic attractors".
- `src/lib/workers/chaosMapsWorker.ts` — add an `ikeda` multi-seed compute
  message type.

### Indicative validation ranges

(Exact bounds finalized during implementation.)

- `u`: 0 – 1
- `x0`, `y0`: −2 – 2
- `iterations`: 1 – 50000
- `burnIn`: 0 – 10000
- `seeds`: 1 – 5000 (clamped to protect performance)
- `pointSize`: small positive range
- `opacity`: 0 – 1

## Safety / Performance (PRD §10)

- Validation ranges + clamped caps on `iterations`, `seeds`, and point density
  so extreme settings cannot freeze the page.
- Debounced re-render on slider changes (existing `use-debounced-effect`
  pattern).
- Multi-seed compute on the worker keeps the main thread responsive.
- "Classic Ikeda" preset provides a one-click return to a known-good default.

## Testing Strategy

Follows existing conventions (Vitest node + jsdom projects; filename selects
environment).

### Node (`*.test.ts`)

- `src/lib/ikeda.test.ts` — determinism (identical output across runs for the
  same params), bounded/finite output, burn-in discards correct count,
  single-orbit vs multi-seed shapes, classic-attractor sanity stats.
- `validateParameters('ikeda', …)` cases in the chaos-validation tests
  (required keys, optional-field enum/number validation, rejection of unexpected
  keys, out-of-range values).
- `isIkedaParameters` in the type-guards tests.
- `comparison-url-state` ikeda default + case.

### jsdom (`*.svelte.test.ts`)

- `IkedaRenderer.svelte.test.ts` — mounts, draws to canvas, reacts to param /
  render-mode / color-mode changes, worker fallback path — mirroring
  `LoziRenderer.svelte.test.ts` / `ChaosEsthetiqueRenderer.svelte.test.ts`.
- Page interaction test — presets apply, Custom transition on edit, controls
  bound, alerts shown for unstable params — mirroring existing
  `*-page-interactions.svelte.test.ts`.
- Compare page test — mirroring `compare-pages.svelte.test.ts`.

## Acceptance Criteria (PRD §12 — restated)

1. Ikeda Map card on the home page (after Lozi, before Logistic).
2. Card opens the Ikeda module page.
3. Page renders a meaningful attractor by default (multi-seed, Classic Ikeda).
4. Feedback parameter `u` adjustable.
5. Initial condition (`x0`, `y0`) adjustable.
6. Switch between single-orbit and multi-seed render modes.
7. Presets apply.
8. Render style settings (density, point size, color mode, opacity) adjustable.
9. Snapshot works.
10. Save works (signed-in).
11. Share link generation works.
12. Compare two Ikeda configurations works.
13. Educational DATA_LOG copy present.
14. Responsive under default settings.
15. Invalid/extreme settings handled gracefully.
