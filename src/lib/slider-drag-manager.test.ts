import { describe, expect, it } from 'vitest';
import { SliderDragManager, type DragState } from './slider-drag-manager';

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
