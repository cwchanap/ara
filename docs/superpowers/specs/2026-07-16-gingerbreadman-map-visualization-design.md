# Gingerbreadman Map Visualization Module — Design

- **Linear issue:** [HPA-61](https://linear.app/cwchanap/issue/HPA-61/add-gingerbreadman-map-visualization-module)
- **PRD:** [Additional Chaotic Map Visualizations](https://linear.app/cwchanap/document/prd-additional-chaotic-map-visualizations-1a69b476e276)
- **Date:** 2026-07-16
- **Status:** Design — revised after third review (2026-07-16)

## Summary

Add the **Gingerbreadman Map** as a new chaotic-map visualization module with **full feature parity** to its nearest sibling, the Tinkerbell Map, **plus the slider/fidelity pipeline** that Tinkerbell has not yet migrated to. It is a 2D discrete-time piecewise-linear map whose orbit forms a distinctive fractal-like “gingerbread” figure. The map itself has **no free shape parameters**; the primary story knobs are **initial conditions** `(x0, y0)` plus iteration count and render controls.

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

**Clone Tinkerbell’s product surface, but do not clone its unmigrated slider path** (Approach A + responsiveness pipeline):

| Layer | Source of truth |
|-------|-----------------|
| Math, worker, color modes, presets, registration | Tinkerbell (swap `a–d` → `x0`/`y0`) |
| Page controls | **`ParameterSlider`** with `updatePolicy` (not raw `<input type="range">`) |
| Renderer fidelity | Accept `fidelity` + `onRenderStateChange` from shell snippet (see [slider responsiveness design](./2026-07-13-slider-responsiveness-design.md) §3 / §5E) |
| Compare URL sync | **Arnold Cat** `untrack` + debounce teardown — **extended** to shared styling state |

**Why not a pure Tinkerbell clone for controls?** The shell already provides `SliderDragManager`, `fidelity`, and save/share/snapshot disable while `fidelity !== 'full'` or `renderState === 'rendering'`. Tinkerbell/Clifford still use raw range inputs and ignore the snippet’s `fidelity` / `onRenderStateChange` args. A greenfield module must wire the pipeline so intermediate preview frames cannot be saved, shared, or snapshotted. **No dependency** on a future Tinkerbell migration.

A shared `PointCloudRenderer` abstraction remains a **non-goal** for this ticket. Extraction can be a follow-up once three near-identical point-cloud maps are stable.

## Product decisions (v1)

| Decision | Choice |
|----------|--------|
| Feature parity | Full sibling parity (Tinkerbell): compare, worker, 5 color modes, presets, save/share |
| Slider / fidelity pipeline | **Required at ship** — not deferred to a later Tinkerbell migration |
| Story knobs | Initial conditions + iterations |
| Color modes | `density`, `iteration`, `radius`, `angle`, `single` |
| Default color mode | `iteration` (ticket emphasizes color-by-iteration; density still available) |
| Presets | Curated **orbit-rich** `(x0, y0)` starts (+ light render style differences); reject short cycles |
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
- Optional test helper (or inline in tests): unique-point count over N iterates for orbit-richness assertions

### 2. `src/lib/gingerbreadman-presets.ts` — presets

Mirror of `src/lib/tinkerbell-presets.ts`, IC-focused:

- `GingerbreadmanPresetState { x0, y0, iterations; colorMode; zoom, pointSize, opacity }`
- `GingerbreadmanPreset { id, label, state }`
- `GINGERBREADMAN_PRESETS` array (see Presets below — **orbit-rich only**)
- `DEFAULT_GINGERBREADMAN_PRESET_ID = 'classic'`
- `getPreset(id)`, `detectPresetId(state)` with `numbersClose` for floats

### 3. `src/lib/components/visualizations/GingerbreadmanRenderer.svelte` — renderer

Start from `TinkerbellRenderer.svelte`’s canvas/color-mode/worker wiring, then **add the fidelity contract** (do not ship a pure Tinkerbell clone):

- Props: `x0`, `y0`, `iterations`, `colorMode`, `zoom`, `pointSize`, `opacity`, `height?`, `containerElement?`, plus:
  - `fidelity: Fidelity = 'full'` (default so compare pages stay full quality without the shell)
  - `onRenderStateChange: (state: RenderState) => void = () => {}` (noop default)
- d3 canvas + sci-fi svg axes; `MAX_POINTS = 250_000`
- Five color modes (identical set + rendering logic to Tinkerbell/Clifford)
- `zoom`, `pointSize`, `opacity`; disable pointSize/opacity under `density`
- Worker post `{ type: 'gingerbreadman', id, x0, y0, iterations, maxPoints }` → handle `gingerbreadmanResult`
- Main-thread fallback → `calculateGingerbreadmanTuples`
- `paramsValid()`: all numeric props finite, `iterations > 0`

**Fidelity / work scaling (required):**

| Signal | Behavior |
|--------|----------|
| Compute keys change (`x0`, `y0`, `iterations`) and `fidelity === 'preview'` | Request worker/main with reduced budget (~**25 000** points / effective iterations) |
| Compute keys change and `fidelity === 'full'` | Full budget up to `MAX_POINTS` / requested iterations |
| Style-only change (`colorMode`, `zoom`, `pointSize`, `opacity`) | Keep cached points; immediate **sampled** repaint (~25k), then debounced full repaint from cache (§5E pattern) |
| Status | Call `onRenderStateChange('rendering')` when work starts; `'complete'` when full-quality paint (or empty/error path) finishes |

Diff compute vs style keys with a `prevValues` ref inside the renderer (shell does not indicate which key changed).

### 4. `src/routes/gingerbreadman/+page.svelte` — main page

Page-owned state + shell, **with ParameterSlider policies** (not raw ranges):

#### Committed vs draft state (required for `preview` policy)

`paramDefs={[]}` means the shell’s `draftValues` object is empty and **not** usable for Gingerbreadman compute params. `ParameterSlider` with `updatePolicy: 'preview'` does **not** write `bind:value` during drag — it only fires throttled `ondraft` ([`ParameterSlider.svelte`](../../../src/lib/components/ui/ParameterSlider.svelte)). The page **must** maintain its own draft mirrors.

| State | Role |
|-------|------|
| `x0`, `y0`, `iterations` | **Committed** — bound to `ParameterSlider` `value`; updated only on release / programmatic set (preset, randomize, config load). Used by `buildParameters()`, save/share/compare, stability `$effect`. |
| `draftX0`, `draftY0`, `draftIterations` | **Draft** — updated via `ondraft`; initialized equal to committed; reset to committed on cancel-drag (slider already re-fires `ondraft` with committed value). |
| `colorMode`, `zoom`, `pointSize`, `opacity` | **Live** style — `updatePolicy: 'live'` updates bound state every input; no separate draft needed. |

Sync rule for programmatic mutations (preset apply, reset, randomize, `onExtraParametersLoaded`): set committed **and** draft to the same values so a mid-drag cancel cannot leave drafts stale relative to a later preset.

#### Controls

- **Numeric controls use `<ParameterSlider>`** so they register with the shell’s `SliderDragManager`:

  | Control | `updatePolicy` | Binding |
  |---------| | -------------- | ------- |
  | `x0`, `y0`, `iterations` | `'preview'` | `bind:value={x0}` (etc.) + `ondraft={(v) => (draftX0 = v)}` |
  | `zoom`, `pointSize`, `opacity` | `'live'` | `bind:value={zoom}` (etc.); optional `ondraft` not required |

- `colorMode` remains a select/toggle group (non-slider); treat as live style change on the renderer
- Presets bar, Initial conditions, Orbit, Render controls, Randomize + Reset
- `createStabilityReporter({ mapType: 'gingerbreadman', getParams, reactive: true })` tracks **committed** `x0`/`y0`/`iterations` only (silent during preview drag; re-check on release — matches responsiveness design §1.6)
- `buildParameters(): GingerbreadmanParameters` reads **committed** values only; `onExtraParametersLoaded` clamps then writes committed + drafts

#### Renderer snippet — consume drafts during preview

```svelte
{#snippet renderer({ container, fidelity, onRenderStateChange })}
	{@const renderX0 = fidelity === 'preview' ? draftX0 : x0}
	{@const renderY0 = fidelity === 'preview' ? draftY0 : y0}
	{@const renderIterations = fidelity === 'preview' ? draftIterations : iterations}
	<GingerbreadmanRenderer
		x0={renderX0}
		y0={renderY0}
		iterations={renderIterations}
		{colorMode}
		{zoom}
		{pointSize}
		{opacity}
		{fidelity}
		{onRenderStateChange}
		bind:containerElement={container.el}
		height={VIZ_CONTAINER_HEIGHT}
	/>
{/snippet}
```

Without the draft branch, dragging a preview slider would leave the renderer on the last committed IC while the shell shows `PREVIEW` — broken UX and false status.

- `<VisualizationShell>`: `mapType="gingerbreadman"`, `title="GINGERBREADMAN_MAP"`, `paramDefs={[]}`, formula lines, educational `description`
- **No `+page.server.ts`** — session from root layout (same as Tinkerbell/Clifford)

### 5. `src/routes/gingerbreadman/compare/+page.svelte` — comparison page

Structure from Tinkerbell compare (dual panel + left-shared styling), **URL sync from Arnold Cat — including styling**:

- `decodeComparisonState($page.url, 'gingerbreadman')`, `getDefaultParameters('gingerbreadman')`, `getStableRanges('gingerbreadman')!`
- `clampParams` over **all** persisted fields: `x0`, `y0`, `iterations`, and optional styling (`colorMode` enum clamp/fallback, `zoom`/`pointSize`/`opacity` numeric ranges)
- Left/right **independent** `$state` for `x0`, `y0`, `iterations`
- Shared styling is **`$state`**, not `const` from first paint only:
  - `colorMode`, `zoom`, `pointSize`, `opacity` (left is the source of truth for both renderers)
- **External URL sync (`untrack` effect)** must apply **both** left/right compute params **and** shared styling from the decoded left (and right compute) payload whenever `$page.url` changes (back/forward, same-route link). Do **not** leave styling frozen after mount (current Tinkerbell bug).
- Debounced `goto` write-back must include styling in `getLeftParams` / `getRightParams` (right carries the shared style fields too so encode/decode is symmetric)
- Debounce timer cleanup on effect teardown
- Two `GingerbreadmanRenderer` instances (`height={400}`); default `fidelity='full'` (no shell)
- Compare panel sliders may stay native ranges (compare routes do not use `VisualizationShell` / drag manager — same as responsiveness design § compare note)

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

### 7. Migration (manual SQL + journal only)

Mirror Arnold Cat’s constraint (see [arnold-cat design § DB Migration](./2026-07-15-arnold-cat-map-visualization-design.md)):

1. **`drizzle/0014_add_gingerbreadman_map_type.sql`**
   - Drop and re-add both CHECK constraints (`check_valid_map_type` on `saved_configurations`, `chk_shared_configurations_map_type` on `shared_configurations`).
   - List **all 20** map types (existing 19 + `'gingerbreadman'`).
   - **Append** `'gingerbreadman'` at the end of each `IN (...)` list (after `'arnold-cat'`).
   - Comment text: **“all 20 map types.”**
   - Wrap in `BEGIN`/`COMMIT` like `0013`.
2. **`drizzle/meta/_journal.json`** — append a **full** entry (not just `idx`/`tag`):

   ```json
   {
     "idx": 14,
     "version": "7",
     "when": <monotonic-ms-timestamp-after-0013>,
     "tag": "0014_add_gingerbreadman_map_type",
     "breakpoints": true
   }
   ```

3. **Do NOT run `drizzle-kit generate`.** Metadata snapshots stop at `0002_snapshot.json`; migrations `0003`–`0013` are manual SQL + journal only. Generating against the stale snapshot chain would create an unrelated or extra migration.
4. **No new snapshot file.**
5. `schema.test.ts` asserts `constraintTypes.toHaveLength(VALID_MAP_TYPES.length)` against the latest migration SQL — both CHECK lists must gain the new type or that test fails.

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
| `drizzle/meta/_journal.json` | Full entry: `idx: 14`, `version: "7"`, monotonic `when`, `tag: '0014_add_gingerbreadman_map_type'`, `breakpoints: true` — **no** `drizzle-kit generate`, **no** snapshot |
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

**Orbit-richness requirement:** every preset IC must produce a dense point cloud, not a short cycle. Dyadic-friendly seeds such as `(0.5, -0.5)` and `(3, -2)` collapse to short periods (verified by direct simulation) and are **rejected**.

### Deterministic quantization rule (load-bearing)

“Unique points” without a grid is ambiguous: the same orbit yields **~79** unique keys at integer precision, **~4 000** at one decimal, and **~100 000** at three or more decimals. Tests and acceptance **must** use this exact rule:

```typescript
/** Quantize to a 0.001 grid (3 decimal places) via integer keys. */
function orbitKey(x: number, y: number): string {
	// Math.round ties toward +∞ for |n| < 2^52 / 1000 — fine for |coord| ≤ MAGNITUDE_CAP
	return `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
}

function countUniqueOrbitPoints(x0: number, y0: number, iterations = 100_000): number {
	const seen = new Set<string>();
	let x = x0;
	let y = y0;
	for (let i = 0; i < iterations; i++) {
		const xNew = 1 - y + Math.abs(x);
		const yNew = x;
		if (
			!Number.isFinite(xNew) ||
			!Number.isFinite(yNew) ||
			Math.abs(xNew) > 1e4 ||
			Math.abs(yNew) > 1e4
		) {
			break;
		}
		x = xNew;
		y = yNew;
		seen.add(orbitKey(x, y));
	}
	return seen.size;
}
```

| Constant | Value | Rationale |
|----------|-------|-----------|
| Grid | **0.001** (`Math.round(coord * 1000)`) | Separates dense fills (~99k unique) from short cycles; integer keys avoid float-set instability |
| Iterations | **100 000** | Matches default preset density |
| Magnitude stop | **1e4** | Same as production orbit guard |
| Pass bar | **`countUniqueOrbitPoints(x0, y0) ≥ 1_000`** | Short cycles (≤ ~90 unique even at fine grids) fail; shipped seeds pass at ~99 000 |

Negative fixtures (must fail the bar): `(0.5, -0.5)`, `(3, -2)`.

| id | label | x0 | y0 | intent | ~unique @ 1e5, 0.001 grid |
|----|--------|-----|-----|--------|---------------------------|
| `classic` (default) | Classic | `-0.1` | `0` | Recognizable gingerbread figure | ~99 754 |
| `near-origin` | Near Origin | `-0.3` | `0` | Alternate textbook-style seed | ~99 623 |
| `offset` | Offset Seed | `-0.75` | `0.1` | Different approach into the figure (non-dyadic) | ~99 797 |
| `far-field` | Far Field | `-2.13` | `0.47` | Farther IC, same map; sensitivity story | ~99 849 |

**Do not ship** the previously proposed `offset (0.5, -0.5)` or `far-field (3, -2)`.

Shared defaults unless a preset overrides for discoverability:

- `iterations: 100_000`
- At least one preset uses `colorMode: 'density'`, one uses `'radius'` or `'angle'`; classic uses `'iteration'`
- `zoom: 1`, `pointSize: 1.5`, `opacity: 0.6`

Visual fine-tuning of seeds is allowed during implementation only if the replacement still passes `countUniqueOrbitPoints ≥ 1_000` under the rule above (prefer exporting the helper from `gingerbreadman.ts` or a tiny `gingerbreadman-orbit-stats.ts` so tests and docs stay single-sourced).

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
- **Orbit-richness (required, deterministic):** for every shipped preset IC, `countUniqueOrbitPoints(x0, y0) ≥ 1_000` under the **0.001 grid** rule above; negative fixtures `(0.5, -0.5)` and `(3, -2)` assert `< 1_000` (or exact short-period counts if fixed)
- Preset helpers — `getPreset` / `detectPresetId`
- **`comparison-url-state-gingerbreadman-preset.test.ts`** — required (mirror Tinkerbell preset comparison-url-state test)
- Extend `chaos-validation`, `types`, `api-validation`, `schema` (parallel 0014 journal test; keep 0013), `comparison-url-state`, worker tests as listed above

### Component / page (jsdom)

- Renderer smoke (+ worker test mirroring Tinkerbell)
- **Fidelity pipeline (required — not optional):**
  1. **Draft preview work:** with `fidelity='preview'`, renderer requests reduced budget (~25k / scaled iterations) and uses the **draft** compute props (page test: drag/`ondraft` changes what is rendered while committed `x0`/`y0`/`iterations` stay put for `buildParameters`)
  2. **Full-quality release:** after commit / `fidelity='full'`, full budget and **committed** props drive the render
  3. **Status callbacks:** `onRenderStateChange('rendering')` then `'complete'` on both preview and full paths (including empty/abort)
  4. **Sampled style repaint:** style-only prop change (e.g. `pointSize` / `colorMode`) does not re-dispatch a new worker compute when points are cached; still ends in `'complete'` after full repaint from cache
- Page interactions (preset / reset / randomize / ParameterSlider; drafts sync on preset/config load)
- Config-loading (configId / share / config param, clamp, warnings, dismiss)
- Compare interactions:
  - URL encode/decode/clamp, defaults, swap
  - **External URL change** updates left/right **and shared styling** (`colorMode`, `zoom`, `pointSize`, `opacity`) — regression for the Tinkerbell const-style freeze

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
| Slider/fidelity pipeline | ParameterSlider policies + page drafts + renderer `fidelity` / `onRenderStateChange` |
| Preview uses drafts | `ondraft` → `draftX0`/`draftY0`/`draftIterations`; snippet picks drafts when `fidelity==='preview'` |
| Compare styling follows URL navigation | Shared styling `$state` + untrack sync + regression test |
| Presets are real point clouds | `countUniqueOrbitPoints ≥ 1_000` on **0.001** grid @ 1e5 iterates |
| Fidelity coverage | Required tests: draft preview, full release, status callbacks, sampled style repaint |
| DB accepts saved/shared configs | Migration `0014` CHECK constraints (manual SQL + full journal entry) |

## Implementation notes for the plan

1. Product surface: **Tinkerbell** (math/worker/color modes/presets). Controls/fidelity: **responsiveness design** (`ParameterSlider` + page-local drafts + `fidelity` / `onRenderStateChange`). Compare URL: **Arnold Cat `untrack`**, extended to **shared styling**.
2. Migration id **`0014`** (after Arnold Cat `0013`). Full journal fields; **manual SQL only** — never `drizzle-kit generate`; no snapshot. Comment: **“all 20 map types.”**
3. Homepage card count tests **and** `CLAUDE.md` overview prose: **19 → 20** (include Gingerbreadman in the map list).
4. **Append-at-end ordering invariant:** append `'gingerbreadman'` at the **end** of `VALID_MAP_TYPES`, both CHECK `IN (...)` lists, `EXPECTED_MAP_TYPES`, and other bi-directional type lists — after `'arnold-cat'` — so the three canonical ordered lists stay synchronized. Homepage card visual order is independent.
5. Prefer grepping sibling registration sites (`VALID_MAP_TYPES`, `EXPECTED_MAP_TYPES`, CHECK SQL lists, exhaustive switches) so no site is missed.
6. Type/API/validation tests often list every map type — update all list copies in the same PR.
7. **Required** test file: `comparison-url-state-gingerbreadman-preset.test.ts` (preset-array sibling pattern).
8. Schema journal: **add** parallel 0014 test; keep 0013 arnold-cat test.
9. Do **not** treat current Tinkerbell page/renderer as a complete control template — copy color modes and worker shape only; implement sliders, **drafts**, and fidelity as specified here.
10. Preset ICs: orbit-richness uses **0.001 grid** (`Math.round(x*1000)` keys); do not reintroduce dyadic short-cycle seeds.
11. `paramDefs={[]}` ⇒ shell `draftValues` is useless for Gingerbreadman; page-owned `ondraft` mirrors are mandatory for preview.

