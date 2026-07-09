# Tinkerbell Map Visualization Module — Design

- **Linear issue:** [HPA-60](https://linear.app/cwchanap/issue/HPA-60/add-tinkerbell-map-visualization-module)
- **PRD:** [Additional Chaotic Map Visualizations](https://linear.app/cwchanap/document/prd-additional-chaotic-map-visualizations-1a69b476e276)
- **Date:** 2026-07-08
- **Status:** Design — pending review

## Summary

Add the **Tinkerbell Map** as a new chaotic-map visualization module, with full feature parity to its nearest sibling, the Clifford Attractor. It is a 2D discrete-time chaotic map that produces a dense, delicate point-cloud strange attractor. The module follows the established one-renderer-per-map convention.

**Route:** `/tinkerbell` (+ `/tinkerbell/compare` for parity).
**Homepage card:** Title `Tinkerbell Map`, description `A 2D chaotic map producing delicate, dense strange-attractor structures`, CTA `Initialize Module`.

## The map and its divergence risk

The Tinkerbell map is the recurrence:

```
x(n+1) = x(n)² − y(n)² + a·x(n) + b·y(n)
y(n+1) = 2·x(n)·y(n)  + c·x(n) + d·y(n)
```

**Default parameters:** `a = 0.9`, `b = -0.6013`, `c = 2.0`, `d = 0.5`.

### Critical difference from Clifford

Clifford is built from `sin`/`cos` and is therefore analytically bounded (it can never diverge). **Tinkerbell has quadratic terms (`x²`, `y²`, `2xy`) and is NOT bounded** — for many parameter sets the orbit escapes to infinity in a handful of steps. This makes two guards load-bearing rather than decorative:

1. **Finiteness guard** — break the loop if `x` or `y` becomes non-finite (shared with Clifford).
2. **Magnitude / runaway guard** — break the loop if `|x|` or `|y|` exceeds a magnitude cap (`1e6`). The divergent point is NOT collected, so it cannot pollute the d3 extent and crush the visible attractor into a single pixel.

This guard is the only real mathematical novelty relative to the Clifford implementation.

## Architecture decision

**Clone-and-modify per map** (the codebase's existing convention — every map has its own renderer, e.g. `CliffordRenderer`, `IkedaRenderer`, `GumowskiMiraRenderer`). A shared `PointCloudRenderer` abstraction was considered and deferred: the PRD's remaining maps are not identical in structure (multi-seed, image-scramble, etc.), so abstracting now risks an awkward seam. Extraction can be revisited once a third near-identical point-cloud map lands.

## Files to create

### 1. `src/lib/tinkerbell.ts` — the math

Mirror of `src/lib/clifford.ts`.

- `export interface TinkerbellParams { a, b, c, d: number; iterations: number; maxPoints?: number }`
- `calculateTinkerbellTuples(params): [number, number][]` — single orbit capped at `maxPoints`, with the two guards above.
- Fixed internal seed (e.g. `START_X = -0.72`, `START_Y = -0.64` — the conventional Tinkerbell initial point), not user-exposed or persisted (same rationale as Clifford).

### 2. `src/lib/tinkerbell-presets.ts` — presets

Mirror of `src/lib/clifford-presets.ts`.

- `TinkerbellPresetState { a, b, c, d, iterations; colorMode: TinkerbellColorMode; zoom, pointSize, opacity }`
- `TinkerbellPreset { id, label, state }`
- `TINKERBELL_PRESETS` array (see Presets below).
- `DEFAULT_TINKERBELL_PRESET_ID = 'classic'`
- `getPreset(id)`, `detectPresetId(state)` with `numbersClose` helper.

### 3. `src/lib/components/visualizations/TinkerbellRenderer.svelte` — renderer

Clone of `CliffordRenderer.svelte`, adapted to call `calculateTinkerbellTuples` and post `{ type: 'tinkerbell', ... }` to the worker. Preserves:

- d3 canvas + sci-fi svg axes, `MAX_POINTS = 250000`, debounced render (`DEBOUNCE_MS = 250`).
- 5 color modes: `density`, `iteration`, `radius`, `angle`, `single` (identical set + rendering logic to Clifford).
- `zoom`, `pointSize`, `opacity` props; `pointSize`/`opacity` disabled under `density` mode.
- **Worker offload with main-thread fallback** (`computeMainThread` → `calculateTinkerbellTuples` when no worker).
- Worker response handler matches on `type: 'tinkerbellResult'`.
- `paramsValid()` guards all numeric props are finite and `iterations > 0`.

### 4. `src/routes/tinkerbell/+page.svelte` — main page

Mirror of `src/routes/clifford/+page.svelte`:

- Page-owned `$state` for `a, b, c, d, iterations, colorMode, zoom, pointSize, opacity` rendered through the `extraControls` snippet.
- Presets bar (with active-preset detection), Shape Parameters (a/b/c/d/iterations), Render Controls (colorMode/zoom/pointSize/opacity), Randomize and Reset buttons.
- `createStabilityReporter({ mapType: 'tinkerbell', getParams, reactive: true })` with a tracking `$effect`.
- `buildParameters(): TinkerbellParameters` and `onExtraParametersLoaded` restore for save/share/config-load.
- `<VisualizationShell>` props: `mapType="tinkerbell"`, `title="TINKERBELL_MAP"`, `paramDefs={[]}`, the formula lines, and educational copy in `description`.
- Randomize: `a,b,c,d` in `[-2, 2]` at 2dp (matches Clifford's randomize range).

### 5. `src/routes/tinkerbell/+page.server.ts` — session loader

Mirror of Clifford's: provides `session` (and `user`/`profile` if present) for the shell's `isAuthenticated` binding.

### 6. `src/routes/tinkerbell/compare/+page.svelte` — comparison page (parity)

Mirror of `src/routes/clifford/compare/+page.svelte`:

- `decodeComparisonState($page.url, 'tinkerbell')`, `getDefaultParameters('tinkerbell')`, `getStableRanges('tinkerbell')!`.
- `clampParams` over a/b/c/d/iterations; shared styling params (colorMode/zoom/pointSize/opacity) from the left side.
- Left/right `a,b,c,d,iterations` sliders (a–d range `[-3, 3]` step 0.01; iterations `10000–250000` step 10000), debounced URL sync, swap via `ComparisonLayout`.
- Two `TinkerbellRenderer` instances (`height={400}`).

## Files to modify (registration surface)

### `src/lib/types.ts`
- `ChaosMapType`: add `'tinkerbell'`.
- Add the color-mode set, mirroring Clifford's pattern:
  ```ts
  export const TINKERBELL_COLOR_MODES = ['density', 'iteration', 'radius', 'angle', 'single'] as const;
  export type TinkerbellColorMode = (typeof TINKERBELL_COLOR_MODES)[number];
  ```
- Add `TinkerbellParameters`:
  ```ts
  export interface TinkerbellParameters {
      type: 'tinkerbell';
      a: number; b: number; c: number; d: number;
      iterations: number;
      colorMode?: TinkerbellColorMode;
      zoom?: number;
      pointSize?: number;
      opacity?: number;
  }
  ```
- `ChaosMapParameters` union: add `TinkerbellParameters`.
- `SavedConfiguration` discriminated union: add the `mapType: 'tinkerbell'` arm.
- `CHAOS_MAP_DISPLAY_NAMES`: add `tinkerbell: 'TINKERBELL_MAP'`.
- `VALID_MAP_TYPES`: add `'tinkerbell'`.

### `src/lib/chaos-validation.ts`
- `STABLE_RANGES.tinkerbell` — mirror Clifford's numeric core:
  ```ts
  tinkerbell: {
      a: { min: -3, max: 3 },
      b: { min: -3, max: 3 },
      c: { min: -3, max: 3 },
      d: { min: -3, max: 3 },
      iterations: { min: 1, max: 250000 }
  }
  ```
- `OPTIONAL_FIELDS.tinkerbell` — mirror Clifford:
  ```ts
  tinkerbell: {
      colorMode: { kind: 'enum', values: [...TINKERBELL_COLOR_MODES] },
      zoom: { kind: 'number', min: 0.5, max: 5 },
      pointSize: { kind: 'number', min: 0.5, max: 6 },
      opacity: { kind: 'number', min: 0, max: 1 }
  }
  ```
- `checkParameterStability`: no mandatory new case. (The runaway guard lives in the orbit function, not in stability; stability ranges already cover wildly out-of-range values. The plan will confirm whether a divergence advisory adds value.)

### `src/lib/comparison-url-state.ts`
- Import `getPreset as getTinkerbellPreset`, `DEFAULT_TINKERBELL_PRESET_ID` from `$lib/tinkerbell-presets`.
- Add to `getDefaultParameters`:
  ```ts
  case 'tinkerbell': {
      const preset = getTinkerbellPreset(DEFAULT_TINKERBELL_PRESET_ID);
      if (!preset) throw new Error(`Missing default Tinkerbell preset: ${DEFAULT_TINKERBELL_PRESET_ID}`);
      return { type: 'tinkerbell', ...preset.state };
  }
  ```

### `src/lib/workers/types.ts`
- Add `TinkerbellRequest { type: 'tinkerbell'; id; a; b; c; d; iterations; maxPoints }` and `TinkerbellResponse { type: 'tinkerbellResult'; id; points }`.
- Add both to the `ChaosMapsWorkerRequest` / `ChaosMapsWorkerResponse` unions.

### `src/lib/workers/chaosMapsHandler.ts`
- This is where the request-dispatch switch lives (it already imports `calculateCliffordTuples` and returns `{ type: 'cliffordResult', id, points }`). Add a `case 'tinkerbell'` mirroring the `clifford` case: import `calculateTinkerbellTuples`, compute points, return `{ type: 'tinkerbellResult', id, points }`. (`chaosMapsWorker.ts` only wires the message port to this handler — no change needed there beyond the type-union edit above.)

### `src/routes/+page.svelte`
- Add a homepage card in the `visualizations` array (placed after the Clifford card):
  ```ts
  {
      name: 'Tinkerbell Map',
      description: 'A 2D chaotic map producing delicate, dense strange-attractor structures',
      url: '/tinkerbell',
      color: 'from-violet-500 to-fuchsia-600'
  }
  ```

## Presets (initial set)

All four are validated visually during implementation; any that diverge or look uninteresting are replaced.

| id | label | a | b | c | d |
|---|---|---|---|---|---|
| `classic` (default) | Classic | 0.9 | -0.6013 | 2.0 | 0.5 |
| `symmetric` | Symmetric Pair | 0.8 | -0.6 | 1.7 | 0.5 |
| `delicate` | Delicate | -0.71 | -0.4 | 1.1 | 0.4 |
| `dense-spiral` | Dense Spiral | 0.97 | -0.799 | 1.85 | 0.55 |

Shared styling defaults across presets: `iterations` 100000 (classic) / scaled per preset, `colorMode: 'iteration'`, `zoom: 1`, `pointSize: 1`, `opacity: 0.6` — finalized during implementation to match what renders well.

## Educational copy (description body)

Concise, plain-language, in the established DATA_LOG style — explains Tinkerbell as a discrete-time chaotic recurrence whose quadratic terms let the orbit escape to infinity for many parameter sets (unlike the bounded Clifford map), and that the four parameters shape the attractor's delicate structure. Kept short per the PRD's "avoid overwhelming equations" guidance; the formula is already shown in the control panel.

## Testing

Follow the existing per-map test pattern:

- **Unit (node project):**
  - `tinkerbell.test.ts` — `calculateTinkerbellTuples`: produces points, caps at `maxPoints`, breaks on non-finite, **breaks and drops the runaway point when the magnitude cap is exceeded**, returns `[]` for `iterations <= 0`.
  - Extend `chaos-validation.test.ts` with tinkerbell cases (valid/missing/extra params; stability in/out of range).
  - Extend type/union tests for `TinkerbellParameters` / `'tinkerbell'` membership.
- **Component / config-loading (jsdom project):**
  - `tinkerbell-config-loading.svelte.test.ts` — mirror the Clifford config-loading test (configId/share/config param, clamp, warnings, dismiss).
  - `tinkerbell-page-interactions.svelte.test.ts` — preset apply/reset/randomize/slider rendering.
  - `tinkerbell-compare-interactions.svelte.test.ts` — compare URL encode/decode/clamp, defaults when no state, swap.
- **Worker:** extend `chaosMapsWorker.test.ts` with a tinkerbell request/response case.
- **Renderer worker test:** mirror `CliffordRenderer.worker.svelte.test.ts` if present.

Run with: `bun run check`, `bun run test`, `bun run lint`.

## Acceptance criteria mapping

| Issue criterion | How satisfied |
|---|---|
| Homepage includes a Tinkerbell card linking to `/tinkerbell` | Homepage card edit |
| `/tinkerbell` renders without errors | New route + renderer |
| Default parameters produce a visually interesting attractor | `classic` preset = issue defaults |
| Parameter controls update the visualization | page-owned `$state` + reactive renderer |
| Reset and randomize actions work | buttons wired to `applyPreset` / `randomizeParameters` |
| Route includes short explanatory copy | `description` body |
| Usable on desktop and mobile | inherited shell layout + responsive control grids |
| NaN / infinite / runaway guard | finiteness + magnitude guards in orbit function |

## Non-goals

- The other 5 maps from the PRD (Gingerbreadman, Arnold Cat, Baker's, and any not-yet-built ones) — separate issues.
- Extracting a shared `PointCloudRenderer`.
- Server-side rendering or persistence beyond the existing save/share/config-load machinery.
- A divergence-specific stability advisory (will revisit during implementation if testing reveals a clear need).
