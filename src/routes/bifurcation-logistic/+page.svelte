<script lang="ts">
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let imgWidth = 1000;
	let imgHeight = 500;
	let rMin = 3.73;
	let rMax = 3.87;
	let maxIterations = 1000;
	let isRendering = false;

	function render() {
		if (!canvas || isRendering) return;
		isRendering = true;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Clear canvas with black background
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, imgWidth, imgHeight);

		// Draw bifurcation diagram
		ctx.fillStyle = '#ffffff';

		for (let i = 0; i < imgWidth; i++) {
			const r = rMin + (rMax - rMin) * (i / (imgWidth - 1));
			let x = 0.5;

			for (let j = 0; j < maxIterations; j++) {
				x = r * x * (1 - x);

				// Plot only after settling period
				if (j > maxIterations / 2) {
					const y = Math.floor(x * imgHeight);
					if (y >= 0 && y < imgHeight) {
						ctx.fillRect(i, imgHeight - y - 1, 1, 1);
					}
				}
			}
		}

		isRendering = false;
	}

	onMount(() => {
		render();
	});

	$: if (canvas && (rMin || rMax || maxIterations)) {
		render();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-4xl font-bold text-white">Bifurcation Diagram (Logistic)</h1>
			<p class="text-white/60 mt-2">
				Visualization of the transition from order to chaos in the logistic map
			</p>
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
				<label class="block text-white/80 text-sm mb-2"> r min: {rMin.toFixed(3)} </label>
				<input type="range" bind:value={rMin} min="2.5" max="4" step="0.01" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> r max: {rMax.toFixed(3)} </label>
				<input type="range" bind:value={rMax} min="2.5" max="4" step="0.01" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> Iterations: {maxIterations} </label>
				<input
					type="range"
					bind:value={maxIterations}
					min="100"
					max="2000"
					step="100"
					class="w-full"
				/>
			</div>
		</div>

		<div class="text-sm text-white/60">
			<p>x(n+1) = r·x(n)·(1 - x(n))</p>
		</div>
	</div>

	<div class="bg-black border border-white/10 rounded-xl overflow-hidden p-4">
		<canvas bind:this={canvas} width={imgWidth} height={imgHeight} class="w-full"></canvas>
	</div>

	<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
		<h3 class="text-lg font-semibold text-white mb-2">About Bifurcation Diagrams</h3>
		<p class="text-white/70 text-sm">
			The bifurcation diagram shows the long-term behavior of the logistic map for different values
			of the growth parameter r. As r increases, the system undergoes a series of period-doubling
			bifurcations, eventually leading to chaos. The famous Feigenbaum constant appears in the
			spacing of these bifurcations.
		</p>
	</div>
</div>
