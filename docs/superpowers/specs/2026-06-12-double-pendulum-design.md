# Double Pendulum Visualization — Design

**Linear issue:** [HPA-56](https://linear.app/cwchanap/issue/HPA-56/add-double-pendulum-visualization-module)
**PRD:** [PRD: Double Pendulum Visualization](https://linear.app/cwchanap/document/prd-double-pendulum-visualization-58577e126876)
**Date:** 2026-06-12

## Summary

Add a `Double Pendulum` visualization module: a real-time, deterministic, client-side
physics simulation of a two-link pendulum that demonstrates sensitivity to initial
conditions. Unlike every existing module — which iterates a map/attractor and plots a
static or accumulating point set — this module runs a **live, stateful simulation** with a
`requestAnimationFrame` loop, a fading trail, and an in-canvas comparison overlay.

The module is **fully integrated** with the existing shared infrastructure: it is added to
`ChaosMapType`, gets a `DoublePendulumParameters` interface, and wires up the saved-config
dialog, account-saved configs, URL-param loading, validation, snapshot, and share — exactly
like the other modules.

## Key design decision: initial conditions vs physical parameters

Because this is a live simulation rather than a recompute-on-change plot, controls split
into two kinds with different runtime behavior:

- **Initial conditions** — `theta1, theta2, omega1, omega2`. These define only the state at
  t=0. Editing any of them, or invoking Reset/Randomize, **re-seeds** the live simulation
  from those values and clears the trail.
- **Physical parameters** — `l1, l2, m1, m2, gravity, damping, speed`. These apply **live**
  to the running simulation without resetting bob positions.

Both kinds are persisted in `DoublePendulumParameters` so save/share/snapshot/URL reproduce
a setup exactly. The evolving runtime state (current `theta`/`omega`, trail) is
session-local and **not** persisted — the same philosophy already documented for Chua in
`types.ts`.

## Architecture

Rendering uses **Canvas 2D** (matches the existing canvas renderers; handles fading trails
better than SVG/DOM, which jitters on mobile). Physics is **not** offloaded to a Web Worker —
RK4 on a 4-variable system is a handful of float ops per step, so a worker would add
per-frame `postMessage` latency for no gain.

### Files

**New:**

- `src/lib/double-pendulum.ts` — pure physics (types, derivatives, RK4 step, bob positions,
  divergence, randomize, finiteness guard). Mirrors `chua.ts`. Heavily unit-tested.
- `src/lib/double-pendulum-presets.ts` — defaults + a few named presets (mirrors
  `ikeda-presets.ts`).
- `src/lib/components/visualizations/DoublePendulumRenderer.svelte` — canvas, rAF loop,
  fixed-timestep sub-stepping with delta-time clamping, capped fading trail, comparison
  overlay + divergence readout.
- `src/routes/double-pendulum/+page.svelte` — main page (controls, save/share/snapshot, URL
  loading), modeled on `src/routes/ikeda/+page.svelte`.
- `src/routes/double-pendulum/compare/+page.svelte` — side-by-side independent sims via
  `ComparisonLayout` / `ComparisonParameterPanel`.

**Edited (shared integration surface):**

- `src/lib/types.ts` — `ChaosMapType`, `DoublePendulumParameters`, `ChaosMapParameters`,
  `CHAOS_MAP_DISPLAY_NAMES` (`DOUBLE_PENDULUM`), `VALID_MAP_TYPES`, `SavedConfiguration`.
- `src/lib/chaos-validation.ts` — `validateParameters` + `checkParameterStability` cases.
- `src/lib/saved-config-loader.ts` — parsing/loading for the new type.
- `src/lib/comparison-url-state.ts` — comparison URL state for the new type.
- `src/lib/type-guards.ts`, `src/lib/constants.ts` — any per-type enumerations.
- `src/routes/+page.svelte` — homepage card.

(The exact set of shared files is confirmed during planning by following the Ikeda
integration as the reference; any file that enumerates all map types must include
`double-pendulum`.)

## Component details

### Physics module (`double-pendulum.ts`)

```ts
export interface PendulumState   { theta1: number; theta2: number; omega1: number; omega2: number; }
export interface PendulumPhysics { l1: number; l2: number; m1: number; m2: number; gravity: number; damping: number; }
```

- `derivatives(state, physics)` → `{ dTheta1, dTheta2, dOmega1, dOmega2 }`. Standard coupled
  double-pendulum equations of motion, with a `-damping · omega` term on each angular
  acceleration.
- `rk4Step(state, physics, dt): PendulumState` — fourth-order Runge–Kutta step.
- `bobPositions(state, physics)` → `{ x1, y1, x2, y2 }` with the pivot at the origin.
- `divergence(a, b, physics)` → Euclidean distance between the second bobs of two systems.
- `randomizeInitialConditions(rng?)` → fresh `{ theta1, theta2, omega1, omega2 }`; RNG is
  injectable for deterministic tests.
- `isFiniteState(state)` → `boolean`; detects NaN/Infinity / runaway state.

### Parameters interface

```ts
export interface DoublePendulumParameters {
  type: 'double-pendulum';
  // Initial conditions (persisted)
  theta1: number; theta2: number; omega1: number; omega2: number;
  // Physical parameters (persisted)
  l1: number; l2: number; m1: number; m2: number; gravity: number; damping: number;
  // Sim/render state (optional; persisted for exact reproduction)
  speed?: number;          // time scale
  showTrail?: boolean;
  trailLength?: number;
  compareMode?: boolean;   // in-canvas overlay toggle
  compareOffset?: number;  // radians offset applied to theta1 of pendulum B
}
```

### Renderer (`DoublePendulumRenderer.svelte`)

- **Loop:** fixed-timestep accumulator. Each frame computes the real elapsed dt, **clamps it
  to a maximum (~50 ms) to survive tab inactivity**, scales by `speed`, then runs N fixed
  sub-steps (~5 ms each) so integration stability is independent of frame rate and speed.
- **Trail:** a capped buffer of bob-2 positions (≤ `trailLength`, default ~400), drawn with
  alpha fade (older = more transparent). Skipped entirely when `showTrail` is off.
- **Comparison overlay:** maintains a second `PendulumState` seeded with
  `theta1 + compareOffset`; integrates both each step; draws B's arms/bob and trail in a
  distinct color; exposes the live `divergence` value via a bindable prop the page renders as
  a readout (distance between the second bobs over time).
- **NaN/runaway guard:** after each step, if `!isFiniteState`, stop the loop, freeze, and
  surface a "simulation diverged — reset" warning instead of rendering garbage.
- **Control surface:** bindable `running` (play/pause). Editing initial-condition props or
  calling `reset()` / `randomize()` re-seeds live state and clears trails; physical-param
  prop changes apply live. The canvas is exposed for `SnapshotButton`.

### Page controls & layout (`double-pendulum/+page.svelte`)

Modeled on `ikeda/+page.svelte`: uses `ParameterPanel` / `ParameterSlider`,
`VisualizationAlerts`, `SaveConfigDialog`, `ShareDialog`, `SnapshotButton`, and reactive
URL-config loading. Controls are grouped so first-timers are not overwhelmed (PRD):

- **Basic (always visible):** θ1, θ2, gravity, speed, Play/Pause, Reset, Randomize, Trail
  toggle, Comparison toggle.
- **Advanced (collapsible):** ω1, ω2, L1, L2, m1, m2, damping, trail length, compare offset.

Defaults produce visibly chaotic motion within a few seconds; `damping` defaults to `0`.
Includes short educational copy explaining why the double pendulum is chaotic and what
sensitivity to initial conditions means, in plain language (via the existing info-panel
styling). Sci-fi aesthetic and `{base}`-prefixed routing throughout.

### Compare route (`double-pendulum/compare/+page.svelte`)

Side-by-side independent simulations using `ComparisonLayout` + `ComparisonParameterPanel`,
matching the convention of the other compare routes. Two full `DoublePendulumRenderer`
instances let users compare arbitrary parameter sets (e.g. different gravity or lengths).
This is distinct from the in-canvas tiny-offset overlay on the main page.

## Error handling

- `validateParameters('double-pendulum', …)`: lengths > 0, masses > 0, all values finite,
  `damping ≥ 0`, and sane numeric ranges.
- `checkParameterStability`: meaningful warnings only (e.g. extreme gravity, very high
  speed). **No** warning for zero damping — that is the intended chaotic default.
- Runtime: the renderer's `isFiniteState` guard freezes the loop and shows a reset prompt if
  the simulation diverges to NaN/Infinity under extreme parameters.

## Testing plan

**node (`*.test.ts`):**

- `double-pendulum.test.ts` — energy approximately conserved over a short integration at
  `damping = 0` (within tolerance), a pendulum at rest stays at rest, `randomize` outputs in
  range, `divergence ≥ 0` and `= 0` for identical states, `isFiniteState` guard behavior,
  RK4 step finiteness.
- Additions to `chaos-validation.test.ts`, `types.test.ts`, `type-guards.test.ts`,
  `constants.test.ts` for the new type.

**jsdom (`*.svelte.test.ts`):**

- `DoublePendulumRenderer.svelte.test.ts` — mounts with a canvas; play/pause toggles the
  loop; reset clears the trail; comparison toggle adds a second pendulum and exposes a
  divergence readout; NaN guard freezes gracefully. Uses fake timers / mocked rAF.
- A page-interactions test modeled on `ikeda-page-interactions` — controls update sim state;
  save/share dialogs; URL-config load.
- A compare-route test modeled on the existing compare tests.
- Homepage-card assertion in `page.svelte.test.ts`.

**e2e (`e2e/double-pendulum.spec.ts`):**

- Homepage card → `/double-pendulum` renders without errors → animates, pauses, resumes,
  resets, randomizes → trail toggle works → comparison mode shows two diverging pendulums →
  page remains usable at a mobile viewport size.

## Acceptance criteria (from PRD / issue)

- Double Pendulum card appears on the homepage and links to `/double-pendulum`.
- `/double-pendulum` renders without errors.
- Pendulum animates, pauses, resumes, resets, and randomizes correctly.
- Controls update the simulation state.
- Trail rendering works and can be toggled.
- Comparison mode shows two nearly identical pendulums diverging over time.
- Page remains usable across common desktop and mobile viewport sizes.
- Existing modules and homepage performance are not noticeably degraded.

## Non-goals (from PRD)

- Laboratory-grade physics accuracy.
- Multi-pendulum systems beyond two links.
- Server-side simulation.
- (Persistent saved simulations were a PRD non-goal, but full save-config integration was
  explicitly chosen for this implementation to stay consistent with every other module.)
