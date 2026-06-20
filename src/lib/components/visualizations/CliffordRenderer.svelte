<!--
  CliffordRenderer Component — Canvas point cloud for the Clifford attractor.
  Single-orbit compute offloads to chaosMapsWorker with a main-thread fallback.
  Two render paths: per-point arcs (single/iteration/radius/angle) and a
  per-pixel density-accumulation buffer (density).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { calculateCliffordTuples } from '$lib/clifford';
	import type { CliffordColorMode } from '$lib/types';
	import type { ChaosMapsWorkerResponse } from '$lib/workers/types';

	interface Props {
		a?: number;
		b?: number;
		c?: number;
		d?: number;
		iterations?: number;
		colorMode?: CliffordColorMode;
		zoom?: number;
		pointSize?: number;
		opacity?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}

	let {
		a = $bindable(-1.4),
		b = $bindable(1.6),
		c = $bindable(1.0),
		d = $bindable(0.7),
		iterations = $bindable(120000),
		colorMode = $bindable<CliffordColorMode>('density'),
		zoom = $bindable(1),
		pointSize = $bindable(1.5),
		opacity = $bindable(0.6),
		height = 500,
		containerElement = $bindable()
	}: Props = $props();

	let container = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		containerElement = container;
	});

	const MAX_POINTS = 250000;
	const DEBOUNCE_MS = 250;

	type Computed = { points: [number, number][]; maxRadius: number };

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
	const densityRamp = d3.interpolateRgbBasis([
		'#000814',
		'#003a4d',
		'#00f3ff',
		'#ff00ff',
		'#ffffff'
	]);

	function colorFor(i: number, point: [number, number], total: number, maxRadius: number): string {
		switch (colorMode) {
			case 'single':
				return '#00f3ff';
			case 'radius': {
				const r = Math.hypot(point[0], point[1]);
				const t = maxRadius > 0 ? Math.min(1, r / maxRadius) : 0;
				return interpMagentaViolet(t);
			}
			case 'angle': {
				const t = (Math.atan2(point[1], point[0]) + Math.PI) / (2 * Math.PI);
				return d3.interpolateRainbow(t);
			}
			case 'iteration':
			default: {
				const t = total > 1 ? i / (total - 1) : 0;
				return interpCyanMagenta(t);
			}
		}
	}

	function computeMaxRadius(points: [number, number][]): number {
		let max = 0;
		for (const [px, py] of points) {
			const r = Math.hypot(px, py);
			if (r > max) max = r;
		}
		return max;
	}

	function buildComputed(points: [number, number][]): Computed {
		return { points, maxRadius: computeMaxRadius(points) };
	}

	/** Apply zoom by scaling a padded domain around its center. */
	function zoomedDomain(lo: number, hi: number): [number, number] {
		const center = (lo + hi) / 2;
		const half = (hi - lo) / 2 / Math.max(0.0001, zoom);
		return [center - half, center + half];
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

		const capped = computed.points.length > MAX_POINTS;
		const points = capped ? computed.points.slice(0, MAX_POINTS) : computed.points;
		if (points.length === 0 || width <= 0 || chartHeight <= 0) return;

		const xExtentRaw = d3.extent(points, (p) => p[0]);
		const yExtentRaw = d3.extent(points, (p) => p[1]);
		const xExtent: [number, number] = [xExtentRaw[0] ?? -1, xExtentRaw[1] ?? 1];
		const yExtent: [number, number] = [yExtentRaw[0] ?? -1, yExtentRaw[1] ?? 1];

		const xDomain = zoomedDomain(xExtent[0] - 0.5, xExtent[1] + 0.5);
		const yDomain = zoomedDomain(yExtent[0] - 0.5, yExtent[1] + 0.5);
		const xScale = d3.scaleLinear().domain(xDomain).range([0, width]);
		const yScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]);

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
			console.warn('CliffordRenderer: canvas or 2D context unavailable');
			return;
		}

		ctx.clearRect(0, 0, width, chartHeight);

		if (colorMode === 'density') {
			renderDensity(ctx, points, xScale, yScale, width, chartHeight);
			return;
		}

		const maxRadius = computed.maxRadius;
		ctx.globalAlpha = Math.min(1, Math.max(0, opacity));
		const r = Math.max(0.5, pointSize);
		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const cx = xScale(p[0]);
			const cy = yScale(p[1]);
			ctx.fillStyle = colorFor(i, p, points.length, maxRadius);
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	/** Accumulate per-pixel hit counts and map log(count) through a color ramp. */
	function renderDensity(
		ctx: CanvasRenderingContext2D,
		points: [number, number][],
		xScale: d3.ScaleLinear<number, number>,
		yScale: d3.ScaleLinear<number, number>,
		width: number,
		chartHeight: number
	) {
		const w = Math.max(1, Math.floor(width));
		const h = Math.max(1, Math.floor(chartHeight));
		const counts = new Uint32Array(w * h);
		let maxCount = 0;
		for (const p of points) {
			const sx = Math.floor(xScale(p[0]));
			const sy = Math.floor(yScale(p[1]));
			if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
			const idx = sy * w + sx;
			const cnt = ++counts[idx];
			if (cnt > maxCount) maxCount = cnt;
		}
		const img = ctx.createImageData(w, h);
		const denom = Math.log(1 + maxCount) || 1;
		for (let i = 0; i < counts.length; i++) {
			const cnt = counts[i];
			if (cnt === 0) continue;
			const t = Math.log(1 + cnt) / denom;
			const rgb = d3.rgb(densityRamp(t));
			const o = i * 4;
			img.data[o] = rgb.r;
			img.data[o + 1] = rgb.g;
			img.data[o + 2] = rgb.b;
			img.data[o + 3] = 255;
		}
		ctx.putImageData(img, 0, 0);
	}

	function paramsValid(): boolean {
		const values = [a, b, c, d, iterations, zoom, pointSize, opacity];
		return values.every(Number.isFinite) && iterations > 0;
	}

	function computeMainThread(): Computed {
		const points = calculateCliffordTuples({ a, b, c, d, iterations, maxPoints: MAX_POINTS });
		return buildComputed(points);
	}

	function requestPoints() {
		if (!paramsValid()) {
			console.warn('CliffordRenderer: invalid parameters, skipping render');
			latest = buildComputed([]);
			isComputing = false;
			render(latest);
			return;
		}

		if (worker && workerAvailable) {
			const id = ++workerRequestId;
			latestWorkerRequestId = id;
			isComputing = true;
			worker.postMessage({ type: 'clifford', id, a, b, c, d, iterations, maxPoints: MAX_POINTS });
			return;
		}

		isComputing = true;
		latest = computeMainThread();
		render(latest);
		isComputing = false;
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
						console.error('Clifford worker error response:', data.message);
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

					if (data.type !== 'cliffordResult') return;
					if (data.id !== latestWorkerRequestId) return;
					isComputing = false;
					latest = buildComputed(data.points);
					render(latest);
					if (hasPendingRender) {
						hasPendingRender = false;
						scheduleRender();
					}
				};
				worker.onerror = (event: ErrorEvent) => {
					console.error('Clifford worker error:', event.message);
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
				console.error('Failed to initialize clifford web worker:', error);
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

	// Recompute when a math input changes.
	$effect(() => {
		void a;
		void b;
		void c;
		void d;
		void iterations;
		scheduleRender();
	});

	// Re-render (no recompute) when a render-only setting changes.
	$effect(() => {
		void colorMode;
		void zoom;
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
