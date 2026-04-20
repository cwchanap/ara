import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cameraSyncStore, createCameraState, applyCameraState } from './camera-sync';
import type { CameraState } from './camera-sync';

function makeCameraState(x = 0, y = 0, z = 0): CameraState {
	return { position: { x, y, z }, target: { x: 0, y: 0, z: 0 } };
}

function getStoreState() {
	let state!: {
		enabled: boolean;
		left: CameraState | null;
		right: CameraState | null;
		lastUpdate: 'left' | 'right' | null;
		syncing: boolean;
	};
	const unsub = cameraSyncStore.subscribe((s) => {
		state = s;
	});
	unsub();
	return state;
}

describe('cameraSyncStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		cameraSyncStore.reset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('initial state', () => {
		it('starts enabled with no camera states and not syncing', () => {
			const state = getStoreState();
			expect(state.enabled).toBe(true);
			expect(state.left).toBeNull();
			expect(state.right).toBeNull();
			expect(state.lastUpdate).toBeNull();
			expect(state.syncing).toBe(false);
		});
	});

	describe('setEnabled', () => {
		it('setEnabled(false) disables sync', () => {
			cameraSyncStore.setEnabled(false);
			expect(getStoreState().enabled).toBe(false);
		});

		it('setEnabled(true) re-enables sync', () => {
			cameraSyncStore.setEnabled(false);
			cameraSyncStore.setEnabled(true);
			expect(getStoreState().enabled).toBe(true);
		});
	});

	describe('toggle', () => {
		it('flips enabled from true to false', () => {
			cameraSyncStore.toggle();
			expect(getStoreState().enabled).toBe(false);
		});

		it('flips enabled from false to true', () => {
			cameraSyncStore.toggle();
			cameraSyncStore.toggle();
			expect(getStoreState().enabled).toBe(true);
		});
	});

	describe('updateFromSide', () => {
		it('does not update store when sync is disabled', () => {
			cameraSyncStore.setEnabled(false);
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			vi.runAllTimers();
			expect(getStoreState().left).toBeNull();
		});

		it('sets the correct side state after debounce fires', () => {
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			vi.runAllTimers();
			const state = getStoreState();
			expect(state.left).not.toBeNull();
			expect(state.left?.position).toEqual({ x: 1, y: 2, z: 3 });
		});

		it('sets lastUpdate to the correct side', () => {
			cameraSyncStore.updateFromSide('right', makeCameraState());
			vi.runAllTimers();
			expect(getStoreState().lastUpdate).toBe('right');
		});

		it('debounces rapid calls — only the last value wins', () => {
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 1, 1));
			cameraSyncStore.updateFromSide('left', makeCameraState(9, 9, 9));
			vi.runAllTimers();
			expect(getStoreState().left?.position).toEqual({ x: 9, y: 9, z: 9 });
		});

		it('sets syncing to true briefly then resets to false', () => {
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			vi.runAllTimers();
			expect(getStoreState().syncing).toBe(false);
		});

		it('does not update when syncing is already true', () => {
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			// Advance past the 120ms debounce but before the 50ms syncing-reset fires
			// (debounce fires at 120ms, reset fires at 170ms)
			vi.advanceTimersByTime(121);
			// syncing is now true; a second call from right should be blocked
			expect(getStoreState().syncing).toBe(true);
			cameraSyncStore.updateFromSide('right', makeCameraState(7, 8, 9));
			vi.runAllTimers();
			// right should still be null because the syncing guard blocked it
			expect(getStoreState().right).toBeNull();
		});
	});

	describe('getStateForSide', () => {
		it('returns null when sync is disabled', () => {
			cameraSyncStore.setEnabled(false);
			expect(cameraSyncStore.getStateForSide('left')).toBeNull();
			expect(cameraSyncStore.getStateForSide('right')).toBeNull();
		});

		it('returns null when neither side has a state', () => {
			expect(cameraSyncStore.getStateForSide('left')).toBeNull();
			expect(cameraSyncStore.getStateForSide('right')).toBeNull();
		});

		it('returns null when this side was last to update', () => {
			cameraSyncStore.updateFromSide('left', makeCameraState());
			vi.runAllTimers();
			expect(cameraSyncStore.getStateForSide('left')).toBeNull();
		});

		it('returns the other side state when the other side updated last', () => {
			const rightState = makeCameraState(5, 6, 7);
			cameraSyncStore.updateFromSide('right', rightState);
			vi.runAllTimers();
			const result = cameraSyncStore.getStateForSide('left');
			expect(result).not.toBeNull();
			expect(result?.position).toEqual({ x: 5, y: 6, z: 7 });
		});

		it('left updates → right gets left state', () => {
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			vi.runAllTimers();
			const result = cameraSyncStore.getStateForSide('right');
			expect(result?.position).toEqual({ x: 1, y: 2, z: 3 });
		});
	});

	describe('reset', () => {
		it('clears all state back to defaults', () => {
			cameraSyncStore.setEnabled(false);
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			vi.runAllTimers();
			cameraSyncStore.reset();

			const state = getStoreState();
			expect(state.enabled).toBe(true);
			expect(state.left).toBeNull();
			expect(state.right).toBeNull();
			expect(state.lastUpdate).toBeNull();
			expect(state.syncing).toBe(false);
		});

		it('cancels pending debounce so no update fires after reset', () => {
			cameraSyncStore.updateFromSide('left', makeCameraState(9, 9, 9));
			cameraSyncStore.reset();
			vi.runAllTimers();
			expect(getStoreState().left).toBeNull();
		});

		it('cancels pending syncing-reset timer', () => {
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			vi.advanceTimersByTime(200); // fires debounce, syncing=true
			cameraSyncStore.reset(); // cancels syncing reset timer
			vi.runAllTimers();
			// After reset, syncing must be false (reset sets it) even if timer was pending
			expect(getStoreState().syncing).toBe(false);
		});
	});
});

describe('createCameraState', () => {
	it('extracts position and target from Three.js-like objects', () => {
		const camera = { position: { x: 1, y: 2, z: 3 } };
		const controls = { target: { x: 4, y: 5, z: 6 } };
		const result = createCameraState(camera, controls);
		expect(result.position).toEqual({ x: 1, y: 2, z: 3 });
		expect(result.target).toEqual({ x: 4, y: 5, z: 6 });
	});

	it('returns a plain copy — mutations to source do not affect the result', () => {
		const camera = { position: { x: 10, y: 20, z: 30 } };
		const controls = { target: { x: 1, y: 2, z: 3 } };
		const result = createCameraState(camera, controls);
		camera.position.x = 999;
		controls.target.z = 999;
		expect(result.position.x).toBe(10);
		expect(result.target.z).toBe(3);
	});

	it('handles zero values', () => {
		const camera = { position: { x: 0, y: 0, z: 0 } };
		const controls = { target: { x: 0, y: 0, z: 0 } };
		const result = createCameraState(camera, controls);
		expect(result.position).toEqual({ x: 0, y: 0, z: 0 });
		expect(result.target).toEqual({ x: 0, y: 0, z: 0 });
	});

	it('handles negative values', () => {
		const camera = { position: { x: -5, y: -10, z: -15 } };
		const controls = { target: { x: -1, y: -2, z: -3 } };
		const result = createCameraState(camera, controls);
		expect(result.position).toEqual({ x: -5, y: -10, z: -15 });
		expect(result.target).toEqual({ x: -1, y: -2, z: -3 });
	});
});

describe('applyCameraState', () => {
	function makeApplyFixture() {
		let posSet: [number, number, number] | undefined;
		let targetSet: [number, number, number] | undefined;
		let updateCalled = false;

		const camera = {
			position: {
				x: 0,
				y: 0,
				z: 0,
				set(x: number, y: number, z: number) {
					posSet = [x, y, z];
				}
			}
		};
		const controls = {
			target: {
				x: 0,
				y: 0,
				z: 0,
				set(x: number, y: number, z: number) {
					targetSet = [x, y, z];
				}
			},
			update() {
				updateCalled = true;
			}
		};

		return {
			camera,
			controls,
			getPos: () => posSet,
			getTarget: () => targetSet,
			getUpdate: () => updateCalled
		};
	}

	it('sets camera position with correct coordinates', () => {
		const { camera, controls, getPos } = makeApplyFixture();
		applyCameraState(
			{ position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 } },
			camera,
			controls
		);
		expect(getPos()).toEqual([1, 2, 3]);
	});

	it('sets controls target with correct coordinates', () => {
		const { camera, controls, getTarget } = makeApplyFixture();
		applyCameraState(
			{ position: { x: 0, y: 0, z: 0 }, target: { x: 4, y: 5, z: 6 } },
			camera,
			controls
		);
		expect(getTarget()).toEqual([4, 5, 6]);
	});

	it('calls controls.update() after setting position and target', () => {
		const { camera, controls, getUpdate } = makeApplyFixture();
		applyCameraState(
			{ position: { x: 1, y: 2, z: 3 }, target: { x: 4, y: 5, z: 6 } },
			camera,
			controls
		);
		expect(getUpdate()).toBe(true);
	});
});
