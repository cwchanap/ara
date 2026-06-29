<!--
  GumowskiMiraRenderer Component - Canvas point cloud for the Gumowski–Mira map (D3 axes).
  Multi-seed compute offloads to chaosMapsWorker with a main-thread fallback.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { calculateGumowskiMiraTuples, calculateGumowskiMiraMultiSeed } from '$lib/gumowski-mira';
	import type { GumowskiMiraColorMode, GumowskiMiraRenderMode } from '$lib/types';
	import type { ChaosMapsWorkerResponse } from '$lib/workers/types';

	interface Props {
		mu?: number;
		a?: number;
		b?: number;
		x0?: number;
		y0?: number;
		iterations?: number;
		burnIn?: number;
		renderMode?: GumowskiMiraRenderMode;
		seeds?: number;
		colorMode?: GumowskiMiraColorMode;
		pointSize?: number;
		opacity?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}

	let {
		mu = $bindable(0.31),
		a = $bindable(0.008),
		b = $bindable(0.05),
		x0 = $bindable(0.1),
		y0 = $bindable(0),
		iterations = $bindable(15000),
		burnIn = $bindable(500),
		renderMode = $bindable<GumowskiMiraRenderMode>('multi'),
		seeds = $bindable(300),
		colorMode = $bindable<GumowskiMiraColorMode>('iteration'),
		pointSize = $bindable(1.5),
		opacity = $bindable(0.6),
		height = 500,
		containerElement = $bindable()
	}: Props = $props();

	let container = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		containerElement = container;
	});

	const MAX_POINTS = 200000;
	const DEBOUNCE_MS = 250;

	type Computed = {
		points: [number, number][];
		seedIndices: number[];
		maxRadius: number;
		totalSeeds: number;
	};

	let renderTimeout: ReturnType<typeof setTimeout> | null = null;
	let worker: Worker | null = null;
	let workerAvailable = false;
	let workerRequestId = 0;
	let latestWorkerRequestId = 0;
	let isComputing = false;
	let hasPendingRender = false;
	let latest: Computed | null = null;
	let isUnmounted = false;

	const interpCyanMagenta = d3.interpolate('#00f3ff', '#ff00ff');
	const interpMagentaViolet = d3.interpolate('#ff00ff', '#8a2be2');

	function colorFor(
		i: number,
		point: [number, number],
		seedIndex: number,
		total: number,
		seedCount: number,
		maxRadius: number
	): string {
		switch (colorMode) {
			case 'single':
				return '#00f3ff';
			case 'seed': {
				const t = seedCount > 1 ? seedIndex / (seedCount - 1) : 0;
				return interpCyanMagenta(t);
			}
			case 'radius': {
				const r = Math.hypot(point[0], point[1]);
				const t = maxRadius > 0 ? Math.min(1, r / maxRadius) : 0;
				return interpMagentaViolet(t);
			}
			case 'iteration':
			default: {
				const t = total > 1 ? i / (total - 1) : 0;
				return interpCyanMagenta(t);
			}
		}
	}

	/** Precompute maxRadius from raw points (before capping). */
	function computeMaxRadius(points: [number, number][]): number {
		let max = 0;
		for (const [px, py] of points) {
			const r = Math.hypot(px, py);
			if (r > max) max = r;
		}
		return max;
	}

	function buildComputed(
		points: [number, number][],
		seedIndices: number[],
		totalSeeds: number
	): Computed {
		return { points, seedIndices, maxRadius: computeMaxRadius(points), totalSeeds };
	}

	function render(computed: Computed) {
		if (!container) return;
		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = container.clientWidth - margin.left - margin.right;
		const chartHeight = height - margin.top - margin.bottom;

		const canvasSelection = d3
			.select(container)
			.append('canvas')
			.attr('width', Math.max(0, width))
			.attr('height', Math.max(0, chartHeight))
			.style('position', 'absolute')
			.style('top', `${margin.top}px`)
			.style('left', `${margin.left}px`);

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Defensive cap so an unexpectedly large compute result cannot stall rendering.
		const capped = computed.points.length > MAX_POINTS;
		const points = capped ? computed.points.slice(0, MAX_POINTS) : computed.points;
		const seedIndices = capped ? computed.seedIndices.slice(0, MAX_POINTS) : computed.seedIndices;
		if (points.length === 0) {
			// Empty data — canvas/svg are present but blank.
			return;
		}

		const xExtentRaw = d3.extent(points, (d) => d[0]);
		const yExtentRaw = d3.extent(points, (d) => d[1]);
		const xExtent: [number, number] = [xExtentRaw[0] ?? -1, xExtentRaw[1] ?? 1];
		const yExtent: [number, number] = [yExtentRaw[0] ?? -1, yExtentRaw[1] ?? 1];

		const xScale = d3
			.scaleLinear()
			.domain([xExtent[0] - 0.5, xExtent[1] + 0.5])
			.range([0, width]);
		const yScale = d3
			.scaleLinear()
			.domain([yExtent[0] - 0.5, yExtent[1] + 0.5])
			.range([chartHeight, 0]);

		const xAxis = d3.axisBottom(xScale).tickSize(-chartHeight).tickPadding(10);
		const yAxis = d3.axisLeft(yScale).tickSize(-width).tickPadding(10);

		svg
			.append('g')
			.attr('transform', `translate(0,${chartHeight})`)
			.call(xAxis)
			.call((g) => {
				g.select('.domain').remove();
				g.selectAll('line').attr('stroke', '#00f3ff').attr('stroke-opacity', 0.1);
				g.selectAll('text').attr('fill', '#00f3ff').attr('font-family', 'Rajdhani');
			});

		svg
			.append('g')
			.call(yAxis)
			.call((g) => {
				g.select('.domain').remove();
				g.selectAll('line').attr('stroke', '#00f3ff').attr('stroke-opacity', 0.1);
				g.selectAll('text').attr('fill', '#00f3ff').attr('font-family', 'Rajdhani');
			});

		const canvas = canvasSelection.node() as HTMLCanvasElement | null;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) {
			console.warn('GumowskiMiraRenderer: canvas or 2D context unavailable');
			return;
		}

		// Use cached maxRadius from the Computed object (computed once per data change).
		const maxRadius = computed.maxRadius;

		ctx.clearRect(0, 0, width, chartHeight);
		ctx.globalAlpha = Math.min(1, Math.max(0, opacity));
		const r = Math.max(0.5, pointSize);

		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const cx = xScale(p[0]);
			const cy = yScale(p[1]);
			ctx.fillStyle = colorFor(
				i,
				p,
				seedIndices[i] ?? 0,
				points.length,
				computed.totalSeeds,
				maxRadius
			);
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	function computeMainThread(): Computed {
		if (renderMode === 'single') {
			const points = calculateGumowskiMiraTuples({ mu, a, b, x0, y0, iterations, burnIn });
			return buildComputed(
				points,
				points.map(() => 0),
				1
			);
		}
		const { points, seedIndices } = calculateGumowskiMiraMultiSeed({
			mu,
			a,
			b,
			iterations,
			burnIn,
			seeds,
			maxPoints: MAX_POINTS
		});
		return buildComputed(points, seedIndices, seeds);
	}

	function paramsValid(): boolean {
		const values = [mu, a, b, x0, y0, iterations, burnIn, seeds, pointSize, opacity];
		return values.every(Number.isFinite) && iterations > 0;
	}

	function requestPoints() {
		if (!paramsValid()) {
			console.warn('GumowskiMiraRenderer: invalid parameters, skipping render');
			latest = buildComputed([], [], 1);
			isComputing = false;
			render(latest);
			return;
		}

		if (renderMode === 'multi' && worker && workerAvailable) {
			const id = ++workerRequestId;
			latestWorkerRequestId = id;
			isComputing = true;
			worker.postMessage({
				type: 'gumowskiMira',
				id,
				mu,
				a,
				b,
				iterations,
				burnIn,
				seeds,
				maxPoints: MAX_POINTS
			});
			return;
		}

		isComputing = true;
		latest = computeMainThread();
		render(latest);
		isComputing = false;
		if (hasPendingRender) {
			hasPendingRender = false;
			scheduleRender();
		}
	}

	function scheduleRender() {
		if (!container) return;
		if (isComputing) {
			hasPendingRender = true;
			return;
		}
		if (renderTimeout !== null) clearTimeout(renderTimeout);
		renderTimeout = setTimeout(() => {
			renderTimeout = null;
			requestPoints();
		}, DEBOUNCE_MS);
	}

	onMount(() => {
		if (typeof window !== 'undefined' && 'Worker' in window) {
			try {
				worker = new Worker(new URL('../../workers/chaosMapsWorker.ts', import.meta.url), {
					type: 'module'
				});
				workerAvailable = true;
				worker.onmessage = (event: MessageEvent<ChaosMapsWorkerResponse>) => {
					const data = event.data;
					if (isUnmounted || !data) return;

					if (data.type === 'error') {
						console.error('Gumowski-Mira worker error response:', data.message);
						isComputing = false;
						workerAvailable = false;
						worker?.terminate();
						worker = null;
						if (container && !isUnmounted) {
							latest = computeMainThread();
							render(latest);
						}
						return;
					}

					if (data.type !== 'gumowskiMiraResult') return;
					if (data.id !== latestWorkerRequestId) return;
					isComputing = false;
					latest = buildComputed(data.points, data.seedIndices, seeds);
					render(latest);
					if (hasPendingRender) {
						hasPendingRender = false;
						scheduleRender();
					}
				};
				worker.onerror = (event: ErrorEvent) => {
					console.error('Gumowski-Mira worker error:', event.message);
					isComputing = false;
					workerAvailable = false;
					worker?.terminate();
					worker = null;
					if (container && !isUnmounted) {
						latest = computeMainThread();
						render(latest);
					}
				};
			} catch (error) {
				console.error('Failed to initialize gumowski-mira web worker:', error);
				worker = null;
				workerAvailable = false;
			}
		}

		scheduleRender();

		return () => {
			isUnmounted = true;
			if (worker) {
				worker.terminate();
				worker = null;
			}
			if (renderTimeout !== null) {
				clearTimeout(renderTimeout);
				renderTimeout = null;
			}
		};
	});

	// Recompute when any input changes.
	$effect(() => {
		void mu;
		void a;
		void b;
		void x0;
		void y0;
		void iterations;
		void burnIn;
		void renderMode;
		void seeds;
		scheduleRender();
	});

	// Re-render (no recompute) when render-only style changes or height changes.
	$effect(() => {
		void colorMode;
		void pointSize;
		void opacity;
		void height;
		if (container && latest) render(latest);
	});
</script>

<div class="relative">
	<div
		bind:this={container}
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
		style="height: {height}px;"
	></div>
	<div
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // CANVAS
	</div>
</div>
