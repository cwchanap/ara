import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import GingerbreadmanRenderer from './GingerbreadmanRenderer.svelte';

// Captured worker messages.
const posted: unknown[] = [];
let onmessage: ((e: { data: unknown }) => void) | null = null;

class MockWorker {
	constructor() {
		return {
			postMessage: (msg: unknown) => posted.push(msg),
			terminate: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			set onmessage(fn: (e: { data: unknown }) => void) {
				onmessage = fn;
			},
			get onmessage(): ((e: { data: unknown }) => void) | null {
				return onmessage;
			},
			onerror: null
		};
	}
}

describe('GingerbreadmanRenderer worker integration', () => {
	beforeEach(() => {
		posted.length = 0;
		onmessage = null;
		vi.stubGlobal('Worker', MockWorker);
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('posts a gingerbreadman request on mount', async () => {
		render(GingerbreadmanRenderer, {
			x0: -0.1,
			y0: 0,
			iterations: 1000,
			colorMode: 'iteration',
			height: 200
		});

		// Flush the debounce (COMPUTE_DEBOUNCE_MS = 250) + microtasks.
		await new Promise((r) => setTimeout(r, 300));
		await vi.waitFor(() => expect(posted.length).toBeGreaterThan(0));

		const req = posted[0] as { type: string; x0: number; y0: number; maxPoints: number };
		expect(req.type).toBe('gingerbreadman');
		expect(req.x0).toBe(-0.1);
		expect(req.y0).toBe(0);
		expect(req.maxPoints).toBe(1000);
	});

	it('renders the canvas container', () => {
		render(GingerbreadmanRenderer, { height: 200 });
		expect(screen.getByText('LIVE_RENDER // CANVAS')).toBeTruthy();
	});
});
