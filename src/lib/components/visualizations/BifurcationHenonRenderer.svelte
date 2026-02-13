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
		containerElement?: HTMLDivElement;
	}

	let {
		aMin = $bindable(1.04),
		aMax = $bindable(1.1),
		b = $bindable(0.3),
		maxIterations = $bindable(1000),
		height = 400,
		containerElement = $bindable()
	}: Props = $props();

	let container: HTMLDivElement;

	// Sync internal container ref to bindable prop
	$effect(() => {
		containerElement = container;
	});
	let canvas: HTMLCanvasElement;
	let isRendering = false;
	let canvasWidth = $state(0);
	let canvasHeight = $state(0);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let pendingRender = false;
	let renderFrame: number | null = null;

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

		const localAMin = aMin;
		const localAMax = aMax;
		const localB = b;
		const localMaxIterations = maxIterations;

		ctx.clearRect(0, 0, imgWidth, imgHeight);
		ctx.fillStyle = 'rgba(188, 19, 254, 0.4)';

		const widthDenominator = Math.max(imgWidth - 1, 1);
		const columnsPerChunk = Math.max(1, Math.floor(imgWidth / 20));
		let column = 0;

		const drawChunk = () => {
			if (!isRendering) return;
			const end = Math.min(column + columnsPerChunk, imgWidth);
			for (let i = column; i < end; i++) {
				const a = localAMin + (localAMax - localAMin) * (i / widthDenominator);
				let x = 0;
				let y = 0;

				for (let j = 0; j < 100; j++) {
					const xNew = y + 1 - a * x * x;
					const yNew = localB * x;
					x = xNew;
					y = yNew;
				}

				for (let j = 0; j < localMaxIterations; j++) {
					const xNew = y + 1 - a * x * x;
					const yNew = localB * x;
					const plotY = Math.floor(-xNew * (imgHeight / 3) + imgHeight / 2);
					if (plotY >= 0 && plotY < imgHeight) {
						ctx.fillRect(i, plotY, 1, 1);
					}
					x = xNew;
					y = yNew;
				}
			}

			column = end;
			if (column < imgWidth) {
				renderFrame = requestAnimationFrame(drawChunk);
				return;
			}

			isRendering = false;
			renderFrame = null;
			if (pendingRender) {
				pendingRender = false;
				scheduleRender();
			}
		};

		drawChunk();
	}

	function scheduleRender() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			if (isRendering) {
				pendingRender = true;
				return;
			}
			render();
		}, 100);
	}

	onMount(() => {
		updateCanvasSize();
		const resizeObserver = new ResizeObserver(() => {
			updateCanvasSize();
			scheduleRender();
		});
		if (container) {
			resizeObserver.observe(container);
		}
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			if (renderFrame !== null) cancelAnimationFrame(renderFrame);
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
		if (canvas) scheduleRender();
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
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // CANVAS_2D
	</div>
</div>
