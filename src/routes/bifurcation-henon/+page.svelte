<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import BifurcationHenonRenderer from '$lib/components/visualizations/BifurcationHenonRenderer.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { BifurcationHenonParameters } from '$lib/types';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();
	let aMin = $state(1.04);
	let aMax = $state(1.1);
	let b = $state(0.3);
	let maxIterations = $state(1000);

	// Save dialog state
	const saveState = $state(createInitialSaveState());

	// Share dialog state
	const shareState = $state(createInitialShareState());

	// Config loading state
	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);
	let lastAppliedConfigKey: string | null = null;
	let configLoadAbortController: AbortController | null = null;
	let isUnmounted = false;

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

	// Create share handler with cleanup
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'bifurcation-henon',
		shareState,
		getParameters
	);

	// Reactive config loading from URL
	$effect(() => {
		const configId = $page.url.searchParams.get('configId');
		const shareCode = $page.url.searchParams.get('share');
		const configParam = $page.url.searchParams.get('config');
		const configKey = shareCode
			? `share:${shareCode}`
			: configId
				? `id:${configId}`
				: configParam
					? `param:${configParam}`
					: null;
		if (configKey === lastAppliedConfigKey) return;
		lastAppliedConfigKey = configKey;

		configLoadAbortController?.abort();
		configLoadAbortController = null;

		if (shareCode || configId) {
			configErrors = [];
			showConfigError = false;
			stabilityWarnings = [];
			showStabilityWarning = false;
			const controller = new AbortController();
			configLoadAbortController = controller;
			const { signal } = controller;
			const currentConfigKey = configKey;

			const baseFetch = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
				fetch(input, { ...init, signal });
			const preconnectProp =
				typeof fetch.preconnect !== 'undefined' ? { preconnect: fetch.preconnect } : {};
			const fetchWithSignal = Object.assign(baseFetch, preconnectProp) as typeof fetch;

			void (async () => {
				try {
					let result: ReturnType<
						typeof loadSavedConfigParameters<'bifurcation-henon'>
					> extends Promise<infer T>
						? T
						: never | undefined;

					if (shareCode) {
						result = await loadSharedConfigParameters({
							shareCode,
							mapType: 'bifurcation-henon',
							base,
							fetchFn: fetchWithSignal
						});
					} else {
						result = await loadSavedConfigParameters({
							configId: configId!,
							mapType: 'bifurcation-henon',
							base,
							fetchFn: fetchWithSignal
						});
					}

					if (isUnmounted || signal.aborted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;
					if (!result) {
						lastAppliedConfigKey = null;
						configErrors = ['Failed to load configuration'];
						showConfigError = true;
						return;
					}
					if (!result.ok) {
						lastAppliedConfigKey = null;
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
				} catch (e) {
					if (e instanceof Error && e.name === 'AbortError') {
						return;
					}
					console.error('Failed to load configuration:', e);
					if (isUnmounted || signal.aborted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;
					lastAppliedConfigKey = null;
					configErrors = [
						'Failed to load configuration: ' + (e instanceof Error ? e.message : 'Unknown error')
					];
					showConfigError = true;
				}
			})();
		} else if (configParam) {
			try {
				configErrors = [];
				showConfigError = false;
				stabilityWarnings = [];
				showStabilityWarning = false;

				const parsed = parseConfigParam({ mapType: 'bifurcation-henon', configParam });
				if (!parsed.ok) {
					console.error(parsed.logMessage, parsed.logDetails);
					configErrors = parsed.errors;
					showConfigError = true;
					return;
				}

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

	// Cleanup on unmount
	onMount(() => {
		return () => {
			cleanupSaveHandler();
			cleanupShareHandler();
			configLoadAbortController?.abort();
			configLoadAbortController = null;
			isUnmounted = true;
		};
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
			<SnapshotButton
				target={rendererContainer}
				targetType="container"
				mapType="bifurcation-henon"
			/>
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

	<!-- Visualization Container -->
	<BifurcationHenonRenderer
		bind:containerElement={rendererContainer}
		bind:aMin
		bind:aMax
		bind:b
		bind:maxIterations
		height={VIZ_CONTAINER_HEIGHT}
	/>

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
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<!-- Share Configuration Dialog -->
<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="bifurcation-henon"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
