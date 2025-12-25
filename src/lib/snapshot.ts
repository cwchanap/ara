/**
 * Snapshot Utility Module
 *
 * Provides functions to capture 2D visualizations (Canvas/SVG) as images
 * and download them. Designed to be reusable across different chaos map pages.
 */

export interface SnapshotOptions {
	/** Image format: 'png' or 'jpeg' */
	format?: 'png' | 'jpeg';
	/** Quality for JPEG (0-1), ignored for PNG */
	quality?: number;
	/** Background color (useful for transparent canvases) */
	backgroundColor?: string;
}

export interface SnapshotResult {
	success: boolean;
	dataUrl?: string;
	error?: string;
}

/**
 * Generates a filename for the snapshot with timestamp
 */
export function generateFilename(mapType: string, extension: string = 'png'): string {
	const now = new Date();
	const timestamp = now.toISOString().replace(/[T]/g, '_').replace(/[:.]/g, '-').slice(0, 19);
	return `${mapType}_${timestamp}.${extension}`;
}

/**
 * Captures a canvas element as a data URL
 */
export async function captureCanvas(
	canvas: HTMLCanvasElement,
	options: SnapshotOptions = {}
): Promise<SnapshotResult> {
	if (!canvas) {
		return { success: false, error: 'No canvas element provided' };
	}

	try {
		const { format = 'png', quality = 1 } = options;
		const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
		const dataUrl = canvas.toDataURL(mimeType, quality);

		return { success: true, dataUrl };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : 'Failed to capture canvas'
		};
	}
}

/**
 * Converts an SVG element to a canvas for capture
 */
async function svgToCanvas(
	svg: SVGSVGElement,
	width: number,
	height: number
): Promise<HTMLCanvasElement> {
	return new Promise((resolve, reject) => {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');

		if (!ctx) {
			reject(new Error('Failed to get canvas context'));
			return;
		}

		// Serialize SVG to string
		const serializer = new XMLSerializer();
		const svgString = serializer.serializeToString(svg);

		// Create blob and image
		const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(svgBlob);
		const img = new Image();

		img.onload = () => {
			ctx.drawImage(img, 0, 0);
			URL.revokeObjectURL(url);
			resolve(canvas);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load SVG as image'));
		};

		img.src = url;
	});
}

/**
 * Captures a container element that may contain canvas and/or SVG elements.
 * Composites them onto a single canvas for export.
 */
export async function captureContainer(
	container: HTMLDivElement,
	options: SnapshotOptions = {}
): Promise<SnapshotResult> {
	if (!container) {
		return { success: false, error: 'No container element provided' };
	}

	try {
		const { format = 'png', quality = 1, backgroundColor } = options;

		// Find canvas and SVG elements
		const canvasElements = container.querySelectorAll('canvas');
		const svgElements = container.querySelectorAll('svg');

		if (canvasElements.length === 0 && svgElements.length === 0) {
			return { success: false, error: 'No capturable content found in container' };
		}

		const width = container.clientWidth;
		const height = container.clientHeight;

		// Create output canvas
		const outputCanvas = document.createElement('canvas');
		outputCanvas.width = width;
		outputCanvas.height = height;
		const ctx = outputCanvas.getContext('2d');

		if (!ctx) {
			return { success: false, error: 'Failed to create output canvas context' };
		}

		// Fill background if specified
		if (backgroundColor) {
			ctx.fillStyle = backgroundColor;
			ctx.fillRect(0, 0, width, height);
		}

		// Draw canvas elements (they're typically positioned behind SVG for axes)
		for (const canvas of canvasElements) {
			const rect = canvas.getBoundingClientRect();
			const containerRect = container.getBoundingClientRect();
			const x = rect.left - containerRect.left;
			const y = rect.top - containerRect.top;
			ctx.drawImage(canvas, x, y);
		}

		// Draw SVG elements on top
		for (const svg of svgElements) {
			try {
				const rect = svg.getBoundingClientRect();
				const containerRect = container.getBoundingClientRect();
				const x = rect.left - containerRect.left;
				const y = rect.top - containerRect.top;
				const svgCanvas = await svgToCanvas(svg, rect.width, rect.height);
				ctx.drawImage(svgCanvas, x, y);
			} catch {
				// Continue if SVG conversion fails - still capture what we can
				console.warn('Failed to convert SVG to canvas, skipping');
			}
		}

		const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
		const dataUrl = outputCanvas.toDataURL(mimeType, quality);

		return { success: true, dataUrl };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : 'Failed to capture container'
		};
	}
}

/**
 * Triggers a download of the snapshot
 */
export function downloadSnapshot(dataUrl: string, filename: string): void {
	const link = document.createElement('a');
	link.href = dataUrl;
	link.download = filename;
	link.click();
}
