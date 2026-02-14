<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import LyapunovRenderer from '$lib/components/visualizations/LyapunovRenderer.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import { useConfigLoader, createInitialConfigLoaderState } from '$lib/use-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { LyapunovParameters } from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';

	let { data } = $props();

	let rMin = $state(2.5);
	let rMax = $state(4.0);
	let iterations = $state(1000);
	let transientIterations = $state(500);

	// Save dialog state
	const saveState = $state(createInitialSaveState());

	// Share dialog state
	const shareState = $state(createInitialShareState());

	// Config loading state using the unified loader
	const configState = $state(createInitialConfigLoaderState());

	// Helper function to clamp and normalize Lyapunov parameters
	function clampAndNormalizeLyapunovParams(typedParams: Partial<LyapunovParameters>) {
		let rMin = 2.5;
		let rMax = 4.0;
		let iterations = 1000;
		let transientIterations = 500;

		if (typeof typedParams.rMin === 'number') {
			rMin = Math.max(0, Math.min(4.0, typedParams.rMin));
		}
		if (typeof typedParams.rMax === 'number') {
			rMax = Math.max(0, Math.min(4.0, typedParams.rMax));
		}
		if (typeof typedParams.iterations === 'number') {
			iterations = Math.max(100, Math.min(10000, typedParams.iterations));
		}
		if (typeof typedParams.transientIterations === 'number') {
			transientIterations = Math.max(50, Math.min(5000, typedParams.transientIterations));
		}

		// Enforce rMin <= rMax
		if (rMin > rMax) {
			const temp = rMin;
			rMin = rMax;
			rMax = temp;
		}

		return { rMin, rMax, iterations, transientIterations };
	}

	// Get current parameters for saving
	function getParameters(): LyapunovParameters {
		return { type: 'lyapunov', rMin, rMax, iterations, transientIterations };
	}

	let comparisonUrl = $state('');
	$effect(() => {
		void rMin;
		void rMax;
		void iterations;
		void transientIterations;
		comparisonUrl = buildComparisonUrl(
			base,
			'lyapunov',
			createComparisonStateFromCurrent('lyapunov', getParameters())
		);
	});

	// Create save handler with cleanup
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'lyapunov',
		saveState,
		getParameters
	);

	// Create share handler with cleanup
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'lyapunov',
		shareState,
		getParameters
	);

	// Reactive config loading from URL using unified loader
	$effect(() => {
		const { cleanup } = useConfigLoader(
			{
				page,
				mapType: 'lyapunov',
				base,
				onParametersLoaded: (params) => {
					// Clamp and normalize parameters before applying
					const normalizedParams = clampAndNormalizeLyapunovParams(params);
					rMin = normalizedParams.rMin;
					rMax = normalizedParams.rMax;
					iterations = normalizedParams.iterations;
					transientIterations = normalizedParams.transientIterations;

					// Run stability check on normalized values (not raw loaded values)
					const stability = checkParameterStability('lyapunov', {
						type: 'lyapunov',
						...normalizedParams
					});
					if (!stability.isStable) {
						configState.warnings = stability.warnings;
						configState.showWarning = true;
					}
				}
			},
			configState
		);

		return cleanup;
	});

	// Cleanup handlers on unmount
	$effect(() => {
		return () => {
			cleanupSaveHandler();
			cleanupShareHandler();
		};
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				LYAPUNOV_EXPONENTS
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				QUANTIFYING_CHAOS // MODULE_10
			</p>
		</div>
		<div class="flex gap-3">
			{#if comparisonUrl}
				<a
					href={comparisonUrl}
					class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
				>
					⊞ Compare
				</a>
			{:else}
				<button
					type="button"
					disabled
					class="px-6 py-2 bg-primary/10 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-sm font-bold opacity-50 cursor-not-allowed"
				>
					⊞ Compare
				</button>
			{/if}
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
		configErrors={configState.errors}
		showConfigError={configState.showError}
		onDismissConfigError={() => (configState.showError = false)}
		stabilityWarnings={configState.warnings}
		showStabilityWarning={configState.showWarning}
		onDismissStabilityWarning={() => (configState.showWarning = false)}
		onDismissSaveError={() => (saveState.saveError = null)}
		onDismissSaveSuccess={() => (saveState.saveSuccess = false)}
	/>

	<!-- Control Panel -->
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

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="r-min" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						r min
					</label>
					<span class="font-mono text-accent">{rMin.toFixed(3)}</span>
				</div>
				<input
					id="r-min"
					type="range"
					bind:value={rMin}
					min="0"
					max="4"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="r-max" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						r max
					</label>
					<span class="font-mono text-accent">{rMax.toFixed(3)}</span>
				</div>
				<input
					id="r-max"
					type="range"
					bind:value={rMax}
					min="0"
					max="4"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label
						for="iterations"
						class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>
						Iterations
					</label>
					<span class="font-mono text-accent">{iterations}</span>
				</div>
				<input
					id="iterations"
					type="range"
					bind:value={iterations}
					min="100"
					max="10000"
					step="100"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label
						for="transient"
						class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>
						Transient
					</label>
					<span class="font-mono text-accent">{transientIterations}</span>
				</div>
				<input
					id="transient"
					type="range"
					bind:value={transientIterations}
					min="50"
					max="5000"
					step="50"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>λ = lim(n→∞) (1/n) Σ ln|r(1-2xᵢ)|</p>
		</div>
	</div>

	<!-- Visualization Container -->
	<LyapunovRenderer
		bind:rMin
		bind:rMax
		bind:iterations
		bind:transientIterations
		height={VIZ_CONTAINER_HEIGHT}
	/>

	<!-- Info Panel -->
	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: LYAPUNOV_ANALYSIS
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl mb-4">
			The Lyapunov exponent provides the most fundamental quantitative measure of chaos,
			characterizing the average rate at which nearby trajectories diverge in phase space. A
			positive exponent indicates exponential divergence of nearby trajectories and serves as the
			primary diagnostic for chaos.
		</p>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
			<div class="bg-black/20 p-4 rounded border border-white/5">
				<h4 class="text-primary font-['Orbitron'] text-sm mb-2">Lyapunov Time Examples</h4>
				<ul class="text-xs text-muted-foreground space-y-1">
					<li>• Weather systems: ~5 days</li>
					<li>• Chaotic circuits: ~1 ms</li>
					<li>• Solar system: 4-5 million years</li>
				</ul>
			</div>
			<div class="bg-black/20 p-4 rounded border border-white/5">
				<h4 class="text-primary font-['Orbitron'] text-sm mb-2">Kaplan-Yorke Dimension</h4>
				<p class="text-xs text-muted-foreground">
					D<sub>L</sub> = j + (λ₁ + ... + λ<sub>j</sub>) / |λ<sub>j+1</sub>|
				</p>
				<p class="text-xs text-muted-foreground mt-1">
					Relates Lyapunov exponents to fractal dimension
				</p>
			</div>
		</div>
	</div>
</div>

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="lyapunov"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<!-- Share Configuration Dialog -->
<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="lyapunov"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
