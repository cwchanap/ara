import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import TinkerbellRenderer from './TinkerbellRenderer.svelte';

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

describe('TinkerbellRenderer worker integration', () => {
	beforeEach(() => {
		posted.length = 0;
		onmessage = null;
		vi.stubGlobal('Worker', MockWorker);
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('posts a tinkerbell request on mount', async () => {
		render(TinkerbellRenderer, {
			a: 0.9,
			b: -0.6013,
			c: 2.0,
			d: 0.5,
			iterations: 1000,
			colorMode: 'density',
			height: 200
		});

		// Flush the debounce (DEBOUNCE_MS = 250) + microtasks.
		await new Promise((r) => setTimeout(r, 300));
		await vi.waitFor(() => expect(posted.length).toBeGreaterThan(0));

		const req = posted[0] as { type: string; a: number };
		expect(req.type).toBe('tinkerbell');
		expect(req.a).toBe(0.9);
	});

	it('renders the canvas container', () => {
		render(TinkerbellRenderer, { height: 200 });
		expect(screen.getByText('LIVE_RENDER // CANVAS')).toBeTruthy();
	});
});
