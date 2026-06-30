# Chaos Module Refactor — Common Components & Declarative Scaffold

**Date:** 2026-06-29
**Status:** Approved (design)
**Scope:** Refactor the 16 chaos visualization modules to eliminate duplication and enable fast scaling to new modules.

## Problem

The app has 16 chaos visualization pages (lorenz, rossler, henon, lozi, logistic, newton,
standard, chua, clifford, ikeda, gumowski-mira, double-pendulum, bifurcation-logistic,
bifurcation-henon, chaos-esthetique, lyapunov). Despite prior modularization work, three
layers of duplication and inconsistency remain.

### Evidence

1. **Six "shared" components are orphaned** — referenced only by their own tests, used by
   zero pages:

   | Component | Page usage |
   |---|---|
   | `VisualizationHeader` | 0/16 |
   | `ParameterSlider` | 0/16 |
   | `ParameterPanel` | 0/16 |
   | `VisualizationContainer` | 0/16 |
   | `VisualizationErrorBoundary` | 0/16 |
   | `ConfigAlerts` | 0/16 (superseded by `VisualizationAlerts`, which is 16/16) |

   Meanwhile **all 16 pages inline** the header markup and the `<input type="range">` slider
   markup those components were meant to replace.

2. **Config-loading is split-brained** — 7 pages use the clean `useConfigLoader` hook
   (henon, lorenz, chua, logistic, newton, lyapunov, bifurcation-logistic); 9 still carry a
   ~110-line inline `onMount` loader (rossler, clifford, ikeda, gumowski-mira,
   double-pendulum, lozi, standard, bifurcation-henon, chaos-esthetique). The hook is
   strictly better and already exists.

3. **Renderer-layer duplication** — all 9 D3 renderers copy-paste the identical sci-fi
   axis-styling block, scale setup (`domain([ext-0.1, ext+0.1])`), and gradient
   point-plotting. The constants that exist for this (`D3_CHART_MARGIN`, `COLOR_PRIMARY`,
   `COLOR_SECONDARY` in `constants.ts`) are not imported — renderers hardcode the values.

4. **Math-module inconsistency** — `HenonRenderer`, `LogisticRenderer`, `LyapunovRenderer`,
   `ChaosEsthetiqueRenderer` inline their `calculate*()` math in the component, while
   clifford/lozi/rossler/etc. extract it to `lib/*.ts`.

Page sizes range from 280 (henon) to 812 (double-pendulum) lines, mostly chrome boilerplate.

## Goals

- Eliminate the duplicated page chrome and slider markup via a single declarative scaffold.
- Make a new chaos module mostly **data** (a param schema + a renderer + strings).
- Collapse the 9 near-identical D3 renderers.
- Standardize config-loading on `useConfigLoader`.
- Keep the existing ~100KB+ test suite green as the refactor's safety net.

## Non-Goals

- No new visualizations or math behavior changes.
- No redesign of the sci-fi visual aesthetic (output stays pixel-equivalent).
- No unrelated refactoring (auth, db, saved-configs UI).
- No forced unification of the outlier renderers (bifurcation diagrams, lyapunov heatmap,
  standard map) into the point-map base.

## Design Decisions (resolved during brainstorming)

1. **Scaffold model: fully declarative shell.** A `paramDefs` schema is the single source of
   truth driving sliders + `getParameters()` + config-load application. A
   `<VisualizationShell>` renders header, action buttons, alerts, dialogs, formula, and
   description. Extra (non-slider) controls go in an optional snippet.
2. **Renderer dedup: helpers + base component for point-maps.** Extract shared D3 helpers;
   add a thin `<D3PointMapRenderer>` for the homogeneous point-plot maps; outliers use
   helpers only; extract the 4 inline-math renderers into `lib/*.ts`.
3. **Orphans are revived inside the shell** (the shell is their missing consumer);
   `ConfigAlerts` is deleted as redundant.
4. **Execution: one combined plan**, internally milestoned so each milestone ships green.
5. **Tests: preserve behavior.** The shell emits DOM equivalent to today so existing
   page/config-loading tests stay green; new abstractions get fresh TDD tests.

## Architecture

### 1. Param schema — single source of truth

Location: `src/lib/viz/`.

```ts
// src/lib/viz/types.ts
export interface ParamDef {
  /** Matches a numeric field in the map's ChaosMapParameters union member. */
  key: string;
  /** Slider label, e.g. "a (parameter)". Must match the current page's label text. */
  label: string;
  min: number;
  max: number;
  step: number;
  /** Display formatting: value.toFixed(decimals). Omit ⇒ rendered as integer. */
  decimals?: number;
  default: number;
}
```

- One `paramDefs` array per map (e.g. `src/lib/viz/schemas/henon.ts` or a single
  `schemas.ts`; final layout decided in the plan). The slider params for a map live here.
- `min`/`max`/`step`/`label`/`decimals`/`default` must exactly match each page's current
  slider markup. This is the migration data-entry and is what keeps existing tests green.
- **Non-slider params** (selects, checkboxes, sub-components) are NOT in the schema. They
  stay page-owned and feed into parameters via the `extraControls` snippet plus the
  `buildParameters` callback (below).
- Internal constants that aren't user-facing sliders (e.g. `x0`, `y0`, `steps`, `dt`) are
  supplied by `buildParameters`, not the schema.

### 2. `<VisualizationShell>` component

Location: `src/lib/components/ui/VisualizationShell.svelte`.

Owns all chrome currently copy-pasted across 16 pages, and becomes the consumer for the
revived orphans:

| Shell region | Built from |
|---|---|
| Header + Compare/Share/Save/Snapshot/Return | `VisualizationHeader` (revived) + action buttons |
| Alerts (save/config/stability) | `VisualizationAlerts` (existing) |
| Control panel (decor corners, SYSTEM_PARAMETERS heading, auto sliders) | `ParameterPanel` + `ParameterSlider` (revived) |
| Renderer container | `VisualizationContainer` + `VisualizationErrorBoundary` (revived) |
| Save/Share dialogs + config loading | `SaveConfigDialog`, `ShareDialog`, `useConfigLoader`, save/share hooks (internalized) |
| Info panel (DATA_LOG) | inline |

`ConfigAlerts` is deleted. The revived orphans get small markup tweaks to match the current
per-page DOM exactly (label classes, value formatting, ids, badges) so tests stay green.

**Props (shape; finalized in the plan):**

```ts
interface VisualizationShellProps<T extends ChaosMapType> {
  mapType: T;
  title: string;
  moduleNumber?: string;
  paramDefs: ParamDef[];
  /** Combines reactive slider values (+ page-owned extras) into the typed param object. */
  buildParameters: (values: Record<string, number>) => ParametersFor<T>;
  /** Formula lines rendered in the mono grid. */
  formula: string[];
  formulaColumns?: 2 | 3;
  description: { heading: string; body: string };
  isAuthenticated: boolean;
  /** Optional: apply non-slider params loaded from a saved/shared config. */
  onExtraParametersLoaded?: (params: ParametersFor<T>) => void;
  /** Snippets */
  renderer: Snippet<[{ values: Record<string, number>; container: { el?: HTMLElement } }]>;
  extraControls?: Snippet;
}
```

**Reactive flow inside the shell:**

- `let values = $state(fromDefaults(paramDefs))` — initialized from `default`s.
- `const parameters = $derived(buildParameters(values))` — used for save/share/compare/stability.
- Save/share handlers via `createSaveHandler` / `createShareHandler` reading `parameters`.
- `comparisonUrl` derived from `parameters` via `buildComparisonUrl` / `createComparisonStateFromCurrent`.
- Config loading via `useConfigLoader` in an `$effect`: `onParametersLoaded` assigns each
  schema `key` from the loaded params (clamped to the def's min/max), calls
  `onExtraParametersLoaded`, and returns `buildParameters(values)` for the stability check.
- Cleanup `$effect` returns the save/share handler cleanups on unmount.

**Snapshot consistency note:** 14/16 pages currently render `SnapshotButton` with
`targetType="container"`; rossler and lyapunov do not. The shell exposes a `showSnapshot`
prop (default `true`) so those two migrate with snapshot disabled, preserving current DOM —
or enable it for them as a deliberate, separately-flagged enhancement. Default behavior must
not silently add the button where tests assert its absence.

**Container ref flow** (the one non-obvious binding): the shell owns
`const container = $state<{ el?: HTMLElement }>({})`, passes it to the `renderer` snippet,
the page's snippet binds the renderer's existing `containerElement` bindable to
`container.el` (`bind:containerElement={container.el}`), and the shell feeds `container.el`
to `SnapshotButton`. This works because Svelte 5 supports `bind:prop={obj.field}` and lets
the snippet (defined in the page) write back into shell-owned state passed as a snippet arg.

**Example migrated page (henon, ~280 → ~40 lines):**

```svelte
<script lang="ts">
  import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
  import HenonRenderer from '$lib/components/visualizations/HenonRenderer.svelte';
  import { henonParamDefs } from '$lib/viz/schemas/henon';
  import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
  let { data } = $props();
</script>

<VisualizationShell
  mapType="henon" title="HÉNON_MAP" moduleNumber="02"
  paramDefs={henonParamDefs}
  buildParameters={(v) => ({ type: 'henon', a: v.a, b: v.b, iterations: v.iterations })}
  formula={['x(n+1) = y(n) + 1 - a·x(n)²', 'y(n+1) = b·x(n)']}
  description={{ heading: 'DATA_LOG: HÉNON_MAP', body: 'The Hénon map is a discrete-time…' }}
  isAuthenticated={!!data?.session}>
  {#snippet renderer({ values, container })}
    <HenonRenderer a={values.a} b={values.b} iterations={values.iterations}
      bind:containerElement={container.el} height={VIZ_CONTAINER_HEIGHT} />
  {/snippet}
</VisualizationShell>
```

**Complex pages** (lorenz, chua, clifford, ikeda, gumowski-mira) add an `extraControls`
snippet for their selects/checkboxes/sub-components, keep that state in the page, and fold
it into `buildParameters` + handle it in `onExtraParametersLoaded`.

### 3. Renderer layer

**`src/lib/viz/d3-chaos.ts`** — shared helpers, using `D3_CHART_MARGIN`, `COLOR_PRIMARY`,
`COLOR_SECONDARY`:

- `createSvg(container, height, margin)` — clear container, append sized `<svg><g>`.
- `makeLinearScales(points, { width, height, pad })` — extents → linear x/y scales.
- `drawSciFiAxes(svg, xScale, yScale, { width, height, labels? })` — the cyan grid/tick
  styling block, optional axis text labels.
- `plotGradientPoints(svg, points, { xScale, yScale, r, opacity, glow })` — cyan→magenta
  gradient circles, optional drop-shadow glow.

**`src/lib/components/visualizations/D3PointMapRenderer.svelte`** — base for the 5
homogeneous point maps (henon, lozi, clifford, ikeda, gumowski-mira). Props: `iterate(params)
⇒ [number, number][]`, `params`, `height`, `containerElement` (bindable), axis-label toggle,
point style (`r` / `opacity` / `glow`), container-chrome variant, badge text. Configurable
enough to reproduce each map's current exact output (e.g. henon uses r=2/opacity=0.8/glow +
X_AXIS/Y_AXIS labels + corner-decor chrome; lozi uses r=1.5/opacity=0.7/no labels + simpler
chrome). The 5 renderers become thin wrappers over this base.

**Outliers** (standard, lyapunov, bifurcation-henon, bifurcation-logistic,
chaos-esthetique) keep their own components but call the `d3-chaos` helpers where applicable.

**Math extraction** — move inline math from `HenonRenderer`, `LogisticRenderer`,
`LyapunovRenderer`, `ChaosEsthetiqueRenderer` into pure, tested `lib/*.ts` modules
(`lib/henon.ts`, `lib/logistic.ts`, and modules for the lyapunov/chaos-esthetique renderer
math), consistent with clifford/lozi/etc.

## Data Flow

```
paramDefs ──► shell `values` ($state) ──► buildParameters ──► save / share / compare / stability
                       │
                       └──► renderer snippet ──► renderer draws

URL (?config | ?share | ?configId) ──► useConfigLoader ──► apply slider keys to `values` (clamped)
                                                          + onExtraParametersLoaded ──► re-render
```

## Error Handling

- Config/stability errors surfaced through `VisualizationAlerts` (unchanged contract).
- `VisualizationErrorBoundary` wraps the renderer so a draw-time throw cannot blank the page.
- `Number.isFinite` divergence guards preserved when extracting math modules.
- Save/share handler timeouts cleaned up on unmount (shell-owned), matching current behavior.

## Testing Strategy

- **Regression net:** the existing page-interaction and config-loading tests
  (`*-page-interactions.svelte.test.ts`, `*-config-loading.svelte.test.ts`,
  `visualization-*.svelte.test.ts`) stay green. The shell must emit equivalent DOM (labels,
  slider `min`/`max`/`step`/`id`, value formatting, buttons, badges, formula, alerts).
- **New TDD tests:**
  - `ParamDef` schema utilities (defaults, formatting, clamping).
  - `VisualizationShell` — renders header/sliders/formula/alerts/dialogs; wires
    save/share/compare/config-load; exposes container ref to the renderer snippet for snapshot.
  - `d3-chaos` helpers — scale domains, axis attributes, gradient interpolation.
  - `D3PointMapRenderer` — per-config output (labels on/off, r/opacity/glow, chrome variant).
  - Each extracted math module — values, divergence guards, edge cases.
- **Orphan tests:** kept and updated to match any markup tweaks; they finally exercise the
  real consumer (the shell) rather than dead code.
- **Full verification at the end:** `bun run check`, `bun run lint`, `bun run test`,
  `bun run test:e2e`.

## Execution Plan (one combined plan, internally milestoned)

Each milestone leaves the suite green.

- **M1 — Abstractions:** add `src/lib/viz/` (schema types + helpers), build
  `VisualizationShell`, revive/adjust the 5 reusable orphans, delete `ConfigAlerts`. No page
  changes yet. New TDD tests for schema + shell.
- **M2 — Renderer layer:** add `d3-chaos.ts` helpers + `D3PointMapRenderer`; extract the 4
  inline-math modules. Rewire the 5 point-map renderers + outliers to the helpers. Renderer
  tests stay green; new tests for helpers/base/math.
- **M3 — Migrate 10 slider-only pages** to the shell (rossler, henon, logistic, newton,
  lozi, standard, bifurcation-logistic, bifurcation-henon, chaos-esthetique, lyapunov),
  standardizing all on `useConfigLoader`. Tests green.
- **M4 — Migrate 5 complex pages** (lorenz, chua, clifford, ikeda, gumowski-mira) using the
  `extraControls` snippet. Tests green.
- **M5 — Cleanup & verify:** remove dead inline code, confirm no orphans remain, run
  `check` / `lint` / `test` / `test:e2e`.

## Risks & Mitigations

- **DOM drift breaking tests** — mitigate by matching markup exactly in revived orphans and
  the shell; migrate one page first and run its tests before proceeding.
- **Snapshot container binding** — validated approach (`bind:prop={obj.field}` into
  shell-owned state via snippet arg); covered by a shell test.
- **Outlier renderers don't fit the base** — explicitly kept on helpers-only; no forced
  unification.
- **Type-safety of `buildParameters`** — keyed to `ParametersFor<T>` so the discriminated
  union is preserved per map.

## Success Criteria

- Zero orphaned visualization components; `ConfigAlerts` removed.
- All 16 pages use `VisualizationShell` and `useConfigLoader`.
- The 5 point-map renderers are thin wrappers over `D3PointMapRenderer`; D3 styling/scale/
  plot code lives once in `d3-chaos.ts`.
- No inline `calculate*` math remains in renderer components.
- A new chaos module can be added with a schema + renderer + strings (+ optional extras).
- `bun run check`, `lint`, `test`, and `test:e2e` all pass.
