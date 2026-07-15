import { describe, expect, it } from 'vitest';
import { SliderDragManager } from './slider-drag-manager.svelte';

describe('SliderDragManager', () => {
	it('defaults to full fidelity and no commit drag', () => {
		const mgr = new SliderDragManager();
		expect(mgr.currentState).toEqual({ fidelity: 'full', commitDragging: false });
	});

	it('returns preview fidelity when a preview-policy slider is dragging', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('a', 'preview');
		mgr.setDragging('a', true);
		expect(mgr.currentState.fidelity).toBe('preview');
		unregister();
	});

	it('returns commitDragging when a commit-policy slider is dragging', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('speed', 'commit');
		mgr.setDragging('speed', true);
		expect(mgr.currentState).toEqual({ fidelity: 'full', commitDragging: true });
		unregister();
	});

	it('does not change fidelity for live-policy drags', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('x', 'live');
		mgr.setDragging('x', true);
		expect(mgr.currentState).toEqual({ fidelity: 'full', commitDragging: false });
		unregister();
	});

	it('live drag does not reassign currentState (guard prevents spurious $state write)', () => {
		const mgr = new SliderDragManager();
		const before = mgr.currentState;
		const unregister = mgr.register('x', 'live');
		mgr.setDragging('x', true);
		mgr.setDragging('x', false);
		// Same reference — recompute() guard skipped the $state write because
		// fidelity and commitDragging were unchanged. This replaces the plan's
		// subscribe-based "does not notify when state is unchanged" test.
		expect(mgr.currentState).toBe(before);
		unregister();
	});

	it('reverts to full when drag ends', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('a', 'preview');
		mgr.setDragging('a', true);
		mgr.setDragging('a', false);
		expect(mgr.currentState).toEqual({ fidelity: 'full', commitDragging: false });
		unregister();
	});

	it('handles simultaneous preview + commit drags', () => {
		const mgr = new SliderDragManager();
		const unreg1 = mgr.register('a', 'preview');
		const unreg2 = mgr.register('b', 'commit');
		mgr.setDragging('a', true);
		mgr.setDragging('b', true);
		expect(mgr.currentState).toEqual({ fidelity: 'preview', commitDragging: true });
		mgr.setDragging('a', false);
		expect(mgr.currentState).toEqual({ fidelity: 'full', commitDragging: true });
		mgr.setDragging('b', false);
		expect(mgr.currentState).toEqual({ fidelity: 'full', commitDragging: false });
		unreg1();
		unreg2();
	});

	it('cleans up dragging on unregister (mid-drag unmount)', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('a', 'preview');
		mgr.setDragging('a', true);
		expect(mgr.currentState.fidelity).toBe('preview');
		unregister();
		expect(mgr.currentState).toEqual({ fidelity: 'full', commitDragging: false });
	});

	it('ignores setDragging for unknown slider IDs', () => {
		const mgr = new SliderDragManager();
		mgr.setDragging('unknown', true);
		expect(mgr.currentState).toEqual({ fidelity: 'full', commitDragging: false });
	});
});
