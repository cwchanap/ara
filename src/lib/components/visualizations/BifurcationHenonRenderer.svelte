<!--
  BifurcationHenonRenderer Component - Canvas visualization for Henon Bifurcation diagram
-->
<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		aMin?: number;
		aMax?: number;
		b?: number;
		maxIterations?: number;
		height?: number;
	}

	let {
		aMin = $bindable(1.04),
		aMax = $bindable(1.1),
		b = $bindable(0.3),
		maxIterations = $bindable(1000),
		height = 400
	}: Props = $props();

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let isRendering = false;
	let canvasWidth = $state(0);
	let canvasHeight = $state(0);

	const updateCanvasSize = () => {
		if (!container) return;
		const nextWidth = Math.max(0, Math.floor(container.clientWidth));
		const nextHeight = Math.max(0, Math.floor(height - 32));
		if (nextWidth !== canvasWidth) canvasWidth = nextWidth;
		if (nextHeight !== canvasHeight) canvasHeight = nextHeight;
		if (canvas) {
			if (canvas.width !== nextWidth) canvas.width = nextWidth;
			if (canvas.height !== nextHeight) canvas.height = nextHeight;
		}
	};

	function render() {
		if (!canvas || isRendering) return;
		isRendering = true;

		const imgWidth = canvas.width;
		const imgHeight = canvas.height;
		if (imgWidth <= 0 || imgHeight <= 0) {
			isRendering = false;
			return;
		}
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			isRendering = false;
			return;
		}

		ctx.clearRect(0, 0, imgWidth, imgHeight);
		ctx.fillStyle = 'rgba(188, 19, 254, 0.4)';

		const widthDenominator = Math.max(imgWidth - 1, 1);
		for (let i = 0; i < imgWidth; i++) {
			const a = aMin + (aMax - aMin) * (i / widthDenominator);
			let x = 0;
			let y = 0;

			for (let j = 0; j < 100; j++) {
				const xNew = y + 1 - a * x * x;
				const yNew = b * x;
				x = xNew;
				y = yNew;
			}

			for (let j = 0; j < maxIterations; j++) {
				const xNew = y + 1 - a * x * x;
				const yNew = b * x;
				const plotY = Math.floor(-xNew * (imgHeight / 3) + imgHeight / 2);
				if (plotY >= 0 && plotY < imgHeight) {
					ctx.fillRect(i, plotY, 1, 1);
				}
				x = xNew;
				y = yNew;
			}
		}
		isRendering = false;
	}

	onMount(() => {
		updateCanvasSize();
		const resizeObserver = new ResizeObserver(() => {
			updateCanvasSize();
			render();
		});
		if (container) {
			resizeObserver.observe(container);
		}
		return () => {
			resizeObserver.disconnect();
		};
	});

	$effect(() => {
		void aMin;
		void aMax;
		void b;
		void maxIterations;
		void height;
		updateCanvasSize();
		if (canvas) render();
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative p-4"
	style="height: {height}px;"
>
	<canvas bind:this={canvas} width={canvasWidth} height={canvasHeight} class="w-full h-full block"
	></canvas>
	<div
		class="absolute top-4 right-4 text-xs font-mono text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // CANVAS_2D
	</div>
</div>
