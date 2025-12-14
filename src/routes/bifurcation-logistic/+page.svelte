<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import { checkParameterStability, validateParameters } from '$lib/chaos-validation';
	import type { BifurcationLogisticParameters } from '$lib/types';

	let { data } = $props();

	let canvas: HTMLCanvasElement;
	let imgWidth = 1000;
	let imgHeight = 500;
	let rMin = $state(3.5); // Zoomed in slightly for better initial view
	let rMax = $state(4.0);
	let maxIterations = $state(1000);
	let isRendering = false;
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;

	// Save dialog state
	let showSaveDialog = $state(false);
	let saveSuccess = $state(false);
	let saveError = $state<string | null>(null);

	// Stability warning state
	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);
	let lastConfigParam: string | null = null;

	// Load config from URL on mount
	$effect(() => {
		const configParam = $page.url.searchParams.get('config');
		if (!configParam) {
			lastConfigParam = null;
			configErrors = [];
			showConfigError = false;
			stabilityWarnings = [];
			showStabilityWarning = false;
			return;
		}
		if (configParam === lastConfigParam) return;
		lastConfigParam = configParam;

		try {
			configErrors = [];
			showConfigError = false;
			stabilityWarnings = [];
			showStabilityWarning = false;

			const params = JSON.parse(decodeURIComponent(configParam));

			// Validate parameters structure before using
			const validation = validateParameters('bifurcation-logistic', params);
			if (!validation.isValid) {
				console.error('Invalid parameters structure:', validation.errors);
				configErrors = validation.errors;
				showConfigError = true;
				return;
			}

			// Now we can safely cast since validation passed
			const typedParams = params as BifurcationLogisticParameters;

			// NOTE: Redundant type coercion using Number() after validation.
			// The validateParameters function already checks that all parameter values are numbers (line 126 in chaos-validation.ts).
			// This extra coercion is unnecessary and creates a false sense of uncertainty about type safety.
			// After validation passes, the values are guaranteed to be numbers, so direct assignment is sufficient.
			// The clamping logic is good for UX, but the Number() coercion is superfluous.
			const newRMin = typedParams.rMin;
			const newRMax = typedParams.rMax;
			const newMaxIterations = typedParams.maxIterations;

			let nextRMin = 3.5;
			let nextRMax = 4.0;
			let nextMaxIterations = 1000;

			// Validate and clamp rMin (2.5 - 4.0)
			nextRMin = Math.max(2.5, Math.min(4.0, newRMin));

			// Validate and clamp rMax (2.5 - 4.0)
			nextRMax = Math.max(2.5, Math.min(4.0, newRMax));

			// Enforce rMin <= rMax
			if (nextRMin > nextRMax) {
				// Swap values to maintain rMin <= rMax
				const temp = nextRMin;
				nextRMin = nextRMax;
				nextRMax = temp;
			}

			// Validate and clamp maxIterations (100 - 2000)
			nextMaxIterations = Math.max(100, Math.min(2000, newMaxIterations));

			const stability = checkParameterStability('bifurcation-logistic', {
				type: 'bifurcation-logistic',
				rMin: nextRMin,
				rMax: nextRMax,
				maxIterations: nextMaxIterations
			});

			rMin = nextRMin;
			rMax = nextRMax;
			maxIterations = nextMaxIterations;
			if (!stability.isStable) {
				stabilityWarnings = stability.warnings;
				showStabilityWarning = true;
			}
		} catch (e) {
			console.error('Invalid config parameter:', e);
			configErrors = ['Failed to parse configuration parameters'];
			showConfigError = true;
		}
	});

	// Get current parameters for saving
	function getParameters(): BifurcationLogisticParameters {
		return { type: 'bifurcation-logistic', rMin, rMax, maxIterations };
	}

	// Handle save
	async function handleSave(name: string) {
		// Clear previous error state
		saveError = null;

		try {
			const response = await fetch(`${base}/api/save-config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					mapType: 'bifurcation-logistic',
					parameters: getParameters()
				})
			});

			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ error: 'Failed to save configuration' }));
				saveSuccess = false;
				if (saveTimeout !== null) {
					clearTimeout(saveTimeout);
					saveTimeout = null;
				}
				saveError = errorData.error || 'Failed to save configuration';
				return;
			}

			saveSuccess = true;
			saveError = null;
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
			}
			saveTimeout = setTimeout(() => {
				saveSuccess = false;
				saveTimeout = null;
			}, 3000);
		} catch (error) {
			saveSuccess = false;
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
				saveTimeout = null;
			}
			saveError =
				'Failed to save configuration: ' +
				(error instanceof Error ? error.message : 'Network error');
		}
	}

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

	onDestroy(() => {
		if (saveTimeout !== null) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
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
				<span class="text-red-400">✗</span>
				<span class="text-red-200">{saveError}</span>
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

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={showSaveDialog}
	mapType="bifurcation-logistic"
	isAuthenticated={Boolean(data?.session)}
	currentPath={$page.url.pathname}
	onClose={() => (showSaveDialog = false)}
	onSave={handleSave}
/>
