<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let container: HTMLDivElement;
	let K = 0.971635;
	let numP = 10;
	let numQ = 10;
	let iterations = 20000;

	function standardMap(numP: number, numQ: number, iterations: number, K: number) {
		const points: [number, number][] = [];

		for (let i = 1; i <= numP; i++) {
			for (let j = 1; j <= numQ; j++) {
				let p = (i / numP) % (2 * Math.PI);
				let q = (j / numQ) % (2 * Math.PI);

				for (let k = 0; k < iterations; k++) {
					const pNew = (p + K * Math.sin(q)) % (2 * Math.PI);
					const qNew = (q + pNew) % (2 * Math.PI);

					points.push([qNew, pNew]);

					p = pNew;
					q = qNew;
				}
			}
		}

		return points;
	}

	function render() {
		if (!container) return;

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

		const points = standardMap(numP, numQ, iterations, K);

		const xScale = d3
			.scaleLinear()
			.domain([0, 2 * Math.PI])
			.range([0, width]);

		const yScale = d3
			.scaleLinear()
			.domain([0, 2 * Math.PI])
			.range([height, 0]);

		// Add axes
		svg
			.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(xScale).ticks(8))
			.attr('color', '#fff');

		svg.append('g').call(d3.axisLeft(yScale).ticks(8)).attr('color', '#fff');

		// Add axis labels
		svg
			.append('text')
			.attr('x', width / 2)
			.attr('y', height + 40)
			.attr('fill', '#fff')
			.attr('text-anchor', 'middle')
			.text('q');

		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -40)
			.attr('fill', '#fff')
			.attr('text-anchor', 'middle')
			.text('p');

		// Plot points
		svg
			.selectAll('circle')
			.data(points)
			.enter()
			.append('circle')
			.attr('cx', (d) => xScale(d[0]))
			.attr('cy', (d) => yScale(d[1]))
			.attr('r', 0.5)
			.attr('fill', '#f59e0b')
			.attr('opacity', 0.3);
	}

	onMount(() => {
		render();
	});

	$: if (container && (K || numP || numQ || iterations)) {
		render();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-4xl font-bold text-white">Standard Map</h1>
			<p class="text-white/60 mt-2">Area-preserving chaotic map from dynamical systems</p>
		</div>
		<a
			href="{base}/"
			class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
		>
			← Back
		</a>
	</div>

	<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 space-y-4">
		<h2 class="text-xl font-semibold text-white">Parameters</h2>

		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<div>
				<label class="block text-white/80 text-sm mb-2"> K: {K.toFixed(6)} </label>
				<input type="range" bind:value={K} min="0" max="5" step="0.01" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> Initial p points: {numP} </label>
				<input type="range" bind:value={numP} min="1" max="20" step="1" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> Initial q points: {numQ} </label>
				<input type="range" bind:value={numQ} min="1" max="20" step="1" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> Iterations: {iterations} </label>
				<input
					type="range"
					bind:value={iterations}
					min="1000"
					max="50000"
					step="1000"
					class="w-full"
				/>
			</div>
		</div>

		<div class="text-sm text-white/60 space-y-1">
			<p>p(n+1) = p(n) + K·sin(q(n)) mod 2π</p>
			<p>q(n+1) = q(n) + p(n+1) mod 2π</p>
		</div>

		<div class="text-xs text-yellow-400">
			Note: High iteration counts may take a few seconds to render
		</div>
	</div>

	<div
		bind:this={container}
		class="bg-black/50 border border-white/10 rounded-xl overflow-hidden"
	></div>

	<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
		<h3 class="text-lg font-semibold text-white mb-2">About the Standard Map</h3>
		<p class="text-white/70 text-sm">
			The standard map (also called the Chirikov-Taylor map) is an area-preserving chaotic map from
			a square with side 2π onto itself. It was introduced as a simplified model for motion in a
			magnetic field. For low values of K, the map displays regular behavior with stable orbits,
			while larger K values lead to chaotic dynamics.
		</p>
	</div>
</div>
