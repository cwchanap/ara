<!--
  LogisticRenderer Component - D3.js visualization for Logistic map
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface Props {
		r?: number;
		x0?: number;
		iterations?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}

	let {
		r = $bindable(3.9),
		x0 = $bindable(0.1),
		iterations = $bindable(100),
		height = 500,
		containerElement = $bindable()
	}: Props = $props();

	let container: HTMLDivElement;

	// Sync internal container ref to bindable prop after mount
	onMount(() => {
		containerElement = container;
	});
	let resizeObserver: ResizeObserver | null = null;

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

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const containerWidth = container.clientWidth;
		if (containerWidth <= 0) {
			if (!resizeObserver && container) {
				resizeObserver = new ResizeObserver(() => {
					if (!container) return;
					const nextWidth = container.clientWidth;
					if (nextWidth > 0) {
						resizeObserver?.disconnect();
						resizeObserver = null;
						render();
					}
				});
				resizeObserver.observe(container);
			}
			return;
		}
		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}
		const width = Math.max(0, containerWidth - margin.left - margin.right);
		const chartHeight = Math.max(0, height - margin.top - margin.bottom);

		const svgRoot = d3
			.select(container)
			.selectAll<SVGSVGElement, unknown>('svg.logistic-svg')
			.data([null])
			.join('svg')
			.classed('logistic-svg', true)
			.attr('width', container.clientWidth)
			.attr('height', height);

		svgRoot.selectAll('*').remove();

		const svg = svgRoot.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

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

	onMount(() => {
		return () => {
			resizeObserver?.disconnect();
			resizeObserver = null;
		};
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
	style="height: {height}px;"
>
	<div
		class="absolute top-4 right-4 text-xs font-['Orbitron'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER_D3_JS
	</div>
</div>
