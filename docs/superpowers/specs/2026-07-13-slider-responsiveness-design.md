# Slider Responsiveness for Computationally Heavy Chaos Modules

**Linear Issue:** [HPA-211](https://linear.app/cwchanap/issue/HPA-211/improve-slider-responsiveness-for-computationally-heavy-chaos-modules)
**Date:** 2026-07-13

## Summary

Dragging parameter sliders on heavy chaos modules causes UI lag because several modules recompute and repaint their full-resolution visualization on every `input` event. This spec introduces a shared per-control update policy (`live` / `preview` / `commit`) that keeps slider thumbs and numeric displays responsive while deferring or reducing the quality of expensive renders during drag. It also converts Hénon/Lozi point plotting from SVG DOM nodes to Canvas pixel operations, adds latest-wins cancellation to prevent stale results from overwriting newer ones, workerizes Newton Fractal computation, and applies renderer-specific optimizations (Chua trajectory caching, Rössler buffer reuse, point-cloud sampling, Double Pendulum trail buffers, Baker's Map adaptive budgets).

### Root cause

- `ParameterSlider` supports internal display values and debounced commits, but `VisualizationShell` passes `debounce={false}` to every schema-driven slider.
- Complex page-owned modules use native range inputs with direct `bind:value` / `oninput`, also propagating every thumb movement to the renderer.
- Renderers have no shared distinction between a draft slider value, a low-cost preview value, and a committed full-quality value.

### Design decisions (from brainstorming)

| Decision | Choice |
|----------|--------|
| Fidelity signal to renderer | `fidelity: 'preview' \| 'full'` param on the renderer snippet |
| Policy assignment location | Per-control, on slider definitions (`ParamDef` for schema-driven, same prop on `ParameterSlider` for page-owned) |
| Page-owned slider migration | Migrate to `ParameterSlider` component; shell provides shared drag-state context |
| Render-complete feedback | Render-state callback from renderer (`onRenderStateChange`) |
| Hénon/Lozi rendering | Hybrid: SVG axes + Canvas point overlay |
| Drag-state architecture | Shell-managed `SliderDragManager` via Svelte context |
| Testing mix | Vitest jsdom for logic + Playwright E2E for interactions |

## Files

### New files

| File | Purpose |
|------|---------|
| `src/lib/slider-drag-manager.ts` | `SliderDragManager` class: tracks dragging sliders, computes fidelity |
| `src/lib/slider-drag-manager.test.ts` | Unit tests for drag manager |
| `src/lib/render-generation.ts` | `RenderGeneration` class: latest-wins cancellation via generation IDs |
| `src/lib/render-generation.test.ts` | Unit tests for generation tracking |
| `src/lib/components/ui/ParameterSlider.svelte.test.ts` | Component tests: policy behavior, keyboard, drag state, unmount |
| `src/lib/components/visualizations/D3PointMapRenderer.svelte.test.ts` | Canvas overlay, preview sampling, render-state reporting |
| `src/lib/workers/worker-cancellation.test.ts` | Latest-wins cancellation with mock worker |
| `e2e/slider-responsiveness.spec.ts` | Playwright: draft-vs-commit, keyboard, latest-wins, cleanup |

### Modified files

| File | Change |
|------|--------|
| `src/lib/viz/types.ts` | Add `updatePolicy?: UpdatePolicy` to `ParamDef` |
| `src/lib/components/ui/ParameterSlider.svelte` | Replace `debounce`/`debounceMs` with `updatePolicy`; add throttle for preview, on-release commit; report to `SliderDragManager` via context; add `disabled` prop |
| `src/lib/components/ui/VisualizationShell.svelte` | Create + provide `SliderDragManager` via context; subscribe to fidelity; pass `fidelity` + `onRenderStateChange` to renderer snippet; remove `debounce={false}`; render status indicators |
| `src/lib/components/visualizations/D3PointMapRenderer.svelte` | Replace SVG point plotting with Canvas overlay; accept `fidelity` + `onRenderStateChange`; split into `renderAxes()` + `renderPoints()` |
| `src/lib/components/visualizations/HenonRenderer.svelte` | Thread `fidelity` + `onRenderStateChange` to `D3PointMapRenderer` |
| `src/lib/components/visualizations/LoziRenderer.svelte` | Same as Hénon |
| `src/lib/components/visualizations/NewtonRenderer.svelte` | Workerize computation; add `RenderGeneration`; accept `fidelity` + `onRenderStateChange`; preview = quarter-res + 25 iters |
| `src/lib/components/visualizations/LyapunovRenderer.svelte` | Accept `fidelity` + `onRenderStateChange`; preview = ~100 samples, 1k iters |
| `src/lib/components/visualizations/BifurcationLogisticRenderer.svelte` | Accept `fidelity` + `onRenderStateChange`; preview = ~200 cols × 200 iters |
| `src/lib/components/visualizations/BifurcationHenonRenderer.svelte` | Accept `fidelity` + `onRenderStateChange`; add `RenderGeneration` for chunk cancellation; preview = ~200 cols × 200 iters |
| `src/lib/components/visualizations/ChuaRenderer.svelte` | Accept `fidelity` + `onRenderStateChange`; trajectory caching; decompose recompute/recolor/section/view; preview = ~5k trajectory pts |
| `src/lib/components/visualizations/LorenzRenderer.svelte` | Accept `fidelity` + `onRenderStateChange`; preview = ~5k trajectory pts |
| `src/lib/components/visualizations/RosslerRenderer.svelte` | Accept `fidelity` + `onRenderStateChange`; pre-allocated typed arrays + `DynamicDrawUsage`; preview = ~5k trajectory pts |
| `src/lib/components/visualizations/CliffordRenderer.svelte` | Accept `fidelity` + `onRenderStateChange`; cached worker result; sampled style drags (25k immediate + debounced full) |
| `src/lib/components/visualizations/IkedaRenderer.svelte` | Same pattern as Clifford |
| `src/lib/components/visualizations/GumowskiMiraRenderer.svelte` | Same pattern as Clifford |
| `src/lib/components/visualizations/TinkerbellRenderer.svelte` | Same pattern as Clifford |
| `src/lib/components/visualizations/StandardRenderer.svelte` | Add `RenderGeneration` for worker result cancellation |
| `src/lib/components/visualizations/ChaosEsthetiqueRenderer.svelte` | Add `RenderGeneration` for worker result cancellation |
| `src/lib/components/visualizations/DoublePendulumRenderer.svelte` | Circular trail buffers; batched path drawing; `commit` policy for physics params |
| `src/lib/components/visualizations/BakersMapRenderer.svelte` | Adaptive frame budgets; `commit` policy for pointCount |
| `src/lib/workers/chaosMapsWorker.ts` (or new `newtonWorker.ts`) | Add Newton computation mode |
| `src/routes/henon/+page.svelte` | Thread `fidelity` + `onRenderStateChange` in renderer snippet |
| `src/routes/lozi/+page.svelte` | Same |
| All other heavy module `+page.svelte` files | Thread `fidelity` + `onRenderStateChange`; page-owned sliders migrated to `ParameterSlider` |
| `src/lib/constants.ts` | Replace `SLIDER_DEBOUNCE_MS` with `PREVIEW_THROTTLE_MS` (100ms); add `PREVIEW_IDLE_COMMIT_MS` (500ms) |
| `src/lib/constants.test.ts` | Update: replace `SLIDER_DEBOUNCE_MS` assertions with `PREVIEW_THROTTLE_MS` + `PREVIEW_IDLE_COMMIT_MS` positive-number checks |
| `src/lib/components/testing/PageOwnedSliderShell.svelte` | Provide `SliderDragManager` context for test harness |

## Design

### 1. Shared Slider Contract

#### 1.1 New types

```typescript
// src/lib/viz/types.ts (extended)

export type UpdatePolicy = 'live' | 'preview' | 'commit';

export interface ParamDef {
    key: string;
    id?: string;
    label: string;
    min: number;
    max: number;
    step: number;
    decimals?: number;
    default: number;
    updatePolicy?: UpdatePolicy; // NEW — defaults to 'live'
}

// src/lib/slider-drag-manager.ts
export type Fidelity = 'preview' | 'full';

export type RenderState = 'idle' | 'rendering' | 'complete';
```

#### 1.2 SliderDragManager

A small class created by `VisualizationShell`, provided via Svelte context. Tracks which sliders are mid-drag and computes overall fidelity.

```typescript
export class SliderDragManager {
    private dragging = new Map<string, UpdatePolicy>();
    private listeners = new Set<(fidelity: Fidelity) => void>();
    private currentFidelity: Fidelity = 'full';
    private commitDragging = false; // any commit-policy slider mid-drag

    register(id: string, policy: UpdatePolicy): () => void {
        // Returns an unregister function
    }

    setDragging(id: string, isDragging: boolean): void {
        // Add/remove from dragging map
        // Recompute fidelity: 'preview' if any preview-policy slider is dragging
        // Track commitDragging: true if any commit-policy slider is dragging
        // Notify subscribers if fidelity or commitDragging changed
    }

    getFidelity(): Fidelity {
        return this.currentFidelity;
    }

    getCommitDragging(): boolean {
        return this.commitDragging;
    }

    subscribe(fn: (fidelity: Fidelity) => void): () => void {
        // Returns an unsubscribe function
    }
}
```

**Fidelity computation:** `'preview'` if any slider with policy `'preview'` is currently dragging, `'full'` otherwise. Sliders with `'commit'` or `'live'` policy do not affect fidelity — commit doesn't render during drag at all; live always renders full quality.

**Commit-drag signal:** `getCommitDragging()` returns `true` when any `commit`-policy slider is mid-drag. The shell uses this to show a `FROZEN — RELEASE TO APPLY` badge instead of `LIVE_RENDER` (see §2.4).

**Context key:** `setContext('slider-drag-manager', manager)` / `getContext('slider-drag-manager')`.

#### 1.3 ParameterSlider changes

Currently has `internalValue` (display) and `value` (committed, bindable), with `debounce` / `debounceMs` props. Changes:

**New props:**
- `updatePolicy: UpdatePolicy = 'live'` — replaces `debounce` / `debounceMs`
- `disabled?: boolean` — when true, slider is visually disabled and doesn't participate in drag tracking

**Removed props:**
- `debounce` — replaced by `updatePolicy`
- `debounceMs` — replaced by `PREVIEW_THROTTLE_MS` constant

**`oninput` behavior by policy:**
- `live`: `value = newValue` immediately (current `debounce={false}` behavior)
- `preview`: throttle — update `value` at most every `PREVIEW_THROTTLE_MS` (100ms, ~8-10 updates/sec); report `setDragging(id, true)` on first input; the last throttled value always fires on release. `internalValue` (display) updates immediately on every input.
- `commit`: do NOT update `value`; report `setDragging(id, true)`; only `internalValue` (display) updates.

**`onchange` behavior (pointer release / keyboard `change` event):**
- `preview` / `commit`: `value = newValue` (flush latest); report `setDragging(id, false)`.
- `live`: no-op (value already current).

**Keyboard support:** Arrow-key drags fire `input` events the same way as pointer drags. On `change` (blur or Enter), commit. An idle timer (`PREVIEW_IDLE_COMMIT_MS` = 500ms after last keystroke without further input) also commits for `preview` / `commit` policies, so keyboard-only users get full renders without needing to blur. Note: holding an arrow key fires continuous `input` events, so the idle timer never fires until the hold ends — this matches pointer drag behavior (no commit until release).

**Disabled-mid-drag guarantee:** If a slider is disabled while mid-drag (e.g., Clifford's `pointSize` is disabled when `colorMode` changes off gradient during an active drag), the slider's `$effect` watching `disabled` calls `setDragging(id, false)` and cleans up all timers. This prevents the `SliderDragManager` from thinking a drag is still active after the slider becomes disabled.

**Drag manager integration:** On mount, the slider registers with the `SliderDragManager` from context (if available). On unmount, it unregisters and cleans up all timers.

#### 1.4 VisualizationShell changes

- Creates a `SliderDragManager` instance per shell mount, provides it via `setContext('slider-drag-manager', manager)`.
- Subscribes to fidelity changes, stores in `$state`.
- Removes the blanket `debounce={false}` — passes `updatePolicy={def.updatePolicy ?? 'live'}` to each `ParameterSlider`.
- **Renderer snippet params change:** `{ values, container }` becomes `{ values, container, fidelity, onRenderStateChange }`.
- **Stable callback reference:** `onRenderStateChange` must be a stable function reference (defined once, not recreated on every shell re-render) to avoid triggering renderer `$effect`s that depend on snippet params. The shell defines it as a plain function (not an inline arrow in the snippet call) or wraps it in a `$derived`-free ref.
- **Save/share/compare/snapshot:** already use `getParameters()` which reads `values` — these are the committed values. No change needed; `values` only updates on commit for `preview` / `commit` policies.
- **Status indicators:** shell renders overlay badges (see Section 2.3).

#### 1.5 Page-owned slider migration

Pages that currently render native `<input type="range">` in `extraControls` (Clifford, Ikeda, Gumowski-Mira, Double Pendulum, Lorenz) will:

1. Replace native inputs with `<ParameterSlider>` components.
2. Receive the `SliderDragManager` from context (the shell already provides it).
3. Declare `updatePolicy` per slider based on the module's classification (Section 3).
4. For disabled/conditional bindings (e.g., Clifford's `pointSize` / `opacity` when `colorMode` is gradient): pass `disabled` prop. When disabled, the slider doesn't participate in drag tracking.
5. Pages that use `PageOwnedSliderShell` (the test wrapper) get the same context.

**Custom control components:** Some page-owned modules (notably Lorenz) encapsulate sliders inside custom control components (PlaybackControls, TrailControls, SolverControls, etc.) rather than rendering native inputs directly. These components must also adopt `ParameterSlider` internally, receiving the `SliderDragManager` from context. The migration applies to native range inputs wherever they live — direct in the page or inside custom components.

#### 1.6 Stability-reporting interaction

The `updatePolicy` changes **when** `values` (or page-owned `$state`) updates, which affects both stability strategies documented in AGENTS.md. The intended behavior for each combination:

| Strategy | Policy | During drag | On release |
|----------|--------|-------------|------------|
| Shell-managed (`reactiveStability`) | `live` | Stability re-checks on every input (unchanged) | — |
| Shell-managed (`reactiveStability`) | `preview` | Stability re-checks on every throttled value update (~10×/sec). An improvement — fewer checks than today's per-input behavior. | Final check on the committed value |
| Shell-managed (`reactiveStability`) | `commit` | **Silent** — `values` doesn't update, so the shell's `$effect` tracking `values[def.key]` doesn't re-run. Stability warnings are suppressed for the entire drag. | Single check on the committed value, warnings fire immediately |
| Page-managed (`stabilityReporter`, `reactive: true`) | `live` | `triggerReactive()` fires on every input → debounced 300ms check (unchanged) | — |
| Page-managed (`stabilityReporter`, `reactive: true`) | `preview` | `triggerReactive()` fires on throttled updates → debounced 300ms check fires ~every 400ms during drag | Final check after debounce settles |
| Page-managed (`stabilityReporter`, `reactive: true`) | `commit` | **Silent** — tracked `$state` doesn't update, so `triggerReactive()` isn't called. The debounce timer from the last pre-drag trigger has already fired. | `$state` updates → `$effect` re-runs → `triggerReactive()` → 300ms debounce → check fires |

**Decision: commit-policy silent-drag-then-warn-on-release is the intended behavior.** This is correct because (a) the user is exploring parameter space and hasn't committed a value yet — warning about an intermediate value is noise, and (b) on release, the warning fires immediately (shell-managed) or after a short debounce (page-managed), which is the right time to alert.

**Page-owned migration note:** After migration, page-owned `$state` variables bind to `ParameterSlider`'s committed `value` instead of updating on every `input`. The `$effect` that tracks `void param1; void param2; …` will see fewer updates (throttled for `preview`, none for `commit`). The `createStabilityReporter` factory's internal `useDebouncedEffect` (300ms debounce) is unaffected — it simply receives fewer `trigger()` calls. No changes to `stability-reporter.ts` are needed.

### 2. Rendering-State Pipeline

#### 2.1 Fidelity signal flow

```
SliderDragManager → (subscribe) → VisualizationShell.$state(fidelity)
    → renderer snippet { fidelity, onRenderStateChange }
    → renderer scales work based on fidelity
```

#### 2.2 Renderer snippet signature

```typescript
interface RendererParams {
    values: Record<string, number>;
    container: { el?: HTMLDivElement };
    fidelity: Fidelity;
    onRenderStateChange: (state: RenderState) => void;
}
```

Existing renderers that destructure only `{ values, container }` continue to work — the new fields are additional. Renderers opt in to fidelity-aware rendering and render-state reporting as they're updated. A renderer that ignores both behaves exactly as it does today (always full-quality, no status feedback).

#### 2.3 Render-state reporting protocol

Each renderer that supports the new contract calls `onRenderStateChange` at these points:

| Event | State | When |
|-------|-------|------|
| Render starts | `'rendering'` | Before beginning synchronous work, worker dispatch, or first rAF chunk |
| Render finishes | `'complete'` | After the final paint/geometry update is on screen |
| Initial mount | `'idle'` | Before the first render begins |

For continuous-animation renderers (Double Pendulum, Baker's Map): they report `'complete'` once per parameter commit and don't report during their normal animation loop — the animation loop is always "live," not a parameter-triggered render.

**Synchronous renderers:** For genuinely synchronous renderers (Bifurcation-Logistic, pre-worker Newton, Hénon/Lozi canvas at preview budgets), the `'rendering'` → `'complete'` transition happens within a single tick. Svelte's reactivity batches these — the `RENDERING FULL QUALITY…` badge will never be visible for synchronous renders. This is correct behavior: fast renders don't need a progress indicator. The badge is meaningful only for asynchronous renders (worker dispatches, progressive rAF chunks, Three.js trajectory rebuilds).

#### 2.4 Status indicators (shell-owned)

The shell renders status badges as absolutely-positioned overlays in the visualization container area:

| State | Badge text | Condition |
|-------|-----------|-----------|
| Idle, live policy | `LIVE_RENDER` | `fidelity === 'full'` and `renderState === 'idle'` or `'complete'` and not `commitDragging` |
| Preview drag | `PREVIEW` | `fidelity === 'preview'` |
| Commit drag | `FROZEN — RELEASE TO APPLY` | `commitDragging === true` (fidelity is `'full'`, viz is frozen) |
| Post-commit render | `RENDERING FULL QUALITY…` | `fidelity === 'full'` and `renderState === 'rendering'` and not `commitDragging` |

During migration, renderers that still render their own `LIVE_RENDER` badge coexist with the shell overlay — the shell badge is positioned at `top-4 left-4` while renderer badges stay at `top-4 right-4`. Once a renderer is updated, it removes its internal badge and the shell's badge takes over at the standard position.

**Commit-policy drag cue:** The `FROZEN — RELEASE TO APPLY` badge replaces `LIVE_RENDER` when any commit-policy slider is mid-drag, making it clear the visualization is intentionally frozen. The slider thumb also gets a subtle CSS accent glow.

#### 2.5 Latest-wins cancellation

A shared `RenderGeneration` utility prevents stale results from overwriting newer ones:

```typescript
// src/lib/render-generation.ts
export class RenderGeneration {
    private current = 0;
    next(): number { return ++this.current; }
    isStale(gen: number): boolean { return gen !== this.current; }
}
```

By renderer type:

| Renderer type | Cancellation mechanism |
|--------------|----------------------|
| Synchronous (Newton, Bifurcation-Logistic) | `isRendering` flag + `pendingRender` (already exists) — render completes before event loop returns. `RenderGeneration` is **not** applied here (not needed: no async gap for stale results to slip through). |
| Progressive rAF (Bifurcation-Hénon) | `RenderGeneration` — each chunk checks `isStale(gen)` before drawing |
| Worker-backed (Clifford, Ikeda, Gumowski-Mira, Tinkerbell, Standard, Chaos Esthetique, Newton) | Generation ID sent with each worker request; result handler checks `isStale(gen)` before painting |
| Three.js (Lorenz, Rössler, Chua) | `RenderGeneration` around trajectory rebuild; geometry from stale generation is discarded |
| Continuous animation (Double Pendulum, Baker's Map) | N/A — always renders latest state per frame |

### 3. Per-Module Policies and Preview Budgets

Every module is classified with an `UpdatePolicy` per slider and a preview budget.

| Module | Slider ownership | Policy | Preview budget | Full render | Extra workstream |
|--------|-----------------|--------|---------------|-------------|-----------------|
| Logistic | Schema | `live` (all) | — | 200 points | None (already fast) |
| Hénon | Schema | `preview` (all) | ~1,000 pts | Up to 5,000 | Canvas conversion (§4) |
| Lozi | Schema | `preview` (all) | ~1,000 pts | Up to 5,000 | Canvas conversion (§4) |
| Newton | Schema | `preview` (all) | ¼-res canvas, 25 iters | Full canvas, selected iters | Workerize (§5A) |
| Lyapunov | Schema | `preview` (all) | ~100 samples, 1k iters | 400 samples, selected iters | — |
| Bifurcation-Logistic | Schema | `preview` (all) | ~200 cols × 200 iters | Full width, selected iters | — |
| Bifurcation-Hénon | Schema | `preview` (all) | ~200 cols × 200 iters | Full width, selected iters | RenderGeneration fix |
| Standard Map | Schema | `preview` (compute), `live` (style) | 10k sampled pts | Full | RenderGeneration fix |
| Chaos Esthétique | Schema | `preview` (compute), `live` (style) | 10k sampled pts | Full | RenderGeneration fix |
| Chua | Schema | `preview` (trajectory params) | ~5k trajectory pts | Full trajectory | Cache + decompose (§5C) |
| Rössler | Schema | `preview` (a, b, c) | ~5k trajectory pts | Full trajectory | Buffer reuse (§5D) |
| Lorenz | Page-owned | `preview` (sigma, rho, beta) | ~5k trajectory pts | Full trajectory | — |
| Clifford | Page-owned | `preview` (a,b,c,d,iter), `live` (style) | 25k sampled pts | Up to 250k | Sampled style drags (§5E) |
| Ikeda | Page-owned | `preview` (compute), `live` (style) | 25k sampled pts | Up to 200k | Sampled style drags (§5E) |
| Gumowski-Mira | Page-owned | `preview` (compute), `live` (style) | 25k sampled pts | Up to 250k | Sampled style drags (§5E) |
| Tinkerbell | Page-owned | `preview` (compute), `live` (style) | 25k sampled pts | Up to 250k | Sampled style drags (§5E) |
| Double Pendulum | Page-owned | `commit` (physics), `live` (view) | Keep current frame | Restart on release | Trail buffers (§5F) |
| Baker's Map | Schema | `commit` (pointCount), `live` (speed) | Keep current frame | Reinit on release | Adaptive budgets (§5G) |

#### Policy rationale

**`live`** — Lightweight: renderer receives every value, always full quality. Used for: Logistic (200 pts), style-only controls on worker-backed modules (color, zoom, point size, opacity), Double Pendulum view controls (speed, trail toggle), Baker's Map speed.

**`preview`** — Heavy computation or paint: throttled reduced-quality render during drag (~8-10 updates/sec), full quality on release. Used for: all P0 trajectory/fractal modules, point-cloud computation parameters, Hénon/Lozi.

**`commit`** — Expensive side effects on change (simulation restart, distribution reinitialization): no render during drag, full-quality render only on release. Used for: Double Pendulum physics params, Baker's Map pointCount.

#### How renderers consume fidelity

Each updated renderer checks `fidelity` in its `$effect` or render function to scale its work:

```typescript
// Example: NewtonRenderer
$effect(() => {
    void xMin; void xMax; void yMin; void maxIterations;
    if (!canvas) return;

    const previewMode = fidelity === 'preview';
    const effectiveWidth = previewMode ? Math.floor(width / 2) : width;
    const effectiveHeight = previewMode ? Math.floor(height / 2) : height;
    const effectiveIterations = previewMode ? Math.min(maxIterations, 25) : maxIterations;

    onRenderStateChange('rendering');
    render(effectiveWidth, effectiveHeight, effectiveIterations);
    onRenderStateChange('complete');
});
```

For worker-backed renderers, the fidelity flag scales the iteration count sent to the worker; the worker result is painted at whatever resolution it returns.

#### Style-only slider sampling

Clifford, Ikeda, Gumowski-Mira, Tinkerbell style controls (colorMode, zoom, pointSize, opacity) are `live` — they should update immediately. But repainting 250k points on every input is expensive. Solution: when a `live` style slider fires, paint only a sampled subset (every Nth point, ~25k) for immediate feedback. Since point positions don't change (only color/size/opacity), the full-quality repaint happens via a debounced follow-up (~150ms after the last style change) that paints all points from the cached worker result.

**Change-detection mechanism:** The renderer receives `values` and `fidelity` from the snippet — it doesn't know *which* key changed. To distinguish style-only changes (re-paint from cache) from compute changes (re-dispatch to worker), the renderer keeps a `prevValues` ref and diffs the compute-key subset on each update. If any compute key (e.g., `a`, `b`, `c`, `d`, `iterations`) changed, it dispatches a new worker request. If only style keys changed, it runs the two-phase sampled paint from the cached result. This is fully renderer-internal — no shell changes needed.

### 4. Hénon/Lozi Canvas Conversion

#### Problem

`D3PointMapRenderer` creates up to 5,000 `<circle>` SVG nodes (each with gradient fill and optional glow filter) on every parameter change. SVG DOM node creation is the bottleneck — thousands of DOM allocations, style recalculations, and layout/paint work.

#### Solution: Hybrid SVG axes + Canvas point overlay

Split the single SVG into two layers in the same container:

```
+-- container (relative, height) ------------------+
|  +-- SVG layer (absolute inset-0) ------------+  |
|  |  D3 axes, labels, gridlines                 |  |
|  |  (rebuilt only when scales change)          |  |
|  +---------------------------------------------+  |
|  +-- Canvas layer (absolute, margin-offset) ---+  |
|  |  Points drawn via Canvas 2D API              |  |
|  |  (redrawn on every update, pixel ops)        |  |
|  +---------------------------------------------+  |
+--------------------------------------------------+
```

**Canvas sizing:** The canvas covers only the plot area (container minus margins), positioned via CSS `left/top/width/height` matching `D3_CHART_MARGIN`. Pixel dimensions = CSS dimensions × `devicePixelRatio` for crisp rendering. Context is scaled by `devicePixelRatio` so plot coordinates map directly.

**Point rendering:** Replace SVG `<circle>` creation with a Canvas draw loop:

```typescript
const interp = d3.interpolateRgb(COLOR_PRIMARY, COLOR_MAGENTA);
const pts = effectivePoints; // sampled during preview
ctx.clearRect(0, 0, canvas.width, canvas.height);

for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const t = i / pts.length;
    ctx.fillStyle = interp(t);
    ctx.globalAlpha = opacity;
    if (glow && fidelity === 'full') {
        ctx.shadowBlur = 4;
        ctx.shadowColor = interp(t);
    }
    ctx.beginPath();
    ctx.arc(xScale(x), yScale(y), r, 0, Math.PI * 2);
    ctx.fill();
}
```

**Glow optimization:** `shadowBlur` is expensive per-point. During `fidelity === 'preview'`, glow is disabled. During full render, glow is applied. If profiling shows glow is still too slow at 5,000 points, fallback: draw a larger semi-transparent circle behind each point as a cheaper glow approximation.

**Preview point sampling:** When `fidelity === 'preview'` and `points.length > 1000`, sample ~1,000 points evenly (every Nth point). This preserves the attractor's shape while cutting draw calls by 5×.

**Render split:** `renderAxes()` runs when dimensions or scales change (SVG layer). `renderPoints()` runs on every update (Canvas layer). Both share the same `makeLinearScales` output.

**Resize handling:** A `ResizeObserver` on the container re-sets `canvas.width/height` (× `devicePixelRatio`), re-scales the context (`ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`), re-runs `renderAxes()` (scales may change), and re-runs `renderPoints()`. Without this, the canvas blurs on container resize because the pixel buffer doesn't match the new CSS dimensions.

#### What changes

| File | Change |
|------|--------|
| `D3PointMapRenderer.svelte` | Replace SVG point plotting with Canvas overlay. Accept `fidelity` and `onRenderStateChange` props. Split render into `renderAxes()` + `renderPoints()`. |
| `HenonRenderer.svelte` | Thread `fidelity` and `onRenderStateChange` through to `D3PointMapRenderer`. No logic change. |
| `LoziRenderer.svelte` | Same as Hénon. |
| `src/routes/henon/+page.svelte` | Add `fidelity` and `onRenderStateChange` to renderer snippet. |
| `src/routes/lozi/+page.svelte` | Same. |
| `src/lib/viz/d3-chaos.ts` | `plotGradientPoints` becomes unused for Hénon/Lozi (keep for Logistic, which stays SVG). Optionally add a `canvasPlotGradientPoints` helper. |

#### What doesn't change

- **Logistic map** stays full SVG (only 200 points — no performance issue).
- Axes styling, labels, gridlines, sci-fi aesthetic — all preserved via the SVG layer.
- Container styling, chrome variants (`plain` / `decorated`), corner borders — unchanged.

### 5. Workers, Cancellation, and Renderer Optimizations

#### 5A. Workerize Newton Fractal

Newton is the worst synchronous offender — every canvas pixel × up to 100 iterations. Even at preview quality (quarter-resolution, 25 iterations), it's ~2.5M operations blocking the main thread. Workerizing it eliminates all main-thread blocking.

**Approach:** Add a Newton computation mode to the existing `chaosMapsWorker.ts` (or a dedicated `newtonWorker.ts` if the shared worker is at capacity).

- **Main → Worker:** `{ generation, fidelity, width, height, xMin, xMax, yMin, yMax, maxIterations }`
- **Worker → Main:** `{ generation, imageData: Uint8ClampedArray, width, height }`
- **Preview scaling in worker:** quarter-resolution dimensions, `min(maxIterations, 25)`
- **Main thread paint:** `ctx.putImageData(new ImageData(result.imageData, width, height), 0, 0)` — if preview resolution, scale up via temporary canvas or draw to a smaller canvas CSS-scaled to full size.

Other modules (Lyapunov, Bifurcation-Logistic) stay synchronous — their preview budgets (100k iterations, 40k map steps) are fast enough to stay under 50ms. If profiling contradicts this, they're workerized as a follow-up using the same pattern.

#### 5B. Latest-wins cancellation (applied per renderer)

Using the `RenderGeneration` class from Section 2.5:

**Worker-backed (existing + Newton):**
```typescript
const gen = renderGen.next();
worker.postMessage({ generation: gen, ...params });
// On result:
if (renderGen.isStale(e.data.generation)) return;
ctx.putImageData(...);
```

**Progressive rAF (Bifurcation-Hénon):**
```typescript
function drawChunk() {
    if (renderGen.isStale(myGeneration)) return; // abort stale chunk
    // ... draw ...
}
```

**Three.js trajectory (Lorenz, Rössler, Chua):**
```typescript
const gen = renderGen.next();
// ... compute trajectory ...
if (renderGen.isStale(gen)) return; // newer request superseded this
// ... update geometry ...
```

#### 5C. Chua: trajectory caching + decomposition

**Current:** Any parameter change triggers full RK4 integration + buffer construction + coloring + Poincaré section.

**After:** Cache the last full-quality trajectory keyed by the parameter values that affect the ODE. Decompose operations:

| Operation | Triggered by | Reuses cache? | Cost |
|-----------|-------------|--------------|------|
| Trajectory integration | alpha, beta, gamma, a, b | No — full recompute | Heavy (~100k RK4 steps) |
| Coloring | color params (if any) | Yes — cached trajectory | Light (iterate points, recompute colors) |
| Poincaré section | plane params (if any) | Yes — cached trajectory | Medium (iterate points, find intersections) |
| Camera/view | zoom, rotation, trailLength | Yes — cached trajectory + geometry | Trivial (Three.js transform) |

Policy: trajectory params → `preview` (~5k points). Other params → `live` (cheap transform on cached data).

#### 5D. Rössler: buffer reuse

**Current:** Allocates new `Vector3` / `Color` per point, new `BufferGeometry` per render — 20,000 allocations.

**After:** Pre-allocate typed arrays on mount, reuse across renders:

```typescript
const maxPoints = 20000;
const positions = new Float32Array(maxPoints * 3);
const colors = new Float32Array(maxPoints * 3);
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));

// On recompute: fill arrays in place, setDrawRange, flag needsUpdate
```

Zero per-render allocations. GC pressure eliminated.

#### 5E. Large point clouds: sampled style drags

**Applies to:** Clifford, Ikeda, Gumowski-Mira, Tinkerbell.

**Current:** Style-only controls (colorMode, zoom, pointSize, opacity) trigger full 200k-250k point repaint.

**After:** Two-phase paint for style-only changes:

1. **Immediate (0ms):** Paint ~25k sampled points (every Nth from cached worker result) for instant visual feedback.
2. **Debounced (~150ms):** Full-quality repaint of all points from the same cached result.

The renderer caches the last worker result (Float32Array of point coordinates) and can re-paint from it without re-dispatching to the worker. Only computation parameter changes (a, b, c, d, iterations) dispatch new worker requests. Style-only changes are detected via a `prevValues` ref diff (see §3 "Change-detection mechanism") and trigger the two-phase sampled paint.

#### 5F. Double Pendulum: circular trail buffers

**Current:** Front-splices arrays, strokes each trail segment independently.

**After:**
- **Circular buffer** for trail positions: `Float64Array` with head pointer, O(1) insert, no array splicing.
- **Batched path:** Single `beginPath()` → sequential `lineTo()` → single `stroke()` per trail, instead of per-segment strokes.

Doubles performance in comparison mode (two pendulums, two trails).

```typescript
const trailX = new Float64Array(maxTrailLength);
const trailY = new Float64Array(maxTrailLength);
let trailHead = 0;
let trailCount = 0;

function addTrailPoint(x: number, y: number) {
    trailX[trailHead] = x;
    trailY[trailHead] = y;
    trailHead = (trailHead + 1) % maxTrailLength;
    if (trailCount < maxTrailLength) trailCount++;
}

function drawTrail(ctx: CanvasRenderingContext2D) {
    if (trailCount < 2) return;
    ctx.beginPath();
    let idx = (trailHead - trailCount + maxTrailLength) % maxTrailLength;
    ctx.moveTo(trailX[idx], trailY[idx]);
    for (let i = 1; i < trailCount; i++) {
        idx = (idx + 1) % maxTrailLength;
        ctx.lineTo(trailX[idx], trailY[idx]);
    }
    ctx.stroke();
}
```

#### 5G. Baker's Map: adaptive frame budgets

**Current:** Fixed 10k points × up to 10 steps per frame.

**After:** Monitor `performance.now()` delta between frames. If consistently over ~18ms (missing 60fps budget), reduce steps per frame. If under ~10ms, increase back toward target. Point count stays fixed (reinitializing mid-drag is worse than the render cost).

```typescript
if (frameDelta > 20) effectiveSteps = Math.max(1, effectiveSteps - 1);
else if (frameDelta < 12 && effectiveSteps < targetSteps) effectiveSteps++;
```

### 6. Testing and Profiling

#### 6.1 Vitest unit/component tests

| Test file | Environment | Coverage |
|-----------|------------|----------|
| `src/lib/slider-drag-manager.test.ts` | node | Register/unregister, fidelity computation (preview only when preview-policy slider drags), multiple simultaneous drags, subscribe lifecycle |
| `src/lib/render-generation.test.ts` | node | `next()` increments, `isStale()` for old/current gens, rapid invalidation |
| `src/lib/components/ui/ParameterSlider.svelte.test.ts` | jsdom | `live`: every input updates value. `preview`: throttled value, immediate display. `commit`: no value update during drag, updates on release. Keyboard: arrow keys fire input, idle timer commits. Drag-state reporting to manager. `disabled` prop opts out. **Disabled-mid-drag: `setDragging(id, false)` called when disabled becomes true during drag.** Unmount cleans up timers + registration |
| `src/lib/components/ui/VisualizationShell.svelte.test.ts` | jsdom | Renderer snippet receives `fidelity` + `onRenderStateChange`. Save/share/compare use committed values. Config loader applies committed values. **SliderDragManager↔shell fidelity subscription wiring.** **Stability-reporter + commit policy: warnings silent during drag, fire on release.** |
| `src/lib/components/visualizations/D3PointMapRenderer.svelte.test.ts` | jsdom | Canvas overlay created alongside SVG axes. Points drawn on canvas (not SVG circles). Preview samples ~1,000. Full renders all. `onRenderStateChange` called correctly |
| `src/lib/workers/worker-cancellation.test.ts` | node | Mock worker: two rapid requests → only latest result painted. Generation ID in request, checked on response |
| `src/lib/components/visualizations/CliffordRenderer.svelte.test.ts` (or similar point-cloud renderer) | jsdom | **Style-only two-phase paint:** style key change triggers sampled immediate paint + debounced full. Compute key change triggers worker dispatch. `prevValues` diff classifies correctly. |

#### 6.2 Playwright E2E tests

`e2e/slider-responsiveness.spec.ts`:

| Test | Module | What it verifies |
|------|--------|-----------------|
| Draft-vs-commit (preview) | Hénon | Drag → viz updates during drag (preview quality) → release → full-quality render → final viz matches released value |
| Commit-policy | Double Pendulum | Drag physics slider → viz does NOT change → release → simulation restarts with new value |
| Keyboard interaction | Newton | Focus slider → arrow keys → preview/commit works → idle timer commits |
| Latest-wins cancellation | Bifurcation-Hénon | Rapid parameter changes → final viz matches last value, not intermediate |
| Cleanup on unmount | Any heavy module | Start drag → navigate away mid-drag → no errors, no orphaned timers/workers/rAF |

#### 6.3 Profiling plan

Manual Chrome DevTools Performance traces, documented as before/after:

| Module | Drag scenario | Before (expected) | After (target) |
|--------|--------------|-------------------|----------------|
| Hénon | Drag `a` slider | 5,000 SVG `<circle>` creations per input event | Canvas pixel ops; ~1,000 sampled during preview |
| Newton | Drag `xMin` slider | Synchronous per-pixel Newton iteration, main thread blocked | Worker computation; main thread free; `RENDERING` badge visible |
| Lorenz | Drag `sigma` slider | Full 100k-point trajectory rebuild per input | ~5k preview points during drag; full on release |
| Clifford | Drag `opacity` (style) slider | Full 250k-point repaint per input | 25k sampled immediate + debounced full repaint |

**Acceptance bar:** No main-thread long task >50ms during slider input handlers at default settings on Chrome on an M1 MacBook at default DPR (no CPU/network throttling). Full renders run asynchronously or progressively with status feedback.

**Accessibility note:** The preview/commit behavior is about computation cost, not animation. `prefers-reduced-motion` does not affect slider policies — reduced-quality previews and deferred commits are not "motion" and don't trigger vestibular issues. The `PREVIEW` / `RENDERING` / `FROZEN` badges are text-based status indicators, not animations.

## Delivery Sequence

The issue's suggested delivery sequence, mapped to the design sections:

1. **Shared slider policy and rendering-state UI** (Sections 1-2) — the foundation. All other workstreams depend on this.
2. **Apply commit/preview behavior to P0 schema-driven modules** (Section 3) — assign policies and preview budgets to Newton, Lyapunov, Bifurcation-Logistic, Chua, Rössler (schema-driven sliders, no migration needed).
3. **Migrate page-owned sliders to ParameterSlider** (Section 1.5) — replace native range inputs in Clifford, Ikeda, Gumowski-Mira, Double Pendulum, Lorenz (including custom control components). Sizable refactor across 5 modules. Can parallelize with step 4.
4. **Convert Hénon/Lozi point rendering to Canvas** (Section 4) — independent of the slider contract, can parallelize with steps 2-3.
5. **Add latest-wins worker/cancellation behavior** (Sections 5A-5B) — workerize Newton, add `RenderGeneration` to progressive and worker-backed renderers.
6. **Optimize large point-cloud paint and continuous-animation frame budgets** (Sections 5C-5G) — Chua caching, Rössler buffer reuse, point-cloud sampling, Double Pendulum trails, Baker's Map budgets.

## Acceptance Criteria

- [ ] Heavy slider controls remain visually responsive while dragging; they do not synchronously trigger a full-quality render for every `input` event.
- [ ] Each heavy module is explicitly classified as `live`, `preview`, or `commit`; lightweight modules retain immediate updates.
- [ ] Pointer release / committed keyboard input results in one full-quality render of the latest parameter values.
- [ ] No obsolete worker result, animation chunk, or delayed render can overwrite a newer committed result.
- [ ] Preview and full-render states are visible and accessible without blanking the previous completed visualization.
- [ ] Save/share/compare/snapshot behavior uses the committed parameter state.
- [ ] Hénon and Lozi no longer create one SVG DOM node per plotted point.
- [ ] Automated tests cover draft-versus-commit behavior, pointer and keyboard interaction, latest-wins cancellation, and cleanup on unmount.
- [ ] Add before/after browser profiling for representative P0 and P1 modules, including Hénon, Newton, Lorenz or Chua, and one 200k+ point-cloud renderer.
- [ ] At default settings on the reference browser/device, slider input handlers do not create main-thread long tasks over 50 ms; max-workload full renders run asynchronously or progressively with status feedback.

## Open Questions

- **Chua parameter decomposition:** The exact set of Chua's parameters (beyond alpha, beta, gamma, a, b) needs verification — if there are color/Poincaré/view controls, they get `live` policy with trajectory caching. If all parameters affect the ODE, they all get `preview`.
- **Baker's Map slider ownership:** Needs verification — assumed schema-driven based on simple parameter set (pointCount, speed). If page-owned, it needs `ParameterSlider` migration.
- **Rössler slider ownership:** Uses `reactiveStability` (shell-managed) per AGENTS.md, suggesting schema-driven. Needs confirmation during implementation.
- **Standard Map / Chaos Esthétique style parameters:** Need to identify which parameters are "compute" (preview) vs "style" (live). Likely: k, numP, numQ, iterations = compute; any color/render options = style.
- **Newton worker capacity:** If `chaosMapsWorker.ts` is at capacity (too many message types), create a dedicated `newtonWorker.ts`. Decision deferred to implementation.
- **Canvas DPI / resize:** The `devicePixelRatio` scaling approach (canvas.width = cssWidth × dpr, ctx.setTransform) and ResizeObserver-driven resize are specified in §4 but need validation across different display densities and container resize scenarios during implementation.
- **Custom control components in page-owned modules:** Lorenz (and possibly others) encapsulate sliders inside custom control components (PlaybackControls, TrailControls, SolverControls). These need internal migration to `ParameterSlider`. The full extent of custom components requiring migration needs inventory during implementation.
