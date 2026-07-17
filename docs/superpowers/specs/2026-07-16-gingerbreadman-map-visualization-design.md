# Gingerbreadman Map Visualization Module — Design

- **Linear issue:** [HPA-61](https://linear.app/cwchanap/issue/HPA-61/add-gingerbreadman-map-visualization-module)
- **PRD:** [Additional Chaotic Map Visualizations](https://linear.app/cwchanap/document/prd-additional-chaotic-map-visualizations-1a69b476e276)
- **Date:** 2026-07-16
- **Status:** Design — approved with review clarifications (2026-07-16)

## Summary

Add the **Gingerbreadman Map** as a new chaotic-map visualization module with **full feature parity** to its nearest sibling, the Tinkerbell Map. It is a 2D discrete-time piecewise-linear map whose orbit forms a distinctive fractal-like “gingerbread” figure. The map itself has **no free shape parameters**; the primary story knobs are **initial conditions** `(x0, y0)` plus iteration count and render controls.

**Route:** `/gingerbreadman` (+ `/gingerbreadman/compare` for parity).  
**Homepage card:** Title `Gingerbreadman Map`, description `A simple chaotic map whose orbit forms a distinctive fractal-like figure`, CTA `Initialize Module`.  
**Map type id:** `gingerbreadman` (no hyphen).  
**Display name:** `GINGERBREADMAN_MAP`.

## The map

Suggested recurrence (ticket / PRD):

```text
x[n+1] = 1 − y[n] + |x[n]|
y[n+1] = x[n]
```

Unlike Clifford (sin/cos, analytically bounded) and Tinkerbell (quadratic, shape params `a–d`, fixed internal seed), Gingerbreadman:

1. Has a **fixed** rule — no `a/b/c/d`.
2. **Exposes and persists** the initial point `(x0, y0)` — IC is the educational story.
3. Can still produce runaway coordinates for poor ICs, so the same two orbit guards as Tinkerbell apply.

### Orbit guards (load-bearing)

1. **Finiteness guard** — break if `x` or `y` is non-finite; do **not** collect the bad point.
2. **Magnitude / runaway guard** — break if `|x|` or `|y|` exceeds `MAGNITUDE_CAP` (`1e4`). Drop the runaway point so d3 extents stay usable.

Renderer also caps collected points (`maxPoints`, default **250 000**).

## Architecture decision

**Clone-and-modify Tinkerbell** (Approach A — approved):

- Math module, presets, renderer, page, compare page, worker case, and full registration surface mirror Tinkerbell.
- Swap shape params `a/b/c/d` for **user-facing** `x0/y0`.
- Compare URL↔slider sync follows the **Arnold Cat compare** template (`untrack` + debounce teardown on `$page.url` changes).

A shared `PointCloudRenderer` abstraction remains a **non-goal** for this ticket (same deferral as Tinkerbell). Extraction can be a follow-up once three near-identical point-cloud maps are stable.

## Product decisions (v1)

| Decision | Choice |
|----------|--------|
| Feature parity | Full sibling parity (Tinkerbell): compare, worker, 5 color modes, presets, save/share |
| Story knobs | Initial conditions + iterations |
| Color modes | `density`, `iteration`, `radius`, `angle`, `single` |
| Default color mode | `iteration` (ticket emphasizes color-by-iteration; density still available) |
| Presets | Curated `(x0, y0)` starts (+ light render style differences) |
| Animation | None — static point cloud only |
| Multi-seed densify | No |
| Click-to-set IC on canvas | No |

### Explicit non-goals

- Shared `PointCloudRenderer` extraction
- Multi-seed / multi-orbit densification (Ikeda-style)
- Animated step-through of the orbit
- Canvas click-to-set initial point
- Generalized map parameters (affine variants, etc.)
- Other PRD maps (separate issues)
- Server-side rendering or persistence beyond existing save/share/config-load
- Dedicated Playwright e2e for this map (match Tinkerbell: unit + component/interaction tests only)
- Divergence-specific stability advisory beyond range checks (revisit only if implementation needs it)

## Parameters

```typescript
export const GINGERBREADMAN_COLOR_MODES = [
	'density',
	'iteration',
	'radius',
	'angle',
	'single'
] as const satisfies readonly string[];

export type GingerbreadmanColorMode = (typeof GINGERBREADMAN_COLOR_MODES)[number];

export interface GingerbreadmanParameters {
	type: 'gingerbreadman';
	x0: number;
	y0: number;
	iterations: number;
	// Optional render state — persisted so save/share/snapshot reproduce exactly
	colorMode?: GingerbreadmanColorMode;
	zoom?: number;
	pointSize?: number;
	opacity?: number;
}
```

### Ranges (`STABLE_RANGES` / `OPTIONAL_FIELDS`)

| Field | Range | Notes |
|-------|--------|--------|
| `x0` | `[-10, 10]` | Slider step `0.01` |
| `y0` | `[-10, 10]` | Slider step `0.01` |
| `iterations` | `1 … 250_000` | UI slider may use `10_000 … 250_000` step `10_000` |
| `colorMode` | enum of five modes | optional field |
| `zoom` | `0.5 … 5` | optional |
| `pointSize` | `0.5 … 6` | optional; disabled under `density` |
| `opacity` | `0 … 1` | optional; disabled under `density` |

**Clamping:** `validateParameters` does not reject out-of-range values; clamp at `onExtraParametersLoaded`, compare `clampParams`, and any reinit boundary (same discipline as recent maps).

### Defaults (`classic` preset)

| Field | Default |
|-------|---------|
| `x0` | `-0.1` |
| `y0` | `0` |
| `iterations` | `100_000` |
| `colorMode` | `'iteration'` |
| `zoom` | `1` |
| `pointSize` | `1.5` |
| `opacity` | `0.6` |

Defaults may be tuned slightly during implementation if the classic figure needs a better conventional seed; the contract is “recognizable gingerbread orbit,” not a specific decimal.

## Files to create

### 1. `src/lib/gingerbreadman.ts` — the math

- `export interface GingerbreadmanParams { x0, y0, iterations: number; maxPoints?: number }`
- `calculateGingerbreadmanTuples(params): [number, number][]` — single orbit from **user** `(x0, y0)`, capped at `maxPoints`, with finiteness + magnitude guards
- `iterations <= 0` or `maxPoints <= 0` → `[]`
- No fixed internal seed

### 2. `src/lib/gingerbreadman-presets.ts` — presets

Mirror of `src/lib/tinkerbell-presets.ts`, IC-focused:

- `GingerbreadmanPresetState { x0, y0, iterations; colorMode; zoom, pointSize, opacity }`
- `GingerbreadmanPreset { id, label, state }`
- `GINGERBREADMAN_PRESETS` array (see Presets below)
- `DEFAULT_GINGERBREADMAN_PRESET_ID = 'classic'`
- `getPreset(id)`, `detectPresetId(state)` with `numbersClose` for floats

### 3. `src/lib/components/visualizations/GingerbreadmanRenderer.svelte` — renderer

Clone of `TinkerbellRenderer.svelte`, adapted for `x0`/`y0`:

- d3 canvas + sci-fi svg axes, `MAX_POINTS = 250000`, debounced render (`DEBOUNCE_MS = 250`)
- Five color modes (identical set + rendering logic to Tinkerbell/Clifford)
- `zoom`, `pointSize`, `opacity` props; disable pointSize/opacity under `density`
- Worker post `{ type: 'gingerbreadman', id, x0, y0, iterations, maxPoints }` → handle `gingerbreadmanResult`
- Main-thread fallback → `calculateGingerbreadmanTuples`
- `paramsValid()`: all numeric props finite, `iterations > 0`

### 4. `src/routes/gingerbreadman/+page.svelte` — main page

Mirror of `src/routes/tinkerbell/+page.svelte` with IC controls:

- Page-owned `$state` for `x0, y0, iterations, colorMode, zoom, pointSize, opacity` via `extraControls`
- Presets bar, Initial conditions, Orbit, Render controls, Randomize + Reset
- `createStabilityReporter({ mapType: 'gingerbreadman', getParams, reactive: true })` + tracking `$effect`
- `buildParameters(): GingerbreadmanParameters` and `onExtraParametersLoaded` with clamps
- `<VisualizationShell>`: `mapType="gingerbreadman"`, `title="GINGERBREADMAN_MAP"`, `paramDefs={[]}`, formula lines, educational `description`
- **No `+page.server.ts`** — session from root layout (same as Tinkerbell/Clifford)

### 5. `src/routes/gingerbreadman/compare/+page.svelte` — comparison page

Mirror Tinkerbell compare structure; **URL sync pattern from Arnold Cat compare**:

- `decodeComparisonState($page.url, 'gingerbreadman')`, `getDefaultParameters('gingerbreadman')`, `getStableRanges('gingerbreadman')!`
- `clampParams` over `x0`, `y0`, `iterations`; shared styling from the **left** side
- Left/right sliders for `x0`/`y0`/`iterations`; debounced URL sync with `untrack` on external URL changes; cleanup debounce on effect teardown
- Two `GingerbreadmanRenderer` instances (`height={400}`)

### 6. Tests (new)

| File | Role |
|------|------|
| `src/lib/gingerbreadman.test.ts` | Math unit tests |
| `src/lib/components/visualizations/GingerbreadmanRenderer.svelte.test.ts` | Renderer smoke |
| `src/lib/components/visualizations/GingerbreadmanRenderer.worker.svelte.test.ts` | Worker path (mirror Tinkerbell) |
| `src/routes/gingerbreadman-page-interactions.svelte.test.ts` | Preset / reset / randomize / sliders |
| `src/routes/gingerbreadman-config-loading.svelte.test.ts` | Config/share load + clamp + warnings |
| `src/routes/gingerbreadman-compare-interactions.svelte.test.ts` | Compare URL encode/decode/clamp/swap |
| `src/lib/comparison-url-state-gingerbreadman-preset.test.ts` | **Required** (not optional): defaults from default preset + preset-state wiring. Sibling maps with a PRESETS array all ship this file (`clifford`, `tinkerbell`, `ikeda`, `gumowski-mira`, `double-pendulum`). Arnold Cat skips it only because it has no preset array. |

### 7. Migration

`drizzle/0014_add_gingerbreadman_map_type.sql` — add `'gingerbreadman'` to both CHECK constraints (`check_valid_map_type` and `chk_shared_configurations_map_type`), following `0013_add_arnold_cat_map_type.sql`.

- **Append at end** of each `IN (...)` list (after `'arnold-cat'`), preserving the shared ordering invariant with `VALID_MAP_TYPES`.
- Update the migration comment from “all 19 map types” (0013 wording) to **“all 20 map types.”**
- `schema.test.ts` asserts `constraintTypes.toHaveLength(VALID_MAP_TYPES.length)` against the latest migration SQL — both CHECK lists must gain the new type or that test fails.

## Files to modify (registration surface)

| File | Change |
|------|--------|
| `src/lib/types.ts` | `ChaosMapType`, color-mode tuple/type, `GingerbreadmanParameters`, `ChaosMapParameters`, `SavedConfiguration` arm, `CHAOS_MAP_DISPLAY_NAMES`, `VALID_MAP_TYPES` (**append** `'gingerbreadman'` at the end of the union/`VALID_MAP_TYPES` array, after `'arnold-cat'`) |
| `src/lib/chaos-validation.ts` | `STABLE_RANGES.gingerbreadman`, `OPTIONAL_FIELDS.gingerbreadman`; no mandatory `checkParameterStability` special case |
| `src/lib/comparison-url-state.ts` | `getDefaultParameters` case from default preset |
| `src/lib/workers/types.ts` | `GingerbreadmanRequest` / `GingerbreadmanResponse` in request/response unions |
| `src/lib/workers/chaosMapsHandler.ts` | `case 'gingerbreadman'` → `calculateGingerbreadmanTuples` → `gingerbreadmanResult` |
| `src/routes/+page.svelte` | Homepage card (visual placement near Tinkerbell / other discrete maps is fine; independent of `VALID_MAP_TYPES` order) |
| `CLAUDE.md` | Project overview: **19 → 20** systems; append Gingerbreadman to the parenthetical map list. (`Agents.md` / `AGENTS.md` are symlinks to `CLAUDE.md` — one edit covers all three.) |
| `drizzle/meta/_journal.json` | Entry `{ idx: 14, tag: '0014_add_gingerbreadman_map_type' }` |
| `src/lib/types.test.ts` | **Append** `'gingerbreadman'` to `EXPECTED_MAP_TYPES` (same end-of-list order as `VALID_MAP_TYPES`); display-name assertion if present |
| `src/lib/api-validation.test.ts` | **Append** `'gingerbreadman'` to bi-directional `expectedTypes` list |
| `src/lib/server/db/schema.test.ts` | **Add a parallel** `test('drizzle journal registers the 0014 gingerbreadman migration', …)` (idx `14`, tag `0014_add_gingerbreadman_map_type`). Do **not** replace the existing 0013 arnold-cat journal test. |
| `src/lib/chaos-validation.test.ts` | Gingerbreadman parameter validation suite |
| `src/lib/comparison-url-state.test.ts` | Exhaustive lists + round-trip describe (mirror Tinkerbell); append type in any ordered type lists |
| `src/lib/workers/chaosMapsWorker.test.ts` | Gingerbreadman request/response case |
| `src/routes/page.svelte.test.ts` | Card/CTA counts **19 → 20**; add `{ name: 'Gingerbreadman Map', url: '/gingerbreadman' }` |

### Homepage card

```ts
{
	name: 'Gingerbreadman Map',
	description: 'A simple chaotic map whose orbit forms a distinctive fractal-like figure',
	url: '/gingerbreadman',
	color: 'from-amber-500 to-rose-600' // distinct warm gradient; adjust if it collides with an existing card
}
```

## Presets (initial set)

Validated visually during implementation; replace any that diverge or look uninteresting.

| id | label | x0 | y0 | intent |
|----|--------|-----|-----|--------|
| `classic` (default) | Classic | `-0.1` | `0` | Recognizable gingerbread figure |
| `near-origin` | Near Origin | `-0.3` | `0` | Alternate textbook-style seed |
| `offset` | Offset Seed | `0.5` | `-0.5` | Different transient into the attractor |
| `far-field` | Far Field | `3` | `-2` | Sensitivity: farther IC, same map |

Shared defaults unless a preset overrides for discoverability:

- `iterations: 100_000`
- At least one preset uses `colorMode: 'density'`, one uses `'radius'` or `'angle'`; classic uses `'iteration'`
- `zoom: 1`, `pointSize: 1.5`, `opacity: 0.6`

## UX details

### Main page control order

1. Presets bar (active detection; “Custom” when no match)
2. Initial conditions — `x0`, `y0`
3. Orbit — `iterations`
4. Render — `colorMode`, `zoom`, `pointSize`, `opacity`
5. Randomize + Reset

### Randomize / Reset

- **Reset** → apply `DEFAULT_GINGERBREADMAN_PRESET_ID` (`classic`)
- **Randomize** → `x0`, `y0` uniform in `[-5, 5]` at 2 decimal places (narrower than full slider so random stays interesting more often); optionally re-roll `colorMode`; leave `iterations` / zoom / pointSize / opacity mostly stable (light jitter optional)

### Educational copy

Concise DATA_LOG-style body:

- Piecewise-linear map with an absolute value — simple rule, complex orbit
- Successive points build a fractal-like “gingerbread” silhouette
- Nearby starts can separate even though the rule never changes (sensitivity is milder than maps like Lorenz/Hénon; frame as fractal silhouette + discrete iteration, not strong strange-attractor chaos)
- Avoid long textbook proofs; formula lives in the control panel

**Contextual note:** Gingerbreadman is weakly chaotic relative to most modules in this app (largely bounded / quasi-periodic fractal silhouette for typical ICs). The magnitude cap rarely fires in-range; it remains a safety guard, not a primary mechanism. No extra stability advisory.

### Empty / early-abort orbits

If the orbit aborts early, render collected finite points (possibly empty). No crash; match Tinkerbell’s empty-canvas + axes behavior unless a sibling already shows a soft empty-orbit message.

## Testing

### Unit (node)

- `gingerbreadman.test.ts` — produces points from default IC; respects `maxPoints`; breaks on non-finite; **breaks and drops** magnitude-cap points; `[]` for `iterations <= 0`; one-step recurrence fixture
- Preset helpers — `getPreset` / `detectPresetId`
- **`comparison-url-state-gingerbreadman-preset.test.ts`** — required (mirror Tinkerbell preset comparison-url-state test)
- Extend `chaos-validation`, `types`, `api-validation`, `schema` (parallel 0014 journal test; keep 0013), `comparison-url-state`, worker tests as listed above

### Component / page (jsdom)

- Renderer smoke (+ worker test mirroring Tinkerbell)
- Page interactions (preset / reset / randomize / sliders)
- Config-loading (configId / share / config param, clamp, warnings, dismiss)
- Compare interactions (URL encode/decode/clamp, defaults, swap, URL sync)

### Verification commands

```bash
bun run check
bun run test
bun run lint
```

## Acceptance criteria mapping

| Issue / product criterion | How satisfied |
|---------------------------|---------------|
| Homepage card links to `/gingerbreadman` | Homepage card + page tests (20 cards) |
| `/gingerbreadman` renders without errors | Route + renderer + worker |
| Default setup = recognizable chaotic orbit | `classic` preset IC |
| Parameter controls update visualization | Page-owned `$state` + debounced renderer |
| Reset and randomize work | Wired to `applyPreset` / `randomizeParameters` |
| Short educational copy | Shell `description` |
| Desktop + mobile usable | Inherited shell + responsive control grids |
| Cap points; guard NaN / ∞ / runaway | `maxPoints` + finiteness + magnitude guards |
| Full sibling parity | Compare route, 5 color modes, worker, presets, save/share registration |
| DB accepts saved/shared configs | Migration `0014` CHECK constraints |

## Implementation notes for the plan

1. Clone path: **Tinkerbell** for math/renderer/page/worker/tests; **Arnold Cat compare** for URL↔slider `untrack` sync.
2. Migration id **`0014`** (after Arnold Cat `0013`). SQL comment: **“all 20 map types.”**
3. Homepage card count tests **and** `CLAUDE.md` overview prose: **19 → 20** (include Gingerbreadman in the map list).
4. **Append-at-end ordering invariant:** append `'gingerbreadman'` at the **end** of `VALID_MAP_TYPES`, both CHECK `IN (...)` lists, `EXPECTED_MAP_TYPES`, and other bi-directional type lists — after `'arnold-cat'` — so the three canonical ordered lists stay synchronized. Homepage card visual order is independent.
5. Prefer grepping sibling registration sites (`VALID_MAP_TYPES`, `EXPECTED_MAP_TYPES`, CHECK SQL lists, exhaustive switches) so no site is missed.
6. Type/API/validation tests often list every map type — update all list copies in the same PR.
7. **Required** test file: `comparison-url-state-gingerbreadman-preset.test.ts` (preset-array sibling pattern).
8. Schema journal: **add** parallel 0014 test; keep 0013 arnold-cat test.
)