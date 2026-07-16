<!--
  ArnoldCatRenderer Component
  Animated canvas visualization of Arnold's Cat Map on the discrete 2^32 torus.
  Speed is wall-clock steps/sec (not steps-per-frame).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { COLOR_PRIMARY, COLOR_MAGENTA } from '$lib/constants';
	import { clampInt } from '$lib/math-utils';
	import {
		TWO_32,
		applyArnoldCatStepInPlace,
		advanceArnoldCatSimulation,
		torusToPixel,
		torusToPixelY,
		type ArnoldCatSimState
	} from '$lib/arnold-cat';

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
		speed = $bindable(5),
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
	const MAX_FRAME_DT = 0.05;
	const MAX_STEPS_PER_FRAME = 30;

	let currentX = new Uint32Array(0);
	let currentY = new Uint32Array(0);
	let initialX = new Uint32Array(0);
	let initialY = new Uint32Array(0);
	let pointColors: string[] = [];
	let acc = 0;
	let iterationCount = 0;
	let lastTimestamp: number | null = null;
	/** Clamped length for tests / badge */
	let activePointCount = $state(0);

	let canvas: HTMLCanvasElement;
	let iterationLabel: HTMLDivElement;
	let rafId: number | null = null;
	let isUnmounted = false;
	let lastLabelUpdate = 0;
	let initialized = false;

	function seedPoints(count: number) {
		if (pointColors.length !== count) pointColors = new Array(count);
		for (let i = 0; i < count; i++) {
			const x = (Math.random() * TWO_32) >>> 0;
			const y = (Math.random() * TWO_32) >>> 0;
			currentX[i] = x;
			currentY[i] = y;
			initialX[i] = x;
			initialY[i] = y;
			pointColors[i] = interpCyanMagenta(y / TWO_32);
		}
	}

	function initDistribution(count: number) {
		const n = clampInt(count, 100, 10000);
		currentX = new Uint32Array(n);
		currentY = new Uint32Array(n);
		initialX = new Uint32Array(n);
		initialY = new Uint32Array(n);
		pointColors = new Array(n);
		seedPoints(n);
		activePointCount = n;
		iterationCount = 0;
		acc = 0;
	}

	function fillRandom() {
		const count = currentX.length;
		seedPoints(count);
		iterationCount = 0;
		acc = 0;
	}

	function doReset() {
		const count = currentX.length;
		for (let i = 0; i < count; i++) {
			currentX[i] = initialX[i];
			currentY[i] = initialY[i];
		}
		iterationCount = 0;
		acc = 0;
	}

	function doRandomize() {
		fillRandom();
	}

	function doStep() {
		applyArnoldCatStepInPlace(currentX, currentY);
		iterationCount++;
		// intentionally do not clear or change acc
	}

	function renderFrame(now: number) {
		if (isUnmounted) return;

		if (lastTimestamp === null) lastTimestamp = now;
		let frameDt = (now - lastTimestamp) / 1000;
		lastTimestamp = now;
		if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;

		const stepsPerSec = clampInt(speed, 1, 30);
		if (!paused) {
			const sim: ArnoldCatSimState = {
				xs: currentX,
				ys: currentY,
				acc,
				iterationCount,
				paused: false
			};
			advanceArnoldCatSimulation(sim, frameDt, stepsPerSec, MAX_FRAME_DT, MAX_STEPS_PER_FRAME);
			acc = sim.acc;
			iterationCount = sim.iterationCount;
		}

		if (canvas) {
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				const w = canvas.width;
				const h = canvas.height;
				for (let i = 0; i < currentX.length; i++) {
					const px = torusToPixel(currentX[i], w);
					const py = torusToPixelY(currentY[i], h);
					ctx.fillStyle = pointColors[i];
					ctx.fillRect(px, py, 1, 1);
				}

				if (now - lastLabelUpdate > 100) {
					if (iterationLabel) {
						// eslint-disable-next-line svelte/no-dom-manipulating
						iterationLabel.textContent = `ITERATION: ${iterationCount}`;
					}
					lastLabelUpdate = now;
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
		if (paused) doStep();
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
		data-testid="iteration-label"
		class="absolute top-4 left-4 text-xs font-['Rajdhani'] text-primary/60 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		ITERATION: 0
	</div>
	<span data-testid="point-count" class="sr-only">{activePointCount}</span>
</div>
