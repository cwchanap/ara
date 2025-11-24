<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { base } from '$app/paths';

	let container: HTMLDivElement;
	let K = $state(0.971635);
	let numP = $state(10);
	let numQ = $state(10);
	let iterations = $state(20000);

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
		const xAxis = d3.axisBottom(xScale).ticks(8).tickSize(-height).tickPadding(10);
		const yAxis = d3.axisLeft(yScale).ticks(8).tickSize(-width).tickPadding(10);

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
			.text('q');

		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -40)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('p');

		// Plot points
		svg
			.selectAll('circle')
			.data(points)
			.enter()
			.append('circle')
			.attr('cx', (d) => xScale(d[0]))
			.attr('cy', (d) => yScale(d[1]))
			.attr('r', 0.8)
			.attr('fill', '#00ffcc') // Neon Teal
			.attr('opacity', 0.4);
	}

	onMount(() => {
		render();
	});

	$effect(() => {
		void K;
		void numP;
		void numQ;
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
				STANDARD_MAP
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_07
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

		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> K </label>
					<span class="font-mono text-accent">{K.toFixed(6)}</span>
				</div>
				<input
					type="range"
					bind:value={K}
					min="0"
					max="5"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Initial p points
					</label>
					<span class="font-mono text-accent">{numP}</span>
				</div>
				<input
					type="range"
					bind:value={numP}
					min="1"
					max="20"
					step="1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Initial q points
					</label>
					<span class="font-mono text-accent">{numQ}</span>
				</div>
				<input
					type="range"
					bind:value={numQ}
					min="1"
					max="20"
					step="1"
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
					max="50000"
					step="1000"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>p(n+1) = p(n) + K·sin(q(n)) mod 2π</p>
			<p>q(n+1) = q(n) + p(n+1) mod 2π</p>
		</div>

		<div class="text-xs text-accent/80 font-mono border-l-2 border-accent pl-2">
			ALERT: High iteration counts may cause rendering latency.
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
			DATA_LOG: STANDARD_MAP
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The standard map (also called the Chirikov-Taylor map) is an area-preserving chaotic map from
			a square with side 2π onto itself. It was introduced as a simplified model for motion in a
			magnetic field. For low values of K, the map displays regular behavior with stable orbits,
			while larger K values lead to chaotic dynamics.
		</p>
	</div>
</div>
