import { describe, expect, it, vi } from 'vitest';
import { generateFilename, downloadSnapshot, captureCanvas, captureContainer } from './snapshot';

describe('generateFilename', () => {
	it('returns a string', () => {
		const filename = generateFilename('lorenz');
		expect(typeof filename).toBe('string');
	});

	it('starts with the mapType', () => {
		const filename = generateFilename('lorenz');
		expect(filename.startsWith('lorenz_')).toBe(true);
	});

	it('ends with .png by default', () => {
		const filename = generateFilename('lorenz');
		expect(filename.endsWith('.png')).toBe(true);
	});

	it('ends with the specified extension', () => {
		const filename = generateFilename('lorenz', 'jpeg');
		expect(filename.endsWith('.jpeg')).toBe(true);
	});

	it('includes a timestamp in YYYY-MM-DD format', () => {
		const filename = generateFilename('lorenz');
		// Matches: lorenz_YYYY-MM-DD_HH-MM-SS.png
		expect(filename).toMatch(/lorenz_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png/);
	});

	it('works for different map types', () => {
		const types = ['rossler', 'henon', 'lozi', 'logistic', 'standard'];
		for (const type of types) {
			const filename = generateFilename(type);
			expect(filename.startsWith(`${type}_`)).toBe(true);
		}
	});
});

describe('captureCanvas', () => {
	it('returns failure when canvas is null', async () => {
		const result = await captureCanvas(null as unknown as HTMLCanvasElement);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it('returns success with dataUrl for a valid canvas (mocked toDataURL)', async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 100;
		canvas.height = 100;
		// jsdom doesn't implement toDataURL fully; mock it
		vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mockdata');
		const result = await captureCanvas(canvas);
		expect(result.success).toBe(true);
		expect(result.dataUrl).toBe('data:image/png;base64,mockdata');
	});

	it('uses png mime type by default', async () => {
		const canvas = document.createElement('canvas');
		vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
		const result = await captureCanvas(canvas);
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/png', 1);
		expect(result.success).toBe(true);
	});

	it('uses jpeg mime type when format is jpeg', async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 100;
		canvas.height = 100;
		vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,mock');
		const result = await captureCanvas(canvas, { format: 'jpeg' });
		expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 1);
		expect(result.success).toBe(true);
	});

	it('returns error when canvas.toDataURL throws', async () => {
		const canvas = document.createElement('canvas');
		vi.spyOn(canvas, 'toDataURL').mockImplementation(() => {
			throw new Error('Security error');
		});
		const result = await captureCanvas(canvas);
		expect(result.success).toBe(false);
		expect(result.error).toContain('Security error');
	});
});

describe('captureContainer', () => {
	it('returns failure when container is null', async () => {
		const result = await captureContainer(null as unknown as HTMLElement);
		expect(result.success).toBe(false);
		expect(result.error).toContain('No container element provided');
	});

	it('returns failure when container has no canvas or SVG elements', async () => {
		const container = document.createElement('div');
		container.innerHTML = '<p>No canvas here</p>';
		const result = await captureContainer(container);
		expect(result.success).toBe(false);
		expect(result.error).toContain('No capturable content found');
	});

	it('returns success when container has a canvas element', async () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		canvas.width = 100;
		canvas.height = 100;
		container.appendChild(canvas);

		// Mock getContext on the output canvas (created internally)
		const mockCtx = {
			fillStyle: '',
			fillRect: vi.fn(),
			drawImage: vi.fn()
		};
		const originalCreate = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			const el = originalCreate(tag);
			if (tag === 'canvas') {
				vi.spyOn(el as HTMLCanvasElement, 'getContext').mockReturnValue(
					mockCtx as unknown as CanvasRenderingContext2D
				);
				vi.spyOn(el as HTMLCanvasElement, 'toDataURL').mockReturnValue(
					'data:image/png;base64,mock'
				);
			}
			return el;
		});

		const result = await captureContainer(container);

		expect(result.success).toBe(true);
		expect(result.dataUrl).toBe('data:image/png;base64,mock');

		vi.restoreAllMocks();
	});

	it('fills background when backgroundColor option is provided', async () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		container.appendChild(canvas);

		const mockCtx = {
			fillStyle: '',
			fillRect: vi.fn(),
			drawImage: vi.fn()
		};
		const originalCreate = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			const el = originalCreate(tag);
			if (tag === 'canvas') {
				vi.spyOn(el as HTMLCanvasElement, 'getContext').mockReturnValue(
					mockCtx as unknown as CanvasRenderingContext2D
				);
				vi.spyOn(el as HTMLCanvasElement, 'toDataURL').mockReturnValue(
					'data:image/png;base64,mock'
				);
			}
			return el;
		});

		await captureContainer(container, { backgroundColor: '#000000' });

		expect(mockCtx.fillRect).toHaveBeenCalled();

		vi.restoreAllMocks();
	});

	it('returns failure when getContext returns null', async () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		container.appendChild(canvas);

		const originalCreate = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			const el = originalCreate(tag);
			if (tag === 'canvas') {
				vi.spyOn(el as HTMLCanvasElement, 'getContext').mockReturnValue(null);
			}
			return el;
		});

		const result = await captureContainer(container);
		expect(result.success).toBe(false);
		expect(result.error).toContain('Failed to create output canvas context');

		vi.restoreAllMocks();
	});
});

describe('downloadSnapshot', () => {
	it('creates anchor and clicks in jsdom when document is available', () => {
		// This is expected to not throw in jsdom since document is available
		// Just verifying it creates an anchor element and calls click
		const clickSpy = vi.fn();
		const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
			(el as HTMLAnchorElement).click = clickSpy;
			return el;
		});
		const removeSpy = vi
			.spyOn(HTMLAnchorElement.prototype, 'remove')
			.mockImplementation(() => {});

		downloadSnapshot('data:image/png;base64,abc', 'test.png');

		expect(clickSpy).toHaveBeenCalled();

		appendSpy.mockRestore();
		removeSpy.mockRestore();
	});

	it('sets the correct href and download attributes', () => {
		const createdLinks: HTMLAnchorElement[] = [];
		const originalCreate = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			const el = originalCreate(tag);
			if (tag === 'a') {
				createdLinks.push(el as HTMLAnchorElement);
				(el as HTMLAnchorElement).click = vi.fn();
			}
			return el;
		});

		downloadSnapshot('data:image/png;base64,testdata', 'my-snapshot.png');

		const link = createdLinks[createdLinks.length - 1];
		expect(link?.href).toContain('data:image/png');
		expect(link?.download).toBe('my-snapshot.png');

		vi.restoreAllMocks();
	});
});
