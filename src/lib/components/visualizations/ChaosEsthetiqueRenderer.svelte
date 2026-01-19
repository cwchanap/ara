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

	function render() {
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

		const points = calculateChaos(a, b, x0, y0, iterations, MAX_POINTS);

		const xExtent = d3.extent(points, (d) => d[0]) as [number, number];
		const yExtent = d3.extent(points, (d) => d[1]) as [number, number];

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
		ctx.shadowBlur = 4;
		ctx.shadowColor = 'rgba(255, 0, 255, 0.5)';

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

	onMount(() => {
		render();
	});

	$effect(() => {
		void a;
		void b;
		void x0;
		void y0;
		void iterations;
		if (container) render();
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
