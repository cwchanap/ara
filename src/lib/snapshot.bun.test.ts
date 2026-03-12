/**
 * Snapshot Utility Tests
 */
import { describe, expect, test, mock } from 'bun:test';
import {
	captureCanvas,
	captureContainer,
	downloadSnapshot,
	generateFilename,
	type SnapshotOptions
} from './snapshot';

// Mock canvas for testing
function createMockCanvas(width = 600, height = 400): HTMLCanvasElement {
	const canvas = {
		width,
		height,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		toDataURL: mock((type?: string, quality?: number) => {
			return `data:${type || 'image/png'};base64,mockImageData`;
		}),
		getContext: mock((contextId: string) => {
			if (contextId === '2d') {
				return {
					drawImage: mock(() => {}),
					fillRect: mock(() => {}),
					fillStyle: '',
					canvas: { width, height }
				} as unknown as CanvasRenderingContext2D;
			}
			return null;
		}),
		getBoundingClientRect: mock(() => ({
			width,
			height,
			top: 0,
			left: 0,
			right: width,
			bottom: height
		}))
	} as unknown as HTMLCanvasElement;
	return canvas;
}

function withMockedDocument<T>(doc: unknown, run: () => T): T {
	const originalDocument = (globalThis as Record<string, unknown>).document;
	(globalThis as Record<string, unknown>).document = doc;
	try {
		return run();
	} finally {
		(globalThis as Record<string, unknown>).document = originalDocument;
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
		const canvas = createMockCanvas();
		const result = await captureCanvas(canvas);

		expect(result.success).toBe(true);
		expect(result.dataUrl).toMatch(/^data:image\/png/);
	});

	test('respects format option for jpeg', async () => {
		const canvas = createMockCanvas();
		const result = await captureCanvas(canvas, { format: 'jpeg' });

		expect(result.success).toBe(true);
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', expect.any(Number));
	});

	test('respects quality option', async () => {
		const canvas = createMockCanvas();
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
		const canvas = createMockCanvas();
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
			toDataURL: mock(() => {
				throw new Error('tainted canvas');
			})
		} as unknown as HTMLCanvasElement;

		const result = await captureCanvas(canvas);

		expect(result.success).toBe(false);
		expect(result.error).toBe('tainted canvas');
	});

	test('returns fallback error when canvas throws non-Error value', async () => {
		const canvas = {
			toDataURL: mock(() => {
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
			querySelectorAll: mock(() => []),
			clientWidth: 400,
			clientHeight: 300
		} as unknown as HTMLElement;

		const result = await captureContainer(container);

		expect(result.success).toBe(false);
		expect(result.error).toBe('No capturable content found in container');
	});

	test('returns error if output canvas context cannot be created', async () => {
		const container = {
			querySelectorAll: mock((selector: string) =>
				selector === 'canvas' ? [createMockCanvas()] : []
			),
			clientWidth: 400,
			clientHeight: 300,
			getBoundingClientRect: mock(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const fakeDocument = {
			createElement: mock(() => ({
				getContext: mock(() => null)
			}))
		};

		const result = await withMockedDocument(fakeDocument, () => captureContainer(container));

		expect(result.success).toBe(false);
		expect(result.error).toBe('Failed to create output canvas context');
	});

	test('captures canvas layers and returns output data URL', async () => {
		const sourceCanvas = createMockCanvas(100, 80);
		sourceCanvas.getBoundingClientRect = mock(() => ({
			left: 30,
			top: 45,
			width: 100,
			height: 80
		})) as never;

		const container = {
			querySelectorAll: mock((selector: string) =>
				selector === 'canvas' ? [sourceCanvas] : []
			),
			clientWidth: 500,
			clientHeight: 400,
			getBoundingClientRect: mock(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const drawImage = mock(() => {});
		const fillRect = mock(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: mock(() => ({ drawImage, fillRect, fillStyle: '' })),
			toDataURL: mock(() => 'data:image/png;base64,composite')
		};
		const fakeDocument = {
			createElement: mock(() => outputCanvas)
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
			getBoundingClientRect: mock(() => ({ left: 35, top: 60, width: 120, height: 90 }))
		} as unknown as SVGSVGElement;
		const container = {
			querySelectorAll: mock((selector: string) => (selector === 'svg' ? [svgElement] : [])),
			clientWidth: 500,
			clientHeight: 400,
			getBoundingClientRect: mock(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const drawImage = mock(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: mock(() => ({ drawImage, fillRect: mock(() => {}), fillStyle: '' })),
			toDataURL: mock(() => 'data:image/png;base64,svg-composite')
		};

		const svgDrawImage = mock(() => {});
		const svgCanvas = {
			width: 120,
			height: 90,
			getContext: mock(() => ({ drawImage: svgDrawImage }))
		} as unknown as HTMLCanvasElement;

		let createCount = 0;
		const fakeDocument = {
			createElement: mock(() => {
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
			createObjectURL: mock(() => 'blob:mock-url'),
			revokeObjectURL: mock(() => {})
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
		const warn = mock(() => {});
		const originalWarn = console.warn;
		console.warn = warn as unknown as typeof console.warn;

		const svgElement = {
			getBoundingClientRect: mock(() => ({ left: 35, top: 60, width: 120, height: 90 }))
		} as unknown as SVGSVGElement;
		const container = {
			querySelectorAll: mock((selector: string) => (selector === 'svg' ? [svgElement] : [])),
			clientWidth: 500,
			clientHeight: 400,
			getBoundingClientRect: mock(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const drawImage = mock(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: mock(() => ({ drawImage, fillRect: mock(() => {}), fillStyle: '' })),
			toDataURL: mock(() => 'data:image/png;base64,svg-no-ctx')
		};
		const svgCanvas = {
			width: 0,
			height: 0,
			getContext: mock(() => null)
		};

		let createCount = 0;
		const fakeDocument = {
			createElement: mock(() => {
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
		const warn = mock(() => {});
		const originalWarn = console.warn;
		console.warn = warn as unknown as typeof console.warn;

		const svgElement = {
			getBoundingClientRect: mock(() => ({ left: 35, top: 60, width: 120, height: 90 }))
		} as unknown as SVGSVGElement;
		const container = {
			querySelectorAll: mock((selector: string) => (selector === 'svg' ? [svgElement] : [])),
			clientWidth: 500,
			clientHeight: 400,
			getBoundingClientRect: mock(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const drawImage = mock(() => {});
		const outputCanvas = {
			width: 0,
			height: 0,
			getContext: mock(() => ({ drawImage, fillRect: mock(() => {}), fillStyle: '' })),
			toDataURL: mock(() => 'data:image/png;base64,svg-fallback')
		};
		const fakeDocument = {
			createElement: mock(() => outputCanvas)
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
			createObjectURL: mock(() => 'blob:mock-url'),
			revokeObjectURL: mock(() => {})
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
			querySelectorAll: mock((selector: string) =>
				selector === 'canvas' ? [createMockCanvas()] : []
			),
			clientWidth: 400,
			clientHeight: 300,
			getBoundingClientRect: mock(() => ({ left: 10, top: 20 }))
		} as unknown as HTMLElement;

		const outputCanvas = {
			getContext: mock(() => ({
				drawImage: mock(() => {}),
				fillRect: mock(() => {}),
				fillStyle: ''
			})),
			toDataURL: mock(() => {
				throw 'serialization failed';
			})
		};
		const fakeDocument = {
			createElement: mock(() => outputCanvas)
		};

		const result = await withMockedDocument(fakeDocument, () => captureContainer(container));

		expect(result.success).toBe(false);
		expect(result.error).toBe('Failed to capture container');
	});

	test('returns error if querySelectorAll throws', async () => {
		const container = {
			querySelectorAll: mock(() => {
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
		const click = mock(() => {});
		const remove = mock(() => {});
		const link = { href: '', download: '', style: { display: '' }, click, remove };
		const fakeDocument = {
			createElement: mock(() => link),
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
		const click = mock(() => {});
		const remove = mock(() => {});
		const appendChild = mock(() => {});
		const link = { href: '', download: '', style: { display: '' }, click, remove };
		const fakeDocument = {
			createElement: mock(() => link),
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
