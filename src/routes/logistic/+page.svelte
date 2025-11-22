<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { base } from '$app/paths';

	let container: HTMLDivElement;
	let r = 0.9;
	let x0 = 0.6;
	let iterations = 80;

	function calculateLogistic(r: number, x0: number, iterations: number) {
		const points: { n: number; x: number }[] = [];
		let x = x0;

		for (let n = 0; n < iterations; n++) {
			points.push({ n, x });
			x = r * x * (1 - x);
		}

		return points;
	}

	function render() {
		if (!container) return;

		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = container.clientWidth - margin.left - margin.right;
		const height = 500 - margin.top - margin.bottom;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', 500)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const data = calculateLogistic(r, x0, iterations);

		const xScale = d3.scaleLinear().domain([0, iterations]).range([0, width]);

		const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);

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
			.text('n (iteration)');

		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -40)
			.attr('fill', '#fff')
			.attr('text-anchor', 'middle')
			.text('x(n)');

		// Create line
		const line = d3
			.line<{ n: number; x: number }>()
			.x((d) => xScale(d.n))
			.y((d) => yScale(d.x));

		svg
			.append('path')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', '#a855f7')
			.attr('stroke-width', 2)
			.attr('d', line);

		// Add points
		svg
			.selectAll('circle')
			.data(data)
			.enter()
			.append('circle')
			.attr('cx', (d) => xScale(d.n))
			.attr('cy', (d) => yScale(d.x))
			.attr('r', 3)
			.attr('fill', '#ec4899');
	}

	onMount(() => {
		render();
	});

	$: if (container && (r || x0 || iterations)) {
		render();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-4xl font-bold text-white">Logistic Map</h1>
			<p class="text-white/60 mt-2">Population growth model showing chaotic behavior</p>
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

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div>
				<label class="block text-white/80 text-sm mb-2"> r (growth rate): {r.toFixed(3)} </label>
				<input type="range" bind:value={r} min="0" max="4" step="0.01" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2">
					x₀ (initial value): {x0.toFixed(3)}
				</label>
				<input type="range" bind:value={x0} min="0" max="1" step="0.01" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> Iterations: {iterations} </label>
				<input type="range" bind:value={iterations} min="10" max="200" step="10" class="w-full" />
			</div>
		</div>

		<div class="text-sm text-white/60">
			<p>x(n+1) = r·x(n)·(1 - x(n))</p>
		</div>
	</div>

	<div
		bind:this={container}
		class="bg-black/50 border border-white/10 rounded-xl overflow-hidden"
	></div>

	<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
		<h3 class="text-lg font-semibold text-white mb-2">About the Logistic Map</h3>
		<p class="text-white/70 text-sm">
			The logistic map is a polynomial mapping that exhibits very complicated chaotic behavior. It
			was popularized by Robert May as a simple model for population growth with limited resources.
			As the parameter r increases, the system transitions from stable to periodic to chaotic
			behavior.
		</p>
	</div>
</div>
