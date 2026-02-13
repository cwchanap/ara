<!--
  StandardRenderer Component - D3.js visualization for Standard map
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface Props {
		k?: number;
		numP?: number;
		numQ?: number;
		iterations?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}

	let {
		k = $bindable(0.97),
		numP = $bindable(10),
		numQ = $bindable(10),
		iterations = $bindable(20000),
		height = 500,
		containerElement = $bindable()
	}: Props = $props();

	let container: HTMLDivElement;

	// Sync internal container ref to bindable prop
	$effect(() => {
		containerElement = container;
	});
	const MAX_POINTS = 20000;
	const DEBOUNCE_MS = 150;
	let renderTimeout: ReturnType<typeof setTimeout> | null = null;
	let worker: Worker | null = null;
	let workerAvailable = false;
	let workerRequestId = 0;
	let latestWorkerRequestId = 0;
	let isComputing = false;
	let hasPendingRender = false;
	let latestPoints: [number, number][] | null = null;
	let isUnmounted = false;

	function handleWorkerFailure(reason?: unknown) {
		if (reason) {
			console.error('Standard map worker failure:', reason);
		}
		workerAvailable = false;
		if (worker) {
			worker.terminate();
		}
		worker = null;
		isComputing = false;
		if (isUnmounted) return;
		if (hasPendingRender) {
			hasPendingRender = false;
			scheduleRender();
			return;
		}
		if (latestPoints) {
			render(latestPoints);
			return;
		}
		const points = standardMap(numP, numQ, iterations, k, MAX_POINTS);
		latestPoints = points;
		render(points);
	}

	function standardMap(
		numP: number,
		numQ: number,
		iterations: number,
		k: number,
		maxPoints: number
	): [number, number][] {
		if (numP <= 0 || numQ <= 0 || iterations <= 0 || maxPoints <= 0) return [];
		const points: [number, number][] = [];

		const TWO_PI = 2 * Math.PI;
		const normalizeAngle = (value: number) => ((value % TWO_PI) + TWO_PI) % TWO_PI;

		outer: for (let i = 1; i <= numP; i++) {
			for (let j = 1; j <= numQ; j++) {
				let p = normalizeAngle(((i - 1) / numP) * TWO_PI);
				let q = normalizeAngle(((j - 1) / numQ) * TWO_PI);

				for (let k = 0; k < iterations; k++) {
					const pNew = normalizeAngle(p + k * Math.sin(q));
					const qNew = normalizeAngle(q + pNew);
					points.push([qNew, pNew]);
					p = pNew;
					q = qNew;
					if (points.length >= maxPoints) break outer;
				}
			}
		}
		return points;
	}

	function render(points: [number, number][]) {
		if (!container) return;

		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = Math.max(0, container.clientWidth - margin.left - margin.right);
		const chartHeight = Math.max(0, height - margin.top - margin.bottom);

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

		const xScale = d3
			.scaleLinear()
			.domain([0, 2 * Math.PI])
			.range([0, width]);
		const yScale = d3
			.scaleLinear()
			.domain([0, 2 * Math.PI])
			.range([chartHeight, 0]);

		const xAxis = d3.axisBottom(xScale).ticks(6).tickSize(-chartHeight).tickPadding(10);
		const yAxis = d3.axisLeft(yScale).ticks(6).tickSize(-width).tickPadding(10);

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
		ctx.fillStyle = '#00f3ff';
		ctx.globalAlpha = 0.4;

		for (const [qVal, pVal] of points) {
			const x = xScale(qVal);
			const y = yScale(pVal);
			ctx.beginPath();
			ctx.arc(x, y, 0.8, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	function requestPoints() {
		const payload = {
			type: 'standard' as const,
			id: ++workerRequestId,
			numP,
			numQ,
			iterations,
			k,
			maxPoints: MAX_POINTS
		};

		if (worker && workerAvailable) {
			latestWorkerRequestId = payload.id;
			isComputing = true;
			worker.postMessage(payload);
		} else {
			isComputing = true;
			const points = standardMap(numP, numQ, iterations, k, MAX_POINTS);
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
		// Set up ResizeObserver to handle container size changes
		const resizeObserver = new ResizeObserver(() => {
			if (!container) return;
			if (latestPoints) {
				render(latestPoints);
			} else {
				scheduleRender();
			}
		});
		if (container) {
			resizeObserver.observe(container);
		}

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
					if (isUnmounted || !data || data.type !== 'standardResult') return;
					if (data.id !== latestWorkerRequestId) return;
					isComputing = false;
					latestPoints = data.points;
					render(data.points);
					if (hasPendingRender) {
						hasPendingRender = false;
						scheduleRender();
					}
				};
				worker.onerror = (event: ErrorEvent) => {
					handleWorkerFailure(event.message ?? event);
				};
				worker.onmessageerror = (event: MessageEvent) => {
					handleWorkerFailure(event);
				};
			} catch (error) {
				handleWorkerFailure(error);
			}
		}

		scheduleRender();

		return () => {
			isUnmounted = true;
			resizeObserver.disconnect();
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
		void k;
		void numP;
		void numQ;
		void iterations;
		scheduleRender();
	});

	$effect(() => {
		void height;
		if (container && container.clientWidth > 0 && latestPoints) render(latestPoints);
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
	style="height: {height}px;"
>
	<div
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // D3_JS
	</div>
</div>
