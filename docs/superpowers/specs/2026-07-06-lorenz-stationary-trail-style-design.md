# Lorenz Stationary Trail Style — Design

**Date:** 2026-07-06
**Status:** Approved design, pending implementation plan
**Module:** `/lorenz` (main page + shared `LorenzRenderer`)

## Overview

Add a third trail style, **Stationary**, to the Lorenz attractor. Unlike the
existing Comet and Cumulative styles — which animate a `head` index across a
precomputed trajectory so the path is drawn over time — Stationary always
renders the complete attractor shape immediately, with no draw-on animation.
It is a persistent display mode for inspecting the final stationary shape while
still allowing orbit/zoom/rotation.

This gives users a way to view the full butterfly (or any parameter set's
attractor) as a static object without waiting for the animation to play out.

### Decisions locked during brainstorming

- **Behavior:** Persistent static display mode that always renders the full
  attractor (`head = trailLength`, `from = 0`), with no head animation. It
  coexists with the animated styles rather than replacing them.
- **Toggle location:** A third trail-style button "Stationary" in
  `TrailControls`, alongside Comet and Cumulative. One three-way choice for how
  the trail is rendered.
- **Mode-switch transition (reset-on-exit):**
  - Switching **to** Stationary snaps `head` to `trailLength` immediately so the
    full shape shows without waiting a frame.
  - Switching **out of** Stationary (to Comet or Cumulative) resets `head = 0`
    so the animated style replays from the start. The Reset button continues to
    work as the explicit manual reset.
- **Playback controls in Stationary mode:** the entire SIMULATION panel
  (Play/Pause, Step, Reset, Speed) is disabled (greyed out, not hidden) to
  clearly signal "no animation in this mode" without shifting layout.

## Non-goals

- No changes to the `/lorenz/compare` page. Compare mode already forces the full
  static attractor (`head = trailLength`, `from = 0`) and is unaffected; the new
  style only applies to the main page's interactive view.
- No changes to the ghost (perturbed) orbit — it renders the same full slice as
  the main trajectory.
- No new state variables on the page; `trailStyle` already exists and is
  persisted. No changes to URL params, save/load, or stability.
- No head scrubbing/timeline UI. Stationary is a static endpoint, not a scrubber.

## Background — current state (baseline)

`LorenzTrailStyle` is `'comet' | 'cumulative'` (`src/lib/types.ts:32`).
`trailStyle` is an optional field on `LorenzParameters`, defaulted to `'comet'`
by `withLorenzDefaults`, persisted in saved configs, and restored in
`onExtraParametersLoaded`.

In `LorenzRenderer.svelte`, `updateDraw()` decides the visible window's `from`
index from the style:

- `comet` → `from = max(0, h - COMET_WINDOW)` (rolling trailing window)
- `cumulative` (the `else` branch) → `from = 0` (full path up to `head`)

`advanceHead()` advances `head` toward `trailLength` each frame while playing.
Compare mode bypasses both: it forces `head = trailLength` and `from = 0`,
which is exactly the "stationary" behavior — but only in compare mode.

So **Stationary is essentially "compare-mode rendering for the main view"**,
plus disabling head advancement and the playback UI.

## Design

### Approach

**Approach A (chosen): add `'stationary'` as a third `LorenzTrailStyle` value.**
The renderer already branches on `trailStyle` in `updateDraw()` to decide
`from`. Stationary becomes a special case that also pins `head` and skips
advancement. Reuses the existing trail-style plumbing, persistence, and URL
params (already serialized). Fewest new concepts.

Rejected alternatives:

- **Separate `displayMode: 'animated' | 'stationary'` prop orthogonal to
  trailStyle** — cleaner separation of concerns but adds a new state variable,
  a new control section, and awkward interaction rules (what does stationary +
  comet mean?). Over-engineered for the need.
- **Playback "snap to end and hold" toggle** — conflates trail rendering with
  playback state; the toggle would live far from Comet/Cumulative, making the
  three-way relationship invisible. Poor discoverability.

### 1. Type & data model

`src/lib/types.ts`:

```ts
export type LorenzTrailStyle = 'comet' | 'cumulative' | 'stationary';
```

No other type changes. `trailStyle` is already optional on `LorenzParameters`
and already persisted in saved configs / URL params, so `'stationary'` is
automatically supported end-to-end. `withLorenzDefaults` already falls back to
`'comet'` when omitted, so legacy configs are unaffected.

### 2. Renderer behavior (`src/lib/components/visualizations/LorenzRenderer.svelte`)

Two logic changes plus one new effect, gated on
`resolved.trailStyle === 'stationary'`:

1. **`advanceHead()`** — when stationary, return early (no head advancement),
   regardless of `isPlaying` or `forceOneFrame`. Head stays pinned at
   `trailLength`.

2. **`updateDraw()`** — **no code change required.** Stationary is not
   `'comet'`, so it already falls into the existing `else` branch
   (`from = 0`). Combined with the head-snap below pinning
   `head = trailLength`, the existing slice logic naturally renders the full
   `[0, trailLength)` range. (The implementer should verify this fall-through
   rather than add a redundant branch; an explicit `if (stationary) from = 0`
   would be a no-op given the current structure.)

3. **`rebuild()` re-snap** — extend the existing head-clamp at the end of
   `rebuild()` so that, when stationary, `head` is forced to the (possibly new)
   `trailLength`:
   ```ts
   if (compareMode || r.trailStyle === 'stationary') head = r.trailLength;
   else if (head > r.trailLength) head = r.trailLength;
   ```
   This covers both the initial build and any later rebuild caused by a
   `trailLength` or math-param change while stationary — ensuring the full new
   shape is always shown (the old clamp only handled the *shrinking* case;
   growing `trailLength` while stationary would otherwise leave `head` at the
   old, smaller value).

4. **Head-snap on style change** — add an `$effect` tracking
   `resolved.trailStyle` that captures the previous style value:
   - On entry to Stationary: `head = resolved.trailLength` (immediate full
     shape, no one-frame wait; also covered by the rebuild re-snap above, but
     this effect handles the case where switching styles does not trigger a
     rebuild — `trailStyle` is not a rebuild dependency).
   - On exit from Stationary: `head = 0` (animated style replays from start).

   This effect must run on style transitions only. It reads
   `resolved.trailLength` only inside the entry branch, so no reactive
   dependency on `trailLength` is registered on a no-transition run.

   Note: `updateDraw()` already clamps `h = Math.min(head, total)`, and the
   rebuild path already does `if (head > r.trailLength) head = r.trailLength`,
   so a shrinking `trailLength` while stationary stays safe.

Ghost orbit renders identically (full `[0, trailLength)`) since it shares the
same `from`/`h` slicing in `setLineSlice`. Compare mode is unchanged (it
already forces full-static and ignores `trailStyle`).

### 3. UI controls

**`src/lib/components/visualizations/lorenz/TrailControls.svelte`** — add a
third button "Stationary" alongside Comet / Cumulative. Identical styling and
`aria-pressed` pattern; the three buttons wrap in the existing flex row.

**`src/lib/components/visualizations/lorenz/PlaybackControls.svelte`** — accept
a new optional `disabled?: boolean` prop (default `false`). When `true`:

- All three buttons (Play/Pause, Step, Reset) get the `disabled` attribute and a
  greyed, `cursor-not-allowed` style.
- The Speed `<input type="range">` gets `disabled`.

The page passes `disabled={trailStyle === 'stationary'}`. Disabling (rather
than hiding) keeps layout stable and clearly communicates the mode.

### 4. Page wiring (`src/routes/lorenz/+page.svelte`)

- Pass `disabled={trailStyle === 'stationary'}` to `<PlaybackControls>`.
- No new state variables. `trailStyle` already exists, is already restored in
  `onExtraParametersLoaded`, and is already included in `getParameters()`.
- The existing stability `$effect` already tracks the relevant params; trail
  style does not affect stability, so no change is needed.

### 5. Persistence / URL params / config

No work required. `trailStyle` is already part of `LorenzParameters`, already
saved/loaded by `SaveConfigDialog` and the save-config API, and already applied
via `onExtraParametersLoaded`. A saved "stationary" config restores correctly,
including the disabled-playback UX (derived from `trailStyle` on load).

### 6. Testing

- **`TrailControls.svelte.test.ts`** — add a case asserting the Stationary
  button renders, fires `onStyleChange('stationary')` on click, and shows
  `aria-pressed="true"` when `trailStyle === 'stationary'`.
- **`PlaybackControls.svelte.test.ts`** — add a case asserting every control
  (Play/Pause, Step, Reset buttons and the Speed slider) receives the `disabled`
  attribute when `disabled={true}`. (We test the attribute — the component's
  contract — not that handlers fail to fire: `fireEvent.click` uses
  `dispatchEvent`, which delivers events to listeners even on disabled buttons,
  so a "handler not called" assertion would be brittle.)
- **`defaults.test.ts`** — add a case confirming `'stationary'` round-trips
  through `withLorenzDefaults` (resolved value preserved when set; falls back
  to `'comet'` when omitted).
- **Renderer branching** — the renderer's Three.js/onMount logic is not
  unit-tested today (it requires a WebGL canvas), so the head-snap and
  `advanceHead`/`updateDraw` branching are accepted as a manual-verification
  gap, consistent with existing renderer coverage. The behavior is
  straightforward conditional branching on the newly-typed `trailStyle`.

## Affected files

- `src/lib/types.ts` — extend `LorenzTrailStyle` union.
- `src/lib/components/visualizations/LorenzRenderer.svelte` — `advanceHead`
  early-return, `rebuild()` head re-snap, new head-snap `$effect` (no
  `updateDraw` change needed).
- `src/lib/components/visualizations/lorenz/TrailControls.svelte` — third
  button.
- `src/lib/components/visualizations/lorenz/PlaybackControls.svelte` —
  `disabled` prop.
- `src/routes/lorenz/+page.svelte` — pass `disabled` to `PlaybackControls`.
- Tests: `TrailControls.svelte.test.ts`, `PlaybackControls.svelte.test.ts`,
  `src/lib/lorenz/defaults.test.ts`.

## Risks & mitigations

- **Reset-on-exit surprises users flipping styles.** Mitigation: Reset button
  remains the explicit manual reset; switching out of Stationary replaying from
  the start is predictable and documented in the button's behavior. Acceptable
  per the brainstorming decision.
- **`trailLength` change while stationary.** Mitigation: the `rebuild()` re-snap
  (section 2, point 3) forces `head` to the new `trailLength` on every rebuild
  while stationary, and `updateDraw` clamps the slice range, so growing or
  shrinking the trail while stationary re-renders the full new shape.
