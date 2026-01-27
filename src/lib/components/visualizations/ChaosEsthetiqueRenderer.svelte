<!--
  ChaosEsthetiqueRenderer Component - D3.js visualization for Chaos Esthetique
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface Props {
		a?: number;
		b?: number;
		x0?: number;
		y0?: number;
		iterations?: number;
		height?: number;
	}

	let {
		a = $bindable(0.9),
		b = $bindable(0.9999),
		x0 = $bindable(18),
		y0 = $bindable(0),
		iterations = $bindable(10000),
		height = 500
	}: Props = $props();

	let container: HTMLDivElement;
	const MAX_POINTS = 15000;
	const SHADOW_POINT_THRESHOLD = 5000;
	const DEBOUNCE_MS = 250;
	let renderTimeout: ReturnType<typeof setTimeout> | null = null;
	let worker: Worker | null = null;
	let workerAvailable = false;
	let workerRequestId = 0;
	let latestWorkerRequestId = 0;
	let isComputing = false;
	let hasPendingRender = false;
	let latestPoints: [number, number][] | null = null;
	let isUnmounted = false;

	function f(x: number, a: number): number {
		return a * x + (2 * (1 - a) * x * x) / (1 + x * x);
	}

	function calculateChaos(
		a: number,
		b: number,
		x0: number,
		y0: number,
		iterations: number,
		maxPoints: number
	): [number, number][] {
		const points: [number, number][] = [];
		let x = x0;
		let y = y0;
		const steps = Math.min(iterations, maxPoints);

		for (let i = 0; i < steps; i++) {
			const xNew = y + f(x, a);
			const yNew = -b * x + f(xNew, a);
			points.push([xNew, yNew]);
			x = xNew;
			y = yNew;
		}
		return points;
	}

	function render(points: [number, number][]) {
		if (!container) return;

		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = container.clientWidth - margin.left - margin.right;
		const chartHeight = height - margin.top - margin.bottom;

		const canvasSelection = d3
			.select(container)
			.append('canvas')
			.attr('width', width)
			.attr('height', chartHeight)
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

		// Guard against empty points array
		if (points.length === 0) {
			d3.select(container).selectAll('*').remove();
			return;
		}

		const xExtentRaw = d3.extent(points, (d) => d[0]);
		const yExtentRaw = d3.extent(points, (d) => d[1]);
		const xExtent: [number, number] = [xExtentRaw[0] ?? -1, xExtentRaw[1] ?? 1];
		const yExtent: [number, number] = [yExtentRaw[0] ?? -1, yExtentRaw[1] ?? 1];

		const xScale = d3
			.scaleLinear()
			.domain([xExtent[0] - 1, xExtent[1] + 1])
			.range([0, width]);
		const yScale = d3
			.scaleLinear()
			.domain([yExtent[0] - 1, yExtent[1] + 1])
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
		if (!canvas || !ctx) return;

		ctx.clearRect(0, 0, width, chartHeight);
		ctx.globalAlpha = 0.6;
		const useShadow = points.length <= SHADOW_POINT_THRESHOLD;
		ctx.shadowBlur = useShadow ? 4 : 0;
		ctx.shadowColor = useShadow ? 'rgba(255, 0, 255, 0.5)' : 'transparent';

		for (let i = 0; i < points.length; i++) {
			const [xVal, yVal] = points[i];
			const x = xScale(xVal);
			const y = yScale(yVal);
			const t = i / points.length;
			const color = d3.interpolate('#ff00ff', '#8a2be2')(t);
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(x, y, 1.5, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
		ctx.shadowBlur = 0;
	}

	function requestPoints() {
		const payload = {
			type: 'chaos' as const,
			id: ++workerRequestId,
			a,
			b,
			x0,
			y0,
			iterations,
			maxPoints: MAX_POINTS
		};

		if (worker && workerAvailable) {
			latestWorkerRequestId = payload.id;
			isComputing = true;
			worker.postMessage(payload);
		} else {
			isComputing = true;
			const points = calculateChaos(a, b, x0, y0, iterations, MAX_POINTS);
			latestPoints = points;
			render(points);
			isComputing = false;
			if (hasPendingRender) {
				hasPendingRender = false;
				scheduleRender();
			}
		}
	}

	function scheduleRender() {
		if (!container) return;
		if (isComputing) {
			hasPendingRender = true;
			return;
		}
		if (renderTimeout !== null) {
			clearTimeout(renderTimeout);
		}
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
				worker.onmessage = (event: MessageEvent) => {
					const data = event.data as {
						type: string;
						id: number;
						points: [number, number][];
					};
					if (isUnmounted || !data || data.type !== 'chaosResult') return;
					if (data.id !== latestWorkerRequestId) return;
					isComputing = false;
					latestPoints = data.points;
					render(data.points);
					if (hasPendingRender) {
						hasPendingRender = false;
						scheduleRender();
					}
				};
			} catch {
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

	$effect(() => {
		void a;
		void b;
		void x0;
		void y0;
		void iterations;
		scheduleRender();
	});

	$effect(() => {
		void height;
		if (container && latestPoints) render(latestPoints);
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
	style="height: {height}px;"
>
	<div
		class="absolute top-4 right-4 text-xs font-mono text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // D3.JS
	</div>
</div>
