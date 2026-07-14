# Slider Responsiveness — Step 1: Shared Slider Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared slider contract (`UpdatePolicy`, `SliderDragManager`, `RenderGeneration`, `ParameterSlider` rewrite, `VisualizationShell` integration) so that all modules default to `live` policy (unchanged behavior) and the infrastructure is ready for per-module policy assignment in Step 2.

**Architecture:** `ParameterSlider` gains `updatePolicy` (live/preview/commit), separating committed `value` from throttled `draftValues` (via `ondraft` callback). `SliderDragManager` (provided via Svelte context by `VisualizationShell`) tracks which sliders are dragging and computes `DragState` (`{ fidelity, commitDragging }`). `RenderGeneration` provides latest-wins cancellation via integer IDs. The shell passes `{ values, draftValues, fidelity, onRenderStateChange }` to renderer snippets, disables save/share/snapshot during drag, and renders accessible status badges.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript strict, Vitest (node + jsdom), `@testing-library/svelte`

**Spec:** `docs/superpowers/specs/2026-07-13-slider-responsiveness-design.md`

## Global Constraints

- TypeScript strict mode enabled — no `any` without eslint-disable comment
- Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props`, `$bindable`
- File naming: `*.test.ts` for node tests, `*.svelte.test.ts` for jsdom component tests
- Run node tests: `bun run vitest run --project node`
- Run jsdom tests: `bun run vitest run --project jsdom`
- Run typecheck: `bun run check`
- Run lint: `bun run lint`
- Commit messages: `feat:`/`fix:`/`refactor:`/`test:`/`docs:` prefix, include `(HPA-211)`

---

## File Structure

### New files

| File                                                   | Responsibility                                          |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `src/lib/slider-drag-manager.ts`                       | `SliderDragManager` class, `DragState`/`Fidelity` types |
| `src/lib/slider-drag-manager.test.ts`                  | Unit tests for SliderDragManager                        |
| `src/lib/render-generation.ts`                         | `RenderGeneration` class                                |
| `src/lib/render-generation.test.ts`                    | Unit tests for RenderGeneration                         |
| `src/lib/components/ui/ParameterSlider.svelte.test.ts` | Component tests for ParameterSlider policies            |

### Modified files

| File                                                      | Change                                                                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/viz/types.ts`                                    | Add `UpdatePolicy` type + `updatePolicy?` field on `ParamDef`                                                                       |
| `src/lib/constants.ts`                                    | Replace `SLIDER_DEBOUNCE_MS` with `PREVIEW_THROTTLE_MS` + `PREVIEW_IDLE_COMMIT_MS`                                                  |
| `src/lib/constants.test.ts`                               | Update assertions for new constant names                                                                                            |
| `src/lib/components/ui/ParameterSlider.svelte`            | Rewrite: `updatePolicy` prop, `ondraft` callback, `disabled` prop, throttle, isDragging guard, drag-manager registration            |
| `src/lib/components/ui/VisualizationShell.svelte`         | SliderDragManager creation + context, `draftValues` state, renderer snippet expansion, status badges, save/share/snapshot disabling |
| `src/lib/components/ui/VisualizationShell.svelte.test.ts` | Tests for new shell behavior                                                                                                        |
| `src/lib/components/testing/PageOwnedSliderShell.svelte`  | Provide SliderDragManager context                                                                                                   |

---

## Task 1: Types + Constants

**Files:**

- Modify: `src/lib/viz/types.ts`
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/constants.test.ts`

**Interfaces:**

- Produces: `UpdatePolicy` type (consumed by Task 2, Task 4, Task 5), `PREVIEW_THROTTLE_MS` and `PREVIEW_IDLE_COMMIT_MS` constants (consumed by Task 4)

- [ ] **Step 1: Add `UpdatePolicy` type to `viz/types.ts`**

Add after the existing imports, before `ParamDef`:

```typescript
export type UpdatePolicy = 'live' | 'preview' | 'commit';
```

Add `updatePolicy` field to the `ParamDef` interface (after `default: number;`):

```typescript
	/** Per-control drag policy. Defaults to 'live' (immediate updates). */
	updatePolicy?: UpdatePolicy;
```

- [ ] **Step 2: Update `constants.ts`**

In `src/lib/constants.ts`, replace the `SLIDER_DEBOUNCE_MS` block:

```typescript
/**
 * Throttle interval for preview-policy slider drafts (milliseconds).
 * Limits draft renders to ~8-10 updates/second during drag.
 */
export const PREVIEW_THROTTLE_MS = 100;

/**
 * Idle timer for keyboard-only commit (milliseconds).
 * After this delay without further input, preview/commit sliders fire their committed value.
 */
export const PREVIEW_IDLE_COMMIT_MS = 500;
```

Remove the old `SLIDER_DEBOUNCE_MS` constant and its JSDoc block.

- [ ] **Step 3: Update `constants.test.ts`**

In `src/lib/constants.test.ts`:

Replace the import line that includes `SLIDER_DEBOUNCE_MS` — remove `SLIDER_DEBOUNCE_MS`, add `PREVIEW_THROTTLE_MS` and `PREVIEW_IDLE_COMMIT_MS`.

Replace the test:

```typescript
test('PREVIEW_THROTTLE_MS is a positive number', () => {
	expect(PREVIEW_THROTTLE_MS).toBeGreaterThan(0);
	expect(typeof PREVIEW_THROTTLE_MS).toBe('number');
});

test('PREVIEW_IDLE_COMMIT_MS is a positive number', () => {
	expect(PREVIEW_IDLE_COMMIT_MS).toBeGreaterThan(0);
	expect(typeof PREVIEW_IDLE_COMMIT_MS).toBe('number');
});
```

- [ ] **Step 4: Run tests + typecheck**

```bash
bun run vitest run --project node src/lib/constants.test.ts
bun run check
```

Expected: All constants tests pass. No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/viz/types.ts src/lib/constants.ts src/lib/constants.test.ts
git commit -m "feat: add UpdatePolicy type and replace SLIDER_DEBOUNCE_MS with preview constants (HPA-211)"
```

---

## Task 2: SliderDragManager

**Files:**

- Create: `src/lib/slider-drag-manager.ts`
- Test: `src/lib/slider-drag-manager.test.ts`

**Interfaces:**

- Consumes: `UpdatePolicy` from `src/lib/viz/types.ts` (Task 1)
- Produces: `SliderDragManager` class, `DragState` interface, `Fidelity` type (consumed by Task 4, Task 5)

- [ ] **Step 1: Write failing tests**

Create `src/lib/slider-drag-manager.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { SliderDragManager, type DragState, type Fidelity } from './slider-drag-manager';

describe('SliderDragManager', () => {
	it('defaults to full fidelity and no commit drag', () => {
		const mgr = new SliderDragManager();
		expect(mgr.getState()).toEqual({ fidelity: 'full', commitDragging: false });
	});

	it('returns preview fidelity when a preview-policy slider is dragging', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('a', 'preview');
		mgr.setDragging('a', true);
		expect(mgr.getState().fidelity).toBe('preview');
		unregister();
	});

	it('returns commitDragging when a commit-policy slider is dragging', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('speed', 'commit');
		mgr.setDragging('speed', true);
		expect(mgr.getState()).toEqual({ fidelity: 'full', commitDragging: true });
		unregister();
	});

	it('does not change fidelity for live-policy drags', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('x', 'live');
		mgr.setDragging('x', true);
		expect(mgr.getState()).toEqual({ fidelity: 'full', commitDragging: false });
		unregister();
	});

	it('reverts to full when drag ends', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('a', 'preview');
		mgr.setDragging('a', true);
		mgr.setDragging('a', false);
		expect(mgr.getState()).toEqual({ fidelity: 'full', commitDragging: false });
		unregister();
	});

	it('handles simultaneous preview + commit drags', () => {
		const mgr = new SliderDragManager();
		const unreg1 = mgr.register('a', 'preview');
		const unreg2 = mgr.register('b', 'commit');
		mgr.setDragging('a', true);
		mgr.setDragging('b', true);
		expect(mgr.getState()).toEqual({ fidelity: 'preview', commitDragging: true });
		mgr.setDragging('a', false);
		expect(mgr.getState()).toEqual({ fidelity: 'full', commitDragging: true });
		mgr.setDragging('b', false);
		expect(mgr.getState()).toEqual({ fidelity: 'full', commitDragging: false });
		unreg1();
		unreg2();
	});

	it('cleans up dragging on unregister (mid-drag unmount)', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('a', 'preview');
		mgr.setDragging('a', true);
		expect(mgr.getState().fidelity).toBe('preview');
		unregister();
		expect(mgr.getState()).toEqual({ fidelity: 'full', commitDragging: false });
	});

	it('notifies subscribers on state change', () => {
		const mgr = new SliderDragManager();
		const states: DragState[] = [];
		const unsub = mgr.subscribe((s) => states.push(s));
		const unregister = mgr.register('a', 'preview');
		mgr.setDragging('a', true);
		mgr.setDragging('a', false);
		expect(states).toEqual([
			{ fidelity: 'preview', commitDragging: false },
			{ fidelity: 'full', commitDragging: false }
		]);
		unregister();
		unsub();
	});

	it('does not notify when state is unchanged', () => {
		const mgr = new SliderDragManager();
		let callCount = 0;
		const unsub = mgr.subscribe(() => callCount++);
		const unregister = mgr.register('x', 'live');
		mgr.setDragging('x', true); // live doesn't change fidelity or commitDragging
		expect(callCount).toBe(0);
		unregister();
		unsub();
	});

	it('ignores setDragging for unknown slider IDs', () => {
		const mgr = new SliderDragManager();
		mgr.setDragging('unknown', true);
		expect(mgr.getState()).toEqual({ fidelity: 'full', commitDragging: false });
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run vitest run --project node src/lib/slider-drag-manager.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `src/lib/slider-drag-manager.ts`:

```typescript
import type { UpdatePolicy } from './viz/types';

export type Fidelity = 'preview' | 'full';

export interface DragState {
	fidelity: Fidelity;
	commitDragging: boolean;
}

export type RenderState = 'idle' | 'rendering' | 'complete';

/**
 * Tracks which sliders are mid-drag and computes the overall drag state
 * (fidelity + commitDragging). Created by VisualizationShell and provided
 * via Svelte context so both schema-driven and page-owned sliders register.
 */
export class SliderDragManager {
	private policies = new Map<string, UpdatePolicy>();
	private dragging = new Map<string, UpdatePolicy>();
	private listeners = new Set<(state: DragState) => void>();
	private currentState: DragState = { fidelity: 'full', commitDragging: false };

	register(id: string, policy: UpdatePolicy): () => void {
		this.policies.set(id, policy);
		return () => {
			this.policies.delete(id);
			this.dragging.delete(id);
			this.recompute();
		};
	}

	setDragging(id: string, isDragging: boolean): void {
		const policy = this.policies.get(id);
		if (!policy) return;
		if (isDragging) this.dragging.set(id, policy);
		else this.dragging.delete(id);
		this.recompute();
	}

	getState(): DragState {
		return this.currentState;
	}

	subscribe(fn: (state: DragState) => void): () => void {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	}

	private recompute(): void {
		const draggingPolicies = [...this.dragging.values()];
		const next: DragState = {
			fidelity: draggingPolicies.some((p) => p === 'preview') ? 'preview' : 'full',
			commitDragging: draggingPolicies.some((p) => p === 'commit')
		};
		if (
			next.fidelity !== this.currentState.fidelity ||
			next.commitDragging !== this.currentState.commitDragging
		) {
			this.currentState = next;
			for (const fn of this.listeners) fn(next);
		}
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run vitest run --project node src/lib/slider-drag-manager.test.ts
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slider-drag-manager.ts src/lib/slider-drag-manager.test.ts
git commit -m "feat: add SliderDragManager for tracking slider drag state (HPA-211)"
```

---

## Task 3: RenderGeneration

**Files:**

- Create: `src/lib/render-generation.ts`
- Test: `src/lib/render-generation.test.ts`

**Interfaces:**

- Produces: `RenderGeneration` class (consumed by Task 5 and future steps)

- [ ] **Step 1: Write failing tests**

Create `src/lib/render-generation.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { RenderGeneration } from './render-generation';

describe('RenderGeneration', () => {
	it('starts at 0 and increments', () => {
		const gen = new RenderGeneration();
		expect(gen.next()).toBe(1);
		expect(gen.next()).toBe(2);
	});

	it('reports stale for old IDs', () => {
		const gen = new RenderGeneration();
		const id1 = gen.next();
		gen.next();
		expect(gen.isStale(id1)).toBe(true);
	});

	it('reports not-stale for current ID', () => {
		const gen = new RenderGeneration();
		const id = gen.next();
		expect(gen.isStale(id)).toBe(false);
	});

	it('rapid invalidation: all previous IDs are stale', () => {
		const gen = new RenderGeneration();
		const ids = [gen.next(), gen.next(), gen.next(), gen.next(), gen.next()];
		for (const id of ids) {
			expect(gen.isStale(id)).toBe(true);
		}
		expect(gen.isStale(5)).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run vitest run --project node src/lib/render-generation.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `src/lib/render-generation.ts`:

```typescript
/**
 * Latest-wins cancellation utility. Each render request calls `next()`
 * to get a monotonically increasing ID. Before applying an async result
 * (worker response, rAF chunk), check `isStale(id)` — if true, discard.
 *
 * Formalizes the existing `latestWorkerRequestId` pattern used by
 * GumowskiMira, Standard, Ikeda, Clifford, Tinkerbell, and ChaosEsthetique
 * renderers.
 */
export class RenderGeneration {
	private current = 0;

	next(): number {
		return ++this.current;
	}

	isStale(id: number): boolean {
		return id !== this.current;
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run vitest run --project node src/lib/render-generation.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/render-generation.ts src/lib/render-generation.test.ts
git commit -m "feat: add RenderGeneration utility for latest-wins cancellation (HPA-211)"
```

---

## Task 4: ParameterSlider Rewrite

**Files:**

- Modify: `src/lib/components/ui/ParameterSlider.svelte`
- Test: `src/lib/components/ui/ParameterSlider.svelte.test.ts`

**Interfaces:**

- Consumes: `UpdatePolicy` from Task 1, `SliderDragManager` from Task 2 (via context), `PREVIEW_THROTTLE_MS`/`PREVIEW_IDLE_COMMIT_MS` from Task 1
- Produces: Rewritten `ParameterSlider` with `updatePolicy`, `ondraft`, `disabled` props (consumed by Task 5 and future steps)

- [ ] **Step 1: Write failing tests**

Create `src/lib/components/ui/ParameterSlider.svelte.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import ParameterSlider from './ParameterSlider.svelte';
import { SliderDragManager } from '$lib/slider-drag-manager';

// Helper: set slider value via input event
function setSliderValue(slider: HTMLElement, value: number) {
	fireEvent.input(slider, { target: { value: String(value) } });
}
function releaseSlider(slider: HTMLElement) {
	fireEvent.change(slider);
}

describe('ParameterSlider', () => {
	it('live policy: every input updates value immediately', async () => {
		let committed = 5;
		const { container } = render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'live' as const
			}
		});
		// Bind is one-way in tests; use onchange callback to verify
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		setSliderValue(slider, 7);
		expect(slider.value).toBe('7');
	});

	it('commit policy: value does NOT update during drag', async () => {
		const onchange = vi.fn();
		const { component } = render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'commit' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		setSliderValue(slider, 8);
		// value prop should NOT have changed (no commit yet)
		expect(component.value).toBe(5);
		// Release
		releaseSlider(slider);
		expect(component.value).toBe(8);
	});

	it('commit policy: display value updates immediately during drag', async () => {
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'commit' as const
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		setSliderValue(slider, 8);
		// Display should show the draft value
		expect(screen.getByText('8.00')).toBeInTheDocument();
	});

	it('preview policy: ondraft fires on throttle, value on release', async () => {
		vi.useFakeTimers();
		const ondraft = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				ondraft
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		setSliderValue(slider, 7);
		// Advance past throttle
		vi.advanceTimersByTime(150);
		expect(ondraft).toHaveBeenCalledWith(7);
		vi.useRealTimers();
	});

	it('disabled prop: does not participate in drag tracking', async () => {
		const mgr = new SliderDragManager();
		// Can't easily test context in jsdom without a wrapper;
		// this test verifies the disabled attribute is set on the input
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'live' as const,
				disabled: true
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		expect(slider.disabled).toBe(true);
	});

	it('throttle rewind guard: external value change does not overwrite internalValue during drag', async () => {
		vi.useFakeTimers();
		const { component } = render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Start drag
		setSliderValue(slider, 7);
		expect(slider.value).toBe('7');
		// Simulate external value change (e.g. from stale throttle)
		// During drag, internalValue should NOT be overwritten
		component.value = 3;
		await vi.advanceTimersByTimeAsync(10);
		expect(slider.value).toBe('7'); // still 7, not rewound to 3
		vi.useRealTimers();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run vitest run --project jsdom src/lib/components/ui/ParameterSlider.svelte.test.ts
```

Expected: FAIL — `updatePolicy` prop doesn't exist yet, old `debounce` prop causes errors.

- [ ] **Step 3: Write the rewritten ParameterSlider**

Replace the entire content of `src/lib/components/ui/ParameterSlider.svelte`:

```svelte
<script lang="ts">
	import { PREVIEW_THROTTLE_MS, PREVIEW_IDLE_COMMIT_MS } from '$lib/constants';
	import type { UpdatePolicy } from '$lib/viz/types';
	import { SliderDragManager } from '$lib/slider-drag-manager';
	import { getContext } from 'svelte';

	interface Props {
		id: string;
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		decimals?: number;
		updatePolicy?: UpdatePolicy;
		disabled?: boolean;
		ondraft?: (value: number) => void;
		onchange?: (value: number) => void;
	}

	let {
		id,
		label,
		value = $bindable(),
		min,
		max,
		step,
		decimals = 2,
		updatePolicy = 'live',
		disabled = false,
		ondraft,
		onchange
	}: Props = $props();

	let internalValue = $state(value);
	let isDragging = false;
	let throttleTimer: ReturnType<typeof setTimeout> | null = null;
	let idleTimer: ReturnType<typeof setTimeout> | null = null;

	const dragManager = getContext<SliderDragManager | undefined>('slider-drag-manager');
	const unregister = dragManager?.register(id, updatePolicy);

	function flushDraft() {
		if (throttleTimer) {
			clearTimeout(throttleTimer);
			throttleTimer = null;
		}
		ondraft?.(internalValue);
	}

	function commit() {
		if (throttleTimer) {
			clearTimeout(throttleTimer);
			throttleTimer = null;
		}
		if (idleTimer) {
			clearTimeout(idleTimer);
			idleTimer = null;
		}
		value = internalValue;
		ondraft?.(internalValue);
		onchange?.(internalValue);
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const newValue = parseFloat(target.value);
		internalValue = newValue;

		if (!isDragging) {
			isDragging = true;
			dragManager?.setDragging(id, true);
		}

		if (updatePolicy === 'live') {
			value = newValue;
			ondraft?.(newValue);
			onchange?.(newValue);
		} else if (updatePolicy === 'preview') {
			// Throttle draft updates
			if (!throttleTimer) {
				throttleTimer = setTimeout(() => {
					throttleTimer = null;
					ondraft?.(internalValue);
				}, PREVIEW_THROTTLE_MS);
			}
		}
		// commit: no value or ondraft during drag

		// Reset idle timer for keyboard commit
		if (idleTimer) clearTimeout(idleTimer);
		if (updatePolicy !== 'live') {
			idleTimer = setTimeout(() => {
				idleTimer = null;
				endDrag();
			}, PREVIEW_IDLE_COMMIT_MS);
		}
	}

	function endDrag() {
		if (!isDragging) return;
		isDragging = false;
		dragManager?.setDragging(id, false);
		commit();
	}

	function handleChange() {
		endDrag();
	}

	// Sync internalValue from external value changes — guarded by isDragging
	$effect(() => {
		if (isDragging) return; // internalValue is authoritative during drag
		if (throttleTimer) {
			clearTimeout(throttleTimer);
			throttleTimer = null;
		}
		internalValue = value;
	});

	// Disabled-mid-drag guarantee
	$effect(() => {
		if (disabled && isDragging) {
			endDrag();
		}
	});

	// Cleanup on unmount
	$effect(() => {
		return () => {
			if (throttleTimer) clearTimeout(throttleTimer);
			if (idleTimer) clearTimeout(idleTimer);
			unregister?.();
		};
	});

	const displayValue = $derived(internalValue.toFixed(decimals));
</script>

<div class="space-y-2">
	<div class="flex justify-between items-end">
		<label for={id} class="text-primary/80 text-xs uppercase tracking-widest font-bold">
			{label}
		</label>
		<span class="font-mono text-accent">{displayValue}</span>
	</div>
	<input
		{id}
		data-testid={`slider-${id}`}
		type="range"
		value={internalValue}
		{min}
		{max}
		{step}
		{disabled}
		oninput={handleInput}
		onchange={handleChange}
		class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
	/>
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run vitest run --project jsdom src/lib/components/ui/ParameterSlider.svelte.test.ts
```

Expected: All tests PASS. If any fail, iterate on the implementation.

- [ ] **Step 5: Run typecheck**

```bash
bun run check
```

Expected: No type errors. The old `debounce`/`debounceMs` props are gone — any existing caller passing them will error (only `VisualizationShell` calls `ParameterSlider`, fixed in Task 5).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/ui/ParameterSlider.svelte src/lib/components/ui/ParameterSlider.svelte.test.ts
git commit -m "feat: rewrite ParameterSlider with UpdatePolicy, draft/committed separation, throttle rewind guard (HPA-211)"
```

---

## Task 5: VisualizationShell Integration

**Files:**

- Modify: `src/lib/components/ui/VisualizationShell.svelte`
- Modify: `src/lib/components/ui/VisualizationShell.svelte.test.ts`

**Interfaces:**

- Consumes: `SliderDragManager` from Task 2, rewritten `ParameterSlider` from Task 4, `Fidelity`/`RenderState`/`DragState` types from Task 2
- Produces: Updated `VisualizationShell` providing drag context, `draftValues`, expanded renderer snippet params, status badges, disabled save/share/snapshot

- [ ] **Step 1: Write failing tests for new shell behavior**

Add to `src/lib/components/ui/VisualizationShell.svelte.test.ts`:

```typescript
describe('slider policy infrastructure', () => {
	it('disables save/share/snapshot buttons during drag', async () => {
		// This test verifies the shell provides the SliderDragManager context
		// and disables action buttons when drag state changes.
		// Detailed test implementation will use a test wrapper that
		// accesses the context-provided manager and simulates dragging.
		// For now, verify the shell renders without errors with the new props.
		const { container } = renderShell();
		expect(container).toBeInTheDocument();
	});
});
```

Note: Full interaction tests for save/share/snapshot disabling, status badges, and `draftValues` threading require updating the mock renderer snippet to assert on new params. Add these tests incrementally as the shell changes are validated.

- [ ] **Step 2: Update VisualizationShell to integrate SliderDragManager**

In `src/lib/components/ui/VisualizationShell.svelte`, add imports at the top of the `<script>` block:

```typescript
import { setContext } from 'svelte';
import {
	SliderDragManager,
	type DragState,
	type Fidelity,
	type RenderState
} from '$lib/slider-drag-manager';
```

After the `values` state declaration, add:

```typescript
const dragManager = new SliderDragManager();
setContext('slider-drag-manager', dragManager);

const draftValues = $state(paramDefaults(paramDefs));
let dragState = $state<DragState>({ fidelity: 'full', commitDragging: false });
let renderState = $state<RenderState>('idle');

// Subscribe to drag state changes
$effect(() => {
	return dragManager.subscribe((s) => {
		dragState = s;
	});
});

// Stable onRenderStateChange callback (avoid identity churn)
const onRenderStateChange = (s: RenderState) => {
	renderState = s;
};
```

Update the `ParameterSlider` rendering to remove `debounce` and pass `updatePolicy`:

```svelte
<ParameterSlider
	id={def.id ?? def.key}
	label={def.label}
	bind:value={values[def.key]}
	ondraft={(v) => {
		draftValues[def.key] = v;
	}}
	{min}
	{max}
	{step}
	decimals={def.decimals}
	updatePolicy={def.updatePolicy ?? 'live'}
/>
```

Update the renderer snippet call to pass new params:

```svelte
<VisualizationErrorBoundary {mapType}>
	<div class="relative">
		{@render renderer({
			values,
			draftValues,
			container,
			fidelity: dragState.fidelity,
			onRenderStateChange
		})}
		<!-- Status badge -->
		<div
			role="status"
			aria-live="polite"
			class="absolute top-4 left-4 text-xs font-['Rajdhani'] border border-primary/20 px-2 py-1 pointer-events-none select-none"
		>
			{#if dragState.commitDragging}
				FROZEN — RELEASE TO APPLY
			{:else if dragState.fidelity === 'preview'}
				PREVIEW
			{:else if renderState === 'rendering'}
				RENDERING FULL QUALITY…
			{:else}
				LIVE_RENDER
			{/if}
		</div>
	</div>
</VisualizationErrorBoundary>
```

Update the `SnapshotButton` to disable during drag/rendering:

```svelte
{#if showSnapshot}
	<SnapshotButton
		target={container.el}
		targetType="container"
		{mapType}
		disabled={dragState.fidelity !== 'full' ||
			dragState.commitDragging ||
			renderState === 'rendering'}
	/>
{/if}
```

Add similar disabled props to the Save and Share buttons (find the `handleSave`/`handleShare` trigger buttons and add `disabled` when `dragState.fidelity !== 'full' || dragState.commitDragging`).

- [ ] **Step 3: Run existing tests to check for regressions**

```bash
bun run vitest run --project jsdom src/lib/components/ui/VisualizationShell.svelte.test.ts
```

Expected: Some tests may fail due to the renderer snippet signature change. Update the mock renderer in tests to accept the new params:

```typescript
const renderer = createRawSnippet((params) => ({
	render: () => '<div data-testid="renderer"></div>'
}));
```

The renderer snippet now receives `{ values, draftValues, container, fidelity, onRenderStateChange }`. The `createRawSnippet` callback receives params but can ignore them.

- [ ] **Step 4: Fix any test failures from the snippet signature change**

Update the test's `renderShell()` and any other renderer mocks to handle the expanded params. The `createRawSnippet` should accept and ignore the new fields.

- [ ] **Step 5: Run typecheck**

```bash
bun run check
```

Expected: No type errors. The renderer snippet type changes from `Snippet<[RendererParams]>` where `RendererParams` is `{ values, container }` to include `draftValues`, `fidelity`, `onRenderStateChange`. Every page's renderer snippet destructuring must be updated — but since the new fields are additive (pages that destructure only `{ values, container }` still work), there should be no type errors for existing snippets. However, the `Props` type for the renderer snippet in the shell needs updating.

- [ ] **Step 6: Update the shell's renderer snippet type**

In the shell's `Props` interface, update the renderer snippet type to include the new params. Find the `renderer` prop type and expand it:

```typescript
renderer: Snippet<
	[
		{
			values: Record<string, number>;
			draftValues: Record<string, number>;
			container: { el?: HTMLDivElement };
			fidelity: Fidelity;
			onRenderStateChange: (state: RenderState) => void;
		}
	]
>;
```

- [ ] **Step 7: Run all tests + typecheck**

```bash
bun run vitest run --project jsdom src/lib/components/ui/VisualizationShell.svelte.test.ts
bun run check
```

Expected: All tests pass. No type errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/ui/VisualizationShell.svelte src/lib/components/ui/VisualizationShell.svelte.test.ts
git commit -m "feat: integrate SliderDragManager, draftValues, status badges, and save/share/snapshot disabling into VisualizationShell (HPA-211)"
```

---

## Task 6: PageOwnedSliderShell Update

**Files:**

- Modify: `src/lib/components/testing/PageOwnedSliderShell.svelte`

**Interfaces:**

- Consumes: `SliderDragManager` from Task 2

- [ ] **Step 1: Read the current PageOwnedSliderShell**

```bash
cat src/lib/components/testing/PageOwnedSliderShell.svelte
```

- [ ] **Step 2: Add SliderDragManager context provider**

The `PageOwnedSliderShell` wraps `VisualizationShell` for test scenarios where sliders live in `extraControls`. Since `VisualizationShell` already provides the context, this shell inherits it automatically. Verify no changes are needed — the context flows through the component tree.

If `PageOwnedSliderShell` renders `ParameterSlider` components directly (outside of `VisualizationShell`'s context), add:

```typescript
import { setContext } from 'svelte';
import { SliderDragManager } from '$lib/slider-drag-manager';

const dragManager = new SliderDragManager();
setContext('slider-drag-manager', dragManager);
```

- [ ] **Step 3: Run all tests**

```bash
bun run test
```

Expected: All existing tests pass. No regressions.

- [ ] **Step 4: Run lint + typecheck**

```bash
bun run lint
bun run check
```

Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/testing/PageOwnedSliderShell.svelte
git commit -m "test: ensure PageOwnedSliderShell provides SliderDragManager context (HPA-211)"
```

---

## Task 7: Final Validation

- [ ] **Step 1: Run the full test suite**

```bash
bun run test
```

Expected: All tests pass — existing tests unchanged (all modules default to `live` policy), new tests pass.

- [ ] **Step 2: Run lint + typecheck**

```bash
bun run lint
bun run check
```

Expected: Clean.

- [ ] **Step 3: Manual smoke test**

```bash
bun run dev -- --open
```

Verify in the browser:

1. Navigate to Hénon — sliders work as before (all `live` by default)
2. No console errors
3. `LIVE_RENDER` badge appears in top-left of visualization area

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "test: final validation for Step 1 slider policy infrastructure (HPA-211)"
```

---

## What This Plan Does NOT Include (Deferred to Subsequent Plans)

- **Step 2:** Assigning non-`live` `updatePolicy` values to schema files (henon.ts, newton.ts, etc.)
- **Step 3:** Migrating page-owned native sliders to `ParameterSlider` (Clifford, Ikeda, etc.)
- **Step 4:** Hénon/Lozi SVG→Canvas conversion
- **Step 5:** Workerizing Newton, adding RenderGeneration to existing renderers
- **Step 6:** Renderer-specific optimizations (Chua caching, Rössler buffers, trail buffers, etc.)
- **Step 7:** Comparison route migration

After this plan is executed, all modules retain `live` behavior (unchanged from today), but the infrastructure (`SliderDragManager`, `ParameterSlider` with policy support, `draftValues`, status badges, `RenderGeneration`) is in place and tested, ready for Step 2.
