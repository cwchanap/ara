import type { UpdatePolicy } from '$lib/viz/types';
import { SvelteMap } from 'svelte/reactivity';

export type Fidelity = 'preview' | 'full';

export interface DragState {
	readonly fidelity: Fidelity;
	readonly commitDragging: boolean;
	readonly anyDragging: boolean;
}

export type RenderState = 'idle' | 'rendering' | 'complete';

/**
 * Tracks which sliders are mid-drag and computes the overall drag state
 * (fidelity + commitDragging). Created by VisualizationShell and provided
 * via Svelte context so both schema-driven and page-owned sliders register.
 *
 * `currentState` is exposed as a read-only getter over a private `$state`
 * field, so components that read it via `$derived` or in `$effect` react
 * automatically — no manual subscribe/listener wiring needed. The getter
 * prevents external callers from writing to the state and breaking the
 * invariant that only recompute() mutates it.
 */
export class SliderDragManager {
	private policies = new SvelteMap<string, UpdatePolicy>();
	private dragging = new SvelteMap<string, UpdatePolicy>();
	private _state = $state<DragState>({
		fidelity: 'full',
		commitDragging: false,
		anyDragging: false
	});

	// Monotonically increasing counter incremented by cancelActiveDrags.
	// Each ParameterSlider reads it in a $effect so a config-load cancel
	// propagates reactively without the manager needing per-slider
	// callbacks. Sliders compare it against their last-seen value and
	// discard an in-progress draft only when it actually changes — so a
	// drag starting (isDragging false→true) does NOT spuriously cancel.
	private _cancelSignal = $state(0);

	get currentState(): Readonly<DragState> {
		return this._state;
	}

	get cancelSignal(): number {
		return this._cancelSignal;
	}

	/**
	 * Signal every registered slider to discard any in-progress drag.
	 * Called by VisualizationShell when an external committed value
	 * (config load via `?config`, `configId`, or `share`) replaces the
	 * bound `values` — so a stale draft does not overwrite the newly
	 * loaded configuration when the pointer is released. Sliders that
	 * are not mid-drag treat the signal as a no-op (cancelDrag returns
	 * early when isDragging is false).
	 */
	cancelActiveDrags(): void {
		this._cancelSignal++;
	}

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

	private recompute(): void {
		const draggingPolicies = [...this.dragging.values()];
		const next: DragState = {
			fidelity: draggingPolicies.some((p) => p === 'preview') ? 'preview' : 'full',
			commitDragging: draggingPolicies.some((p) => p === 'commit'),
			anyDragging: draggingPolicies.length > 0
		};
		// Skip the $state write when nothing changed. Without this guard,
		// recompute() allocates a new object on every call, triggering
		// unnecessary $derived recomputations in the shell. The guard was
		// present in the original subscribe-based design and is still needed
		// under runes. Note: anyDragging changes when a live-policy slider
		// starts/ends a drag (fidelity and commitDragging are unchanged for
		// live drags), so the guard now includes anyDragging to ensure the
		// shell's action-button gating reacts to live drags.
		if (
			next.fidelity !== this._state.fidelity ||
			next.commitDragging !== this._state.commitDragging ||
			next.anyDragging !== this._state.anyDragging
		) {
			this._state = next;
		}
	}
}
