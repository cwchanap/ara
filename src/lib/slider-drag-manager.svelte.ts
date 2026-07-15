import type { UpdatePolicy } from './viz/types';
import { SvelteMap } from 'svelte/reactivity';

export type Fidelity = 'preview' | 'full';

export interface DragState {
	fidelity: Fidelity;
	commitDragging: boolean;
	anyDragging: boolean;
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

	get currentState(): DragState {
		return this._state;
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
