<!--
  LyapunovRenderer Component - D3.js visualization for Lyapunov exponents
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface Props {
		rMin?: number;
		rMax?: number;
		iterations?: number;
		transientIterations?: number;
		height?: number;
	}

	let {
		rMin = $bindable(2.5),
		rMax = $bindable(4.0),
		iterations = $bindable(1000),
		transientIterations = $bindable(500),
		height = 400
	}: Props = $props();

	let container: HTMLDivElement;

	function calculateLyapunovExponent(
		r: number,
		iterations: number,
		transientIterations: number
	): number {
		let x = 0.5;

		for (let i = 0; i < transientIterations; i++) {
			x = r * x * (1 - x);
			if (x < 1e-10 || x > 1 - 1e-10) x = 0.5;
		}

		let sum = 0;
		let validIterations = 0;

		for (let i = 0; i < iterations; i++) {
			x = r * x * (1 - x);
			const derivative = Math.abs(r * (1 - 2 * x));
			if (derivative > 0 && x > 1e-10 && x < 1 - 1e-10) {
				sum += Math.log(derivative);
				validIterations++;
			} else if (x < 1e-10 || x > 1 - 1e-10) {
				x = 0.5;
			}
		}

		return validIterations > 0 ? sum / validIterations : -Infinity;
	}

	function render() {
		if (!container) return;

		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = container.clientWidth - margin.left - margin.right;
		const chartHeight = height - margin.top - margin.bottom;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const numPoints = Math.max(2, Math.min(400, width));
		let actualRMin = rMin;
		let actualRMax = rMax;

		if (Math.abs(rMax - rMin) < 0.001) {
			const epsilon = 0.01;
			actualRMin = Math.max(0, rMin - epsilon);
			actualRMax = Math.min(4, rMax + epsilon);
		}

		const data: { r: number; lyapunov: number }[] = [];
		for (let i = 0; i < numPoints; i++) {
			const r = actualRMin + (actualRMax - actualRMin) * (i / (numPoints - 1));
			const lyapunov = calculateLyapunovExponent(r, iterations, transientIterations);
			data.push({ r, lyapunov });
		}

		const xScale = d3.scaleLinear().domain([actualRMin, actualRMax]).range([0, width]);
		const yScale = d3
			.scaleLinear()
			.domain(d3.extent(data, (d) => d.lyapunov) as [number, number])
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

		// Zero line (chaos threshold)
		svg
			.append('line')
			.attr('x1', 0)
			.attr('x2', width)
			.attr('y1', yScale(0))
			.attr('y2', yScale(0))
			.attr('stroke', '#ff00ff')
			.attr('stroke-width', 1.5)
			.attr('stroke-dasharray', '5,5')
			.attr('opacity', 0.5);

		const line = d3
			.line<{ r: number; lyapunov: number }>()
			.x((d) => xScale(d.r))
			.y((d) => yScale(d.lyapunov))
			.curve(d3.curveLinear);

		// Draw segments colored by sign
		for (let i = 0; i < data.length - 1; i++) {
			const segment = data.slice(i, i + 2);
			const color = segment[0].lyapunov < 0 ? '#00f3ff' : '#ff00ff';
			svg
				.append('path')
				.datum(segment)
				.attr('fill', 'none')
				.attr('stroke', color)
				.attr('stroke-width', 1.5)
				.attr('d', line);
		}
	}

	onMount(() => {
		render();
	});

	$effect(() => {
		void rMin;
		void rMax;
		void iterations;
		void transientIterations;
		if (container) render();
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative p-4"
	style="height: {height}px;"
>
	<div
		class="absolute top-4 right-4 text-xs font-mono text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // D3.JS
	</div>
</div>
