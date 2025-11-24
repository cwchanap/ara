<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { base } from '$app/paths';

	let container: HTMLDivElement;
	let a = $state(0.9);
	let b = $state(0.9999);
	let x0 = $state(18);
	let y0 = $state(0);
	let iterations = $state(10000);

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

		const xExtent = d3.extent(points, (d) => d[0]) as [number, number];
		const yExtent = d3.extent(points, (d) => d[1]) as [number, number];

		const xScale = d3
			.scaleLinear()
			.domain([xExtent[0] - 1, xExtent[1] + 1])
			.range([0, width]);

		const yScale = d3
			.scaleLinear()
			.domain([yExtent[0] - 1, yExtent[1] + 1])
			.range([height, 0]);

		// Add axes
		const xAxis = d3.axisBottom(xScale).tickSize(-height).tickPadding(10);
		const yAxis = d3.axisLeft(yScale).tickSize(-width).tickPadding(10);

		svg
			.append('g')
			.attr('class', 'grid-lines')
			.attr('transform', `translate(0,${height})`)
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

		// Add axis labels
		svg
			.append('text')
			.attr('x', width / 2)
			.attr('y', height + 40)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('X');

		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -40)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('Y');

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
				// Neon Pink/Purple Gradient
				return d3.interpolate('#ff00ff', '#8a2be2')(t);
			})
			.attr('opacity', 0.6)
			.attr('filter', 'drop-shadow(0 0 2px rgba(255, 0, 255, 0.5))');
	}

	onMount(() => {
		render();
	});

	$effect(() => {
		void a;
		void b;
		void x0;
		void y0;
		void iterations;
		if (container) render();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				CHAOS_ESTHETIQUE
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_08
			</p>
		</div>
		<a
			href="{base}/"
			class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
		>
			← Return
		</a>
	</div>

	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative overflow-hidden group"
	>
		<!-- Decor corners -->
		<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
		<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
		<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

		<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
			<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
			SYSTEM_PARAMETERS
		</h2>

		<div class="grid grid-cols-1 md:grid-cols-5 gap-4">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> a </label>
					<span class="font-mono text-accent">{a.toFixed(4)}</span>
				</div>
				<input
					type="range"
					bind:value={a}
					min="0"
					max="2"
					step="0.0001"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> b </label>
					<span class="font-mono text-accent">{b.toFixed(4)}</span>
				</div>
				<input
					type="range"
					bind:value={b}
					min="0"
					max="1.5"
					step="0.0001"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> x₀ </label>
					<span class="font-mono text-accent">{x0.toFixed(2)}</span>
				</div>
				<input
					type="range"
					bind:value={x0}
					min="-20"
					max="20"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> y₀ </label>
					<span class="font-mono text-accent">{y0.toFixed(2)}</span>
				</div>
				<input
					type="range"
					bind:value={y0}
					min="-20"
					max="20"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Iterations
					</label>
					<span class="font-mono text-accent">{iterations}</span>
				</div>
				<input
					type="range"
					bind:value={iterations}
					min="1000"
					max="20000"
					step="1000"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>x(n+1) = y(n) + a·x(n) + 2(1-a)·x(n)² / (1+x(n)²)</p>
			<p>y(n+1) = -b·x(n) + f(x(n+1))</p>
		</div>
	</div>

	<div
		bind:this={container}
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
	>
		<div
			class="absolute top-4 right-4 text-xs font-mono text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
		>
			LIVE_RENDER // D3.JS
		</div>
	</div>

	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: CHAOS_ESTHETIQUE
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			This is a custom aesthetic chaos system that generates beautiful patterns through iterative
			transformations. The function f(x) creates a nonlinear mapping, and the coupled equations
			produce intricate attractors. The system is highly sensitive to parameters a and b, displaying
			a wide variety of behaviors from stable orbits to chaotic attractors.
		</p>
	</div>
</div>
