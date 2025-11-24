<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { base } from '$app/paths';

	let container: HTMLDivElement;
	let r = $state(3.9);
	let x0 = $state(0.5);
	let iterations = $state(100);

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
			.text('ITERATION (n)');

		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -40)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('VALUE x(n)');

		// Create line
		const line = d3
			.line<{ n: number; x: number }>()
			.x((d) => xScale(d.n))
			.y((d) => yScale(d.x))
			.curve(d3.curveMonotoneX); // Smooth it slightly

		// Glow effect definition
		const defs = svg.append('defs');
		const filter = defs.append('filter').attr('id', 'glow');
		filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
		const feMerge = filter.append('feMerge');
		feMerge.append('feMergeNode').attr('in', 'coloredBlur');
		feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

		// Draw line
		svg
			.append('path')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', '#39ff14') // Neon Green
			.attr('stroke-width', 2)
			.attr('d', line)
			.attr('filter', 'url(#glow)');

		// Add points
		svg
			.selectAll('circle')
			.data(data)
			.enter()
			.append('circle')
			.attr('cx', (d) => xScale(d.n))
			.attr('cy', (d) => yScale(d.x))
			.attr('r', 3)
			.attr('fill', '#ff00ff') // Neon Magenta dots
			.attr('stroke', '#fff')
			.attr('stroke-width', 1);
	}

	onMount(() => {
		render();
	});

	$effect(() => {
		void r;
		void x0;
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
				LOGISTIC_MAP
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_03
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

		<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						r (growth rate)
					</label>
					<span class="font-mono text-accent">{r.toFixed(3)}</span>
				</div>
				<input
					type="range"
					bind:value={r}
					min="0"
					max="4"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						x₀ (initial value)
					</label>
					<span class="font-mono text-accent">{x0.toFixed(3)}</span>
				</div>
				<input
					type="range"
					bind:value={x0}
					min="0"
					max="1"
					step="0.01"
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
					min="10"
					max="200"
					step="10"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>x(n+1) = r·x(n)·(1 - x(n))</p>
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
			DATA_LOG: LOGISTIC_MAP
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The logistic map is a polynomial mapping that exhibits very complicated chaotic behavior. It
			was popularized by Robert May as a simple model for population growth with limited resources.
			As the parameter r increases, the system transitions from stable to periodic to chaotic
			behavior.
		</p>
	</div>
</div>
