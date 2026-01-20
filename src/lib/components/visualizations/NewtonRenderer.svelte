<!--
  NewtonRenderer Component - Canvas visualization for Newton fractal
-->
<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		xMin?: number;
		xMax?: number;
		yMin?: number;
		yMax?: number;
		maxIterations?: number;
		height?: number;
	}

	let {
		xMin = $bindable(-2),
		xMax = $bindable(2),
		yMin = $bindable(-2),
		yMax = $bindable(2),
		maxIterations = $bindable(50),
		height = 500
	}: Props = $props();

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let isRendering = false;

	// Newton fractal for z^3 - 1 = 0
	function render() {
		if (!canvas || isRendering) return;
		isRendering = true;

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			isRendering = false;
			return;
		}

		const width = canvas.width;
		const h = canvas.height;

		const imageData = ctx.createImageData(width, h);
		const data = imageData.data;

		// Roots of z^3 - 1 = 0
		const roots = [
			{ re: 1, im: 0 },
			{ re: -0.5, im: Math.sqrt(3) / 2 },
			{ re: -0.5, im: -Math.sqrt(3) / 2 }
		];
		const colors = [
			[0, 243, 255], // Cyan
			[188, 19, 254], // Magenta
			[59, 130, 246] // Blue
		];

		for (let py = 0; py < h; py++) {
			for (let px = 0; px < width; px++) {
				let zRe = xMin + (px / width) * (xMax - xMin);
				let zIm = yMax - (py / h) * (yMax - yMin);

				let iter = 0;
				for (; iter < maxIterations; iter++) {
					// f(z) = z^3 - 1, f'(z) = 3z^2
					// Newton: z = z - f(z)/f'(z) = z - (z^3 - 1)/(3z^2)
					const z2Re = zRe * zRe - zIm * zIm;
					const z2Im = 2 * zRe * zIm;
					const z3Re = z2Re * zRe - z2Im * zIm;
					const z3Im = z2Re * zIm + z2Im * zRe;

					const denom = 3 * (z2Re * z2Re + z2Im * z2Im);
					if (denom < 1e-10) {
						// Set fallback color before breaking
						iter = maxIterations;
						const idx = (py * width + px) * 4;
						data[idx] = data[idx + 1] = data[idx + 2] = 0;
						data[idx + 3] = 255;
						break;
					}

					const fRe = z3Re - 1;
					const fIm = z3Im;

					zRe = zRe - (fRe * z2Re + fIm * z2Im) / denom;
					zIm = zIm - (fIm * z2Re - fRe * z2Im) / denom;

					// Check convergence
					for (let r = 0; r < roots.length; r++) {
						const dist = Math.sqrt((zRe - roots[r].re) ** 2 + (zIm - roots[r].im) ** 2);
						if (dist < 0.001) {
							const brightness = 1 - iter / maxIterations;
							const idx = (py * width + px) * 4;
							data[idx] = colors[r][0] * brightness;
							data[idx + 1] = colors[r][1] * brightness;
							data[idx + 2] = colors[r][2] * brightness;
							data[idx + 3] = 255;
							iter = maxIterations;
							break;
						}
					}
				}

				if (iter === maxIterations) {
					const idx = (py * width + px) * 4;
					if (data[idx + 3] === 0) {
						data[idx] = data[idx + 1] = data[idx + 2] = 0;
						data[idx + 3] = 255;
					}
				}
			}
		}

		ctx.putImageData(imageData, 0, 0);
		isRendering = false;
	}

	onMount(() => {
		if (container) {
			canvas.width = container.clientWidth;
			canvas.height = height;
			render();
		}
	});

	$effect(() => {
		void xMin;
		void xMax;
		void yMin;
		void yMax;
		void maxIterations;
		if (canvas) render();
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
	style="height: {height}px;"
>
	<canvas bind:this={canvas} class="w-full h-full"></canvas>
	<div
		class="absolute top-4 right-4 text-xs font-mono text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // CANVAS
	</div>
</div>
