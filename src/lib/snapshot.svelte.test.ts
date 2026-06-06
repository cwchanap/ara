import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	captureCanvas,
	captureContainer,
	downloadSnapshot,
	generateFilename,
	type SnapshotOptions
} from './snapshot';

function createMockCanvas(toDataURLReturn?: string): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.toDataURL = vi.fn().mockReturnValue(toDataURLReturn ?? 'data:image/png;base64,test');
	return canvas;
}

describe('generateFilename', () => {
	it('generates filename with default .png extension', () => {
		const result = generateFilename('lorenz');
		expect(result).toMatch(/^lorenz_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
	});

	it('generates filename with custom extension', () => {
		const result = generateFilename('henon', 'jpg');
		expect(result).toMatch(/^henon_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.jpg$/);
	});

	it('includes the mapType prefix', () => {
		const result = generateFilename('rossler');
		expect(result.startsWith('rossler_')).toBe(true);
	});

	it('pads single-digit month/day/hour/minute/second with zeros', () => {
		const date = new Date(2025, 0, 5, 3, 7, 9);
		vi.useFakeTimers();
		try {
			vi.setSystemTime(date);
			const result = generateFilename('test');
			expect(result).toBe('test_2025-01-05_03-07-09.png');
		} finally {
			vi.useRealTimers();
		}
	});

	it('handles double-digit values without extra padding', () => {
		const date = new Date(2025, 10, 12, 14, 30, 45);
		vi.useFakeTimers();
		try {
			vi.setSystemTime(date);
			const result = generateFilename('test');
			expect(result).toBe('test_2025-11-12_14-30-45.png');
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('captureCanvas', () => {
	it('returns error when canvas is null', async () => {
		const result = await captureCanvas(null as unknown as HTMLCanvasElement);
		expect(result).toEqual({ success: false, error: 'No canvas element provided' });
	});

	it('returns success with dataUrl for valid canvas', async () => {
		const canvas = createMockCanvas('data:image/png;base64,abc123');
		const result = await captureCanvas(canvas);
		expect(result.success).toBe(true);
		expect(result.dataUrl).toBe('data:image/png;base64,abc123');
	});

	it('captures as JPEG when format is jpeg', async () => {
		const canvas = createMockCanvas('data:image/jpeg;base64,abc');
		const result = await captureCanvas(canvas, { format: 'jpeg' });
		expect(result.success).toBe(true);
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 1);
	});

	it('passes quality option for JPEG', async () => {
		const canvas = createMockCanvas('data:image/jpeg;base64,abc');
		const result = await captureCanvas(canvas, { format: 'jpeg', quality: 0.5 });
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.5);
		expect(result.success).toBe(true);
	});

	it('returns error when toDataURL throws', async () => {
		const canvas = document.createElement('canvas');
		canvas.toDataURL = () => {
			throw new Error('Canvas tainted');
		};
		const result = await captureCanvas(canvas);
		expect(result.success).toBe(false);
		expect(result.error).toBe('Canvas tainted');
	});

	it('returns generic error when toDataURL throws non-Error', async () => {
		const canvas = document.createElement('canvas');
		canvas.toDataURL = () => {
			throw 'string error';
		};
		const result = await captureCanvas(canvas);
		expect(result.success).toBe(false);
		expect(result.error).toBe('Failed to capture canvas');
	});

	it('uses default options when empty object provided', async () => {
		const canvas = createMockCanvas('data:image/png;base64,test');
		const result = await captureCanvas(canvas, {});
		expect(result.success).toBe(true);
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/png', 1);
	});
});

describe('captureContainer', () => {
	let getContextSpy: ReturnType<typeof vi.spyOn>;
	let toDataURLSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' } as any);
		toDataURLSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
			.mockReturnValue('data:image/png;base64,composed');
	});

	afterEach(() => {
		getContextSpy.mockRestore();
		toDataURLSpy.mockRestore();
	});

	it('returns error when container is null', async () => {
		const result = await captureContainer(null as unknown as HTMLElement);
		expect(result).toEqual({ success: false, error: 'No container element provided' });
	});

	it('returns error when container has no canvas or SVG children', async () => {
		const container = document.createElement('div');
		const result = await captureContainer(container);
		expect(result).toEqual({
			success: false,
			error: 'No capturable content found in container'
		});
	});

	it('returns success with dataUrl when container has a canvas child', async () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		container.appendChild(canvas);

		const result = await captureContainer(container);
		expect(result.success).toBe(true);
		expect(result.dataUrl).toBe('data:image/png;base64,composed');
	});

	it('fills background when backgroundColor option is provided', async () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		container.appendChild(canvas);

		const ctx = {
			fillRect: vi.fn(),
			drawImage: vi.fn(),
			fillStyle: ''
		};
		getContextSpy.mockReturnValue(ctx as unknown as CanvasRenderingContext2D);

		await captureContainer(container, { backgroundColor: '#000000' });
		expect(ctx.fillRect).toHaveBeenCalled();
		expect(ctx.fillStyle).toBe('#000000');
	});

	it('captures as JPEG when format is jpeg', async () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		container.appendChild(canvas);

		const result = await captureContainer(container, { format: 'jpeg' });
		expect(result.success).toBe(true);
		expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 1);
	});

	it('returns error when getContext returns null', async () => {
		getContextSpy.mockReturnValue(null);

		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		container.appendChild(canvas);

		const result = await captureContainer(container);
		expect(result.success).toBe(false);
		expect(result.error).toBe('Failed to create output canvas context');
	});

	it('handles SVG elements in container gracefully', async () => {
		const container = document.createElement('div');
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', '50');
		svg.setAttribute('height', '50');
		container.appendChild(svg);

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const OrigImage = globalThis.Image;
		function MockImage() {
			const img = new OrigImage();
			const origSrcSet = Object.getOwnPropertyDescriptor(
				Object.getPrototypeOf(img),
				'src'
			)?.set;
			let onloadCb: (() => void) | null = null;
			Object.defineProperty(img, 'onload', {
				get: () => onloadCb,
				set: (cb: (() => void) | null) => {
					onloadCb = cb;
				}
			});
			Object.defineProperty(img, 'src', {
				set(value: string) {
					origSrcSet?.call(img, value);
					if (onloadCb) queueMicrotask(onloadCb);
				},
				get: Object.getOwnPropertyDescriptor(Object.getPrototypeOf(img), 'src')?.get
			});
			return img;
		}
		vi.stubGlobal('Image', MockImage);

		const result = await captureContainer(container);
		expect(result).toBeDefined();
		expect(result.success).toBe(true);

		vi.stubGlobal('Image', OrigImage);
		warnSpy.mockRestore();
	});

	it('returns error on unexpected exception', async () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		container.appendChild(canvas);

		getContextSpy.mockImplementation(() => {
			throw new Error('Unexpected');
		});

		const result = await captureContainer(container);
		expect(result.success).toBe(false);
		expect(result.error).toBe('Unexpected');
	});
});

describe('downloadSnapshot', () => {
	it('creates an anchor element, clicks it, and removes it', () => {
		const appendSpy = vi.spyOn(document.body, 'appendChild');
		const removeSpy = vi.spyOn(Element.prototype, 'remove');

		downloadSnapshot('data:image/png;base64,abc', 'test.png');

		expect(appendSpy).toHaveBeenCalled();
		const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
		expect(anchor.tagName).toBe('A');
		expect(anchor.href).toBe('data:image/png;base64,abc');
		expect(anchor.download).toBe('test.png');
		expect(anchor.style.display).toBe('none');
		expect(removeSpy).toHaveBeenCalled();

		appendSpy.mockRestore();
		removeSpy.mockRestore();
	});

	it('throws error when document is undefined', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.spyOn(globalThis as any, 'document', 'get').mockImplementation(() => undefined);

		expect(() => downloadSnapshot('data:image/png', 'test.png')).toThrow(
			'Download is only available in the browser'
		);

		vi.restoreAllMocks();
	});
});

// ════════════════════════════════════════════════════════════════════════════
// Merged from snapshot.bun.test.ts and snapshot.extra.test.ts.
// These use a self-contained fake-object / mocked-document strategy that
// complements the real-jsdom tests above. The shared helpers below are defined
// once here (renamed to avoid colliding with the createMockCanvas above).
// ════════════════════════════════════════════════════════════════════════════

function createFakeCanvas(width = 600, height = 400): HTMLCanvasElement {
	return {
		width,
		height,
		toDataURL: vi.fn((type?: string, quality?: number) => {
			void quality;
			return `data:${type ?? 'image/png'};base64,mockImageData`;
		}),
		getContext: vi.fn((contextId: string) => {
			if (contextId === '2d') {
				return {
					drawImage: vi.fn(() => {}),
					fillRect: vi.fn(() => {}),
					fillStyle: '',
					canvas: { width, height }
				} as unknown as CanvasRenderingContext2D;
			}
			return null;
		}),
		getBoundingClientRect: vi.fn(() => ({
			width,
			height,
			top: 0,
			left: 0,
			right: width,
			bottom: height
		}))
	} as unknown as HTMLCanvasElement;
}

async function withMockedDocument<T>(doc: unknown, run: () => T | Promise<T>): Promise<T> {
	const original = (globalThis as Record<string, unknown>).document;
	(globalThis as Record<string, unknown>).document = doc;
	try {
		return await run();
	} finally {
		(globalThis as Record<string, unknown>).document = original;
	}
}
describe('generateFilename', () => {
	test('generates filename with map type and timestamp', () => {
		const filename = generateFilename('henon');
		expect(filename).toMatch(/^henon_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
	});

	test('generates filename with custom extension', () => {
		const filename = generateFilename('logistic', 'jpeg');
		expect(filename).toMatch(/^logistic_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.jpeg$/);
	});

	test('sanitizes map type with special characters', () => {
		const filename = generateFilename('chaos-esthetique');
		expect(filename).toContain('chaos-esthetique');
		expect(filename).toMatch(/\.png$/);
	});

	test('handles empty map type', () => {
		const filename = generateFilename('');
		expect(filename).toMatch(/^_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
	});
});

describe('captureCanvas', () => {
	test('returns data URL from canvas', async () => {
		const canvas = createFakeCanvas();
		const result = await captureCanvas(canvas);

		expect(result.success).toBe(true);
		expect(result.dataUrl).toMatch(/^data:image\/png/);
	});

	test('respects format option for jpeg', async () => {
		const canvas = createFakeCanvas();
		const result = await captureCanvas(canvas, { format: 'jpeg' });

		expect(result.success).toBe(true);
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', expect.any(Number));
	});

	test('respects quality option', async () => {
		const canvas = createFakeCanvas();
		const result = await captureCanvas(canvas, { format: 'jpeg', quality: 0.8 });

		expect(result.success).toBe(true);
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
	});

	test('returns error for null canvas', async () => {
		const result = await captureCanvas(null as unknown as HTMLCanvasElement);

		expect(result.success).toBe(false);
		expect(result.error).toBe('No canvas element provided');
	});

	test('uses default PNG format', async () => {
		const canvas = createFakeCanvas();
		await captureCanvas(canvas);

		expect(canvas.toDataURL).toHaveBeenCalledWith('image/png', 1);
	});

	test('returns error for undefined canvas', async () => {
		const result = await captureCanvas(undefined as unknown as HTMLCanvasElement);

		expect(result.success).toBe(false);
		expect(result.error).toBe('No canvas element provided');
	});

	test('returns exact message when canvas throws Error', async () => {
		const canvas = {
			toDataURL: vi.fn(() => {
				throw new Error('tainted canvas');
			})
		} as unknown as HTMLCanvasElement;

		const result = await captureCanvas(canvas);

		expect(result.success).toBe(false);
		expect(result.error).toBe('tainted canvas');
	});

	test('returns fallback error when canvas throws non-Error value', async () => {
		const canvas = {
			toDataURL: vi.fn(() => {
				throw 'boom';
			})
		} as unknown as HTMLCanvasElement;

		const result = await captureCanvas(canvas);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Failed to capture canvas');
	});
});

describe('captureContainer', () => {
	test('returns error for null container', async () => {
		const result = await captureContainer(null as unknown as HTMLElement);

		expect(result.success).toBe(false);
		expect(result.error).toBe('No container element provided');
	});

	test('returns error for empty container content', async () => {
		const container = {
			querySelectorAll: vi.fn(() => []),
			clientWidth: 400,
			clientHeight: 300
		} as unknown as HTMLElement;

		const result = await captureContainer(container);

		expect(result.success).toBe(false);
		expect(result.error).toBe('No capturable content found in container');
	});

	test('returns error if output canvas context cannot be created', async () => {
		const container = {
			querySelectorAll: vi.fn((selector: string) =>
				selector === 'canvas' ? [createFakeCanvas()] : []
			),
			clientWidth: 400,
			clientHeight: 300,
			getBoundingClientRect: vi.fn(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const fakeDocument = {
			createElement: vi.fn(() => ({
				getContext: vi.fn(() => null)
			}))
		};

		const result = await withMockedDocument(fakeDocument, () => captureContainer(container));

		expect(result.success).toBe(false);
		expect(result.error).toBe('Failed to create output canvas context');
	});

	test('uses jpeg mime type when format is jpeg', async () => {
		const sourceCanvas = createFakeCanvas(100, 80);
		sourceCanvas.getBoundingClientRect = vi.fn(() => ({
			left: 0,
			top: 0,
			width: 100,
			height: 80
		})) as never;

		const container = {
			querySelectorAll: vi.fn((selector: string) =>
				selector === 'canvas' ? [sourceCanvas] : []
			),
			clientWidth: 100,
			clientHeight: 80,
			getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 }))
		} as unknown as HTMLElement;

		const toDataURL = vi.fn(() => 'data:image/jpeg;base64,jpegdata');
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({
				drawImage: vi.fn(() => {}),
				fillRect: vi.fn(() => {}),
				fillStyle: ''
			})),
			toDataURL
		};
		const fakeDocument = {
			createElement: vi.fn(() => outputCanvas)
		};

		const result = await withMockedDocument(fakeDocument, () =>
			captureContainer(container, { format: 'jpeg', quality: 0.9 })
		);

		expect(result.success).toBe(true);
		expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.9);
	});

	test('captures canvas layers and returns output data URL', async () => {
		const sourceCanvas = createFakeCanvas(100, 80);
		sourceCanvas.getBoundingClientRect = vi.fn(() => ({
			left: 30,
			top: 45,
			width: 100,
			height: 80
		})) as never;

		const container = {
			querySelectorAll: vi.fn((selector: string) =>
				selector === 'canvas' ? [sourceCanvas] : []
			),
			clientWidth: 500,
			clientHeight: 400,
			getBoundingClientRect: vi.fn(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const drawImage = vi.fn(() => {});
		const fillRect = vi.fn(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({ drawImage, fillRect, fillStyle: '' })),
			toDataURL: vi.fn(() => 'data:image/png;base64,composite')
		};
		const fakeDocument = {
			createElement: vi.fn(() => outputCanvas)
		};

		const result = await withMockedDocument(fakeDocument, () =>
			captureContainer(container, { backgroundColor: '#000000' })
		);

		expect(result).toEqual({ success: true, dataUrl: 'data:image/png;base64,composite' });
		expect(drawImage).toHaveBeenCalledWith(sourceCanvas, 20, 25);
		expect(fillRect).toHaveBeenCalledWith(0, 0, 500, 400);
		expect(outputCanvas.toDataURL).toHaveBeenCalledWith('image/png', 1);
	});

	test('captures SVG overlays when conversion succeeds', async () => {
		const svgElement = {
			getBoundingClientRect: vi.fn(() => ({ left: 35, top: 60, width: 120, height: 90 }))
		} as unknown as SVGSVGElement;
		const container = {
			querySelectorAll: vi.fn((selector: string) => (selector === 'svg' ? [svgElement] : [])),
			clientWidth: 500,
			clientHeight: 400,
			getBoundingClientRect: vi.fn(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const drawImage = vi.fn(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({ drawImage, fillRect: vi.fn(() => {}), fillStyle: '' })),
			toDataURL: vi.fn(() => 'data:image/png;base64,svg-composite')
		};

		const svgDrawImage = vi.fn(() => {});
		const svgCanvas = {
			width: 120,
			height: 90,
			getContext: vi.fn(() => ({ drawImage: svgDrawImage }))
		} as unknown as HTMLCanvasElement;

		let createCount = 0;
		const fakeDocument = {
			createElement: vi.fn(() => {
				createCount += 1;
				return createCount === 1 ? outputCanvas : svgCanvas;
			})
		};

		const originalXMLSerializer = (globalThis as Record<string, unknown>).XMLSerializer;
		const originalBlob = (globalThis as Record<string, unknown>).Blob;
		const originalURL = (globalThis as Record<string, unknown>).URL;
		const originalImage = (globalThis as Record<string, unknown>).Image;

		(globalThis as Record<string, unknown>).XMLSerializer = class {
			serializeToString() {
				return '<svg></svg>';
			}
		};
		(globalThis as Record<string, unknown>).Blob = class {
			constructor(parts: unknown[], opts: unknown) {
				void parts;
				void opts;
			}
		};
		(globalThis as Record<string, unknown>).URL = {
			createObjectURL: vi.fn(() => 'blob:mock-url'),
			revokeObjectURL: vi.fn(() => {})
		};
		(globalThis as Record<string, unknown>).Image = class {
			onload?: () => void;
			onerror?: () => void;
			set src(_value: string) {
				if (this.onload) this.onload();
			}
		};

		try {
			const result = await withMockedDocument(fakeDocument, () =>
				captureContainer(container)
			);

			expect(result).toEqual({
				success: true,
				dataUrl: 'data:image/png;base64,svg-composite'
			});
			expect(drawImage).toHaveBeenCalled();
			const urlObject = (globalThis as Record<string, unknown>).URL as {
				revokeObjectURL: ReturnType<typeof mock>;
			};
			expect(urlObject.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
		} finally {
			(globalThis as Record<string, unknown>).XMLSerializer = originalXMLSerializer;
			(globalThis as Record<string, unknown>).Blob = originalBlob;
			(globalThis as Record<string, unknown>).URL = originalURL;
			(globalThis as Record<string, unknown>).Image = originalImage;
		}
	});

	test('continues rendering when SVG canvas context is unavailable', async () => {
		const warn = vi.fn(() => {});
		const originalWarn = console.warn;
		console.warn = warn as unknown as typeof console.warn;

		const svgElement = {
			getBoundingClientRect: vi.fn(() => ({ left: 35, top: 60, width: 120, height: 90 }))
		} as unknown as SVGSVGElement;
		const container = {
			querySelectorAll: vi.fn((selector: string) => (selector === 'svg' ? [svgElement] : [])),
			clientWidth: 500,
			clientHeight: 400,
			getBoundingClientRect: vi.fn(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const drawImage = vi.fn(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({ drawImage, fillRect: vi.fn(() => {}), fillStyle: '' })),
			toDataURL: vi.fn(() => 'data:image/png;base64,svg-no-ctx')
		};
		const svgCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => null)
		};

		let createCount = 0;
		const fakeDocument = {
			createElement: vi.fn(() => {
				createCount += 1;
				return createCount === 1 ? outputCanvas : svgCanvas;
			})
		};

		const originalXMLSerializer = (globalThis as Record<string, unknown>).XMLSerializer;
		(globalThis as Record<string, unknown>).XMLSerializer = class {
			serializeToString() {
				return '<svg></svg>';
			}
		};

		try {
			const result = await withMockedDocument(fakeDocument, () =>
				captureContainer(container)
			);
			expect(result).toEqual({ success: true, dataUrl: 'data:image/png;base64,svg-no-ctx' });
			expect(warn).toHaveBeenCalledWith('Failed to convert SVG to canvas, skipping');
			expect(drawImage).not.toHaveBeenCalled();
		} finally {
			console.warn = originalWarn;
			(globalThis as Record<string, unknown>).XMLSerializer = originalXMLSerializer;
		}
	});

	test('continues rendering when SVG conversion fails', async () => {
		const warn = vi.fn(() => {});
		const originalWarn = console.warn;
		console.warn = warn as unknown as typeof console.warn;

		const svgElement = {
			getBoundingClientRect: vi.fn(() => ({ left: 35, top: 60, width: 120, height: 90 }))
		} as unknown as SVGSVGElement;
		const container = {
			querySelectorAll: vi.fn((selector: string) => (selector === 'svg' ? [svgElement] : [])),
			clientWidth: 500,
			clientHeight: 400,
			getBoundingClientRect: vi.fn(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const drawImage = vi.fn(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({ drawImage, fillRect: vi.fn(() => {}), fillStyle: '' })),
			toDataURL: vi.fn(() => 'data:image/png;base64,svg-fallback')
		};
		const fakeDocument = {
			createElement: vi.fn(() => outputCanvas)
		};

		const originalXMLSerializer = (globalThis as Record<string, unknown>).XMLSerializer;
		const originalBlob = (globalThis as Record<string, unknown>).Blob;
		const originalURL = (globalThis as Record<string, unknown>).URL;
		const originalImage = (globalThis as Record<string, unknown>).Image;

		(globalThis as Record<string, unknown>).XMLSerializer = class {
			serializeToString() {
				return '<svg></svg>';
			}
		};
		(globalThis as Record<string, unknown>).Blob = class {
			constructor(parts: unknown[], opts: unknown) {
				void parts;
				void opts;
			}
		};
		(globalThis as Record<string, unknown>).URL = {
			createObjectURL: vi.fn(() => 'blob:mock-url'),
			revokeObjectURL: vi.fn(() => {})
		};
		(globalThis as Record<string, unknown>).Image = class {
			onload?: () => void;
			onerror?: () => void;
			set src(_value: string) {
				if (this.onerror) this.onerror();
			}
		};

		try {
			const result = await withMockedDocument(fakeDocument, () =>
				captureContainer(container)
			);
			expect(result).toEqual({
				success: true,
				dataUrl: 'data:image/png;base64,svg-fallback'
			});
			expect(warn).toHaveBeenCalledWith('Failed to convert SVG to canvas, skipping');
			expect(drawImage).not.toHaveBeenCalled();
		} finally {
			console.warn = originalWarn;
			(globalThis as Record<string, unknown>).XMLSerializer = originalXMLSerializer;
			(globalThis as Record<string, unknown>).Blob = originalBlob;
			(globalThis as Record<string, unknown>).URL = originalURL;
			(globalThis as Record<string, unknown>).Image = originalImage;
		}
	});

	test('returns fallback error when non-Error is thrown', async () => {
		const container = {
			querySelectorAll: vi.fn((selector: string) =>
				selector === 'canvas' ? [createFakeCanvas()] : []
			),
			clientWidth: 400,
			clientHeight: 300,
			getBoundingClientRect: vi.fn(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const outputCanvas = {
			getContext: vi.fn(() => ({
				drawImage: vi.fn(() => {}),
				fillRect: vi.fn(() => {}),
				fillStyle: ''
			})),
			toDataURL: vi.fn(() => {
				throw 'serialization failed';
			})
		};
		const fakeDocument = {
			createElement: vi.fn(() => outputCanvas)
		};

		const result = await withMockedDocument(fakeDocument, () => captureContainer(container));

		expect(result.success).toBe(false);
		expect(result.error).toBe('Failed to capture container');
	});

	test('returns error if querySelectorAll throws', async () => {
		const container = {
			querySelectorAll: vi.fn(() => {
				throw new Error('bad container');
			})
		} as unknown as HTMLElement;

		const result = await captureContainer(container);

		expect(result.success).toBe(false);
		expect(result.error).toBe('bad container');
	});
});

describe('downloadSnapshot', () => {
	test('throws when document is not available', () => {
		const originalDocument = (globalThis as Record<string, unknown>).document;
		Reflect.deleteProperty(globalThis as Record<string, unknown>, 'document');

		try {
			expect(() => downloadSnapshot('data:image/png;base64,mock', 'test.png')).toThrow(
				'Download is only available in the browser'
			);
		} finally {
			(globalThis as Record<string, unknown>).document = originalDocument;
		}
	});

	test('clicks link directly when document.body is unavailable', () => {
		const click = vi.fn(() => {});
		const remove = vi.fn(() => {});
		const link = { href: '', download: '', style: { display: '' }, click, remove };
		const fakeDocument = {
			createElement: vi.fn(() => link),
			body: null
		};

		withMockedDocument(fakeDocument, () =>
			downloadSnapshot('data:image/png;base64,mock', 'a.png')
		);

		expect(link.href).toBe('data:image/png;base64,mock');
		expect(link.download).toBe('a.png');
		expect(click).toHaveBeenCalledTimes(1);
		expect(remove).toHaveBeenCalledTimes(0);
	});

	test('appends, clicks, and removes link when body exists', () => {
		const click = vi.fn(() => {});
		const remove = vi.fn(() => {});
		const appendChild = vi.fn(() => {});
		const link = { href: '', download: '', style: { display: '' }, click, remove };
		const fakeDocument = {
			createElement: vi.fn(() => link),
			body: { appendChild }
		};

		withMockedDocument(fakeDocument, () =>
			downloadSnapshot('data:image/jpeg;base64,mock', 'b.jpeg')
		);

		expect(appendChild).toHaveBeenCalledWith(link);
		expect(click).toHaveBeenCalledTimes(1);
		expect(remove).toHaveBeenCalledTimes(1);
	});
});

describe('SnapshotOptions type', () => {
	test('accepts valid options', () => {
		const options: SnapshotOptions = {
			format: 'png',
			quality: 0.9,
			backgroundColor: '#000000'
		};
		expect(options.format).toBe('png');
		expect(options.quality).toBe(0.9);
		expect(options.backgroundColor).toBe('#000000');
	});

	test('accepts jpeg format', () => {
		const options: SnapshotOptions = {
			format: 'jpeg',
			quality: 0.8
		};
		expect(options.format).toBe('jpeg');
	});

	test('accepts minimal options', () => {
		const options: SnapshotOptions = {};
		expect(options.format).toBeUndefined();
		expect(options.quality).toBeUndefined();
	});
});

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
		const canvas = createFakeCanvas();
		const result = await captureCanvas(canvas, { format: 'jpeg', quality: 0 });
		expect(result.success).toBe(true);
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0);
	});

	test('quality=1 is passed through for jpeg', async () => {
		const canvas = createFakeCanvas();
		await captureCanvas(canvas, { format: 'jpeg', quality: 1 });
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 1);
	});

	test('returns the exact dataUrl from canvas.toDataURL', async () => {
		const canvas = {
			toDataURL: vi.fn(() => 'data:image/png;base64,specificResult')
		} as unknown as HTMLCanvasElement;
		const result = await captureCanvas(canvas);
		expect(result.dataUrl).toBe('data:image/png;base64,specificResult');
	});

	test('success result has no error property set', async () => {
		const canvas = createFakeCanvas();
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
		const canvas1 = createFakeCanvas(200, 100);
		const canvas2 = createFakeCanvas(200, 100);
		canvas1.getBoundingClientRect = vi.fn(() => ({
			left: 0,
			top: 0,
			width: 200,
			height: 100
		})) as never;
		canvas2.getBoundingClientRect = vi.fn(() => ({
			left: 0,
			top: 100,
			width: 200,
			height: 100
		})) as never;

		const drawImage = vi.fn(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({ drawImage, fillRect: vi.fn(() => {}), fillStyle: '' })),
			toDataURL: vi.fn(() => 'data:image/png;base64,multi-canvas')
		};
		const fakeDocument = { createElement: vi.fn(() => outputCanvas) };

		const container = {
			querySelectorAll: vi.fn((selector: string) =>
				selector === 'canvas' ? [canvas1, canvas2] : []
			),
			clientWidth: 200,
			clientHeight: 200,
			getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 }))
		} as unknown as HTMLElement;

		const result = await withMockedDocument(fakeDocument, () => captureContainer(container));

		expect((result as { success: boolean }).success).toBe(true);
		// drawImage should have been called once per canvas
		expect(drawImage).toHaveBeenCalledTimes(2);
	});

	test('fills background with PNG format (not just JPEG)', async () => {
		const canvas = createFakeCanvas(100, 80);
		canvas.getBoundingClientRect = vi.fn(() => ({
			left: 0,
			top: 0,
			width: 100,
			height: 80
		})) as never;

		const fillStyle = { value: '' };
		const ctx = {
			drawImage: vi.fn(() => {}),
			fillRect: vi.fn(() => {}),
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
			getContext: vi.fn(() => ctx),
			toDataURL: vi.fn(() => 'data:image/png;base64,bg-png')
		};
		const fakeDocument = { createElement: vi.fn(() => outputCanvas) };

		const container = {
			querySelectorAll: vi.fn((selector: string) => (selector === 'canvas' ? [canvas] : [])),
			clientWidth: 100,
			clientHeight: 80,
			getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 }))
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
		const canvas = createFakeCanvas(100, 80);
		canvas.getBoundingClientRect = vi.fn(() => ({
			left: 0,
			top: 0,
			width: 100,
			height: 80
		})) as never;

		const fillRect = vi.fn(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({ drawImage: vi.fn(() => {}), fillRect, fillStyle: '' })),
			toDataURL: vi.fn(() => 'data:image/png;base64,no-bg')
		};
		const fakeDocument = { createElement: vi.fn(() => outputCanvas) };

		const container = {
			querySelectorAll: vi.fn((selector: string) => (selector === 'canvas' ? [canvas] : [])),
			clientWidth: 100,
			clientHeight: 80,
			getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 }))
		} as unknown as HTMLElement;

		await withMockedDocument(fakeDocument, () => captureContainer(container, {}));

		expect(fillRect).not.toHaveBeenCalled();
	});
});

// ── downloadSnapshot – additional cases ──────────────────────────────────────

describe('downloadSnapshot – additional cases', () => {
	test('sets display:none on the link element', async () => {
		const link = {
			href: '',
			download: '',
			style: { display: 'initial' },
			click: vi.fn(() => {}),
			remove: vi.fn(() => {})
		};
		const fakeDocument = {
			createElement: vi.fn(() => link),
			body: { appendChild: vi.fn(() => {}) }
		};

		await withMockedDocument(fakeDocument, () =>
			downloadSnapshot('data:image/png;base64,x', 'file.png')
		);

		expect(link.style.display).toBe('none');
	});

	test('sets correct href and download attributes', async () => {
		const link = {
			href: '',
			download: '',
			style: { display: '' },
			click: vi.fn(() => {}),
			remove: vi.fn(() => {})
		};
		const fakeDocument = {
			createElement: vi.fn(() => link),
			body: { appendChild: vi.fn(() => {}) }
		};

		await withMockedDocument(fakeDocument, () =>
			downloadSnapshot('data:image/jpeg;base64,abc123', 'snapshot_2024.jpeg')
		);

		expect(link.href).toBe('data:image/jpeg;base64,abc123');
		expect(link.download).toBe('snapshot_2024.jpeg');
	});

	test('removes link even when click throws', async () => {
		const remove = vi.fn(() => {});
		const link = {
			href: '',
			download: '',
			style: { display: '' },
			click: vi.fn(() => {
				throw new Error('click failed');
			}),
			remove
		};
		const fakeDocument = {
			createElement: vi.fn(() => link),
			body: { appendChild: vi.fn(() => {}) }
		};

		// withMockedDocument is async so errors surface as rejected Promises
		await expect(
			withMockedDocument(fakeDocument, () =>
				downloadSnapshot('data:image/png;base64,x', 'file.png')
			)
		).rejects.toThrow('click failed');

		// downloadSnapshot uses try/finally so remove is called despite the throw
		expect(remove).toHaveBeenCalledTimes(1);
	});
});
