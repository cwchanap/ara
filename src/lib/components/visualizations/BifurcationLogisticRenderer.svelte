<!--
  BifurcationLogisticRenderer Component - Canvas visualization for Logistic Bifurcation diagram
-->
<script lang="ts">
	interface Props {
		rMin?: number;
		rMax?: number;
		maxIterations?: number;
		height?: number;
	}

	let {
		rMin = $bindable(3.5),
		rMax = $bindable(4.0),
		maxIterations = $bindable(1000),
		height = 400
	}: Props = $props();

	let canvas: HTMLCanvasElement;
	let isRendering = false;
	let pendingRender = false;
	const canvasHeight = $derived(Math.max(1, height - 32));

	function render() {
		if (!canvas) return;
		if (isRendering) {
			pendingRender = true;
			return;
		}
		isRendering = true;

		try {
			const imgWidth = canvas.width;
			const imgHeight = canvas.height;
			if (imgWidth <= 0 || imgHeight <= 0) return;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			// Create ImageData buffer for efficient pixel manipulation
			const imageData = ctx.createImageData(imgWidth, imgHeight);
			const data = imageData.data;

			for (let i = 0; i < imgWidth; i++) {
				const denom = Math.max(1, imgWidth - 1);
				const t = i / denom;
				const rChannel = Math.round(0 + (255 - 0) * t);
				const gChannel = Math.round(243 + (0 - 243) * t);
				const bChannel = Math.round(255 + (255 - 255) * t);
				const r = rMin + (rMax - rMin) * (i / denom);
				let x = 0.5;

				for (let j = 0; j < 100; j++) {
					x = r * x * (1 - x);
				}

				for (let j = 0; j < maxIterations; j++) {
					x = r * x * (1 - x);
					const y = Math.floor(x * imgHeight);
					if (y >= 0 && y < imgHeight) {
						const row = imgHeight - y - 1;
						const pixelIndex = (row * imgWidth + i) * 4;
						// Set RGBA (cyan to magenta gradient with 0.3 opacity = ~77 alpha)
						data[pixelIndex] = rChannel;
						data[pixelIndex + 1] = gChannel;
						data[pixelIndex + 2] = bChannel;
						data[pixelIndex + 3] = 77; // A (0.3 * 255 ≈ 77)
					}
				}
			}

			// Draw the entire buffer at once
			ctx.putImageData(imageData, 0, 0);
		} finally {
			isRendering = false;
			if (pendingRender) {
				pendingRender = false;
				render();
			}
		}
	}

	$effect(() => {
		void rMin;
		void rMax;
		void maxIterations;
		void height;
		if (canvas) render();
	});
</script>

<div
	class="bg-black/40 border border-primary/30 rounded-sm overflow-hidden relative p-4 backdrop-blur-md ring-1 ring-primary/30 shadow-[0_0_25px_rgba(0,243,255,0.25),0_0_45px_rgba(255,0,255,0.15)]"
	style="height: {height}px;"
>
	<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
	<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
	<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
	<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>
	<canvas bind:this={canvas} width={800} height={canvasHeight} class="w-full h-full block"></canvas>
	<div
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/80 border border-primary/40 bg-black/60 backdrop-blur-sm px-2 py-1 pointer-events-none select-none shadow-[0_0_12px_rgba(0,243,255,0.35)]"
	>
		LIVE_RENDER // CANVAS_2D
	</div>
</div>
