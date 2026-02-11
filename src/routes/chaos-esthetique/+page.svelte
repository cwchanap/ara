<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import ChaosEsthetiqueRenderer from '$lib/components/visualizations/ChaosEsthetiqueRenderer.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { ChaosEsthetiqueParameters } from '$lib/types';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';

	let { data } = $props();

	let a = $state(0.9);
	let b = $state(0.9999);
	let x0 = $state(18);
	let y0 = $state(0);
	let iterations = $state(10000);

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
	function getParameters(): ChaosEsthetiqueParameters {
		return { type: 'chaos-esthetique', a, b, x0, y0, iterations };
	}

	// Create save handler with cleanup
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'chaos-esthetique',
		saveState,
		getParameters
	);

	// Create share handler with cleanup
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'chaos-esthetique',
		shareState,
		getParameters
	);

	// Load config from URL on mount
	onMount(() => {
		const controller = new AbortController();
		const { signal } = controller;
		const fetchWithSignal = Object.assign(
			(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
				fetch(input, { ...init, signal }),
			{ preconnect: (fetch as { preconnect?: typeof fetch.preconnect }).preconnect }
		) as typeof fetch;

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
						mapType: 'chaos-esthetique',
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
					if (typeof typedParams.a === 'number') a = typedParams.a;
					if (typeof typedParams.b === 'number') b = typedParams.b;
					if (typeof typedParams.x0 === 'number') x0 = typedParams.x0;
					if (typeof typedParams.y0 === 'number') y0 = typedParams.y0;
					if (typeof typedParams.iterations === 'number') iterations = typedParams.iterations;

					const stability = checkParameterStability('chaos-esthetique', typedParams);
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
						mapType: 'chaos-esthetique',
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
					if (typeof typedParams.a === 'number') a = typedParams.a;
					if (typeof typedParams.b === 'number') b = typedParams.b;
					if (typeof typedParams.x0 === 'number') x0 = typedParams.x0;
					if (typeof typedParams.y0 === 'number') y0 = typedParams.y0;
					if (typeof typedParams.iterations === 'number') iterations = typedParams.iterations;

					const stability = checkParameterStability('chaos-esthetique', typedParams);
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
					const parsed = parseConfigParam({ mapType: 'chaos-esthetique', configParam });
					if (!parsed.ok) {
						console.error(parsed.logMessage, parsed.logDetails);
						if (signal.aborted) return;
						configErrors = parsed.errors;
						showConfigError = true;
					} else {
						// Now we can safely cast since validation passed
						const typedParams = parsed.parameters;
						if (signal.aborted) return;
						if (typeof typedParams.a === 'number') a = typedParams.a;
						if (typeof typedParams.b === 'number') b = typedParams.b;
						if (typeof typedParams.x0 === 'number') x0 = typedParams.x0;
						if (typeof typedParams.y0 === 'number') y0 = typedParams.y0;
						if (typeof typedParams.iterations === 'number') iterations = typedParams.iterations;

						// Check stability
						const stability = checkParameterStability('chaos-esthetique', typedParams);
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
				CHAOS_ESTHETIQUE
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_08
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

		<div class="grid grid-cols-1 md:grid-cols-5 gap-4">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="a" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						a
					</label>
					<span class="font-mono text-accent">{a.toFixed(4)}</span>
				</div>
				<input
					id="a"
					type="range"
					bind:value={a}
					min="0"
					max="2"
					step="0.0001"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="b" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						b
					</label>
					<span class="font-mono text-accent">{b.toFixed(4)}</span>
				</div>
				<input
					id="b"
					type="range"
					bind:value={b}
					min="0"
					max="1.5"
					step="0.0001"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="x0" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						x₀
					</label>
					<span class="font-mono text-accent">{x0.toFixed(2)}</span>
				</div>
				<input
					id="x0"
					type="range"
					bind:value={x0}
					min="-20"
					max="20"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="y0" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						y₀
					</label>
					<span class="font-mono text-accent">{y0.toFixed(2)}</span>
				</div>
				<input
					id="y0"
					type="range"
					bind:value={y0}
					min="-20"
					max="20"
					step="0.1"
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
					max="20000"
					step="1000"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>x(n+1) = y(n) + a·x(n) + 2(1-a)·x(n)² / (1+x(n)²)</p>
			<p>y(n+1) = -b·x(n) + f(x(n+1))</p>
		</div>
	</div>

	<!-- Visualization Container -->
	<ChaosEsthetiqueRenderer
		bind:a
		bind:b
		bind:x0
		bind:y0
		bind:iterations
		height={VIZ_CONTAINER_HEIGHT}
	/>

	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: CHAOS_ESTHETIQUE
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			This is a custom aesthetic chaos system that generates beautiful patterns through iterative
			transformations. The function f(x) creates a nonlinear mapping, and the coupled equations
			produce intricate attractors. The system is highly sensitive to parameters a and b, displaying
			a wide variety of behaviors from stable orbits to chaotic attractors.
		</p>
	</div>
</div>

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="chaos-esthetique"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<!-- Share Configuration Dialog -->
<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="chaos-esthetique"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
