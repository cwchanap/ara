/**
 * Camera Sync Store for Three.js Visualizations
 *
 * Provides debounced bidirectional camera synchronization between
 * left and right comparison panels. Only used for Three.js visualizations
 * (Lorenz, Rössler) that use OrbitControls.
 */

import { writable, get } from 'svelte/store';

/**
 * Camera state that can be synced between panels.
 */
export interface CameraState {
	position: { x: number; y: number; z: number };
	target: { x: number; y: number; z: number };
}

/**
 * Store state for camera synchronization.
 */
interface CameraSyncState {
	enabled: boolean;
	left: CameraState | null;
	right: CameraState | null;
	lastUpdate: 'left' | 'right' | null;
	syncing: boolean;
}

const DEBOUNCE_MS = 120;

function createCameraSyncStore() {
	const { subscribe, set, update } = writable<CameraSyncState>({
		enabled: true,
		left: null,
		right: null,
		lastUpdate: null,
		syncing: false
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let syncingResetTimer: ReturnType<typeof setTimeout> | null = null;

	return {
		subscribe,

		/**
		 * Enable or disable camera sync.
		 */
		setEnabled(enabled: boolean) {
			update((state) => ({ ...state, enabled }));
		},

		/**
		 * Update camera state from one side with debouncing.
		 * The other side should listen and apply update.
		 */
		updateFromSide(side: 'left' | 'right', state: CameraState) {
			const currentState = get({ subscribe });

			// Don't update if syncing (prevents infinite loops)
			if (currentState.syncing || !currentState.enabled) return;

			// Clear any pending debounce
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}

			// Debounce update
			debounceTimer = setTimeout(() => {
				update((s) => ({
					...s,
					[side]: state,
					lastUpdate: side,
					syncing: true
				}));

				// Reset syncing flag after a short delay to allow other side to update
				if (syncingResetTimer) {
					clearTimeout(syncingResetTimer);
				}
				syncingResetTimer = setTimeout(() => {
					update((s) => ({ ...s, syncing: false }));
				}, 50);
			}, DEBOUNCE_MS);
		},

		/**
		 * Get camera state to apply to a specific side.
		 * Returns null if this side was last to update (no need to apply).
		 */
		getStateForSide(side: 'left' | 'right'): CameraState | null {
			const state = get({ subscribe });
			if (!state.enabled) return null;

			// If this side was last to update, don't apply (prevents loops)
			if (state.lastUpdate === side) return null;

			// Return other side's state
			return side === 'left' ? state.right : state.left;
		},

		/**
		 * Reset store (call when exiting comparison mode).
		 */
		reset() {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
			if (syncingResetTimer) {
				clearTimeout(syncingResetTimer);
				syncingResetTimer = null;
			}
			set({
				enabled: true,
				left: null,
				right: null,
				lastUpdate: null,
				syncing: false
			});
		},

		/**
		 * Toggle camera sync on/off.
		 */
		toggle() {
			update((state) => ({ ...state, enabled: !state.enabled }));
		}
	};
}

export const cameraSyncStore = createCameraSyncStore();

/**
 * Helper to create camera state from Three.js objects.
 */
export function createCameraState(
	camera: { position: { x: number; y: number; z: number } },
	controls: { target: { x: number; y: number; z: number } }
): CameraState {
	return {
		position: {
			x: camera.position.x,
			y: camera.position.y,
			z: camera.position.z
		},
		target: {
			x: controls.target.x,
			y: controls.target.y,
			z: controls.target.z
		}
	};
}

/**
 * Apply camera state to Three.js objects.
 */
export function applyCameraState(
	state: CameraState,
	camera: {
		position: {
			x: number;
			y: number;
			z: number;
			set: (x: number, y: number, z: number) => void;
		};
	},
	controls: {
		target: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
		update: () => void;
	}
): void {
	camera.position.set(state.position.x, state.position.y, state.position.z);
	controls.target.set(state.target.x, state.target.y, state.target.z);
	controls.update();
}
