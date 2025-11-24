<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';

	let canvas: HTMLCanvasElement;
	let imgWidth = 1000;
	let imgHeight = 1500;
	let aMin = $state(1.04);
	let aMax = $state(1.1);
	let b = $state(0.3);
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
		// Neon Violet/Purple with low opacity for density
		ctx.fillStyle = 'rgba(188, 19, 254, 0.4)';

		for (let i = 0; i < imgWidth; i++) {
			const a = aMin + (aMax - aMin) * (i / (imgWidth - 1));
			let x = 0;
			let y = 0;

			// Pre-warm
			for (let j = 0; j < 100; j++) {
				const xNew = y + 1 - a * x * x;
				const yNew = b * x;
				x = xNew;
				y = yNew;
			}

			for (let j = 0; j < maxIterations; j++) {
				const xNew = y + 1 - a * x * x;
				const yNew = b * x;

				// Plot
				const plotY = Math.floor(-xNew * (imgHeight / 3) + 750);
				if (plotY >= 0 && plotY < imgHeight) {
					ctx.fillRect(i, plotY, 1, 1);
				}

				x = xNew;
				y = yNew;
			}
		}

		isRendering = false;
	}

	onMount(() => {
		render();
	});

	$effect(() => {
		void aMin;
		void aMax;
		void b;
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
				HÉNON_BIFURCATION
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_05
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
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> a min </label>
					<span class="font-mono text-accent">{aMin.toFixed(3)}</span>
				</div>
				<input
					type="range"
					bind:value={aMin}
					min="0.5"
					max="1.5"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> a max </label>
					<span class="font-mono text-accent">{aMax.toFixed(3)}</span>
				</div>
				<input
					type="range"
					bind:value={aMax}
					min="0.5"
					max="1.5"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> b </label>
					<span class="font-mono text-accent">{b.toFixed(3)}</span>
				</div>
				<input
					type="range"
					bind:value={b}
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
			class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>x(n+1) = y(n) + 1 - a·x(n)²</p>
			<p>y(n+1) = b·x(n)</p>
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
			DATA_LOG: HÉNON_BIFURCATION
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			This diagram shows how the attractor of the Hénon map changes as the parameter a varies. The
			system exhibits complex bifurcation patterns and chaotic behavior for certain parameter
			ranges.
		</p>
	</div>
</div>
