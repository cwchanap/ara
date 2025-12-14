<script lang="ts">
	import { onMount } from 'svelte';
	import { onDestroy } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import { checkParameterStability, validateParameters } from '$lib/chaos-validation';
	import type { NewtonParameters } from '$lib/types';

	let { data } = $props();

	let canvas: HTMLCanvasElement;
	let imgWidth = 600;
	let imgHeight = 600;
	let xMin = $state(-0.01);
	let xMax = $state(0.01);
	let yMin = $state(-0.01);
	let yMax = $state(0.01);
	let maxIterations = $state(50);
	let epsilon = 5e-19;
	let isRendering = false;

	// Save dialog state
	let showSaveDialog = $state(false);
	let saveSuccess = $state(false);
	let saveError = $state('');
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let saveErrorTimeout: ReturnType<typeof setTimeout> | null = null;

	// Stability warning state
	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	// Load config from URL on mount
	$effect(() => {
		const configParam = $page.url.searchParams.get('config');
		if (configParam) {
			try {
				configErrors = [];
				showConfigError = false;
				stabilityWarnings = [];
				showStabilityWarning = false;

				const params = JSON.parse(decodeURIComponent(configParam));

				// Validate parameters structure before using
				const validation = validateParameters('newton', params);
				if (!validation.isValid) {
					console.error('Invalid parameters structure:', validation.errors);
					configErrors = validation.errors;
					showConfigError = true;
					return;
				}

				// Now we can safely cast since validation passed
				const typedParams = params as NewtonParameters;
				xMin = typedParams.xMin ?? xMin;
				xMax = typedParams.xMax ?? xMax;
				yMin = typedParams.yMin ?? yMin;
				yMax = typedParams.yMax ?? yMax;
				maxIterations = typedParams.maxIterations ?? maxIterations;

				const stability = checkParameterStability('newton', typedParams);
				if (!stability.isStable) {
					stabilityWarnings = stability.warnings;
					showStabilityWarning = true;
				}
			} catch (e) {
				console.error('Invalid config parameter:', e);
				configErrors = ['Failed to parse configuration parameters'];
				showConfigError = true;
			}
		}
	});

	// Get current parameters for saving
	function getParameters(): NewtonParameters {
		return { type: 'newton', xMin, xMax, yMin, yMax, maxIterations };
	}

	// Handle save
	async function handleSave(name: string) {
		// Clear any previous error/success states
		saveError = '';
		saveSuccess = false;

		try {
			const response = await fetch(`${base}/api/save-config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					mapType: 'newton',
					parameters: getParameters()
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Failed to save' }));
				saveSuccess = false;
				saveError = errorData.error || 'Failed to save configuration';

				if (saveErrorTimeout !== null) {
					clearTimeout(saveErrorTimeout);
					saveErrorTimeout = null;
				}
				saveErrorTimeout = setTimeout(() => {
					saveError = '';
					saveErrorTimeout = null;
				}, 3000);
				return;
			}

			// Success
			saveSuccess = true;
			saveError = '';
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
			}
			saveTimeout = setTimeout(() => {
				saveSuccess = false;
				saveTimeout = null;
			}, 3000);
		} catch (err) {
			saveSuccess = false;
			saveError =
				err instanceof Error
					? `Failed to save configuration: ${err.message}`
					: 'Failed to save configuration';

			if (saveErrorTimeout !== null) {
				clearTimeout(saveErrorTimeout);
				saveErrorTimeout = null;
			}
			saveErrorTimeout = setTimeout(() => {
				saveError = '';
				saveErrorTimeout = null;
			}, 3000);
		}
	}

	function render() {
		if (!canvas || isRendering) return;
		isRendering = true;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Clear canvas
		ctx.clearRect(0, 0, imgWidth, imgHeight);

		// Draw Newton fractal
		const imageData = ctx.createImageData(imgWidth, imgHeight);
		const data = imageData.data;

		for (let y = 0; y < imgHeight; y++) {
			const zy = (y * (yMax - yMin)) / (imgHeight - 1) + yMin;

			for (let x = 0; x < imgWidth; x++) {
				const zx = (x * (xMax - xMin)) / (imgWidth - 1) + xMin;

				let real = zx;
				let imag = zy;

				let iterations = 0;
				for (let i = 0; i < maxIterations; i++) {
					// Newton iteration for z^3 - 1 = 0
					// z_new = z - (z^3 - 1) / (3*z^2)

					const r2 = real * real + imag * imag;
					if (r2 === 0) break;

					// z^2
					const z2_real = real * real - imag * imag;
					const z2_imag = 2 * real * imag;

					// z^3
					const z3_real = real * z2_real - imag * z2_imag;
					const z3_imag = real * z2_imag + imag * z2_real;

					// z^3 - 1
					const numerator_real = z3_real - 1;
					const numerator_imag = z3_imag;

					// 3*z^2
					const denominator_real = 3 * z2_real;
					const denominator_imag = 3 * z2_imag;

					// Division
					const denom = denominator_real * denominator_real + denominator_imag * denominator_imag;
					if (denom === 0) break;

					const div_real =
						(numerator_real * denominator_real + numerator_imag * denominator_imag) / denom;
					const div_imag =
						(numerator_imag * denominator_real - numerator_real * denominator_imag) / denom;

					// z_new = z - result
					const newReal = real - div_real;
					const newImag = imag - div_imag;

					const diff = Math.sqrt((newReal - real) ** 2 + (newImag - imag) ** 2);

					real = newReal;
					imag = newImag;
					iterations = i;

					if (diff < epsilon) break;
				}

				// Color based on which root we converged to
				const idx = (y * imgWidth + x) * 4;

				if (real + 0.5 < epsilon) {
					// Converged to specific root - show White/Cyan
					data[idx] = 200;
					data[idx + 1] = 255;
					data[idx + 2] = 255;
					data[idx + 3] = 255;
				} else {
					// Color based on iterations - Neon Gold/Amber gradient
					const intensity = Math.floor((iterations / maxIterations) * 255);
					// Gold: 255, 215, 0 -> Gradient
					data[idx] = intensity * 2; // Red
					data[idx + 1] = intensity * 1.5; // Green
					data[idx + 2] = intensity * 0.2; // Blue
					data[idx + 3] = 255;
				}
			}
		}

		ctx.putImageData(imageData, 0, 0);
		isRendering = false;
	}

	onMount(() => {
		render();
	});

	onDestroy(() => {
		if (saveTimeout !== null) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		if (saveErrorTimeout !== null) {
			clearTimeout(saveErrorTimeout);
			saveErrorTimeout = null;
		}
	});

	$effect(() => {
		void xMin;
		void xMax;
		void yMin;
		void yMax;
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
				NEWTON_FRACTAL
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_06
			</p>
		</div>
		<div class="flex gap-3">
			<button
				onclick={() => (showSaveDialog = true)}
				class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				💾 Save
			</button>
			<a
				href="{base}/"
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				← Return
			</a>
		</div>
	</div>

	<!-- Save Success Toast -->
	{#if saveSuccess}
		<div
			class="fixed top-20 right-4 z-50 px-6 py-4 bg-green-500/10 border border-green-500/30 rounded-lg backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-right-5"
		>
			<div class="flex items-center gap-3">
				<span class="text-green-400">✓</span>
				<span class="text-green-200">Configuration saved successfully!</span>
			</div>
		</div>
	{/if}

	<!-- Save Error Toast -->
	{#if saveError}
		<div
			class="fixed top-20 right-4 z-50 px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-right-5"
		>
			<div class="flex items-center gap-3">
				<span class="text-red-400">✕</span>
				<span class="text-red-200">{saveError}</span>
				<button
					onclick={() => (saveError = '')}
					class="ml-2 text-red-400/60 hover:text-red-400 transition-colors"
					aria-label="Close error message"
				>
					×
				</button>
			</div>
		</div>
	{/if}

	{#if showConfigError && configErrors.length > 0}
		<div class="bg-red-500/10 border border-red-500/30 rounded-sm p-4 relative">
			<div class="flex items-start gap-3">
				<span class="text-red-400 text-xl">✕</span>
				<div class="flex-1">
					<h3 class="font-['Orbitron'] text-red-400 font-semibold mb-1">INVALID_CONFIGURATION</h3>
					<p class="text-red-200/80 text-sm mb-2">
						The loaded configuration could not be applied due to validation errors:
					</p>
					<ul class="text-xs text-red-200/60 list-disc list-inside space-y-1">
						{#each configErrors as err, i (i)}
							<li>{err}</li>
						{/each}
					</ul>
				</div>
				<button
					onclick={() => (showConfigError = false)}
					class="text-red-400/60 hover:text-red-400"
				>
					✕
				</button>
			</div>
		</div>
	{/if}

	<!-- Stability Warning -->
	{#if showStabilityWarning && stabilityWarnings.length > 0}
		<div class="bg-amber-500/10 border border-amber-500/30 rounded-sm p-4 relative">
			<div class="flex items-start gap-3">
				<span class="text-amber-400 text-xl">⚠️</span>
				<div class="flex-1">
					<h3 class="font-['Orbitron'] text-amber-400 font-semibold mb-1">
						UNSTABLE_PARAMETERS_DETECTED
					</h3>
					<p class="text-amber-200/80 text-sm mb-2">
						The loaded configuration contains parameters outside recommended stable ranges:
					</p>
					<ul class="text-xs text-amber-200/60 list-disc list-inside space-y-1">
						{#each stabilityWarnings as warning, i (i)}
							<li>{warning}</li>
						{/each}
					</ul>
				</div>
				<button
					onclick={() => (showStabilityWarning = false)}
					class="text-amber-400/60 hover:text-amber-400"
				>
					✕
				</button>
			</div>
		</div>
	{/if}

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

		<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
			<div class="space-y-4">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						x range
					</label>
					<span class="font-mono text-accent text-xs">[{xMin.toFixed(4)}, {xMax.toFixed(4)}]</span>
				</div>
				<div class="flex gap-4">
					<input
						type="range"
						bind:value={xMin}
						min="-1"
						max="0"
						step="0.001"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
					<input
						type="range"
						bind:value={xMax}
						min="0"
						max="1"
						step="0.001"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
			</div>

			<div class="space-y-4">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						y range
					</label>
					<span class="font-mono text-accent text-xs">[{yMin.toFixed(4)}, {yMax.toFixed(4)}]</span>
				</div>
				<div class="flex gap-4">
					<input
						type="range"
						bind:value={yMin}
						min="-1"
						max="0"
						step="0.001"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
					<input
						type="range"
						bind:value={yMax}
						min="0"
						max="1"
						step="0.001"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Max Iterations
					</label>
					<span class="font-mono text-accent">{maxIterations}</span>
				</div>
				<input
					type="range"
					bind:value={maxIterations}
					min="10"
					max="100"
					step="5"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>z(n+1) = z(n) - (z³ - 1) / (3z²)</p>
		</div>
	</div>

	<div
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative p-4 flex justify-center"
	>
		<canvas bind:this={canvas} width={imgWidth} height={imgHeight} class="max-w-full h-auto"
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
			DATA_LOG: NEWTON_FRACTAL
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			Newton fractals are created by applying Newton's method to find roots of complex functions.
			Each pixel is colored based on which root it converges to. The intricate boundaries between
			basins of attraction form beautiful fractal patterns, revealing the chaotic nature of the
			method's behavior.
		</p>
	</div>
</div>

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={showSaveDialog}
	mapType="newton"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (showSaveDialog = false)}
	onSave={handleSave}
/>
