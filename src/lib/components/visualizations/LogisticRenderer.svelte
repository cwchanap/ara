<!--
  LogisticRenderer Component - D3.js visualization for Logistic map
-->
<script lang="ts">
	import * as d3 from 'd3';

	interface Props {
		r?: number;
		x0?: number;
		iterations?: number;
		height?: number;
	}

	let {
		r = $bindable(3.9),
		x0 = $bindable(0.1),
		iterations = $bindable(100),
		height = 500
	}: Props = $props();

	let container: HTMLDivElement;

	function calculateLogistic(r: number, x0: number, iterations: number): [number, number][] {
		const points: [number, number][] = [];
		let x = x0;
		for (let i = 0; i < iterations; i++) {
			x = r * x * (1 - x);
			points.push([i, x]);
		}
		return points;
	}

	function render() {
		if (!container) return;

		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const containerWidth = container.clientWidth;
		if (containerWidth <= 0) {
			requestAnimationFrame(() => {
				if (container) render();
			});
			return;
		}
		const width = containerWidth - margin.left - margin.right;
		const chartHeight = height - margin.top - margin.bottom;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const points = calculateLogistic(r, x0, iterations);

		const xScale = d3.scaleLinear().domain([0, iterations]).range([0, width]);
		const yScale = d3.scaleLinear().domain([0, 1]).range([chartHeight, 0]);

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

		// Draw line
		const line = d3
			.line<[number, number]>()
			.x((d) => xScale(d[0]))
			.y((d) => yScale(d[1]));
		svg
			.append('path')
			.datum(points)
			.attr('fill', 'none')
			.attr('stroke', '#00f3ff')
			.attr('stroke-width', 1.5)
			.attr('d', line)
			.attr('filter', 'drop-shadow(0 0 3px rgba(0, 243, 255, 0.5))');

		// Draw points
		svg
			.selectAll('circle')
			.data(points)
			.enter()
			.append('circle')
			.attr('cx', (d) => xScale(d[0]))
			.attr('cy', (d) => yScale(d[1]))
			.attr('r', 3)
			.attr('fill', (d, i) => d3.interpolate('#00f3ff', '#bc13fe')(i / points.length))
			.attr('opacity', 0.8);
	}

	$effect(() => {
		void r;
		void x0;
		void iterations;
		void height;
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
