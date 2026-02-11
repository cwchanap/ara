<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import BifurcationLogisticRenderer from '$lib/components/visualizations/BifurcationLogisticRenderer.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import { useConfigLoader, createInitialConfigLoaderState } from '$lib/use-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { BifurcationLogisticParameters } from '$lib/types';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';

	let { data } = $props();

	let rMin = $state(3.5); // Zoomed in slightly for better initial view
	let rMax = $state(4.0);
	let maxIterations = $state(1000);

	// Save dialog state
	const saveState = $state(createInitialSaveState());

	// Share dialog state
	const shareState = $state(createInitialShareState());

	// Config loading state
	const configState = $state(createInitialConfigLoaderState());
	// Reactive derived values for compatibility with existing template
	let configErrors = $derived(configState.errors);
	let showConfigError = $derived(configState.showError);
	let stabilityWarnings = $derived(configState.warnings);
	let showStabilityWarning = $derived(configState.showWarning);

	// Get current parameters for saving
	function getParameters(): BifurcationLogisticParameters {
		return { type: 'bifurcation-logistic', rMin, rMax, maxIterations };
	}

	// Create save handler with cleanup
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'bifurcation-logistic',
		saveState,
		getParameters
	);

	// Create share handler with cleanup
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'bifurcation-logistic',
		shareState,
		getParameters
	);

	// Use shared config loader hook with proper cleanup
	$effect(() => {
		const { cleanup: cleanupConfigLoader } = useConfigLoader(
			{
				page,
				mapType: 'bifurcation-logistic',
				base,
				onParametersLoaded: (typedParams) => {
					// Clamp and normalize parameters before applying
					let nextRMin = 3.5;
					let nextRMax = 4.0;
					let nextMaxIterations = 1000;

					if (typeof typedParams.rMin === 'number') {
						nextRMin = Math.max(2.5, Math.min(4.0, typedParams.rMin));
					}
					if (typeof typedParams.rMax === 'number') {
						nextRMax = Math.max(2.5, Math.min(4.0, typedParams.rMax));
					}
					if (typeof typedParams.maxIterations === 'number') {
						nextMaxIterations = Math.max(100, Math.min(2000, typedParams.maxIterations));
					}

					// Enforce rMin <= rMax
					if (nextRMin > nextRMax) {
						const temp = nextRMin;
						nextRMin = nextRMax;
						nextRMax = temp;
					}

					rMin = nextRMin;
					rMax = nextRMax;
					maxIterations = nextMaxIterations;

					const stability = checkParameterStability('bifurcation-logistic', {
						type: 'bifurcation-logistic',
						rMin: nextRMin,
						rMax: nextRMax,
						maxIterations: nextMaxIterations
					});
					if (!stability.isStable) {
						configState.warnings = stability.warnings;
						configState.showWarning = true;
					}
				}
			},
			configState
		);

		return () => {
			cleanupSaveHandler();
			cleanupShareHandler();
			cleanupConfigLoader();
		};
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
				onclick={() => (shareState.showShareDialog = true)}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				🔗 Share
			</button>
			<button
				onclick={() => (saveState.showSaveDialog = true)}
				class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				💾 Save
			</button>
			<a
				href={base + '/'}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				← Return
			</a>
		</div>
	</div>

	<!-- Alerts: Save success/error, config errors, stability warnings -->
	<VisualizationAlerts
		saveSuccess={saveState.saveSuccess}
		saveError={saveState.saveError}
		{configErrors}
		{showConfigError}
		onDismissConfigError={() => (showConfigError = false)}
		{stabilityWarnings}
		{showStabilityWarning}
		onDismissStabilityWarning={() => (showStabilityWarning = false)}
		onDismissSaveError={() => (saveState.saveError = null)}
		onDismissSaveSuccess={() => (saveState.saveSuccess = false)}
	/>

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
					<label for="rMin" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						r min
					</label>
					<span class="font-mono text-accent">{rMin.toFixed(3)}</span>
				</div>
				<input
					id="rMin"
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
					<label for="rMax" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						r max
					</label>
					<span class="font-mono text-accent">{rMax.toFixed(3)}</span>
				</div>
				<input
					id="rMax"
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
			class="grid grid-cols-1 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>x(n+1) = r·x(n)·(1 - x(n))</p>
		</div>
	</div>

	<!-- Visualization Container -->
	<BifurcationLogisticRenderer
		bind:rMin
		bind:rMax
		bind:maxIterations
		height={VIZ_CONTAINER_HEIGHT}
	/>

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
	bind:open={saveState.showSaveDialog}
	mapType="bifurcation-logistic"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<!-- Share Configuration Dialog -->
<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="bifurcation-logistic"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
