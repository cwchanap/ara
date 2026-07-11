<!--
  BakersMapRenderer Component
  Animated canvas visualization of the Baker's Map stretch/cut/stack mixing.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { COLOR_PRIMARY, COLOR_MAGENTA } from '$lib/constants';
	import { clampInt } from '$lib/math-utils';

	interface Props {
		height?: number;
		containerElement?: HTMLDivElement;
		pointCount?: number;
		speed?: number;
		paused?: boolean;
		resetSignal?: number;
		randomizeSignal?: number;
		stepSignal?: number;
	}

	let {
		height = 600,
		containerElement = $bindable(),
		pointCount = $bindable(3000),
		speed = $bindable(1),
		paused = $bindable(false),
		resetSignal = 0,
		randomizeSignal = 0,
		stepSignal = 0
	}: Props = $props();

	let container = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		containerElement = container;
	});

	const interpCyanMagenta = d3.interpolate(COLOR_PRIMARY, COLOR_MAGENTA);
	const MAX_ITERATIONS = 50;

	let currentX = new Float64Array(0);
	let currentY = new Float64Array(0);
	let initialX = new Float64Array(0);
	let initialY = new Float64Array(0);
	let iterationCount = 0;

	let canvas: HTMLCanvasElement;
	let iterationLabel: HTMLDivElement;
	let rafId: number | null = null;
	let isUnmounted = false;
	let lastLabelUpdate = 0;
	let initialized = false;

	function initDistribution(count: number) {
		currentX = new Float64Array(count);
		currentY = new Float64Array(count);
		initialX = new Float64Array(count);
		initialY = new Float64Array(count);
		for (let i = 0; i < count; i++) {
			const x = Math.random();
			const y = Math.random();
			currentX[i] = x;
			currentY[i] = y;
			initialX[i] = x;
			initialY[i] = y;
		}
		iterationCount = 0;
	}

	function fillRandom() {
		const count = currentX.length;
		for (let i = 0; i < count; i++) {
			const x = Math.random();
			const y = Math.random();
			currentX[i] = x;
			currentY[i] = y;
			initialX[i] = x;
			initialY[i] = y;
		}
		iterationCount = 0;
	}

	function applyStep() {
		const count = currentX.length;
		for (let i = 0; i < count; i++) {
			const x = currentX[i];
			const y = currentY[i];
			const doubled = 2 * x;
			if (doubled < 1) {
				currentX[i] = doubled;
				currentY[i] = y / 2;
			} else {
				currentX[i] = doubled - 1;
				currentY[i] = (y + 1) / 2;
			}
		}
		iterationCount++;
		if (iterationCount >= MAX_ITERATIONS) {
			fillRandom();
		}
	}

	function doReset() {
		const count = currentX.length;
		for (let i = 0; i < count; i++) {
			currentX[i] = initialX[i];
			currentY[i] = initialY[i];
		}
		iterationCount = 0;
	}

	function doRandomize() {
		fillRandom();
	}

	function renderFrame(timestamp: number) {
		if (isUnmounted) return;

		if (canvas) {
			const ctx = canvas.getContext('2d');
			if (ctx) {
				if (!paused) {
					const steps = clampInt(speed, 1, 10);
					for (let s = 0; s < steps; s++) {
						applyStep();
					}
				}

				ctx.clearRect(0, 0, canvas.width, canvas.height);
				const w = canvas.width;
				const h = canvas.height;
				for (let i = 0; i < currentX.length; i++) {
					const px = currentX[i] * w;
					const py = (1 - currentY[i]) * h;
					ctx.fillStyle = interpCyanMagenta(initialY[i]);
					ctx.fillRect(px, py, 1, 1);
				}

				if (timestamp - lastLabelUpdate > 100) {
					if (iterationLabel) {
						// eslint-disable-next-line svelte/no-dom-manipulating
						iterationLabel.textContent = `ITERATION: ${iterationCount}`;
					}
					lastLabelUpdate = timestamp;
				}
			}
		}

		rafId = requestAnimationFrame(renderFrame);
	}

	function updateCanvasSize() {
		if (!container || !canvas) return;
		const nextWidth = Math.max(0, Math.floor(container.clientWidth));
		const nextHeight = Math.max(0, Math.floor(height - 32));
		if (canvas.width !== nextWidth) canvas.width = nextWidth;
		if (canvas.height !== nextHeight) canvas.height = nextHeight;
	}

	// Signal effects — skip initial run (Svelte $effect fires on mount)
	let prevReset = resetSignal;
	$effect(() => {
		if (resetSignal === prevReset) return;
		prevReset = resetSignal;
		doReset();
	});

	let prevRandomize = randomizeSignal;
	$effect(() => {
		if (randomizeSignal === prevRandomize) return;
		prevRandomize = randomizeSignal;
		doRandomize();
	});

	let prevStep = stepSignal;
	$effect(() => {
		if (stepSignal === prevStep) return;
		prevStep = stepSignal;
		if (paused) applyStep();
	});

	// Reinitialize when pointCount changes (skip initial — onMount handles it)
	$effect(() => {
		void pointCount;
		if (!initialized) return;
		const clamped = clampInt(pointCount, 100, 10000);
		initDistribution(clamped);
	});

	onMount(() => {
		const clampedCount = clampInt(pointCount, 100, 10000);
		initDistribution(clampedCount);
		initialized = true;
		updateCanvasSize();
		const resizeObserver = new ResizeObserver(() => updateCanvasSize());
		if (container) resizeObserver.observe(container);
		rafId = requestAnimationFrame(renderFrame);
		return () => {
			isUnmounted = true;
			if (rafId !== null) cancelAnimationFrame(rafId);
			resizeObserver.disconnect();
		};
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative p-4"
	style="height: {height}px;"
>
	<canvas bind:this={canvas} class="w-full h-full block"></canvas>
	<div
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // CANVAS_2D
	</div>
	<div
		bind:this={iterationLabel}
		class="absolute top-4 left-4 text-xs font-['Rajdhani'] text-primary/60 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		ITERATION: 0
	</div>
</div>
