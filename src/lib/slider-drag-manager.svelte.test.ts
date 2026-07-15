import { describe, expect, it } from 'vitest';
import { SliderDragManager } from '$lib/slider-drag-manager.svelte';

describe('SliderDragManager', () => {
	it('defaults to full fidelity and no commit drag', () => {
		const mgr = new SliderDragManager();
		expect(mgr.currentState).toEqual({
			fidelity: 'full',
			commitDragging: false,
			anyDragging: false
		});
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
		expect(mgr.currentState).toEqual({
			fidelity: 'full',
			commitDragging: true,
			anyDragging: true
		});
		unregister();
	});

	it('does not change fidelity for live-policy drags', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('x', 'live');
		mgr.setDragging('x', true);
		// Fidelity stays 'full' and commitDragging stays false for live drags,
		// but anyDragging is true because the slider IS being dragged.
		expect(mgr.currentState).toEqual({
			fidelity: 'full',
			commitDragging: false,
			anyDragging: true
		});
		unregister();
	});

	it('live drag sets anyDragging true then false (anyDragging is the only field that changes)', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('x', 'live');
		// Start drag: anyDragging goes false -> true, fidelity and
		// commitDragging are unchanged — the guard now includes anyDragging
		// so the $state write is NOT skipped.
		mgr.setDragging('x', true);
		expect(mgr.currentState).toEqual({
			fidelity: 'full',
			commitDragging: false,
			anyDragging: true
		});
		// End drag: anyDragging goes true -> false.
		mgr.setDragging('x', false);
		expect(mgr.currentState).toEqual({
			fidelity: 'full',
			commitDragging: false,
			anyDragging: false
		});
		unregister();
	});

	it('does not reassign currentState when no drag state field changes', () => {
		// After a live drag ends (anyDragging back to false), a redundant
		// setDragging(false) call must NOT reassign the $state object — the
		// guard skips the write when all three fields are unchanged.
		const mgr = new SliderDragManager();
		const unregister = mgr.register('x', 'live');
		mgr.setDragging('x', true);
		mgr.setDragging('x', false);
		const before = mgr.currentState;
		// A second setDragging(false) on an already-not-dragging slider is a
		// no-op in the dragging map (delete on a missing key), but recompute
		// still runs. The guard must skip the write because anyDragging,
		// fidelity, and commitDragging are all unchanged.
		mgr.setDragging('x', false);
		expect(mgr.currentState).toBe(before);
		unregister();
	});

	it('reverts to full when drag ends', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('a', 'preview');
		mgr.setDragging('a', true);
		mgr.setDragging('a', false);
		expect(mgr.currentState).toEqual({
			fidelity: 'full',
			commitDragging: false,
			anyDragging: false
		});
		unregister();
	});

	it('handles simultaneous preview + commit drags', () => {
		const mgr = new SliderDragManager();
		const unreg1 = mgr.register('a', 'preview');
		const unreg2 = mgr.register('b', 'commit');
		mgr.setDragging('a', true);
		mgr.setDragging('b', true);
		expect(mgr.currentState).toEqual({
			fidelity: 'preview',
			commitDragging: true,
			anyDragging: true
		});
		mgr.setDragging('a', false);
		expect(mgr.currentState).toEqual({
			fidelity: 'full',
			commitDragging: true,
			anyDragging: true
		});
		mgr.setDragging('b', false);
		expect(mgr.currentState).toEqual({
			fidelity: 'full',
			commitDragging: false,
			anyDragging: false
		});
		unreg1();
		unreg2();
	});

	it('cleans up dragging on unregister (mid-drag unmount)', () => {
		const mgr = new SliderDragManager();
		const unregister = mgr.register('a', 'preview');
		mgr.setDragging('a', true);
		expect(mgr.currentState.fidelity).toBe('preview');
		unregister();
		expect(mgr.currentState).toEqual({
			fidelity: 'full',
			commitDragging: false,
			anyDragging: false
		});
	});

	it('ignores setDragging for unknown slider IDs', () => {
		const mgr = new SliderDragManager();
		mgr.setDragging('unknown', true);
		expect(mgr.currentState).toEqual({
			fidelity: 'full',
			commitDragging: false,
			anyDragging: false
		});
	});

	it('cancelSignal starts at 0 and increments on each cancelActiveDrags', () => {
		const mgr = new SliderDragManager();
		expect(mgr.cancelSignal).toBe(0);
		mgr.cancelActiveDrags();
		expect(mgr.cancelSignal).toBe(1);
		mgr.cancelActiveDrags();
		expect(mgr.cancelSignal).toBe(2);
	});

	it('cancelActiveDrags does not alter the drag state', () => {
		// The cancel signal is a separate reactive counter; cancelling must
		// not flip fidelity/commitDragging/anyDragging (a slider with no
		// active drag treats the signal as a no-op).
		const mgr = new SliderDragManager();
		const before = { ...mgr.currentState };
		mgr.cancelActiveDrags();
		expect(mgr.currentState).toEqual(before);
	});
});
