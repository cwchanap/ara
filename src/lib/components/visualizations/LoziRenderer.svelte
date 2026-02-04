<!--
  LoziRenderer Component - D3.js visualization for Lozi map
-->
<script lang="ts">
	import * as d3 from 'd3';
	import { calculateLoziTuples } from '$lib/lozi';

	interface Props {
		a?: number;
		b?: number;
		x0?: number;
		y0?: number;
		iterations?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}

	let {
		a = $bindable(1.7),
		b = $bindable(0.5),
		x0 = $bindable(0),
		y0 = $bindable(0),
		iterations = $bindable(5000),
		height = 500,
		containerElement = $bindable()
	}: Props = $props();

	let container: HTMLDivElement;

	// Sync internal container ref to bindable prop
	$effect(() => {
		containerElement = container;
	});

	function render() {
		if (!container) return;

		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = Math.max(0, container.clientWidth - margin.left - margin.right);
		const chartHeight = Math.max(0, height - margin.top - margin.bottom);

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		let points: [number, number][] = [];
		try {
			points = calculateLoziTuples({ a, b, x0, y0, iterations });
		} catch (err) {
			console.error('Error calculating Lozi tuples', err);
		}

		const xExtentRaw = d3.extent(points, (d) => d[0]);
		const yExtentRaw = d3.extent(points, (d) => d[1]);
		const xExtent: [number, number] = [xExtentRaw[0] ?? -1, xExtentRaw[1] ?? 1];
		const yExtent: [number, number] = [yExtentRaw[0] ?? -1, yExtentRaw[1] ?? 1];

		const xScale = d3
			.scaleLinear()
			.domain([xExtent[0] - 0.1, xExtent[1] + 0.1])
			.range([0, width]);
		const yScale = d3
			.scaleLinear()
			.domain([yExtent[0] - 0.1, yExtent[1] + 0.1])
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

		svg
			.selectAll('circle')
			.data(points)
			.enter()
			.append('circle')
			.attr('cx', (d) => xScale(d[0]))
			.attr('cy', (d) => yScale(d[1]))
			.attr('r', 1.5)
			.attr('fill', (d, i) => d3.interpolate('#00f3ff', '#bc13fe')(i / points.length))
			.attr('opacity', 0.7);
	}

	$effect(() => {
		void a;
		void b;
		void x0;
		void y0;
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
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // D3_JS
	</div>
</div>
