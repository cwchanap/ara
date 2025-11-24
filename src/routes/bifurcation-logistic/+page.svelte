<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';

	let canvas: HTMLCanvasElement;
	let imgWidth = 1000;
	let imgHeight = 500;
	let rMin = $state(3.5); // Zoomed in slightly for better initial view
	let rMax = $state(4.0);
	let maxIterations = $state(1000);
	let isRendering = false;

	function render() {
		if (!canvas || isRendering) return;
		isRendering = true;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Clear canvas
		ctx.clearRect(0, 0, imgWidth, imgHeight);

		// Draw bifurcation diagram
		// Use Neon Orange/Red with some transparency for density effect
		ctx.fillStyle = 'rgba(255, 80, 0, 0.3)';

		for (let i = 0; i < imgWidth; i++) {
			const r = rMin + (rMax - rMin) * (i / (imgWidth - 1));
			let x = 0.5;

			// Pre-warm to settle into attractor
			for (let j = 0; j < 100; j++) {
				x = r * x * (1 - x);
			}

			for (let j = 0; j < maxIterations; j++) {
				x = r * x * (1 - x);

				// Plot
				const y = Math.floor(x * imgHeight);
				if (y >= 0 && y < imgHeight) {
					ctx.fillRect(i, imgHeight - y - 1, 1, 1);
				}
			}
		}

		isRendering = false;
	}

	onMount(() => {
		render();
	});

	$effect(() => {
		void rMin;
		void rMax;
		void maxIterations;
		if (canvas) render();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				LOGISTIC_BIFURCATION
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_04
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
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> r min </label>
					<span class="font-mono text-accent">{rMin.toFixed(3)}</span>
				</div>
				<input
					type="range"
					bind:value={rMin}
					min="2.5"
					max="4"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> r max </label>
					<span class="font-mono text-accent">{rMax.toFixed(3)}</span>
				</div>
				<input
					type="range"
					bind:value={rMax}
					min="2.5"
					max="4"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Iterations
					</label>
					<span class="font-mono text-accent">{maxIterations}</span>
				</div>
				<input
					type="range"
					bind:value={maxIterations}
					min="100"
					max="2000"
					step="100"
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
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative p-4"
	>
		<canvas bind:this={canvas} width={imgWidth} height={imgHeight} class="w-full h-auto block"
		></canvas>
		<div
			class="absolute top-4 right-4 text-xs font-mono text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
		>
			LIVE_RENDER // CANVAS_2D
		</div>
	</div>

	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: BIFURCATION_ANALYSIS
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The bifurcation diagram shows the long-term behavior of the logistic map for different values
			of the growth parameter r. As r increases, the system undergoes a series of period-doubling
			bifurcations, eventually leading to chaos. The famous Feigenbaum constant appears in the
			spacing of these bifurcations.
		</p>
	</div>
</div>
