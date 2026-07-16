# Arnold Cat Map Visualization Module

**Linear Issue:** [HPA-62](https://linear.app/cwchanap/issue/HPA-62/add-arnold-cat-map-visualization-module)
**PRD:** [Additional Chaotic Map Visualizations](https://linear.app/cwchanap/document/prd-additional-chaotic-map-visualizations-1a69b476e276)
**Date:** 2026-07-15

## Summary

Implement **Arnold Cat Map** as a new chaotic map visualization module at `/arnold-cat`. UX shell mirrors **Baker's Map** (HPA-63): an animated **random point-cloud** on the unit torus, colored by initial position, with pause / step / reset / randomize controls. The map itself is the classic fixed area-preserving torus map (no image-scramble mode, no generalized matrix parameters in v1).

**Critical divergences from Baker** (do not copy these Baker choices blindly):

1. **Exact discrete coordinates** (`Uint32Array` mod \(2^{32}\)), not `Float64` on `[0,1)` — preserves the bijection indefinitely.
2. **`speed` = steps per second** with a time accumulator, not steps per animation frame — frame-rate independent and watchable.
3. **Pixel mapping** into `[0, width-1] × [0, height-1]`, not `py = (1-y)*h` which can land on `h` (off-canvas).

### Mathematical Definition

Continuous educational form on the unit torus `[0,1)²`:

```text
Γ(x, y) = (x + y  mod 1,  x + 2y  mod 1)
```

Matrix form (determinant 1 → area-preserving / measure-preserving):

```text
[x'] = [1 1] [x]   (mod 1)
[y']   [1 2] [y]
```

**Implementation form (required):** integer Cat Map on the discrete torus \((\mathbb{Z}/N\mathbb{Z})^2\) with \(N = 2^{32}\):

```text
X' = (X + Y)     mod 2^32
Y' = (X + 2Y)    mod 2^32
```

In JavaScript/TypeScript this is native `Uint32` wrap via `>>> 0` (or writing into a `Uint32Array`). The matrix has integer coefficients and det = 1, so the map is an **exact bijection** on the discrete torus: forward orbits never lose information, and the inverse `[[2,-1],[-1,1]]` recovers the start state after any number of steps.

Display maps discrete coords to the unit square for painting:

```text
u = X / 2^32 ∈ [0, 1),   v = Y / 2^32 ∈ [0, 1)
```

Each application shears then wraps (torus topology). Nearby points diverge exponentially; density of a uniform sample remains uniform. Points colored by **initial** \(v\) make stretch-and-fold visible as colors shear and mix.

### Product decisions (v1)

| Decision | Choice |
|----------|--------|
| Visualization mode | Random point cloud (not image scramble, not lattice) |
| Map parameters | Classic fixed Γ only (not generalized `k` / `a,b`) |
| Coordinate representation | **`Uint32Array` on \(2^{32}\) torus** (exact bijection); paint via `/ 2^32` |
| Animation controls | `pointCount`, `speed` (**steps/sec**), pause, step, reset, randomize |
| Persisted params | `pointCount`, `speed` only |
| Auto-reset cycle | **None** (exact discrete dynamics — no fidelity horizon to manage) |

### Explicit non-goals (v1)

- Image scramble / full-pixel `N×N` image buffer mode (distinct from discrete *point* coordinates)
- Generalized Cat Map parameters
- Recurrence detection UI
- Silent auto-reset after a max iteration count
- Continuous `Float64` orbits on `[0,1)` (rejected: abandons mathematical fidelity after ~37 steps)

## Files

### New files

| File | Purpose |
|------|---------|
| `src/lib/arnold-cat.ts` | Pure, allocation-free Cat Map step helpers (Uint32 in-place) |
| `src/lib/arnold-cat.test.ts` | Deterministic math fixtures (one-step, multi-step, wrap, inverse) |
| `src/routes/arnold-cat/+page.svelte` | Route page with `VisualizationShell` and page-managed controls |
| `src/routes/arnold-cat/compare/+page.svelte` | Side-by-side comparison route |
| `src/lib/components/visualizations/ArnoldCatRenderer.svelte` | Canvas-based animated renderer |
| `src/lib/components/visualizations/ArnoldCatRenderer.svelte.test.ts` | Renderer unit tests (signals, RAF, pixel mapping smoke) |
| `src/routes/arnold-cat-page-interactions.svelte.test.ts` | Page interaction + config-load tests (mirror Baker) |
| `src/routes/arnold-cat-compare-interactions.svelte.test.ts` | Compare-page interaction tests (mirror Baker) |
| `drizzle/0013_add_arnold_cat_map_type.sql` | DB migration: add `'arnold-cat'` to both CHECK constraints |

### Modified files

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `ArnoldCatParameters`; register in `ChaosMapType`, `ChaosMapParameters`, `CHAOS_MAP_DISPLAY_NAMES`, `VALID_MAP_TYPES`, `SavedConfiguration` |
| `src/lib/chaos-validation.ts` | Add `'arnold-cat'` entry in `STABLE_RANGES` |
| `src/lib/comparison-url-state.ts` | Add `'arnold-cat'` case in exhaustive `getDefaultParameters` switch |
| `src/routes/+page.svelte` | Add homepage card |
| `drizzle/meta/_journal.json` | Add entry `{ idx: 13, tag: '0013_add_arnold_cat_map_type' }` |
| `src/lib/server/db/schema.test.ts` | Update journal test **name**, tag `0012`→`0013`, and idx `12`→`13` |
| `src/lib/types.test.ts` | Add `'arnold-cat'` to the `EXPECTED_MAP_TYPES` array (lines 12–31); also add display-name assertion for `ARNOLD_CAT_MAP` if the file has per-type display checks |
| `src/lib/api-validation.test.ts` | Add `'arnold-cat'` to the bi-directional `expectedTypes` list (lines 278–297); length must stay equal to `VALID_MAP_TYPES` |
| `src/routes/page.svelte.test.ts` | Bump hard-coded card/CTA counts from **18→19**; add `{ name: 'Arnold Cat Map', url: '/arnold-cat' }` to the local `visualizations` array |
| `src/lib/chaos-validation.test.ts` | Add `'arnold-cat'` parameter validation suite (mirror `describe('bakers-map parameter validation')`) |
| `src/lib/comparison-url-state.test.ts` | Add `'arnold-cat'` to any exhaustive type lists; add `describe('arnold-cat comparison URL round-trip')` (mirror Baker) |

## Design

### Type System Integration (`src/lib/types.ts`)

New parameter interface:

```typescript
export interface ArnoldCatParameters {
	type: 'arnold-cat';
	pointCount: number; // number of points (capped at 10,000)
	speed: number; // Cat Map steps per second (1–30), not per frame
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
	speed: { min: 1, max: 30 } // steps per second
}
```

No `OPTIONAL_FIELDS` entry — both persisted fields are core range fields.

Classic Cat Map on the discrete torus is always mathematically well-behaved for finite inputs in range, so no dedicated `checkParameterStability` case is required. The generic range check handles validation.

**Boundary clamping (critical):** `validateParameters` only checks for finite numeric values — it does not clamp or reject out-of-range values (that's `checkParameterStability`'s job, which produces debounced warnings, not synchronous rejection). A loaded/shared/comparison config could therefore set `speed` or `pointCount` to extreme values.

Clamp at **every allocation and control boundary** — not only in RAF:

| Boundary | What to clamp |
|----------|----------------|
| `onExtraParametersLoaded` | `pointCount` → `[100, 10000]`, `speed` → `[1, 30]` before `$state` |
| Compare `clampParams` | Same ranges before left/right `$state` |
| **Before every array allocation / reinit** (`initDistribution`, `pointCount` change) | **`pointCount` first** — RAF is too late; a huge prop would allocate or throw before the first frame |
| RAF time accumulator | **`speed` only** → `[1, 30]` when computing steps to apply |
| `getDefaultParameters` | Defaults already in range (`pointCount: 3000`, `speed: 5`) |

### Comparison URL State (`src/lib/comparison-url-state.ts`)

The `getDefaultParameters` function has an exhaustive `switch(mapType)` with no default — adding `'arnold-cat'` to `ChaosMapType` without a case is a compile error. Additionally, `createComparisonStateFromCurrent` calls it on every page mount via the shell's `$derived` `comparisonUrl`, so a missing case would crash at runtime.

New case:

```typescript
case 'arnold-cat':
	return { type: 'arnold-cat', pointCount: 3000, speed: 5 };
```

### DB Migration (`drizzle/0013_add_arnold_cat_map_type.sql`)

Mirror the `0012_add_bakers_map_map_type.sql` pattern: drop and re-add both CHECK constraints (`check_valid_map_type` on `saved_configurations`, `chk_shared_configurations_map_type` on `shared_configurations`) listing all **19** map types (existing 18 plus `'arnold-cat'`), wrapped in `BEGIN`/`COMMIT`. Without this, runtime Save/Share fails with a CHECK violation and `schema.test.ts` fails (it asserts the latest migration's constraint list matches `VALID_MAP_TYPES` exactly).

Add the journal entry to `drizzle/meta/_journal.json` manually (`{ idx: 13, when: <timestamp>, tag: '0013_add_arnold_cat_map_type', breakpoints: true }`). **Do NOT run `drizzle-kit generate`** — the metadata snapshots stop at `0002_snapshot.json`; migrations `0003`–`0012` are manual SQL + journal entries only. Running `drizzle-kit generate` against the stale snapshot chain would create an unrelated or additional migration. Mirror `0012` exactly: SQL file + journal entry, no snapshot.

Update `schema.test.ts`:

- Journal tag from `'0012_add_bakers_map_map_type'` → `'0013_add_arnold_cat_map_type'`
- `idx` from `12` → `13`
- Test **description string** from `'drizzle journal registers the 0012 bakers-map migration'` → something like `'drizzle journal registers the 0013 arnold-cat migration'` (a literal tag/idx-only find-replace leaves a stale name)

### Pure math module (`src/lib/arnold-cat.ts`)

Extract buffer-mutating helpers so the **transformation itself is unit-testable** without mounting a Svelte component. Hot path stays allocation-free (no tuple returns).

```typescript
/** N = 2^32 via Uint32 wrap (>>> 0). */
export function applyArnoldCatStepInPlace(xs: Uint32Array, ys: Uint32Array, count = xs.length): void {
	for (let i = 0; i < count; i++) {
		const x = xs[i];
		const y = ys[i];
		xs[i] = (x + y) >>> 0;
		ys[i] = (x + 2 * y) >>> 0;
	}
}

/** Inverse [[2,-1],[-1,1]] — used only in tests / optional reset verification. */
export function applyArnoldCatInverseInPlace(xs: Uint32Array, ys: Uint32Array, count = xs.length): void {
	for (let i = 0; i < count; i++) {
		const x = xs[i];
		const y = ys[i];
		xs[i] = (2 * x - y) >>> 0;
		ys[i] = (-x + y) >>> 0;
	}
}

/** Map discrete coords into canvas pixel indices in [0, dim-1]. */
export function torusToPixel(coord: number, dim: number): number {
	if (dim <= 1) return 0;
	// coord is Uint32; u in [0,1)
	const u = coord / 4294967296; // 2^32
	return Math.min(dim - 1, Math.floor(u * dim));
}

export function torusToPixelY(coord: number, dim: number): number {
	// y=0 at bottom of canvas (flip)
	if (dim <= 1) return 0;
	const v = coord / 4294967296;
	return Math.min(dim - 1, Math.floor((1 - v) * dim));
}
```

**Why not Float64 on `[0,1)`:** The continuous matrix has spectral radius λ ≈ 2.618. Float64 mantissa (~52 bits) loses orbit fidelity after roughly `52 / log₂(λ) ≈ 37` steps. At Baker-style “1 step per frame” @ 60 Hz that horizon arrives in **~0.6 s** (speed 10: ~0.06 s). That knowingly abandons the math while still claiming to animate the Cat Map. Integer coefficients make the `Uint32` discretization free of that tradeoff: verified 10 000 random points through 1 000 forward + 1 000 inverse steps with zero mismatches.

### Renderer (`src/lib/components/visualizations/ArnoldCatRenderer.svelte`)

Canvas + RAF component. Shell/controls still resemble Baker; **internals follow the discrete + time-based design above**.

**Data structures (preallocated, no per-frame allocations):**

- `Uint32Array` current X/Y (length = clamped `pointCount`)
- `Uint32Array` initial X/Y (reset + color source)
- `pointColors: string[]` — precomputed at init/randomize from initial \(v = Y/2^{32}\)

**Precision / iteration policy:**

- Exact discrete dynamics → **no silent auto-reset**, no fidelity warning UI required for long runs.
- Iteration counter increments without wrapping; user **Reset** / **Randomize** restarts the visual demo.

**Color interpolation (precomputed at component scope):**

```typescript
import * as d3 from 'd3';
import { COLOR_PRIMARY, COLOR_MAGENTA } from '$lib/constants';

const interpCyanMagenta = d3.interpolate(COLOR_PRIMARY, COLOR_MAGENTA);
// at init: pointColors[i] = interpCyanMagenta(initialY[i] / 4294967296);
```

Colors fixed for the lifetime of a distribution so material identity is preserved while positions mix.

**Stepping:** call `applyArnoldCatStepInPlace(currentX, currentY)` from `$lib/arnold-cat` (buffer-mutating pure function — still zero allocations). Do **not** re-inline a divergent copy of the math in the renderer; the pure module is the single source of truth and the fixture target.

**Animation loop — steps per second (required):**

Baker’s “steps per frame” is **rejected** for this map. At default speed=1 step/frame @ 60 Hz the continuous (and even a too-fast discrete) cloud loses visible structure almost immediately: on a ~600px canvas, color bands become sub-pixel after roughly **seven** iterations (~0.11 s at 60 steps/s). That undermines the acceptance criterion that the visualization **clearly show** repeated stretch/shear/wrap.

Follow the elapsed-time accumulator pattern in `DoublePendulumRenderer.svelte` (~line 221):

```typescript
const MAX_FRAME_DT = 0.05; // seconds — avoid spiral-of-death after tab background
const MAX_STEPS_PER_FRAME = 30; // hard cap even if speed is high / frame is long

let last = 0;
let acc = 0; // accumulated steps owed

function renderFrame(now: number) {
	if (isUnmounted) return;
	if (last === 0) last = now;
	let frameDt = (now - last) / 1000;
	last = now;
	if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;

	const stepsPerSec = clampInt(speed, 1, 30);

	if (!paused) {
		acc += Math.min(frameDt, MAX_FRAME_DT) * stepsPerSec;
		let steps = 0;
		while (acc >= 1 && steps < MAX_STEPS_PER_FRAME) {
			applyArnoldCatStepInPlace(currentX, currentY);
			iterationCount += 1;
			acc -= 1;
			steps += 1;
		}
	}

	// draw + throttled label…
	rafId = requestAnimationFrame(renderFrame);
}
```

- Default `speed = 5` → five map steps per second (watchable shear progression).
- Range `1–30` steps/sec (persisted / validated).
- `stepSignal` still applies **exactly one** map step (independent of the accumulator); do not drain `acc` on manual step unless needed for consistency (preferred: leave `acc` alone so pause+step is precise).
- When `paused`, do not advance `acc` (or clear pending fractional steps — either is fine if documented; prefer **freeze acc** so resume continues smoothly).

**Iteration label** via direct `textContent` (not `$state`), throttled ~100ms:

```typescript
if (timestamp - lastLabelUpdate > 100) {
	if (iterationLabel) {
		// eslint-disable-next-line svelte/no-dom-manipulating
		iterationLabel.textContent = `ITERATION: ${iterationCount}`;
	}
	lastLabelUpdate = timestamp;
}
```

The eslint disable is **required** (Baker / lint-staged).

Static badge: `LIVE_RENDER // CANVAS_2D`.

**Canvas layout / pixel mapping:**

- Discrete \((X,Y)\) → unit square via `/ 2^{32}`, then into **drawable** pixel indices.
- **Do not** use `py = (1 - v) * canvasHeight` alone: when `v = 0`, that yields `canvasHeight`, which is **outside** `[0, height-1]` for `fillRect`.
- Use helpers from `$lib/arnold-cat`:

```typescript
const px = torusToPixel(currentX[i], w); // [0, w-1]
const py = torusToPixelY(currentY[i], h); // [0, h-1], y=0 at bottom
ctx.fillRect(px, py, 1, 1);
```

- Sci-fi frame + `bg-black/40` consistent with Baker / bifurcation renderers.

**Props:**

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `height` | `number` | `600` (`VIZ_CONTAINER_HEIGHT`) | Canvas height |
| `containerElement` | `HTMLDivElement` (bindable) | — | Snapshot binding |
| `pointCount` | `number` (bindable) | `3000` | **Clamp before allocate**; change reinits |
| `speed` | `number` (bindable) | `5` | **Steps per second** (1–30) |
| `paused` | `boolean` (bindable) | `false` | Pause/resume |
| `resetSignal` | `number` | `0` | Restore initial Uint32 positions |
| `randomizeSignal` | `number` | `0` | New random Uint32 cloud |
| `stepSignal` | `number` | `0` | Exactly one map step |

Signal `$effect`s use **prev-value guards** (skip Svelte 5 initial run) — same as Baker.

**Initial distribution:** Uniform random `Uint32` samples (`crypto.getRandomValues` on a `Uint32Array`, or `(Math.random() * 2**32) >>> 0` per component). Incrementing `randomizeSignal` reseeds.

**Performance guards:**

- Clamp `pointCount` to `[100, 10000]` **immediately before every allocation**
- `Uint32Array` point data; no per-frame heap allocations
- `MAX_STEPS_PER_FRAME` + `MAX_FRAME_DT` on the accumulator
- Single `fillRect` per point per frame
- Cancel RAF + unmounted flag on teardown; `ResizeObserver` for sizing

**Reactive behavior:**

- `pointCount` change → clamp → reallocate → reseed → iteration = 0; reset `acc`
- `speed` change → next frame’s accumulator rate only
- `resetSignal` → copy initial → current; iteration = 0; optional `acc = 0`
- `randomizeSignal` → new random initial + current; iteration = 0
- `stepSignal` → one `applyArnoldCatStepInPlace`; iteration++

### Route Page (`src/routes/arnold-cat/+page.svelte`)

Uses `VisualizationShell` with page-managed sliders (same pattern as Baker's Map / Tinkerbell / Clifford).

**Shell configuration:**

- `mapType`: `'arnold-cat'`
- `title`: `'ARNOLD_CAT_MAP'`
- `paramDefs`: `[]` (all controls are page-owned, rendered in `extraControls`)
- `paramColumns`: `1`
- `stabilityReporter`: Registered via `createStabilityReporter({ mapType: 'arnold-cat', getParams: () => buildParameters(), reactive: true })`
- `formula`: `["x' = (x + y) mod 1", "y' = (x + 2y) mod 1"]` (educational continuous form; implementation uses exact \(2^{32}\) wrap)
- `formulaColumns`: `2`
- `description`: `{ heading: 'DATA_LOG: ARNOLD_CAT_MAP', body: 'Arnold\'s Cat Map is an area-preserving linear map on the unit torus. Each step shears the square via the matrix [[1,1],[1,2]] (determinant 1) and wraps coordinates. This visualization uses exact integer arithmetic on a fine discrete torus so orbits stay faithful indefinitely. The map stretches and folds phase space so nearby points diverge exponentially while overall density stays uniform — the same stretch-and-fold mechanism that classically scrambles images. Points are colored by their initial height so the shearing and mixing remain visible as iterations proceed.' }` (must be `{ heading: string; body: string }` per `VisualizationShell` Props)
- `isAuthenticated`: `!!data?.session`

**Page-owned `$state`:**

| State | Type | Default | Range |
|-------|------|---------|-------|
| `pointCount` | `number` | `3000` | 100–10,000 (step 100) |
| `speed` | `number` | `5` | 1–30 **steps/sec** (step 1) |
| `paused` | `boolean` | `false` | — |
| `resetSignal` | `number` | `0` | increment to trigger |
| `randomizeSignal` | `number` | `0` | increment to trigger |
| `stepSignal` | `number` | `0` | increment to trigger |

**Controls (in `extraControls` snippet):**

| Control | Element | Action |
|---------|---------|--------|
| Point Count | Range slider | Bind `pointCount` |
| Speed (steps/sec) | Range slider | Bind `speed`; label clearly as steps per second |
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

**`onExtraParametersLoaded(p)`:** Restores `pointCount` and `speed` from saved/shared configs, **clamped** to `[100, 10000]` and `[1, 30]` respectively. Animation state (`paused`, iteration count, signal counters, accumulator) is session-local — not persisted (same approach as Baker's Map and Double Pendulum optional fields).

**Session/auth:** `data.session` from root layout's `+layout.server.ts`. No separate `+page.server.ts` needed.

### Compare Route (`src/routes/arnold-cat/compare/+page.svelte`)

Every map's `VisualizationShell` renders a Compare button linking to `/{mapType}/compare`. **Clone `src/routes/bakers-map/compare/+page.svelte` and rename types/map ids** — do not invent a thinner compare page. Required pieces (all present on Baker):

| Piece | Role |
|-------|------|
| `ComparisonLayout` | Two-panel shell chrome |
| `ComparisonParameterPanel` | Left/right parameter UI |
| `ArnoldCatRenderer` × 2 | Side-by-side animated clouds |
| `decodeComparisonState` / `encodeComparisonState` / `getDefaultParameters` | URL state |
| `getStableRanges('arnold-cat')` | Range source for clamping |
| `clampParams` helper | Clamp extreme URL values before `$state` (same as Baker: `clampValue` with `Math.round` + finite check on `pointCount` and `speed`) |
| Debounced `goto` (~300ms) | Sync left/right params to the compare URL with `replaceState` |

Omitting `clampParams` is the most common regression when "following the pattern" from memory — URL-loaded extremes would bypass page-level safety the same way unclamped save/share loads do on the main route.

### Homepage Card (`src/routes/+page.svelte`)

Add to `visualizations` array:

```javascript
{
	name: 'Arnold Cat Map',
	description:
		'An area-preserving map that scrambles images through stretch-and-fold dynamics',
	url: '/arnold-cat',
	color: 'from-slate-400 to-cyan-600'
}
```

**Color rationale:** Prefer a **gradient pair** not already used. `from-rose-500 to-orange-500` is unique as a pair but overlaps rose with Chaos Esthetique (`from-pink-500 to-rose-600`) and orange with Bifurcation-Logistic (`from-orange-500 to-red-600`). `from-slate-400 to-cyan-600` avoids those endpoints while staying on-brand (cyan sci-fi). If implementation prefers another unused pair, that is fine — check all 18 existing `color` strings in `+page.svelte` before finalizing.

CTA styling follows existing cards (`Initialize Module` pattern already on the home page).

### Tests

#### Math fixtures (`src/lib/arnold-cat.test.ts`) — required

The transformation itself must be tested. Mount/signal/cleanup tests alone would pass with a transposed matrix, wrong wrap, or no-op step.

Minimum fixtures:

| Case | Assertion |
|------|-----------|
| One-step known points | e.g. `(0,0) → (0,0)`; `(1,0) → (1,1)`; `(0,1) → (1,2)`; hand-checked mid-range pairs |
| Modular wrap | Values near `2^32 - 1` wrap correctly under `>>> 0` (no float `% 1` path) |
| Multi-step | Fixed seed: after \(k\) steps matches hand/oracle values |
| Inverse recovery | After \(k\) forward + \(k\) inverse, buffers equal initials (batch of random points) |
| In-place length | `count` parameter respects partial buffer updates |
| Pixel mapping | `torusToPixel` / `torusToPixelY`: `0`, near-`2^32-1`, and mid values land in `[0, dim-1]`; `y=0` maps to bottom row `dim-1` (or documented convention); never returns `dim` |

#### Renderer (`src/lib/components/visualizations/ArnoldCatRenderer.svelte.test.ts`)

- **Mount/unmount**: mounts; canvas present
- **RAF cleanup**: `cancelAnimationFrame` on unmount
- **Signal props**: reset / randomize / step behavior; init skip (iteration starts at 0)
- **pointCount resize**: clamps extreme props before allocate (e.g. prop `1e9` does not allocate a billion entries)
- **paused**: does not advance iteration while paused
- **No auto-reset** after long iteration counts
- Optional smoke: after forced steps, painted coords stay in-canvas (if test harness can inspect helpers)

#### Page / compare interactions (Baker parity)

| File | Mirrors |
|------|---------|
| `src/routes/arnold-cat-page-interactions.svelte.test.ts` | Baker page tests — sliders, pause/step/reset/randomize, stability, `onExtraParametersLoaded` clamp to new speed range |
| `src/routes/arnold-cat-compare-interactions.svelte.test.ts` | Baker compare tests — dual panels, URL sync, `clampParams` |

#### Hard-coded count / list updates (will fail without these)

| File | Required change |
|------|-----------------|
| `src/routes/page.svelte.test.ts` | `toHaveLength(18)` → `19` in **two** places; add Arnold Cat to local `visualizations` array |
| `src/lib/api-validation.test.ts` | Add `'arnold-cat'` to `expectedTypes` |
| `src/lib/types.test.ts` | Add `'arnold-cat'` to `EXPECTED_MAP_TYPES` |
| `src/lib/server/db/schema.test.ts` | Journal tag/idx **and** test name for `0013` |
| `src/lib/chaos-validation.test.ts` | `describe('arnold-cat parameter validation')` including speed range `1–30` |
| `src/lib/comparison-url-state.test.ts` | Defaults `speed: 5`; URL round-trip suite |

#### Gate commands

- `bun run check` must pass
- `bun run test` must pass (includes math fixtures + all integration lists)

No new Playwright e2e required for v1.

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
- [ ] The visualization clearly shows repeated stretching/shearing/wrapping over iterations (watchable at default steps/sec; not washed out in <1s).
- [ ] Iteration controls and reset work correctly (plus pause, step, randomize).
- [ ] Dynamics use exact discrete Cat Map arithmetic (`Uint32` / \(2^{32}\) wrap), covered by pure math fixtures.
- [ ] `speed` is steps **per second** (time accumulator), frame-rate independent.
- [ ] Pixel mapping keeps all samples inside the drawable canvas (including `y = 0` and wrap-near-zero).
- [ ] `pointCount` is clamped before every allocation.
- [ ] The route includes short explanatory copy.
- [ ] The module remains usable on desktop and mobile.
- [ ] Compare button links to `/arnold-cat/compare` (not a 404).
- [ ] `bun run check` passes (no TS errors from exhaustive switch).
- [ ] `bun run test` passes (math fixtures, schema, renderer, homepage 19-card counts, api-validation / types lists, chaos-validation + comparison-url-state suites, page/compare interaction tests).
