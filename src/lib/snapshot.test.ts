/**
 * Snapshot Utility Tests
 *
 * Note: Tests for DOM-dependent functions (captureContainer, downloadSnapshot)
 * are limited since Bun's test environment doesn't have a full DOM.
 * Those functions are tested via E2E/integration tests in the browser.
 */
import { describe, expect, test, mock } from 'bun:test';
import { captureCanvas, generateFilename, type SnapshotOptions } from './snapshot';

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
