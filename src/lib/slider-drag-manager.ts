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
