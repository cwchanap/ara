import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import BakersMapRenderer from './BakersMapRenderer.svelte';

// jsdom doesn't implement canvas getContext — stub it
beforeEach(() => {
	HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		set fillStyle(_v: string) {},
		get fillStyle() {
			return '';
		}
	}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

// jsdom doesn't implement RAF
beforeEach(() => {
	vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('BakersMapRenderer', () => {
	test('mounts without errors', () => {
		const { container } = render(BakersMapRenderer);
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	test('creates the LIVE_RENDER badge', () => {
		const { container } = render(BakersMapRenderer);
		// At minimum, the container has overlay text
		expect(container.textContent).toContain('LIVE_RENDER');
	});

	test('cancelAnimationFrame is called on unmount', () => {
		const { unmount } = render(BakersMapRenderer);
		unmount();
		expect(cancelAnimationFrame).toHaveBeenCalled();
	});

	test('displays iteration counter overlay', () => {
		const { container } = render(BakersMapRenderer);
		expect(container.textContent).toContain('ITERATION');
	});

	test('accepts pointCount prop', () => {
		const { component } = render(BakersMapRenderer, { pointCount: 500 });
		// No error thrown means prop was accepted
		expect(component).toBeTruthy();
	});

	test('accepts speed prop', () => {
		const { component } = render(BakersMapRenderer, { speed: 5 });
		expect(component).toBeTruthy();
	});

	test('accepts paused prop', () => {
		const { component } = render(BakersMapRenderer, { paused: true });
		expect(component).toBeTruthy();
	});

	test('does not crash when resetSignal changes', async () => {
		const { rerender } = render(BakersMapRenderer, { resetSignal: 0 });
		await rerender({ resetSignal: 1 });
		// No crash = pass
	});

	test('does not crash when randomizeSignal changes', async () => {
		const { rerender } = render(BakersMapRenderer, { randomizeSignal: 0 });
		await rerender({ randomizeSignal: 1 });
	});

	test('does not crash when stepSignal changes', async () => {
		const { rerender } = render(BakersMapRenderer, { stepSignal: 0, paused: true });
		await rerender({ stepSignal: 1 });
	});
});
