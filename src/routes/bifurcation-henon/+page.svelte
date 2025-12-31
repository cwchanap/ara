<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import { loadSavedConfigParameters, parseConfigParam } from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import type { BifurcationHenonParameters } from '$lib/types';

	let { data } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let imgWidth = 1000;
	let imgHeight = 1500;
	let aMin = $state(1.04);
	let aMax = $state(1.1);
	let b = $state(0.3);
	let maxIterations = $state(1000);
	let isRendering = false;

	// Save dialog state
	const saveState = $state(createInitialSaveState());
	let saveAbortController: AbortController | null = null;
	let configLoadAbortController: AbortController | null = null;
	let isUnmounted = false;
	let lastAppliedConfigKey = $state<string | null>(null);

	// Stability warning state
	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	// Load config from URL on mount
	$effect(() => {
		const configId = $page.url.searchParams.get('configId');
		const configParam = $page.url.searchParams.get('config');
		const configKey = configId ? `id:${configId}` : configParam ? `param:${configParam}` : null;
		if (configKey === lastAppliedConfigKey) return;
		lastAppliedConfigKey = configKey;

		configLoadAbortController?.abort();
		configLoadAbortController = null;

		if (configId) {
			configErrors = [];
			showConfigError = false;
			stabilityWarnings = [];
			showStabilityWarning = false;
			const controller = new AbortController();
			configLoadAbortController = controller;
			const { signal } = controller;
			const currentConfigKey = configKey;

			void (async () => {
				const fetchWithSignal: typeof fetch = Object.assign(
					(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
						fetch(input, { ...init, signal }),
					{ preconnect: fetch.preconnect }
				);

				const result = await loadSavedConfigParameters({
					configId,
					mapType: 'bifurcation-henon',
					base,
					fetchFn: fetchWithSignal
				});
				if (isUnmounted || signal.aborted) return;
				if (lastAppliedConfigKey !== currentConfigKey) return;
				if (!result.ok) {
					configErrors = result.errors;
					showConfigError = true;
					return;
				}

				const typedParams = result.parameters;
				aMin = typedParams.aMin ?? aMin;
				aMax = typedParams.aMax ?? aMax;
				b = typedParams.b ?? b;
				maxIterations = typedParams.maxIterations ?? maxIterations;

				const stability = checkParameterStability('bifurcation-henon', typedParams);
				if (!stability.isStable) {
					stabilityWarnings = stability.warnings;
					showStabilityWarning = true;
				}
			})();
		} else if (configParam) {
			try {
				configErrors = [];
				showConfigError = false;
				stabilityWarnings = [];
				showStabilityWarning = false;

				// Validate parameters structure before using
				const parsed = parseConfigParam({ mapType: 'bifurcation-henon', configParam });
				if (!parsed.ok) {
					console.error(parsed.logMessage, parsed.logDetails);
					configErrors = parsed.errors;
					showConfigError = true;
					return;
				}

				// Now we can safely cast since validation passed
				const typedParams = parsed.parameters;
				aMin = typedParams.aMin ?? aMin;
				aMax = typedParams.aMax ?? aMax;
				b = typedParams.b ?? b;
				maxIterations = typedParams.maxIterations ?? maxIterations;

				const stability = checkParameterStability('bifurcation-henon', typedParams);
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
	function getParameters(): BifurcationHenonParameters {
		return { type: 'bifurcation-henon', aMin, aMax, b, maxIterations };
	}

	// Create save handler with cleanup
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'bifurcation-henon',
		saveState,
		getParameters
	);

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

	onMount(() => {
		return () => {
			isUnmounted = true;
			if (configLoadAbortController) {
				configLoadAbortController.abort();
				configLoadAbortController = null;
			}
			if (saveAbortController) {
				saveAbortController.abort();
				saveAbortController = null;
			}
			// Clear save handler timeout to prevent state updates after unmount
			cleanupSaveHandler();
		};
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
		<div class="flex gap-3">
			<SnapshotButton target={canvas} targetType="canvas" mapType="bifurcation-henon" />
			<button
				onclick={() => (saveState.showSaveDialog = true)}
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
	{#if saveState.saveSuccess}
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
	{#if saveState.saveError}
		<div
			class="fixed top-20 right-4 z-50 px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-right-5"
		>
			<div class="flex items-center gap-3">
				<span class="text-red-400">✕</span>
				<span class="text-red-200">{saveState.saveError}</span>
				<button
					onclick={() => (saveState.saveError = null)}
					class="ml-2 text-red-400/60 hover:text-red-400 transition-colors"
					aria-label="Close error message"
				>
					×
				</button>
			</div>
		</div>
	{/if}

	<!-- Invalid Configuration -->
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

		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="aMin" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						a min
					</label>
					<span class="font-mono text-accent">{aMin.toFixed(3)}</span>
				</div>
				<input
					id="aMin"
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
					<label for="aMax" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						a max
					</label>
					<span class="font-mono text-accent">{aMax.toFixed(3)}</span>
				</div>
				<input
					id="aMax"
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
					<label for="b" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						b
					</label>
					<span class="font-mono text-accent">{b.toFixed(3)}</span>
				</div>
				<input
					id="b"
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
					<label
						for="maxIterations"
						class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>
						Iterations
					</label>
					<span class="font-mono text-accent">{maxIterations}</span>
				</div>
				<input
					id="maxIterations"
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

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="bifurcation-henon"
	isAuthenticated={Boolean(data?.session)}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>
