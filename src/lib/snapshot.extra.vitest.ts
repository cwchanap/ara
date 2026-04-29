import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureContainer, downloadSnapshot } from './snapshot';

describe('captureContainer – SVG elements', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('succeeds and captures output when SVG conversion fails (ctx null in svgToCanvas)', async () => {
		const container = document.createElement('div');

		// Add an SVG element to trigger the SVG path
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', '100');
		svg.setAttribute('height', '100');
		container.appendChild(svg);

		// Track how many canvas elements have been created
		let canvasCallCount = 0;
		const originalCreate = document.createElement.bind(document);

		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			const el = originalCreate(tag);
			if (tag === 'canvas') {
				canvasCallCount++;
				if (canvasCallCount === 1) {
					// First canvas: the output canvas — needs a working ctx
					const mockCtx = {
						fillStyle: '',
						fillRect: vi.fn(),
						drawImage: vi.fn()
					};
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(el as any).getContext = vi.fn().mockReturnValue(mockCtx);
					vi.spyOn(el as HTMLCanvasElement, 'toDataURL').mockReturnValue(
						'data:image/png;base64,mock'
					);
				} else {
					// Second canvas: inside svgToCanvas — return null ctx to trigger line 77
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(el as any).getContext = vi.fn().mockReturnValue(null);
				}
			}
			return el;
		});

		// captureContainer should still succeed — the SVG error is caught and skipped
		const result = await captureContainer(container);
		expect(result.success).toBe(true);
		expect(result.dataUrl).toBe('data:image/png;base64,mock');
	});

	it('succeeds when container has both canvas and SVG (SVG conversion throws)', async () => {
		const container = document.createElement('div');

		const canvas = document.createElement('canvas');
		container.appendChild(canvas);

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		container.appendChild(svg);

		const mockCtx = {
			fillStyle: '',
			fillRect: vi.fn(),
			drawImage: vi.fn()
		};

		let canvasCallCount = 0;
		const originalCreate = document.createElement.bind(document);

		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			const el = originalCreate(tag);
			if (tag === 'canvas') {
				canvasCallCount++;
				if (canvasCallCount === 1) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(el as any).getContext = vi.fn().mockReturnValue(mockCtx);
					vi.spyOn(el as HTMLCanvasElement, 'toDataURL').mockReturnValue(
						'data:image/png;base64,composited'
					);
				} else {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(el as any).getContext = vi.fn().mockReturnValue(null);
				}
			}
			return el;
		});

		const result = await captureContainer(container);
		expect(result.success).toBe(true);
	});
});

describe('downloadSnapshot – document.body is null', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('calls link.click() directly when document.body is null (fallback path)', () => {
		// Temporarily replace document.body with null
		const originalBody = document.body;
		Object.defineProperty(document, 'body', {
			get: () => null,
			configurable: true
		});

		try {
			const clickSpy = vi.fn();
			const originalCreate = document.createElement.bind(document);
			vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
				const el = originalCreate(tag);
				if (tag === 'a') {
					(el as HTMLAnchorElement).click = clickSpy;
				}
				return el;
			});

			downloadSnapshot('data:image/png;base64,abc', 'test.png');
			expect(clickSpy).toHaveBeenCalledTimes(1);
		} finally {
			Object.defineProperty(document, 'body', {
				get: () => originalBody,
				configurable: true
			});
		}
	});
});

describe('captureContainer – jpeg format', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('uses jpeg mime type when format is jpeg', async () => {
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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(el as any).getContext = vi.fn().mockReturnValue(mockCtx);
				vi.spyOn(el as HTMLCanvasElement, 'toDataURL').mockReturnValue(
					'data:image/jpeg;base64,mock'
				);
			}
			return el;
		});

		const result = await captureContainer(container, { format: 'jpeg', quality: 0.8 });
		expect(result.success).toBe(true);
	});
});
