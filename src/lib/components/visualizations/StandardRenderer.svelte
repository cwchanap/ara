<!--
  StandardRenderer Component - D3.js visualization for Standard map
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface Props {
		K?: number;
		numP?: number;
		numQ?: number;
		iterations?: number;
		height?: number;
	}

	let {
		K = $bindable(0.97),
		numP = $bindable(10),
		numQ = $bindable(10),
		iterations = $bindable(20000),
		height = 500
	}: Props = $props();

	let container: HTMLDivElement;
	const MAX_POINTS = 20000;

	function standardMap(
		numP: number,
		numQ: number,
		iterations: number,
		K: number,
		maxPoints: number
	): [number, number][] {
		const points: [number, number][] = [];

		const TWO_PI = 2 * Math.PI;
		const normalizeAngle = (value: number) => ((value % TWO_PI) + TWO_PI) % TWO_PI;

		outer: for (let i = 1; i <= numP; i++) {
			for (let j = 1; j <= numQ; j++) {
				let p = normalizeAngle(((i - 1) / numP) * TWO_PI);
				let q = normalizeAngle(((j - 1) / numQ) * TWO_PI);

				for (let k = 0; k < iterations; k++) {
					const pNew = normalizeAngle(p + K * Math.sin(q));
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

	function render() {
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

		const points = standardMap(numP, numQ, iterations, K, MAX_POINTS);

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
		ctx.fillStyle = '#00ffcc';
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

	onMount(() => {
		// Set up ResizeObserver to handle container size changes
		const resizeObserver = new ResizeObserver(() => {
			if (container) render();
		});
		if (container) {
			resizeObserver.observe(container);
		}

		return () => {
			resizeObserver.disconnect();
		};
	});

	$effect(() => {
		void K;
		void numP;
		void numQ;
		void iterations;
		void height;
		if (container && container.clientWidth > 0) render();
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
