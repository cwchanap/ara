<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let container: HTMLDivElement;
	let a = 1.01;
	let b = 0.3;
	let iterations = 1000;

	function calculateHenon(a: number, b: number, iterations: number) {
		const points: [number, number][] = [];
		let x = 0;
		let y = 0;

		for (let i = 0; i < iterations; i++) {
			const xNew = y + 1 - a * x * x;
			const yNew = b * x;
			points.push([xNew, yNew]);
			x = xNew;
			y = yNew;
		}

		return points;
	}

	function render() {
		if (!container) return;

		// Clear previous content
		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = container.clientWidth - margin.left - margin.right;
		const height = 600 - margin.top - margin.bottom;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', 600)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const points = calculateHenon(a, b, iterations);

		const xScale = d3
			.scaleLinear()
			.domain([d3.min(points, (d) => d[0])! - 0.1, d3.max(points, (d) => d[0])! + 0.1])
			.range([0, width]);

		const yScale = d3
			.scaleLinear()
			.domain([d3.min(points, (d) => d[1])! - 0.1, d3.max(points, (d) => d[1])! + 0.1])
			.range([height, 0]);

		// Add axes
		svg
			.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(xScale))
			.attr('color', '#fff');

		svg.append('g').call(d3.axisLeft(yScale)).attr('color', '#fff');

		// Add axis labels
		svg
			.append('text')
			.attr('x', width / 2)
			.attr('y', height + 40)
			.attr('fill', '#fff')
			.attr('text-anchor', 'middle')
			.text('x');

		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -40)
			.attr('fill', '#fff')
			.attr('text-anchor', 'middle')
			.text('y');

		// Plot points
		svg
			.selectAll('circle')
			.data(points)
			.enter()
			.append('circle')
			.attr('cx', (d) => xScale(d[0]))
			.attr('cy', (d) => yScale(d[1]))
			.attr('r', 1.5)
			.attr('fill', (d, i) => {
				const t = i / points.length;
				return d3.interpolateRainbow(t);
			})
			.attr('opacity', 0.6);
	}

	onMount(() => {
		render();
	});

	$: if (container && (a || b || iterations)) {
		render();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-4xl font-bold text-white">Hénon Map</h1>
			<p class="text-white/60 mt-2">A 2D discrete-time dynamical system with strange attractor</p>
		</div>
		<a
			href="/"
			class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
		>
			← Back
		</a>
	</div>

	<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 space-y-4">
		<h2 class="text-xl font-semibold text-white">Parameters</h2>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div>
				<label class="block text-white/80 text-sm mb-2"> a: {a.toFixed(3)} </label>
				<input type="range" bind:value={a} min="0.5" max="1.5" step="0.01" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> b: {b.toFixed(3)} </label>
				<input type="range" bind:value={b} min="0" max="1" step="0.01" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> Iterations: {iterations} </label>
				<input
					type="range"
					bind:value={iterations}
					min="100"
					max="5000"
					step="100"
					class="w-full"
				/>
			</div>
		</div>

		<div class="text-sm text-white/60 space-y-1">
			<p>x(n+1) = y(n) + 1 - a·x(n)²</p>
			<p>y(n+1) = b·x(n)</p>
		</div>
	</div>

	<div
		bind:this={container}
		class="bg-black/50 border border-white/10 rounded-xl overflow-hidden"
	></div>

	<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
		<h3 class="text-lg font-semibold text-white mb-2">About the Hénon Map</h3>
		<p class="text-white/70 text-sm">
			The Hénon map is a discrete-time dynamical system introduced by Michel Hénon as a simplified
			model of the Poincaré section of the Lorenz model. For certain parameter values, the map
			exhibits chaotic behavior and produces a strange attractor.
		</p>
	</div>
</div>
