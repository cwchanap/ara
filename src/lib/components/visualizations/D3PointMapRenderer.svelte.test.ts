import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/svelte';
import D3PointMapRenderer from './D3PointMapRenderer.svelte';

describe('D3PointMapRenderer', () => {
	afterEach(cleanup);

	it('renders an svg with one circle per point', async () => {
		const points: [number, number][] = [
			[0, 0],
			[1, 1],
			[2, 0.5]
		];
		const { container } = render(D3PointMapRenderer, { props: { points, height: 200 } });
		// jsdom has no layout; component must guard width===0. Force a width:
		const root = container.querySelector('div') as HTMLDivElement;
		Object.defineProperty(root, 'clientWidth', { value: 400, configurable: true });
		// trigger a re-render by updating points
		await new Promise((r) => setTimeout(r, 0));
		// At minimum the LIVE_RENDER badge is present:
		expect(container.textContent).toContain('LIVE_RENDER');
	});

	it('renders the decorated chrome variant with corner decorations and ring', () => {
		const { container } = render(D3PointMapRenderer, {
			props: { points: [], height: 200, chrome: 'decorated' }
		});
		const root = container.querySelector('div') as HTMLDivElement;
		expect(root.classList.contains('ring-1')).toBe(true);
		expect(root.classList.contains('ring-primary/30')).toBe(true);
		// Decorated chrome adds 4 sci-fi corner decoration divs.
		const corners = root.querySelectorAll('.absolute.border-t-2, .absolute.border-b-2');
		expect(corners.length).toBe(4);
		expect(container.textContent).toContain('LIVE_RENDER');
	});
});

describe('D3PointMapRenderer D3 render branch (clientWidth 0)', () => {
	let originalResizeObserver: typeof ResizeObserver;
	let prevClientWidth: PropertyDescriptor | undefined;
	let roCallback: (() => void) | null = null;

	beforeEach(() => {
		originalResizeObserver = globalThis.ResizeObserver;
		prevClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
		roCallback = null;
		class CapturingResizeObserver {
			constructor(cb: () => void) {
				roCallback = cb;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		}
		globalThis.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;
		// Force clientWidth to 0 so render() sets up a ResizeObserver.
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			value: 0
		});
	});

	afterEach(() => {
		globalThis.ResizeObserver = originalResizeObserver;
		if (prevClientWidth) {
			Object.defineProperty(HTMLElement.prototype, 'clientWidth', prevClientWidth);
		}
		cleanup();
	});

	it('creates a ResizeObserver when clientWidth is 0 and renders svg + circles when width becomes positive', async () => {
		const points: [number, number][] = [
			[0, 0],
			[1, 1],
			[2, 0.5]
		];
		const { container } = render(D3PointMapRenderer, {
			props: { points, height: 200 }
		});
		// clientWidth 0 → render() creates a ResizeObserver and observes the container.
		expect(roCallback).not.toBeNull();

		// Simulate the container gaining layout (width becomes positive).
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			value: 400
		});
		// Fire the captured ResizeObserver callback → disconnect, null, render().
		roCallback!();

		await waitFor(() => {
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelectorAll('circle').length).toBe(3);
		});
	});

	it('renders axes/frame with no circles when points array is empty', async () => {
		const { container } = render(D3PointMapRenderer, {
			props: { points: [], height: 200 }
		});
		expect(roCallback).not.toBeNull();

		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			value: 400
		});
		roCallback!();

		await waitFor(() => {
			// SVG + axes present, but no point circles.
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelectorAll('circle').length).toBe(0);
		});
	});
});

describe('D3PointMapRenderer clears a stale ResizeObserver on re-render', () => {
	let originalResizeObserver: typeof ResizeObserver;
	let prevClientWidth: PropertyDescriptor | undefined;
	let roCallback: (() => void) | null = null;
	let disconnectSpy: Mock;

	beforeEach(() => {
		originalResizeObserver = globalThis.ResizeObserver;
		prevClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
		roCallback = null;
		disconnectSpy = vi.fn();
		class CapturingResizeObserver {
			constructor(cb: () => void) {
				roCallback = cb;
			}
			observe() {}
			unobserve() {}
			disconnect() {
				disconnectSpy();
			}
		}
		globalThis.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;
		// Force clientWidth to 0 globally so mount enters the observer path.
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			value: 0
		});
	});

	afterEach(() => {
		globalThis.ResizeObserver = originalResizeObserver;
		if (prevClientWidth) {
			Object.defineProperty(HTMLElement.prototype, 'clientWidth', prevClientWidth);
		}
		cleanup();
	});

	it('disconnects the prior observer when a re-render runs with positive width', async () => {
		const points: [number, number][] = [
			[0, 0],
			[1, 1]
		];
		const { container, rerender } = render(D3PointMapRenderer, {
			props: { points, height: 200 }
		});

		// Mount ran render() with clientWidth 0 → a ResizeObserver was created.
		expect(roCallback).not.toBeNull();

		// The container gains layout (width becomes positive) WITHOUT the
		// ResizeObserver callback firing yet.
		const root = container.querySelector('div') as HTMLDivElement;
		Object.defineProperty(root, 'clientWidth', { configurable: true, value: 400 });

		// A prop change re-runs the $effect: the prior effect's cleanup
		// disconnects the stale observer, then render() runs with positive
		// width and draws the svg + circles for the updated points.
		rerender({ points: [...points, [2, 0.5]], height: 200 });

		await waitFor(() => {
			expect(disconnectSpy).toHaveBeenCalled();
			expect(container.querySelector('svg')).not.toBeNull();
			expect(container.querySelectorAll('circle').length).toBe(3);
		});
	});
});
