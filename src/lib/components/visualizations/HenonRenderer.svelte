<!--
  HenonRenderer Component

  Encapsulates D3.js Hénon map visualization.
  Can be used standalone or in comparison mode.
-->
<script lang="ts">
	import * as d3 from 'd3';

	interface Props {
		a?: number;
		b?: number;
		iterations?: number;
		height?: number;
	}

	let {
		a = $bindable(1.4),
		b = $bindable(0.3),
		iterations = $bindable(2000),
		height = 500
	}: Props = $props();

	let container: HTMLDivElement;

	function calculateHenon(a: number, b: number, iterations: number) {
		const points: [number, number][] = [];
		let x = 0;
		let y = 0;

		for (let i = 0; i < iterations; i++) {
			const xNew = y + 1 - a * x * x;
			const yNew = b * x;
			if (!Number.isFinite(xNew) || !Number.isFinite(yNew)) {
				break;
			}
			if (Math.abs(xNew) > 1e6 || Math.abs(yNew) > 1e6) {
				break;
			}
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
		const width = Math.max(0, container.clientWidth - margin.left - margin.right);
		const chartHeight = Math.max(0, height - margin.top - margin.bottom);
		if (width === 0 || chartHeight === 0) return;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const points = calculateHenon(a, b, iterations);

		// Guard against empty points array
		if (points.length === 0) {
			d3.select(container).selectAll('*').remove();
			return;
		}

		const xExtent = d3.extent(points, (d) => d[0]) as [number, number];
		const yExtent = d3.extent(points, (d) => d[1]) as [number, number];

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
			.attr('class', 'grid-lines')
			.attr('transform', `translate(0,${chartHeight})`)
			.call(xAxis)
			.call((g) => {
				g.select('.domain').remove();
				g.selectAll('line').attr('stroke', '#00f3ff').attr('stroke-opacity', 0.1);
				g.selectAll('text')
					.attr('fill', '#00f3ff')
					.attr('font-family', 'Rajdhani')
					.attr('font-size', '12px');
			});

		svg
			.append('g')
			.attr('class', 'grid-lines')
			.call(yAxis)
			.call((g) => {
				g.select('.domain').remove();
				g.selectAll('line').attr('stroke', '#00f3ff').attr('stroke-opacity', 0.1);
				g.selectAll('text')
					.attr('fill', '#00f3ff')
					.attr('font-family', 'Rajdhani')
					.attr('font-size', '12px');
			});

		svg
			.append('text')
			.attr('x', width / 2)
			.attr('y', chartHeight + 40)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('X_AXIS');

		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -chartHeight / 2)
			.attr('y', -40)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('Y_AXIS');

		svg
			.selectAll('circle')
			.data(points)
			.enter()
			.append('circle')
			.attr('cx', (d) => xScale(d[0]))
			.attr('cy', (d) => yScale(d[1]))
			.attr('r', 2)
			.attr('fill', (d, i) => {
				const t = i / points.length;
				return d3.interpolate('#00f3ff', '#bc13fe')(t);
			})
			.attr('opacity', 0.8)
			.attr('filter', 'drop-shadow(0 0 2px rgba(0, 243, 255, 0.5))');
	}

	$effect(() => {
		void a;
		void b;
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
