<!--
  LyapunovRenderer Component - D3.js visualization for Lyapunov exponents
-->
<script lang="ts">
	import * as d3 from 'd3';
	import { calculateLyapunovExponent } from '$lib/lyapunov-map';
	import { COLOR_PRIMARY, COLOR_MAGENTA } from '$lib/constants';

	interface Props {
		rMin?: number;
		rMax?: number;
		iterations?: number;
		transientIterations?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}

	let {
		rMin = $bindable(2.5),
		rMax = $bindable(4.0),
		iterations = $bindable(1000),
		transientIterations = $bindable(500),
		height = 400,
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

		const numPoints = Math.max(2, Math.min(400, width));
		// Enforce rMin <= rMax so a loaded config (or manual slider entry) with a
		// reversed range renders a forward axis instead of a backwards one. This
		// restores the swap that the pre-shell page applied on config load.
		let actualRMin = rMin;
		let actualRMax = rMax;
		if (actualRMin > actualRMax) {
			const temp = actualRMin;
			actualRMin = actualRMax;
			actualRMax = temp;
		}

		if (Math.abs(actualRMax - actualRMin) < 0.001) {
			const epsilon = 0.01;
			actualRMin = Math.max(0, actualRMin - epsilon);
			actualRMax = Math.min(4, actualRMax + epsilon);
		}

		const data: { r: number; lyapunov: number | null }[] = [];
		for (let i = 0; i < numPoints; i++) {
			const r = actualRMin + (actualRMax - actualRMin) * (i / (numPoints - 1));
			const lyapunov = calculateLyapunovExponent(r, iterations, transientIterations);
			data.push({ r, lyapunov });
		}

		// Filter out null values for extent calculation
		const validData = data.filter((d) => d.lyapunov !== null);
		if (validData.length === 0) {
			svg
				.append('text')
				.attr('x', width / 2)
				.attr('y', chartHeight / 2)
				.attr('text-anchor', 'middle')
				.attr('fill', COLOR_PRIMARY)
				.attr('font-family', 'Rajdhani')
				.attr('font-size', 14)
				.text('No valid Lyapunov values');
			return;
		}

		const yExtent = d3.extent(validData, (d) => d.lyapunov as number) as [number, number];

		const xScale = d3.scaleLinear().domain([actualRMin, actualRMax]).range([0, width]);
		const yScale = d3.scaleLinear().domain(yExtent).range([chartHeight, 0]);

		const xAxis = d3.axisBottom(xScale).tickSize(-chartHeight).tickPadding(10);
		const yAxis = d3.axisLeft(yScale).tickSize(-width).tickPadding(10);

		svg
			.append('g')
			.attr('transform', `translate(0,${chartHeight})`)
			.call(xAxis)
			.call((g) => {
				g.select('.domain').remove();
				g.selectAll('line').attr('stroke', COLOR_PRIMARY).attr('stroke-opacity', 0.1);
				g.selectAll('text').attr('fill', COLOR_PRIMARY).attr('font-family', 'Rajdhani');
			});

		svg
			.append('g')
			.call(yAxis)
			.call((g) => {
				g.select('.domain').remove();
				g.selectAll('line').attr('stroke', COLOR_PRIMARY).attr('stroke-opacity', 0.1);
				g.selectAll('text').attr('fill', COLOR_PRIMARY).attr('font-family', 'Rajdhani');
			});

		// Zero line (chaos threshold)
		const zeroY = yScale(0);
		if (Number.isFinite(zeroY) && zeroY >= 0 && zeroY <= chartHeight) {
			svg
				.append('line')
				.attr('x1', 0)
				.attr('x2', width)
				.attr('y1', zeroY)
				.attr('y2', zeroY)
				.attr('stroke', COLOR_MAGENTA)
				.attr('stroke-width', 1.5)
				.attr('stroke-dasharray', '5,5')
				.attr('opacity', 0.5);
		}

		// Create line generator with defined accessor to handle null values
		const line = d3
			.line<{ r: number; lyapunov: number | null }>()
			.x((d) => xScale(d.r))
			.y((d) => yScale(d.lyapunov ?? 0))
			.defined((d) => d.lyapunov !== null)
			.curve(d3.curveLinear);

		// Draw segments colored by sign
		for (let i = 0; i < data.length - 1; i++) {
			const segment = data.slice(i, i + 2);
			// Use the first non-null lyapunov value
			const lyap = segment[0].lyapunov ?? segment[1].lyapunov;
			// Skip segments where both points are null
			if (lyap === null) continue;
			const color = lyap < 0 ? COLOR_PRIMARY : COLOR_MAGENTA;
			svg
				.append('path')
				.datum(segment)
				.attr('fill', 'none')
				.attr('stroke', color)
				.attr('stroke-width', 1.5)
				.attr('d', line);
		}
	}

	$effect(() => {
		void rMin;
		void rMax;
		void iterations;
		void transientIterations;
		void height;
		if (container) render();
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative p-4"
	style="height: {height}px;"
>
	<div
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // D3_JS
	</div>
</div>
