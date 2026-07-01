# Chaos Module Refactor — Milestone 4 Follow-up Epic

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Open. Branch TBD (create from `refactor/chaos-module-scaffold` after it merges, or continue on a new branch `refactor/chaos-module-complex-pages`).

**Predecessor:** [`docs/superpowers/plans/2026-06-30-chaos-module-refactor.md`](./2026-06-30-chaos-module-refactor.md) — completed Milestones 1–3 + partial renderer layer (10/16 pages migrated).

## Goal

Migrate the 6 remaining chaos pages — `clifford`, `ikeda`, `gumowski-mira`, `chua`, `double-pendulum`, `lorenz` — onto `VisualizationShell`. These pages carry non-slider state (colorMode/renderMode selects, checkboxes, sub-controls, presets) that the shipped shell cannot restore from a loaded config. The first task re-introduces the `onExtraParametersLoaded` hook into the shell; only then do the page migrations follow.

## Why a separate epic

The shipped `VisualizationShell` (`src/lib/components/ui/VisualizationShell.svelte`) dropped the `onExtraParametersLoaded` mechanism that the original plan's Tasks 23–27 relied on. Its `useConfigLoader` callback only runs `applyLoadedValues(paramDefs, values, params)` — which clamps slider values — and returns the raw params for stability checking. There is no path for the page to receive those params and restore `colorMode`/`renderMode`/preset/sub-control state. Re-adding the hook is a shell-level change that must land and be tested in isolation before any complex page is migrated.

## Architecture

### Shell change: `onExtraParametersLoaded`

Add an optional prop to `VisualizationShell.svelte`:

```ts
interface Props {
	// ...existing props...
	/** Receives the raw loaded params AFTER slider clamping, so the page can
	 *  restore non-slider state (selects, checkboxes, presets, sub-controls).
	 *  Called once per successful config load. The params passed are the same
	 *  raw object returned by the loader (NOT the clamped slider values). */
	onExtraParametersLoaded?: (params: ChaosMapParameters) => void;
}
```

In the existing `$effect` that wires `useConfigLoader`, invoke the hook inside `onParametersLoaded` after `applyLoadedValues`:

```ts
onParametersLoaded: (params) => {
	applyLoadedValues(paramDefs, values, params as unknown as Record<string, unknown>);
	onExtraParametersLoaded?.(params);
	return params;
},
```

Rationale for calling inside `onParametersLoaded` (rather than as a separate `useConfigLoader` option): the loader already gates on abort/staleness and runs the stability check on the returned params. Reusing that path keeps a single load pipeline and avoids a second subscription. The hook receives the raw params (pre-clamp) so the page can read `colorMode`/`renderMode` exactly as saved; slider values are already clamped into `values` by `applyLoadedValues`.

### Page migration recipe (complex)

Same as the slider-only recipe (Milestone 3), plus:

1. Keep page-level `$state` for non-slider controls (selects, checkboxes, sub-components, preset state).
2. Render those controls inside the `extraControls` snippet — copy markup verbatim from the current page (exact `id`/`for`/`data-testid`/option values).
3. Fold non-slider state into `buildParameters` so it is persisted/saved.
4. Restore non-slider state in `onExtraParametersLoaded` (e.g. `if (p.colorMode) colorMode = p.colorMode`).
5. For preset-driven pages (clifford), keep the preset UI in `extraControls`; preset application still mutates the page `$state` which feeds `buildParameters`.

## Global Constraints

- Inherited from the predecessor plan (Svelte 5 runes, strict TS, preserve behavior, sci-fi aesthetic, test file naming, commit-per-task, conventional commits with required trailers).
- **Do not change `useConfigLoader`'s signature.** The hook is added at the shell layer only.
- **No behavior change on the 10 already-migrated pages.** They do not pass `onExtraParametersLoaded`; the prop is optional and a no-op when absent.
- Each page migration MUST keep the existing `*-page-interactions`, `*-config-loading`, and (where present) `*-compare-interactions` jsdom tests green without editing test expectations (adjust markup to match, not tests).

## File Structure

**Modify:**

- `src/lib/components/ui/VisualizationShell.svelte` — add `onExtraParametersLoaded` prop + invocation.
- `src/lib/components/ui/VisualizationShell.svelte.test.ts` — add test asserting the hook fires with raw loaded params and is a no-op when absent.
- `src/routes/<map>/+page.svelte` for the 6 pages — adopt shell with `extraControls` + `onExtraParametersLoaded`.

**Create:**

- `src/lib/viz/schemas/<map>.ts` (+ `*.test.ts`) for each of the 6 maps that lacks one.

**Delete (end of epic, Task 8):** none anticipated. `VisualizationContainer` is already gone.

---

## Task 1: Re-introduce `onExtraParametersLoaded` in `VisualizationShell`

**Files:**

- Modify: `src/lib/components/ui/VisualizationShell.svelte`
- Modify: `src/lib/components/ui/VisualizationShell.svelte.test.ts`

**Steps:**

- [ ] **Step 1:** Add the `onExtraParametersLoaded?: (params: ChaosMapParameters) => void` prop to `Props` and destructure it.
- [ ] **Step 2:** In the `useConfigLoader` `onParametersLoaded` callback, after `applyLoadedValues(...)`, call `onExtraParametersLoaded?.(params)`. Keep the `return params;` for stability checking unchanged.
- [ ] **Step 3:** Add jsdom tests:
  - `fires onExtraParametersLoaded with raw loaded params after slider clamping` — mount shell with a mock loader path (or drive via URL `?config=...` using the existing test harness pattern in `VisualizationShell.svelte.test.ts`), assert the callback receives the raw params object and that slider-bound `values` are clamped.
  - `does not throw when onExtraParametersLoaded is absent` — mount shell without the prop, trigger a load, assert no error.
- [ ] **Step 4:** `bun run vitest run src/lib/components/ui/VisualizationShell.svelte.test.ts && bun run check` — PASS.
- [ ] **Step 5:** Commit `feat(ui): re-introduce onExtraParametersLoaded hook in VisualizationShell`.

---

## Task 2: Migrate `clifford` (canonical complex example)

**Files:**

- Create: `src/lib/viz/schemas/clifford.ts` (+ test)
- Modify: `src/routes/clifford/+page.svelte`
- Tests: `clifford-page-interactions`, `clifford-config-loading` (+ `clifford-compare-interactions` if it imports the page).

**Schema sliders:** `a, b, c, d` (bounds `-3..3`, step `0.01`, decimals 2), `iterations` (`10000..250000`, step `10000`), `zoom` (`0.5..5`, step `0.1`, decimals 1), `pointSize` (`0.5..6`, step `0.1`, decimals 1), `opacity` (`0..1`, step `0.05`, decimals 2). Transcribe exact `id`/`data-testid`/decimals from the current page.

**Non-slider state (page `$state`):** `colorMode: CliffordColorMode` (default from `DEFAULT_CLIFFORD_PRESET_ID` preset). Plus preset UI state (`activePresetId` derived, `applyPreset`/`resetToDefault`/`randomizeParameters` functions).

**`extraControls` snippet:** the PRESETS block, the Randomize/Reset buttons, and the RENDER_CONTROLS block (colorMode `<select>`, and the zoom/pointSize/opacity sliders IF those are not folded into the schema — decide: zoom/pointSize/opacity ARE sliders, so they go in the schema; only colorMode `<select>` + preset buttons + randomize/reset stay in `extraControls`). Keep `class:opacity-40={colorMode === 'density'}` disabled-state styling on pointSize/opacity by reading `values.colorMode`-equivalent — note: the schema sliders won't have the conditional disabled binding, so either (a) keep pointSize/opacity as page-state sliders inside `extraControls` to preserve the disabled binding, or (b) extend `ParameterSlider` to accept a `disabled` snippet/prop. **Prefer (a)** to avoid touching `ParameterSlider` in this epic; document the choice in the commit body.

**`buildParameters`:** `{ type: 'clifford', a, b, c, d, iterations, colorMode, zoom, pointSize, opacity }`.

**`onExtraParametersLoaded`:** `if (p.colorMode) colorMode = p.colorMode;` (mirror current `applyParameters` null-coalescing).

- [ ] **Step 1:** Schema + test (defaults match current page preset).
- [ ] **Step 2:** Run schema test — PASS.
- [ ] **Step 3:** Rewrite page per recipe. Preserve exact slider `id`/`for`/`data-testid`, select option values/labels, preset button labels, and the `data-testid="active-preset"` element.
- [ ] **Step 4:** `bun run vitest run src/routes/clifford-page-interactions.svelte.test.ts src/routes/clifford-config-loading.svelte.test.ts && bun run check` — PASS. Adjust `extraControls` markup until tests pass.
- [ ] **Step 5:** Commit `refactor(clifford): adopt VisualizationShell with extraControls + onExtraParametersLoaded`.

---

## Tasks 3–6: Migrate the remaining complex pages

Apply the complex recipe, one commit each. For each: schema + test → page rewrite (with `extraControls` + `onExtraParametersLoaded`) → run the page's jsdom test suite + `check` (PASS) → commit.

- [ ] **Task 3 — `ikeda`.** Schema sliders: `u, x0, y0, iterations, burnIn, seeds, pointSize, opacity`. Extras: `renderMode`, `colorMode` (selects). `seeds`/`burnIn` are integers (decimals omitted). Build `{ type: 'ikeda', ...sliders, renderMode, colorMode }`. Restore both selects in `onExtraParametersLoaded`.
- [ ] **Task 4 — `gumowski-mira`.** Schema sliders: `mu, a, b, x0, y0, iterations, burnIn, seeds, pointSize, opacity`. Extras: `renderMode`, `colorMode`. Build `{ type: 'gumowski-mira', ... }`.
- [ ] **Task 5 — `chua`.** Schema sliders: `alpha, beta, gamma, a, b` only. Extras: `colorMode`, `poincarePlane` (selects) + 1 checkbox + session-only `dt`/`trailLength`. **Only `alpha/beta/gamma/a/b` are persisted** in `ChuaParameters`; keep `dt`/`trailLength`/checkbox/selects as page state passed to the renderer but NOT in `buildParameters` (matches current persistence). `onExtraParametersLoaded` restores the visual selects/checkbox from the loaded params if present (defensive: they may be absent on old saved configs).
- [ ] **Task 6 — `double-pendulum`.** Schema sliders: `theta1, theta2, omega1, omega2, l1, l2, m1, m2, gravity, damping, speed, trailLength, compareOffset` (13). No selects/checkboxes in the schema scan, but it has bespoke play/compare controls — render those via `extraControls` if present. Build the full `DoublePendulumParameters` per `types.ts`.

Each task: `bun run vitest run src/routes/<map>-page-interactions.svelte.test.ts src/routes/<map>-config-loading.svelte.test.ts && bun run check` (PASS; also run `<map>-compare-interactions` if it imports the page) → commit `refactor(<map>): adopt VisualizationShell with extraControls`.

---

## Task 7: Migrate `lorenz` (3D, 8 sub-control components)

**Files:**

- Create: `src/lib/viz/schemas/lorenz.ts` (+ test) — sliders `sigma, rho, beta` only.
- Modify: `src/routes/lorenz/+page.svelte`
- Tests: `lorenz-page-interactions`, `lorenz-config-loading`, `lorenz-compare-interactions`.

Lorenz uses the 8 sub-components under `src/lib/components/visualizations/lorenz/` (`ColorModeSelector`, `PlaybackControls`, `ViewControls`, `TrailControls`, `SolverControls`, `InitialStateControls`, `PresetSelector`, `ChaosIndicator`) and has many optional `LorenzParameters` fields. Put the three core sliders (`sigma/rho/beta`) in the schema; render ALL sub-components inside `extraControls`, keep their state as page `$state`, and fold everything into `buildParameters`/`onExtraParametersLoaded`. Keep `renderEngine="THREE_JS"`. Renderer snippet renders `<LorenzRenderer .../>` binding its container to `container.el`.

- [ ] **Step 1:** Schema (`sigma/rho/beta` with exact bounds/ids/decimals) + test.
- [ ] **Step 2:** Run schema test — PASS.
- [ ] **Step 3:** Rewrite the page: move all sub-controls into `extraControls`, build the full `LorenzParameters` (core + optional fields currently persisted) in `buildParameters`, restore them in `onExtraParametersLoaded`. Keep `renderEngine="THREE_JS"`.
- [ ] **Step 4:** `bun run vitest run src/routes/lorenz-page-interactions.svelte.test.ts src/routes/lorenz-config-loading.svelte.test.ts src/routes/lorenz-compare-interactions.svelte.test.ts && bun run check` — PASS.
- [ ] **Step 5:** Commit `refactor(lorenz): adopt VisualizationShell with sub-control extras`.

---

## Task 8: Cleanup & full verification (predecessor Milestone 5)

- [ ] **Step 1:** Confirm no orphaned shared components remain. Run the grep loop from the predecessor plan's Task 29, but drop `VisualizationContainer` (deleted) and keep `VisualizationHeader, ParameterSlider, ParameterPanel, VisualizationErrorBoundary, VisualizationShell`. Each must have ≥1 non-test consumer.
- [ ] **Step 2:** `bun run check && bun run lint && bun run test` — all green (node + jsdom projects).
- [ ] **Step 3:** `bun run test:e2e` — green locally. Confirm CI `.github/workflows/e2e.yml` and `build.yml` pass with stubbed env (NEON_AUTH_BASE_URL / DATABASE_URL placeholders already configured).
- [ ] **Step 4:** Commit `chore(chaos): milestone 4 cleanup + verification`.

---

## Open questions (resolve before starting Task 2)

1. **clifford disabled-slider binding:** pointSize/opacity sliders are `disabled={colorMode === 'density'}` in the current page. The schema-driven `ParameterSlider` has no `disabled` prop. Preferred resolution (documented above): keep those two sliders as page-state sliders inside `extraControls` to preserve the disabled binding, and exclude them from the schema. Confirm this is acceptable vs. extending `ParameterSlider`.
2. **Preset persistence:** clifford presets mutate page state which feeds `buildParameters`. Saved configs store the resolved parameter values, not the preset id. Confirm this matches current behavior (it does — `getParameters()` returns values, not preset id) and that no test asserts preset-id persistence.
