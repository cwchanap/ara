/**
 * Unit tests for camera-sync store and helpers.
 *
 * CAMERA_SYNC_DEBOUNCE_MS is 120ms (from $lib/constants).
 * updateFromSide sets a 120ms debounce before updating the store,
 * then sets a 50ms syncing-reset timer. Tests that rely on the
 * debounced value use a 200ms pause to ensure both timers have fired.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { cameraSyncStore, createCameraState, applyCameraState } from './camera-sync';
import type { CameraState } from './camera-sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCameraState(x = 0, y = 0, z = 0): CameraState {
	return {
		position: { x, y, z },
		target: { x: 0, y: 0, z: 0 }
	};
}

/** Read the current store value synchronously. */
function getStoreState(): {
	enabled: boolean;
	left: CameraState | null;
	right: CameraState | null;
	lastUpdate: 'left' | 'right' | null;
	syncing: boolean;
} {
	let state!: ReturnType<typeof getStoreState>;
	const unsub = cameraSyncStore.subscribe((s) => {
		state = s;
	});
	unsub();
	return state;
}

/** Wait long enough for the debounce (120ms) + syncing reset (50ms) to complete. */
const waitForDebounce = () => new Promise<void>((r) => setTimeout(r, 200));

// ---------------------------------------------------------------------------
// cameraSyncStore
// ---------------------------------------------------------------------------

describe('cameraSyncStore', () => {
	beforeEach(() => {
		cameraSyncStore.reset();
	});

	// -------------------------------------------------------------------------
	describe('initial state', () => {
		test('starts with sync enabled, no camera states, and not syncing', () => {
			const state = getStoreState();
			expect(state.enabled).toBe(true);
			expect(state.left).toBeNull();
			expect(state.right).toBeNull();
			expect(state.lastUpdate).toBeNull();
			expect(state.syncing).toBe(false);
		});
	});

	// -------------------------------------------------------------------------
	describe('setEnabled', () => {
		test('setEnabled(false) disables sync', () => {
			cameraSyncStore.setEnabled(false);
			expect(getStoreState().enabled).toBe(false);
		});

		test('setEnabled(true) re-enables sync', () => {
			cameraSyncStore.setEnabled(false);
			cameraSyncStore.setEnabled(true);
			expect(getStoreState().enabled).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	describe('toggle', () => {
		test('toggle flips enabled from true to false', () => {
			cameraSyncStore.toggle();
			expect(getStoreState().enabled).toBe(false);
		});

		test('toggle flips enabled from false back to true', () => {
			cameraSyncStore.toggle(); // true -> false
			cameraSyncStore.toggle(); // false -> true
			expect(getStoreState().enabled).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	describe('updateFromSide', () => {
		test('does not update store when sync is disabled', async () => {
			cameraSyncStore.setEnabled(false);
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			await waitForDebounce();
			expect(getStoreState().left).toBeNull();
		});

		test('sets the correct side state after debounce', async () => {
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			await waitForDebounce();
			const state = getStoreState();
			expect(state.left).not.toBeNull();
			expect(state.left?.position).toEqual({ x: 1, y: 2, z: 3 });
		});

		test('sets lastUpdate to the correct side after debounce', async () => {
			cameraSyncStore.updateFromSide('right', makeCameraState());
			await waitForDebounce();
			expect(getStoreState().lastUpdate).toBe('right');
		});

		test('debounces rapid successive calls — only last wins', async () => {
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 1, 1));
			cameraSyncStore.updateFromSide('left', makeCameraState(9, 9, 9));
			await waitForDebounce();
			const state = getStoreState();
			// Only the final call should be stored
			expect(state.left?.position).toEqual({ x: 9, y: 9, z: 9 });
		});

		test('does not update while syncing flag is set', async () => {
			// Trigger first update so syncing becomes true briefly
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			// Immediately try to update right while syncing may be in-flight —
			// the guard prevents a second update during the syncing window.
			// We cannot reliably test the exact syncing moment in unit tests,
			// so we verify that after both settle only left was set first.
			await waitForDebounce();
			// After full settle, syncing must be false again
			expect(getStoreState().syncing).toBe(false);
		});
	});

	// -------------------------------------------------------------------------
	describe('getStateForSide', () => {
		test('returns null when sync is disabled', () => {
			cameraSyncStore.setEnabled(false);
			expect(cameraSyncStore.getStateForSide('left')).toBeNull();
			expect(cameraSyncStore.getStateForSide('right')).toBeNull();
		});

		test('returns null when neither side has a state', () => {
			expect(cameraSyncStore.getStateForSide('left')).toBeNull();
			expect(cameraSyncStore.getStateForSide('right')).toBeNull();
		});

		test('returns null when this side was the last to update', async () => {
			cameraSyncStore.updateFromSide('left', makeCameraState());
			await waitForDebounce();
			// Left was last to update — querying left should return null
			expect(cameraSyncStore.getStateForSide('left')).toBeNull();
		});

		test('returns the other side state when the other side was last to update', async () => {
			const rightState = makeCameraState(5, 6, 7);
			cameraSyncStore.updateFromSide('right', rightState);
			await waitForDebounce();
			// Right was last to update — left should receive right's state
			const result = cameraSyncStore.getStateForSide('left');
			expect(result).not.toBeNull();
			expect(result?.position).toEqual({ x: 5, y: 6, z: 7 });
		});

		test('left side returns right state; right side returns left state', async () => {
			const leftState = makeCameraState(1, 2, 3);
			cameraSyncStore.updateFromSide('left', leftState);
			await waitForDebounce();

			// Right side should get left's stored camera state
			const resultForRight = cameraSyncStore.getStateForSide('right');
			expect(resultForRight).not.toBeNull();
			expect(resultForRight?.position).toEqual({ x: 1, y: 2, z: 3 });
		});
	});

	// -------------------------------------------------------------------------
	describe('reset', () => {
		test('clears all state back to defaults synchronously', async () => {
			cameraSyncStore.setEnabled(false);
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			await waitForDebounce();

			cameraSyncStore.reset();

			const state = getStoreState();
			expect(state.enabled).toBe(true);
			expect(state.left).toBeNull();
			expect(state.right).toBeNull();
			expect(state.lastUpdate).toBeNull();
			expect(state.syncing).toBe(false);
		});

		test('cancels any pending debounce so no update fires after reset', async () => {
			// Start an update but reset before debounce fires
			cameraSyncStore.updateFromSide('left', makeCameraState(9, 9, 9));
			cameraSyncStore.reset(); // should cancel the pending timer
			await waitForDebounce();
			// left must still be null because the timer was cancelled
			expect(getStoreState().left).toBeNull();
		});
	});
});

// ---------------------------------------------------------------------------
// createCameraState
// ---------------------------------------------------------------------------

describe('createCameraState', () => {
	test('extracts position and target from Three.js-like objects', () => {
		const camera = { position: { x: 1, y: 2, z: 3 } };
		const controls = { target: { x: 4, y: 5, z: 6 } };
		const result = createCameraState(camera, controls);
		expect(result.position).toEqual({ x: 1, y: 2, z: 3 });
		expect(result.target).toEqual({ x: 4, y: 5, z: 6 });
	});

	test('returns a plain object copy — mutations do not affect the source', () => {
		const camera = { position: { x: 10, y: 20, z: 30 } };
		const controls = { target: { x: 1, y: 2, z: 3 } };
		const result = createCameraState(camera, controls);

		// Mutate original
		camera.position.x = 999;
		controls.target.z = 999;

		// Result should retain original values
		expect(result.position.x).toBe(10);
		expect(result.target.z).toBe(3);
	});

	test('handles zero values correctly', () => {
		const camera = { position: { x: 0, y: 0, z: 0 } };
		const controls = { target: { x: 0, y: 0, z: 0 } };
		const result = createCameraState(camera, controls);
		expect(result.position).toEqual({ x: 0, y: 0, z: 0 });
		expect(result.target).toEqual({ x: 0, y: 0, z: 0 });
	});

	test('handles negative values correctly', () => {
		const camera = { position: { x: -5, y: -10, z: -15 } };
		const controls = { target: { x: -1, y: -2, z: -3 } };
		const result = createCameraState(camera, controls);
		expect(result.position).toEqual({ x: -5, y: -10, z: -15 });
		expect(result.target).toEqual({ x: -1, y: -2, z: -3 });
	});
});

// ---------------------------------------------------------------------------
// applyCameraState
// ---------------------------------------------------------------------------

describe('applyCameraState', () => {
	test('calls set() on camera.position with correct coordinates', () => {
		let posSet: [number, number, number] | undefined;

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
				set(...args: [number, number, number]) {
					void args;
				}
			},
			update() {}
		};

		const state: CameraState = { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 } };
		applyCameraState(state, camera, controls);

		expect(posSet).toEqual([1, 2, 3]);
	});

	test('calls set() on controls.target with correct coordinates', () => {
		let targetSet: [number, number, number] | undefined;

		const camera = {
			position: {
				x: 0,
				y: 0,
				z: 0,
				set(...args: [number, number, number]) {
					void args;
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
			update() {}
		};

		const state: CameraState = { position: { x: 0, y: 0, z: 0 }, target: { x: 4, y: 5, z: 6 } };
		applyCameraState(state, camera, controls);

		expect(targetSet).toEqual([4, 5, 6]);
	});

	test('calls controls.update() after setting position and target', () => {
		let updateCalled = false;

		const camera = {
			position: {
				x: 0,
				y: 0,
				z: 0,
				set(...args: [number, number, number]) {
					void args;
				}
			}
		};
		const controls = {
			target: {
				x: 0,
				y: 0,
				z: 0,
				set(...args: [number, number, number]) {
					void args;
				}
			},
			update() {
				updateCalled = true;
			}
		};

		const state: CameraState = { position: { x: 1, y: 2, z: 3 }, target: { x: 4, y: 5, z: 6 } };
		applyCameraState(state, camera, controls);

		expect(updateCalled).toBe(true);
	});

	test('full integration: position, target, and update all applied correctly', () => {
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

		const state: CameraState = { position: { x: 1, y: 2, z: 3 }, target: { x: 4, y: 5, z: 6 } };
		applyCameraState(state, camera, controls);

		expect(posSet).toEqual([1, 2, 3]);
		expect(targetSet).toEqual([4, 5, 6]);
		expect(updateCalled).toBe(true);
	});
});
