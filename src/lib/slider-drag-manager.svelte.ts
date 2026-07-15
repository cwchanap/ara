import type { UpdatePolicy } from './viz/types';
import { SvelteMap } from 'svelte/reactivity';

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
 *
 * `currentState` is a Svelte 5 `$state` field, so components that read it
 * via `$derived` or in `$effect` react automatically — no manual
 * subscribe/listener wiring needed.
 */
export class SliderDragManager {
	private policies = new SvelteMap<string, UpdatePolicy>();
	private dragging = new SvelteMap<string, UpdatePolicy>();
	currentState = $state<DragState>({ fidelity: 'full', commitDragging: false });

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

	private recompute(): void {
		const draggingPolicies = [...this.dragging.values()];
		this.currentState = {
			fidelity: draggingPolicies.some((p) => p === 'preview') ? 'preview' : 'full',
			commitDragging: draggingPolicies.some((p) => p === 'commit')
		};
	}
}
