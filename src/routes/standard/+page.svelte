<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import StandardRenderer from '$lib/components/visualizations/StandardRenderer.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { StandardParameters } from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();
	let K = $state(0.971635);
	let numP = $state(10);
	let numQ = $state(10);
	let iterations = $state(20000);

	// Save dialog state
	const saveState = $state(createInitialSaveState());

	// Share dialog state
	const shareState = $state(createInitialShareState());

	// Config loading state
	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	// Get current parameters for saving
	function getParameters(): StandardParameters {
		return { type: 'standard', K, numP, numQ, iterations };
	}

	let comparisonUrl = $state('');
	$effect(() => {
		void K;
		void numP;
		void numQ;
		void iterations;
		comparisonUrl = buildComparisonUrl(
			base,
			'standard',
			createComparisonStateFromCurrent('standard', getParameters())
		);
	});

	// Create save handler with cleanup
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'standard',
		saveState,
		getParameters
	);

	// Create share handler with cleanup
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'standard',
		shareState,
		getParameters
	);

	// Load config from URL on mount
	onMount(() => {
		const controller = new AbortController();
		const { signal } = controller;
		const fetchWithSignal: typeof fetch = Object.assign(
			(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
				fetch(input, { ...init, signal }),
			{ preconnect: fetch.preconnect }
		);

		configErrors = [];
		showConfigError = false;
		stabilityWarnings = [];
		showStabilityWarning = false;

		const configId = $page.url.searchParams.get('configId');
		const shareCode = $page.url.searchParams.get('share');
		if (shareCode) {
			void (async () => {
				try {
					const result = await loadSharedConfigParameters({
						shareCode,
						mapType: 'standard',
						base,
						fetchFn: fetchWithSignal
					});
					if (signal.aborted) return;
					if (!result.ok) {
						configErrors = result.errors;
						showConfigError = true;
						return;
					}

					const typedParams = result.parameters;
					if (typeof typedParams.K === 'number') K = typedParams.K;
					if (typeof typedParams.numP === 'number') numP = typedParams.numP;
					if (typeof typedParams.numQ === 'number') numQ = typedParams.numQ;
					if (typeof typedParams.iterations === 'number') iterations = typedParams.iterations;

					const stability = checkParameterStability('standard', typedParams);
					if (!stability.isStable) {
						stabilityWarnings = stability.warnings;
						showStabilityWarning = true;
					}
				} catch (err) {
					if (
						signal.aborted ||
						(err instanceof DOMException && err.name === 'AbortError') ||
						(err instanceof Error && err.name === 'AbortError')
					) {
						return;
					}
					configErrors = ['Failed to load shared configuration'];
					showConfigError = true;
				}
			})();
		} else if (configId) {
			void (async () => {
				try {
					const result = await loadSavedConfigParameters({
						configId,
						mapType: 'standard',
						base,
						fetchFn: fetchWithSignal
					});
					if (signal.aborted) return;
					if (!result.ok) {
						if (signal.aborted) return;
						configErrors = result.errors;
						showConfigError = true;
						return;
					}

					const typedParams = result.parameters;
					if (signal.aborted) return;
					if (typeof typedParams.K === 'number') K = typedParams.K;
					if (typeof typedParams.numP === 'number') numP = typedParams.numP;
					if (typeof typedParams.numQ === 'number') numQ = typedParams.numQ;
					if (typeof typedParams.iterations === 'number') iterations = typedParams.iterations;

					const stability = checkParameterStability('standard', typedParams);
					if (signal.aborted) return;
					if (!stability.isStable) {
						stabilityWarnings = stability.warnings;
						showStabilityWarning = true;
					}
				} catch (err) {
					if (
						signal.aborted ||
						(err instanceof DOMException && err.name === 'AbortError') ||
						(err instanceof Error && err.name === 'AbortError')
					) {
						return;
					}
					configErrors = ['Failed to load configuration parameters'];
					showConfigError = true;
				}
			})();
		} else {
			const configParam = $page.url.searchParams.get('config');
			if (configParam) {
				try {
					// Validate parameters structure before using
					const parsed = parseConfigParam({ mapType: 'standard', configParam });
					if (!parsed.ok) {
						console.error(parsed.logMessage, parsed.logDetails);
						if (signal.aborted) return;
						configErrors = parsed.errors;
						showConfigError = true;
					} else {
						// Now we can safely cast since validation passed
						const typedParams = parsed.parameters;
						if (signal.aborted) return;
						if (typeof typedParams.K === 'number') K = typedParams.K;
						if (typeof typedParams.numP === 'number') numP = typedParams.numP;
						if (typeof typedParams.numQ === 'number') numQ = typedParams.numQ;
						if (typeof typedParams.iterations === 'number') iterations = typedParams.iterations;

						// Check stability
						const stability = checkParameterStability('standard', typedParams);
						if (signal.aborted) return;
						if (!stability.isStable) {
							stabilityWarnings = stability.warnings;
							showStabilityWarning = true;
						}
					}
				} catch (e) {
					console.error('Invalid config parameter:', e);
					if (signal.aborted) return;
					configErrors = ['Failed to parse configuration parameters'];
					showConfigError = true;
				}
			}
		}

		return () => {
			controller.abort();
			// Clear save/share handler timeouts to prevent state updates after unmount
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
				STANDARD_MAP
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_07
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={rendererContainer} targetType="container" mapType="standard" />
			{#if comparisonUrl}
				<a
					href={comparisonUrl}
					class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
				>
					⊞ Compare
				</a>
			{:else}
				<span
					class="px-6 py-2 bg-primary/10 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-sm font-bold opacity-50 cursor-not-allowed"
					aria-disabled="true"
				>
					⊞ Compare
				</span>
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
				href="{base}/"
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

		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="K" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						K
					</label>
					<span class="font-mono text-accent">{K.toFixed(6)}</span>
				</div>
				<input
					id="K"
					type="range"
					bind:value={K}
					min="0"
					max="5"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="numP" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Initial p points
					</label>
					<span class="font-mono text-accent">{numP}</span>
				</div>
				<input
					id="numP"
					type="range"
					bind:value={numP}
					min="1"
					max="20"
					step="1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="numQ" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Initial q points
					</label>
					<span class="font-mono text-accent">{numQ}</span>
				</div>
				<input
					id="numQ"
					type="range"
					bind:value={numQ}
					min="1"
					max="20"
					step="1"
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
					min="1000"
					max="50000"
					step="1000"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>p(n+1) = p(n) + K·sin(q(n)) mod 2π</p>
			<p>q(n+1) = q(n) + p(n+1) mod 2π</p>
		</div>

		<div class="text-xs text-accent/80 font-mono border-l-2 border-accent pl-2">
			ALERT: High iteration counts may cause rendering latency.
		</div>
	</div>

	<!-- Visualization Container -->
	<StandardRenderer
		bind:containerElement={rendererContainer}
		bind:K
		bind:numP
		bind:numQ
		bind:iterations
		height={VIZ_CONTAINER_HEIGHT}
	/>

	<!-- Info Panel -->
	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: STANDARD_MAP
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The standard map (also called the Chirikov-Taylor map) is an area-preserving chaotic map from
			a square with side 2π onto itself. It was introduced as a simplified model for motion in a
			magnetic field. For low values of K, the map displays regular behavior with stable orbits,
			while larger K values lead to chaotic dynamics.
		</p>
	</div>
</div>

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="standard"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<!-- Share Configuration Dialog -->
<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="standard"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
