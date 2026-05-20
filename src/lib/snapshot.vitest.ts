import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { captureCanvas, captureContainer, downloadSnapshot, generateFilename } from './snapshot';

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
		vi.setSystemTime(date);
		const result = generateFilename('test');
		expect(result).toBe('test_2025-01-05_03-07-09.png');
		vi.useRealTimers();
	});

	it('handles double-digit values without extra padding', () => {
		const date = new Date(2025, 10, 12, 14, 30, 45);
		vi.useFakeTimers();
		vi.setSystemTime(date);
		const result = generateFilename('test');
		expect(result).toBe('test_2025-11-12_14-30-45.png');
		vi.useRealTimers();
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
