<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import NewtonRenderer from '$lib/components/visualizations/NewtonRenderer.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { NewtonParameters } from '$lib/types';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';

	let { data } = $props();

	let xMin = $state(-0.01);
	let xMax = $state(0.01);
	let yMin = $state(-0.01);
	let yMax = $state(0.01);
	let maxIterations = $state(50);

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
	function getParameters(): NewtonParameters {
		return { type: 'newton', xMin, xMax, yMin, yMax, maxIterations };
	}

	// Create save handler with cleanup
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'newton',
		saveState,
		getParameters
	);

	// Create share handler with cleanup
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'newton',
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
						mapType: 'newton',
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
					if (typeof typedParams.xMin === 'number') xMin = typedParams.xMin;
					if (typeof typedParams.xMax === 'number') xMax = typedParams.xMax;
					if (typeof typedParams.yMin === 'number') yMin = typedParams.yMin;
					if (typeof typedParams.yMax === 'number') yMax = typedParams.yMax;
					if (typeof typedParams.maxIterations === 'number')
						maxIterations = typedParams.maxIterations;

					const stability = checkParameterStability('newton', typedParams);
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
						mapType: 'newton',
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
					if (typeof typedParams.xMin === 'number') xMin = typedParams.xMin;
					if (typeof typedParams.xMax === 'number') xMax = typedParams.xMax;
					if (typeof typedParams.yMin === 'number') yMin = typedParams.yMin;
					if (typeof typedParams.yMax === 'number') yMax = typedParams.yMax;
					if (typeof typedParams.maxIterations === 'number')
						maxIterations = typedParams.maxIterations;

					const stability = checkParameterStability('newton', typedParams);
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
					const parsed = parseConfigParam({ mapType: 'newton', configParam });
					if (!parsed.ok) {
						console.error(parsed.logMessage, parsed.logDetails);
						if (signal.aborted) return;
						configErrors = parsed.errors;
						showConfigError = true;
					} else {
						// Now we can safely cast since validation passed
						const typedParams = parsed.parameters;
						if (signal.aborted) return;
						if (typeof typedParams.xMin === 'number') xMin = typedParams.xMin;
						if (typeof typedParams.xMax === 'number') xMax = typedParams.xMax;
						if (typeof typedParams.yMin === 'number') yMin = typedParams.yMin;
						if (typeof typedParams.yMax === 'number') yMax = typedParams.yMax;
						if (typeof typedParams.maxIterations === 'number')
							maxIterations = typedParams.maxIterations;

						// Check stability
						const stability = checkParameterStability('newton', typedParams);
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
				NEWTON_FRACTAL
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_06
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

		<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
			<div class="space-y-4">
				<div class="flex justify-between items-end">
					<label for="xMin" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						x range
					</label>
					<span class="font-mono text-accent text-xs">[{xMin.toFixed(4)}, {xMax.toFixed(4)}]</span>
				</div>
				<div class="flex gap-4">
					<input
						id="xMin"
						type="range"
						bind:value={xMin}
						min="-1"
						max="0"
						step="0.001"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						aria-label="x minimum"
					/>
					<input
						id="xMax"
						type="range"
						bind:value={xMax}
						aria-label="x maximum"
						min="0"
						max="1"
						step="0.001"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
			</div>

			<div class="space-y-4">
				<div class="flex justify-between items-end">
					<label for="yMin" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						y range
					</label>
					<span class="font-mono text-accent text-xs">[{yMin.toFixed(4)}, {yMax.toFixed(4)}]</span>
				</div>
				<div class="flex gap-4">
					<input
						id="yMin"
						type="range"
						bind:value={yMin}
						min="-1"
						max="0"
						step="0.001"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						aria-label="y minimum"
					/>
					<input
						id="yMax"
						type="range"
						bind:value={yMax}
						aria-label="y maximum"
						min="0"
						max="1"
						step="0.001"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label
						for="maxIterations"
						class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>
						Max Iterations
					</label>
					<span class="font-mono text-accent">{maxIterations}</span>
				</div>
				<input
					id="maxIterations"
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

	<!-- Visualization Container -->
	<NewtonRenderer
		bind:xMin
		bind:xMax
		bind:yMin
		bind:yMax
		bind:maxIterations
		height={VIZ_CONTAINER_HEIGHT}
	/>

	<!-- Info Panel -->
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
	bind:open={saveState.showSaveDialog}
	mapType="newton"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<!-- Share Configuration Dialog -->
<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="newton"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
