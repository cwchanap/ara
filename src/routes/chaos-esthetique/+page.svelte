<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let container: HTMLDivElement;
	let a = 0.9;
	let b = 0.9999;
	let x0 = 18;
	let y0 = 0;
	let iterations = 10000;

	function f(x: number, a: number): number {
		return a * x + (2 * (1 - a) * x * x) / (1 + x * x);
	}

	function calculateChaos(a: number, b: number, x0: number, y0: number, iterations: number) {
		const points: [number, number][] = [];
		let x = x0;
		let y = y0;

		for (let i = 0; i < iterations; i++) {
			const xNew = y + f(x, a);
			const yNew = -b * x + f(xNew, a);

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
		const width = container.clientWidth - margin.left - margin.right;
		const height = 600 - margin.top - margin.bottom;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', 600)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const points = calculateChaos(a, b, x0, y0, iterations);

		const xScale = d3
			.scaleLinear()
			.domain([d3.min(points, (d) => d[0])! - 1, d3.max(points, (d) => d[0])! + 1])
			.range([0, width]);

		const yScale = d3
			.scaleLinear()
			.domain([d3.min(points, (d) => d[1])! - 1, d3.max(points, (d) => d[1])! + 1])
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
				return d3.interpolatePlasma(t);
			})
			.attr('opacity', 0.6);
	}

	onMount(() => {
		render();
	});

	$: if (container && (a || b || x0 || y0 || iterations)) {
		render();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-4xl font-bold text-white">Chaos Esthetique</h1>
			<p class="text-white/60 mt-2">Aesthetic chaos pattern with custom formula</p>
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

		<div class="grid grid-cols-1 md:grid-cols-5 gap-4">
			<div>
				<label class="block text-white/80 text-sm mb-2"> a: {a.toFixed(4)} </label>
				<input type="range" bind:value={a} min="0" max="2" step="0.0001" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> b: {b.toFixed(4)} </label>
				<input type="range" bind:value={b} min="0" max="1.5" step="0.0001" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> x₀: {x0.toFixed(2)} </label>
				<input type="range" bind:value={x0} min="-20" max="20" step="0.1" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> y₀: {y0.toFixed(2)} </label>
				<input type="range" bind:value={y0} min="-20" max="20" step="0.1" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> Iterations: {iterations} </label>
				<input
					type="range"
					bind:value={iterations}
					min="1000"
					max="20000"
					step="1000"
					class="w-full"
				/>
			</div>
		</div>

		<div class="text-sm text-white/60 space-y-1">
			<p>f(x) = a·x + 2(1-a)·x² / (1+x²)</p>
			<p>x(n+1) = y(n) + f(x(n))</p>
			<p>y(n+1) = -b·x(n) + f(x(n+1))</p>
		</div>
	</div>

	<div
		bind:this={container}
		class="bg-black/50 border border-white/10 rounded-xl overflow-hidden"
	></div>

	<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
		<h3 class="text-lg font-semibold text-white mb-2">About Chaos Esthetique</h3>
		<p class="text-white/70 text-sm">
			This is a custom aesthetic chaos system that generates beautiful patterns through iterative
			transformations. The function f(x) creates a nonlinear mapping, and the coupled equations
			produce intricate attractors. The system is highly sensitive to parameters a and b,
			displaying a wide variety of behaviors from stable orbits to chaotic attractors.
		</p>
	</div>
</div>
