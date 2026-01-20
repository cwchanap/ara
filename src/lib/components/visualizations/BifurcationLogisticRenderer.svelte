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

	function render() {
		if (!canvas || isRendering) return;
		isRendering = true;

		const imgWidth = canvas.width;
		const imgHeight = canvas.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			isRendering = false;
			return;
		}

		ctx.clearRect(0, 0, imgWidth, imgHeight);
		ctx.fillStyle = 'rgba(255, 80, 0, 0.3)';

		for (let i = 0; i < imgWidth; i++) {
			const denom = Math.max(1, imgWidth - 1);
			const r = rMin + (rMax - rMin) * (i / denom);
			let x = 0.5;

			for (let j = 0; j < 100; j++) {
				x = r * x * (1 - x);
			}

			for (let j = 0; j < maxIterations; j++) {
				x = r * x * (1 - x);
				const y = Math.floor(x * imgHeight);
				if (y >= 0 && y < imgHeight) {
					ctx.fillRect(i, imgHeight - y - 1, 1, 1);
				}
			}
		}
		isRendering = false;
	}

	$effect(() => {
		void rMin;
		void rMax;
		void maxIterations;
		if (canvas) render();
	});
</script>

<div
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative p-4"
	style="height: {height}px;"
>
	<canvas bind:this={canvas} width={800} height={height - 32} class="w-full h-full block"></canvas>
	<div
		class="absolute top-4 right-4 text-xs font-mono text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // CANVAS_2D
	</div>
</div>
