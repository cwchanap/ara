/**
 * Additional tests for snapshot.ts
 *
 * Covers cases not in snapshot.bun.test.ts:
 * - generateFilename timestamp component formatting (zero-padded single digits)
 * - generateFilename with various map type strings
 * - captureCanvas with quality=0 and quality=1
 * - captureContainer with multiple canvases
 * - captureContainer with background color but PNG format
 * - captureContainer with undefined container
 * - downloadSnapshot sets display:none on link
 * - downloadSnapshot removes link even when click throws
 */

import { describe, expect, test, mock } from 'bun:test';
import {
	generateFilename,
	captureCanvas,
	captureContainer,
	downloadSnapshot,
	type SnapshotOptions
} from './snapshot';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockCanvas(width = 100, height = 80): HTMLCanvasElement {
	return {
		width,
		height,
		toDataURL: mock((type?: string, quality?: number) => {
			void quality;
			return `data:${type ?? 'image/png'};base64,mockData`;
		}),
		getContext: mock((id: string) => {
			if (id === '2d') {
				return {
					drawImage: mock(() => {}),
					fillRect: mock(() => {}),
					fillStyle: ''
				} as unknown as CanvasRenderingContext2D;
			}
			return null;
		}),
		getBoundingClientRect: mock(() => ({ left: 0, top: 0, width, height }))
	} as unknown as HTMLCanvasElement;
}

function withMockedDocument<T>(doc: unknown, run: () => T | Promise<T>): T | Promise<T> {
	const original = (globalThis as Record<string, unknown>).document;
	(globalThis as Record<string, unknown>).document = doc;
	let result: T | Promise<T>;
	try {
		result = run();
	} finally {
		(globalThis as Record<string, unknown>).document = original;
	}
	return result;
}

// ── generateFilename – additional cases ──────────────────────────────────────

describe('generateFilename – additional cases', () => {
	test('uses default extension of png when none provided', () => {
		const filename = generateFilename('lorenz');
		expect(filename).toMatch(/\.png$/);
	});

	test('custom extension appears after timestamp', () => {
		const filename = generateFilename('rossler', 'jpeg');
		expect(filename).toMatch(/^rossler_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.jpeg$/);
	});

	test('map type containing hyphen is preserved', () => {
		const filename = generateFilename('bifurcation-logistic');
		expect(filename).toMatch(/^bifurcation-logistic_/);
	});

	test('map type containing accented chars is preserved', () => {
		const filename = generateFilename('CHAOS_ESTHÉTIQUE');
		expect(filename).toContain('CHAOS_ESTHÉTIQUE');
	});

	test('timestamp section is zero-padded to two digits', () => {
		// The regex pattern checks for exactly 2-digit month, day, hour, minute, second
		const filename = generateFilename('henon');
		// Extract timestamp portion: after first underscore
		const timestampPart = filename.split('_').slice(1).join('_').replace('.png', '');
		// Pattern: YYYY-MM-DD_HH-MM-SS
		expect(timestampPart).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
	});

	test('two consecutive calls return different filenames only when time advances', () => {
		// Both calls happen in the same second so they may or may not differ
		// We only verify the format is always valid
		const f1 = generateFilename('test');
		const f2 = generateFilename('test');
		expect(f1).toMatch(/^test_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
		expect(f2).toMatch(/^test_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
	});
});

// ── captureCanvas – additional cases ─────────────────────────────────────────

describe('captureCanvas – additional cases', () => {
	test('quality=0 is passed through for jpeg', async () => {
		const canvas = createMockCanvas();
		const result = await captureCanvas(canvas, { format: 'jpeg', quality: 0 });
		expect(result.success).toBe(true);
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0);
	});

	test('quality=1 is passed through for jpeg', async () => {
		const canvas = createMockCanvas();
		await captureCanvas(canvas, { format: 'jpeg', quality: 1 });
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 1);
	});

	test('returns the exact dataUrl from canvas.toDataURL', async () => {
		const canvas = {
			toDataURL: mock(() => 'data:image/png;base64,specificResult')
		} as unknown as HTMLCanvasElement;
		const result = await captureCanvas(canvas);
		expect(result.dataUrl).toBe('data:image/png;base64,specificResult');
	});

	test('success result has no error property set', async () => {
		const canvas = createMockCanvas();
		const result = await captureCanvas(canvas);
		expect(result.success).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test('failure result has no dataUrl property set', async () => {
		const result = await captureCanvas(null as unknown as HTMLCanvasElement);
		expect(result.success).toBe(false);
		expect(result.dataUrl).toBeUndefined();
	});
});

// ── captureContainer – additional cases ──────────────────────────────────────

describe('captureContainer – additional cases', () => {
	test('captures multiple canvases in one container', async () => {
		const canvas1 = createMockCanvas(200, 100);
		const canvas2 = createMockCanvas(200, 100);
		canvas1.getBoundingClientRect = mock(() => ({
			left: 0,
			top: 0,
			width: 200,
			height: 100
		})) as never;
		canvas2.getBoundingClientRect = mock(() => ({
			left: 0,
			top: 100,
			width: 200,
			height: 100
		})) as never;

		const drawImage = mock(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: mock(() => ({ drawImage, fillRect: mock(() => {}), fillStyle: '' })),
			toDataURL: mock(() => 'data:image/png;base64,multi-canvas')
		};
		const fakeDocument = { createElement: mock(() => outputCanvas) };

		const container = {
			querySelectorAll: mock((selector: string) =>
				selector === 'canvas' ? [canvas1, canvas2] : []
			),
			clientWidth: 200,
			clientHeight: 200,
			getBoundingClientRect: mock(() => ({ left: 0, top: 0 }))
		} as unknown as HTMLElement;

		const result = await withMockedDocument(fakeDocument, () => captureContainer(container));

		expect((result as { success: boolean }).success).toBe(true);
		// drawImage should have been called once per canvas
		expect(drawImage).toHaveBeenCalledTimes(2);
	});

	test('fills background with PNG format (not just JPEG)', async () => {
		const canvas = createMockCanvas(100, 80);
		canvas.getBoundingClientRect = mock(() => ({
			left: 0,
			top: 0,
			width: 100,
			height: 80
		})) as never;

		const fillStyle = { value: '' };
		const ctx = {
			drawImage: mock(() => {}),
			fillRect: mock(() => {}),
			get fillStyle() {
				return fillStyle.value;
			},
			set fillStyle(v: string) {
				fillStyle.value = v;
			}
		};
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: mock(() => ctx),
			toDataURL: mock(() => 'data:image/png;base64,bg-png')
		};
		const fakeDocument = { createElement: mock(() => outputCanvas) };

		const container = {
			querySelectorAll: mock((selector: string) => (selector === 'canvas' ? [canvas] : [])),
			clientWidth: 100,
			clientHeight: 80,
			getBoundingClientRect: mock(() => ({ left: 0, top: 0 }))
		} as unknown as HTMLElement;

		const options: SnapshotOptions = { format: 'png', backgroundColor: '#ffffff' };
		await withMockedDocument(fakeDocument, () => captureContainer(container, options));

		expect(fillStyle.value).toBe('#ffffff');
		expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 80);
	});

	test('returns error for undefined container', async () => {
		const result = await captureContainer(undefined as unknown as HTMLElement);
		expect(result.success).toBe(false);
		expect(result.error).toBe('No container element provided');
	});

	test('no background is drawn when backgroundColor is not set', async () => {
		const canvas = createMockCanvas(100, 80);
		canvas.getBoundingClientRect = mock(() => ({
			left: 0,
			top: 0,
			width: 100,
			height: 80
		})) as never;

		const fillRect = mock(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: mock(() => ({ drawImage: mock(() => {}), fillRect, fillStyle: '' })),
			toDataURL: mock(() => 'data:image/png;base64,no-bg')
		};
		const fakeDocument = { createElement: mock(() => outputCanvas) };

		const container = {
			querySelectorAll: mock((selector: string) => (selector === 'canvas' ? [canvas] : [])),
			clientWidth: 100,
			clientHeight: 80,
			getBoundingClientRect: mock(() => ({ left: 0, top: 0 }))
		} as unknown as HTMLElement;

		await withMockedDocument(fakeDocument, () => captureContainer(container, {}));

		expect(fillRect).not.toHaveBeenCalled();
	});
});

// ── downloadSnapshot – additional cases ──────────────────────────────────────

describe('downloadSnapshot – additional cases', () => {
	test('sets display:none on the link element', () => {
		const link = {
			href: '',
			download: '',
			style: { display: 'initial' },
			click: mock(() => {}),
			remove: mock(() => {})
		};
		const fakeDocument = {
			createElement: mock(() => link),
			body: { appendChild: mock(() => {}) }
		};

		withMockedDocument(fakeDocument, () =>
			downloadSnapshot('data:image/png;base64,x', 'file.png')
		);

		expect(link.style.display).toBe('none');
	});

	test('sets correct href and download attributes', () => {
		const link = {
			href: '',
			download: '',
			style: { display: '' },
			click: mock(() => {}),
			remove: mock(() => {})
		};
		const fakeDocument = {
			createElement: mock(() => link),
			body: { appendChild: mock(() => {}) }
		};

		withMockedDocument(fakeDocument, () =>
			downloadSnapshot('data:image/jpeg;base64,abc123', 'snapshot_2024.jpeg')
		);

		expect(link.href).toBe('data:image/jpeg;base64,abc123');
		expect(link.download).toBe('snapshot_2024.jpeg');
	});

	test('removes link even when click throws', () => {
		const remove = mock(() => {});
		const link = {
			href: '',
			download: '',
			style: { display: '' },
			click: mock(() => {
				throw new Error('click failed');
			}),
			remove
		};
		const fakeDocument = {
			createElement: mock(() => link),
			body: { appendChild: mock(() => {}) }
		};

		// downloadSnapshot uses try/finally so remove should still be called
		expect(() =>
			withMockedDocument(fakeDocument, () =>
				downloadSnapshot('data:image/png;base64,x', 'file.png')
			)
		).toThrow('click failed');

		expect(remove).toHaveBeenCalledTimes(1);
	});
});
