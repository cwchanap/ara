# Lorenz Stationary Trail Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Stationary" trail style to the Lorenz attractor that always renders the full attractor shape immediately (no draw-on animation), as a third button alongside Comet/Cumulative.

**Architecture:** Extend the existing `LorenzTrailStyle` union with `'stationary'`. The renderer pins `head = trailLength` and skips head advancement when stationary; a transition effect snaps head on style switches (reset-on-exit). `TrailControls` gets a third button; `PlaybackControls` gains a `disabled` prop the page drives from `trailStyle`. No new state, persistence, or URL-param work — `trailStyle` is already serialized end-to-end.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript (strict), Vitest (jsdom + node projects), Three.js, TailwindCSS v4.

**Spec:** `docs/superpowers/specs/2026-07-06-lorenz-stationary-trail-style-design.md`

## Global Constraints

- **Type system:** TypeScript strict mode is on. After any type change, `bun run check` (svelte-check) must pass.
- **Trail style union:** `LorenzTrailStyle = 'comet' | 'cumulative' | 'stationary'` (defined `src/lib/types.ts:32`). Default remains `'comet'` (`src/lib/lorenz/defaults.ts:46`).
- **Test runner routing:** `*.svelte.test.ts` → jsdom project; `*.test.ts` (pure logic) → node project. Run a single file with `bun run vitest run <path>` (vitest auto-routes to the correct project).
- **Code style:** No comments unless asked. Match existing sci-fi styling (neon cyan `#00f3ff`, UPPERCASE labels, Orbitron/Rajdhani). Follow the existing `styleBtn`/`btn` class patterns in the control components.
- **No new state variables on the page.** `trailStyle` already exists at `src/routes/lorenz/+page.svelte:38`, is restored in `onExtraParametersLoaded` (`:158`), and is included in `getParameters()` (`:135`).
- **Commit style:** Match repo (`feat(lorenz): ...`, `test: ...`, `refactor: ...`). One logical commit per task unless noted.

---

## File Structure

- `src/lib/types.ts` — extend `LorenzTrailStyle` union (1 line).
- `src/lib/lorenz/defaults.test.ts` — add stationary round-trip regression test.
- `src/lib/components/visualizations/lorenz/TrailControls.svelte` — add third "Stationary" button.
- `src/lib/components/visualizations/lorenz/TrailControls.svelte.test.ts` — add stationary button tests.
- `src/lib/components/visualizations/lorenz/PlaybackControls.svelte` — add `disabled` prop; apply to buttons + slider.
- `src/lib/components/visualizations/lorenz/PlaybackControls.svelte.test.ts` — add disabled-state tests.
- `src/routes/lorenz/+page.svelte` — pass `disabled={trailStyle === 'stationary'}` to `PlaybackControls`.
- `src/lib/components/visualizations/LorenzRenderer.svelte` — `advanceHead` early-return, `rebuild()` head re-snap, new head-snap `$effect`.

---

### Task 1: Extend `LorenzTrailStyle` type and add defaults round-trip test

**Files:**

- Modify: `src/lib/types.ts:32`
- Test: `src/lib/lorenz/defaults.test.ts`

**Interfaces:**

- Produces: `LorenzTrailStyle` now accepts `'stationary'`. All later tasks rely on this.

- [ ] **Step 1: Write the failing test**

Add this test to the existing `describe('withLorenzDefaults', ...)` block in `src/lib/lorenz/defaults.test.ts` (after the "preserves provided overrides" test):

```ts
test('round-trips the stationary trail style', () => {
	const resolved = withLorenzDefaults({
		type: 'lorenz',
		sigma: 10,
		rho: 28,
		beta: 8 / 3,
		trailStyle: 'stationary'
	});
	expect(resolved.trailStyle).toBe('stationary');
});
```

- [ ] **Step 2: Verify the type-check fails (red)**

The test assigns `'stationary'` to a `LorenzTrailStyle | undefined` field. Because the union does not yet include `'stationary'`, svelte-check errors.

Run: `bun run check`
Expected: FAIL with an error like `Type '"stationary"' is not assignable to type '"comet" | "cumulative" | undefined'` pointing at `defaults.test.ts`.

(Note: `bun run vitest run src/lib/lorenz/defaults.test.ts` may pass at runtime because esbuild strips types — the meaningful red signal here is the svelte-check failure.)

- [ ] **Step 3: Extend the type**

In `src/lib/types.ts`, change line 32 from:

```ts
export type LorenzTrailStyle = 'comet' | 'cumulative';
```

to:

```ts
export type LorenzTrailStyle = 'comet' | 'cumulative' | 'stationary';
```

- [ ] **Step 4: Verify type-check and tests pass (green)**

Run: `bun run check`
Expected: PASS (no errors).

Run: `bun run vitest run src/lib/lorenz/defaults.test.ts`
Expected: PASS (3 tests in the `withLorenzDefaults` suite).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/lorenz/defaults.test.ts
git commit -m "feat(lorenz): extend LorenzTrailStyle with 'stationary'"
```

---

### Task 2: Add "Stationary" button to TrailControls

**Files:**

- Modify: `src/lib/components/visualizations/lorenz/TrailControls.svelte`
- Test: `src/lib/components/visualizations/lorenz/TrailControls.svelte.test.ts`

**Interfaces:**

- Consumes: `LorenzTrailStyle` from `$lib/types` (now includes `'stationary'`).
- Produces: `TrailControls` emits `onStyleChange('stationary')`; the page already wires `onStyleChange` to `(st) => (trailStyle = st)`.

- [ ] **Step 1: Write the failing tests**

Add these two tests to the existing `describe('TrailControls', ...)` block in `src/lib/components/visualizations/lorenz/TrailControls.svelte.test.ts`:

```ts
it('calls onStyleChange when switching to stationary', async () => {
	const onStyleChange = vi.fn();
	const { getByText } = render(TrailControls, { props: { ...base, onStyleChange } });
	await fireEvent.click(getByText(/Stationary/i));
	expect(onStyleChange).toHaveBeenCalledWith('stationary');
});

it('marks the Stationary button as pressed when active', () => {
	const { getByText } = render(TrailControls, {
		props: { ...base, trailStyle: 'stationary' }
	});
	expect(getByText(/Stationary/i).getAttribute('aria-pressed')).toBe('true');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run src/lib/components/visualizations/lorenz/TrailControls.svelte.test.ts`
Expected: FAIL — "Stationary" text not found (Unable to find element with text /Stationary/i).

- [ ] **Step 3: Add the Stationary button**

In `src/lib/components/visualizations/lorenz/TrailControls.svelte`, the button row currently is (lines 35-52):

```svelte
<div class="flex gap-2">
	<button
		type="button"
		class={styleBtn(trailStyle === 'comet')}
		aria-pressed={trailStyle === 'comet'}
		onclick={() => onStyleChange('comet')}
	>
		Comet
	</button>
	<button
		type="button"
		class={styleBtn(trailStyle === 'cumulative')}
		aria-pressed={trailStyle === 'cumulative'}
		onclick={() => onStyleChange('cumulative')}
	>
		Cumulative
	</button>
</div>
```

Add a third button before the closing `</div>` (after the Cumulative button):

```svelte
<button
	type="button"
	class={styleBtn(trailStyle === 'stationary')}
	aria-pressed={trailStyle === 'stationary'}
	onclick={() => onStyleChange('stationary')}
>
	Stationary
</button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run src/lib/components/visualizations/lorenz/TrailControls.svelte.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/visualizations/lorenz/TrailControls.svelte src/lib/components/visualizations/lorenz/TrailControls.svelte.test.ts
git commit -m "feat(lorenz): add Stationary trail style button"
```

---

### Task 3: Add `disabled` prop to PlaybackControls

**Files:**

- Modify: `src/lib/components/visualizations/lorenz/PlaybackControls.svelte`
- Test: `src/lib/components/visualizations/lorenz/PlaybackControls.svelte.test.ts`

**Interfaces:**

- Produces: `PlaybackControls` accepts optional `disabled?: boolean` (default `false`). When `true`, all buttons and the speed slider are disabled (greyed). The page will pass `disabled={trailStyle === 'stationary'}` in Task 4.

- [ ] **Step 1: Write the failing test**

Add this test to the existing `describe('PlaybackControls', ...)` block in `src/lib/components/visualizations/lorenz/PlaybackControls.svelte.test.ts`:

```ts
it('disables all controls when disabled prop is true', () => {
	const { getByText, container } = render(PlaybackControls, {
		props: { ...base, disabled: true }
	});
	const pauseBtn = getByText('Pause').closest('button') as HTMLButtonElement;
	const stepBtn = getByText('Step').closest('button') as HTMLButtonElement;
	const resetBtn = getByText('Reset').closest('button') as HTMLButtonElement;
	const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
	expect(pauseBtn.disabled).toBe(true);
	expect(stepBtn.disabled).toBe(true);
	expect(resetBtn.disabled).toBe(true);
	expect(slider.disabled).toBe(true);
});
```

> Note: we test the `disabled` attribute (the component's actual contract), not
> that handlers fail to fire — `fireEvent.click` uses `dispatchEvent`, which
> delivers events to listeners even on disabled buttons (jsdom only suppresses
> user-gesture clicks, not programmatic dispatch), so a "handler not called"
> assertion would be brittle and incorrect.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run src/lib/components/visualizations/lorenz/PlaybackControls.svelte.test.ts`
Expected: FAIL — `pauseBtn.disabled` is `false` (expected `true`), and/or the `disabled` prop is not a known property.

- [ ] **Step 3: Add the `disabled` prop and apply it**

In `src/lib/components/visualizations/lorenz/PlaybackControls.svelte`, replace the `<script>` block (lines 2-14):

```svelte
<script lang="ts">
	interface Props {
		isPlaying: boolean;
		speed: number;
		onTogglePlay: () => void;
		onStep: () => void;
		onReset: () => void;
		onSpeedChange: (speed: number) => void;
	}
	let { isPlaying, speed, onTogglePlay, onStep, onReset, onSpeedChange }: Props = $props();
	const btn =
		'px-3 py-1 text-xs uppercase tracking-widest font-bold bg-primary/10 text-primary border border-primary/30 rounded-sm hover:bg-primary/20';
</script>
```

with:

```svelte
<script lang="ts">
	interface Props {
		isPlaying: boolean;
		speed: number;
		disabled?: boolean;
		onTogglePlay: () => void;
		onStep: () => void;
		onReset: () => void;
		onSpeedChange: (speed: number) => void;
	}
	let {
		isPlaying,
		speed,
		disabled = false,
		onTogglePlay,
		onStep,
		onReset,
		onSpeedChange
	}: Props = $props();
	const btn =
		'px-3 py-1 text-xs uppercase tracking-widest font-bold bg-primary/10 text-primary border border-primary/30 rounded-sm hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed';
</script>
```

Then replace the template body (lines 16-38) with this version that adds `disabled={disabled}` to every button and the slider:

```svelte
<div class="space-y-3">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">SIMULATION</span>
	<div class="flex items-center gap-2">
		<button type="button" class={btn} {disabled} onclick={onTogglePlay}
			>{isPlaying ? 'Pause' : 'Play'}</button
		>
		<button type="button" class={btn} {disabled} onclick={onStep}>Step</button>
		<button type="button" class={btn} {disabled} onclick={onReset}>Reset</button>
	</div>
	<label class="space-y-1 block">
		<div class="flex justify-between items-end">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">Speed</span>
			<span class="font-mono text-accent text-sm">{speed.toFixed(1)}x</span>
		</div>
		<input
			type="range"
			min="0.1"
			max="5"
			step="0.1"
			value={speed}
			{disabled}
			oninput={(e) => onSpeedChange(Number(e.currentTarget.value))}
			class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
		/>
	</label>
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run src/lib/components/visualizations/lorenz/PlaybackControls.svelte.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/visualizations/lorenz/PlaybackControls.svelte src/lib/components/visualizations/lorenz/PlaybackControls.svelte.test.ts
git commit -m "feat(lorenz): add disabled prop to PlaybackControls"
```

---

### Task 4: Wire `disabled` from the page

**Files:**

- Modify: `src/routes/lorenz/+page.svelte:291-298`

**Interfaces:**

- Consumes: `PlaybackControls` `disabled` prop (Task 3); `trailStyle` page state.

- [ ] **Step 1: Pass the disabled prop**

In `src/routes/lorenz/+page.svelte`, the `PlaybackControls` usage (around lines 291-298) is:

```svelte
<PlaybackControls
	{isPlaying}
	{speed}
	onTogglePlay={() => (isPlaying = !isPlaying)}
	onStep={() => (stepNonce += 1)}
	onReset={() => (resetNonce += 1)}
	onSpeedChange={(s) => (speed = s)}
/>
```

Replace with:

```svelte
<PlaybackControls
	{isPlaying}
	{speed}
	disabled={trailStyle === 'stationary'}
	onTogglePlay={() => (isPlaying = !isPlaying)}
	onStep={() => (stepNonce += 1)}
	onReset={() => (resetNonce += 1)}
	onSpeedChange={(s) => (speed = s)}
/>
```

- [ ] **Step 2: Verify type-check and lint pass**

Run: `bun run check`
Expected: PASS.

Run: `bun run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/lorenz/+page.svelte
git commit -m "feat(lorenz): disable playback controls in stationary mode"
```

---

### Task 5: Renderer — pin head and snap on style transitions

**Files:**

- Modify: `src/lib/components/visualizations/LorenzRenderer.svelte`

**Interfaces:**

- Consumes: `resolved.trailStyle === 'stationary'` (Task 1 type), `resolved.trailLength`.
- Produces: when stationary, `head` is pinned to `trailLength` and the full `[0, trailLength)` slice renders; switching styles snaps head per the reset-on-exit rule.

**Testing note:** The renderer's Three.js `onMount` logic requires a WebGL canvas and is not unit-tested today. This task is verified by `bun run check` (type/compile), `bun run lint`, and the manual browser checklist in Task 6. The changes are small, conditional branches.

- [ ] **Step 1: Early-return in `advanceHead` when stationary**

In `src/lib/components/visualizations/LorenzRenderer.svelte`, the `advanceHead` function (lines 124-130) is:

```ts
function advanceHead(forceOneFrame = false): void {
	const total = resolved.trailLength;
	const perFrame = Math.max(1, Math.round(resolved.stepsPerFrame * resolved.speed));
	if (forceOneFrame || isPlaying) {
		head = Math.min(total, head + perFrame);
	}
}
```

Replace with:

```ts
function advanceHead(forceOneFrame = false): void {
	if (resolved.trailStyle === 'stationary') return;
	const total = resolved.trailLength;
	const perFrame = Math.max(1, Math.round(resolved.stepsPerFrame * resolved.speed));
	if (forceOneFrame || isPlaying) {
		head = Math.min(total, head + perFrame);
	}
}
```

- [ ] **Step 2: Re-snap head in `rebuild` when stationary**

In the same file, inside `rebuild = () => { ... }`, the head-clamp (around lines 250-252) is:

```ts
// In compare mode show the full static attractor.
if (compareMode) head = r.trailLength;
else if (head > r.trailLength) head = r.trailLength;
```

Replace with:

```ts
// In compare mode or stationary trail style, show the full static attractor.
// Re-snapping here also covers trailLength changes while stationary (the
// plain clamp only handled the shrinking case).
if (compareMode || r.trailStyle === 'stationary') head = r.trailLength;
else if (head > r.trailLength) head = r.trailLength;
```

- [ ] **Step 3: Add the style-transition head-snap effect**

In the same file, immediately after the stepNonce `$effect` block (which ends around line 122 with the closing `});` of the `stepNonce` effect), add this new effect:

```ts
// Snap head on trail-style transitions: entering Stationary jumps to the
// full shape; leaving Stationary resets to 0 so the animated style replays.
// Reads resolved.trailLength only inside the entry branch, so no reactive
// dependency on trailLength is registered on a no-transition run.
let lastTrailStyle = resolved.trailStyle;
$effect(() => {
	const style = resolved.trailStyle;
	if (style === lastTrailStyle) return;
	if (style === 'stationary') head = resolved.trailLength;
	else if (lastTrailStyle === 'stationary') head = 0;
	lastTrailStyle = style;
});
```

Placement: this is a top-level `$effect` in the component `<script>`, not nested inside `onMount`. Place it right after the existing stepNonce effect (the one containing `advanceHead(true)`), before `function advanceHead`. The `let lastTrailStyle = resolved.trailStyle;` initializer runs once at component init (initial mount relies on `rebuild` to set head, so no snap is needed on first run).

- [ ] **Step 4: Verify type-check and lint pass**

Run: `bun run check`
Expected: PASS.

Run: `bun run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/visualizations/LorenzRenderer.svelte
git commit -m "feat(lorenz): pin head and snap on stationary style transitions"
```

---

### Task 6: Full verification

**Files:** None (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `bun run test`
Expected: PASS — all node + jsdom project tests green, including the new tests from Tasks 1-3.

- [ ] **Step 2: Run type-check and lint**

Run: `bun run check`
Expected: PASS.

Run: `bun run lint`
Expected: PASS.

- [ ] **Step 3: Manual browser verification**

Run: `bun run dev -- --open` and navigate to `http://localhost:5173/lorenz`.

Verify each of these:

1. **Stationary shows full shape instantly.** Click "Stationary" in the TRAIL controls. The complete butterfly attractor appears immediately (no draw-on animation).
2. **Playback controls grey out.** While Stationary is active, the SIMULATION panel buttons (Pause/Step/Reset) and the Speed slider are visibly disabled (greyed, cursor-not-allowed) and do not respond to clicks/drags.
3. **Reset-on-exit replays animation.** From Stationary, click "Comet". The animation restarts from the beginning (head=0) and plays forward. Repeat with "Cumulative" — same replay-from-start behavior.
4. **Reset-on-entry snaps to full.** From Comet (mid-animation), click "Stationary". Head jumps to the end immediately; full shape shown.
5. **trailLength change while stationary re-renders full shape.** While Stationary, drag the TRAIL_LENGTH slider to a higher value (e.g. 50000). The shape becomes denser and remains fully drawn (not truncated at the old length). Drag it lower — shape shrinks correctly.
6. **Orbit/zoom/rotate work in Stationary.** While Stationary, drag to orbit, use the zoom control, toggle auto-rotate. The static shape responds normally.
7. **Ghost orbit shows full.** Enable "Show ghost" in Initial State controls while Stationary. Both main and ghost orbits render the full shape.
8. **Parameter changes re-render.** While Stationary, drag σ/ρ/β. The full new attractor shape recomputes and displays statically.
9. **Persistence round-trips.** With Stationary active, save the config (if authenticated), reload the page, and load the saved config. Stationary mode restores and playback controls are disabled.
10. **Compare page unaffected.** Navigate to `/lorenz/compare`. It still renders the full static attractor as before; the Stationary button is not present there (compare uses its own controls).

- [ ] **Step 4: Commit any cleanup (only if needed)**

If lint/format adjusted any files in Steps 1-2, stage and commit them:

```bash
git add -A
git commit -m "style: format lorenz stationary trail style files"
```

Otherwise, no commit — Task 5 was the final code change.
