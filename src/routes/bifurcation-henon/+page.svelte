<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';

	let canvas: HTMLCanvasElement;
	let imgWidth = 1000;
	let imgHeight = 1500;
	let aMin = 1.04;
	let aMax = 1.1;
	let b = 0.3;
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
			const a = aMin + (aMax - aMin) * (i / (imgWidth - 1));
			let x = 0;
			let y = 0;

			for (let j = 0; j < maxIterations; j++) {
				const xNew = y + 1 - a * x * x;
				const yNew = b * x;

				// Plot only after settling period
				if (j > maxIterations / 2) {
					const plotY = Math.floor(-xNew * (imgHeight / 3) + 750);
					if (plotY >= 0 && plotY < imgHeight) {
						ctx.fillRect(i, plotY, 1, 1);
					}
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

	$: if (canvas && (aMin || aMax || b || maxIterations)) {
		render();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-4xl font-bold text-white">Bifurcation Diagram (Hénon)</h1>
			<p class="text-white/60 mt-2">Bifurcation patterns of the Hénon map as parameter a varies</p>
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
				<label class="block text-white/80 text-sm mb-2"> a min: {aMin.toFixed(3)} </label>
				<input type="range" bind:value={aMin} min="0.5" max="1.5" step="0.01" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> a max: {aMax.toFixed(3)} </label>
				<input type="range" bind:value={aMax} min="0.5" max="1.5" step="0.01" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> b: {b.toFixed(3)} </label>
				<input type="range" bind:value={b} min="0" max="1" step="0.01" class="w-full" />
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

		<div class="text-sm text-white/60 space-y-1">
			<p>x(n+1) = y(n) + 1 - a·x(n)²</p>
			<p>y(n+1) = b·x(n)</p>
		</div>
	</div>

	<div class="bg-black border border-white/10 rounded-xl overflow-hidden p-4">
		<canvas bind:this={canvas} width={imgWidth} height={imgHeight} class="w-full"></canvas>
	</div>

	<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
		<h3 class="text-lg font-semibold text-white mb-2">About the Hénon Bifurcation</h3>
		<p class="text-white/70 text-sm">
			This diagram shows how the attractor of the Hénon map changes as the parameter a varies. The
			system exhibits complex bifurcation patterns and chaotic behavior for certain parameter
			ranges.
		</p>
	</div>
</div>
