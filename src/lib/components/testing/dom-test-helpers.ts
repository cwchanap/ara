/**
 * Shared test utilities for stubbing DOM dimension properties.
 *
 * jsdom has no layout engine, so `clientWidth`/`clientHeight` are always 0.
 * Visualization renderers (Three.js camera aspect, canvas size) need non-zero
 * dimensions to avoid NaN/0 calculations. This helper centralizes the
 * defineProperty stub/restore boilerplate that was duplicated across renderer
 * test files.
 *
 * Usage in a test file:
 *
 * ```ts
 * import { stubClientDimensions, restoreClientDimensions } from '$lib/components/testing/dom-test-helpers';
 *
 * beforeEach(() => {
 *   vi.useFakeTimers();
 *   stubClientDimensions(500, 400);
 * });
 *
 * afterEach(() => {
 *   vi.useRealTimers();
 *   restoreClientDimensions();
 *   cleanup();
 * });
 * ```
 */
// Capture the original descriptors once at module load so restore is exact.
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

/**
 * Stub `clientWidth`/`clientHeight` on `HTMLElement.prototype` to return fixed
 * non-zero values. Call `restoreClientDimensions` in `afterEach` to undo.
 */
export function stubClientDimensions(width = 500, height = 400): void {
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
		configurable: true,
		get() {
			return width;
		}
	});
	Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
		configurable: true,
		get() {
			return height;
		}
	});
}

/**
 * Restore the original `clientWidth`/`clientHeight` descriptors captured before
 * {@link stubClientDimensions} was first called. Safe to call even if stub was
 * never installed.
 */
export function restoreClientDimensions(): void {
	if (originalClientWidth) {
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
	} else {
		delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
	}
	if (originalClientHeight) {
		Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
	} else {
		delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
	}
}
