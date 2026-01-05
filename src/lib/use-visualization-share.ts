/**
 * useVisualizationShare - Reusable share logic for visualization pages
 *
 * Provides state management and handlers for sharing configurations.
 */

import { base } from '$app/paths';
import type { ChaosMapType, ChaosMapParameters } from '$lib/types';

export interface ShareState {
	showShareDialog: boolean;
	isSharing: boolean;
	shareError: string | null;
}

export interface ShareHandlerWithCleanup {
	share: () => Promise<{ shareUrl: string; expiresAt: string } | null>;
	cleanup: () => void;
}

/**
 * Create initial share state.
 */
export function createInitialShareState(): ShareState {
	return {
		showShareDialog: false,
		isSharing: false,
		shareError: null
	};
}

/**
 * Creates a share handler for visualization pages.
 *
 * @param mapType - The chaos map type
 * @param state - The reactive state object
 * @param getParameters - Function to get current parameters
 * @returns Object containing share handler and cleanup function
 */
export function createShareHandler(
	mapType: ChaosMapType,
	state: ShareState,
	getParameters: () => ChaosMapParameters
): ShareHandlerWithCleanup {
	let abortController: AbortController | null = null;

	const share = async (): Promise<{ shareUrl: string; expiresAt: string } | null> => {
		// Prevent multiple concurrent shares
		if (state.isSharing) return null;

		// Cancel any in-flight request
		if (abortController) {
			abortController.abort();
		}
		abortController = new AbortController();

		state.shareError = null;
		state.isSharing = true;

		try {
			const response = await fetch(`${base}/api/share`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: abortController.signal,
				body: JSON.stringify({
					mapType,
					parameters: getParameters()
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Failed to share' }));
				throw new Error(errorData.error || 'Failed to create share link');
			}

			const data = await response.json();
			return {
				shareUrl: data.shareUrl,
				expiresAt: data.expiresAt
			};
		} catch (error) {
			// Don't set error if it was a manual abort
			if (error instanceof Error && error.name === 'AbortError') {
				return null;
			}

			const message = error instanceof Error ? error.message : 'Failed to create share link';
			state.shareError = message;
			throw error;
		} finally {
			state.isSharing = false;
			abortController = null;
		}
	};

	const cleanup = () => {
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
	};

	return { share, cleanup };
}
