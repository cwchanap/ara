<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import LoziRenderer from '$lib/components/visualizations/LoziRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { LoziParameters } from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();
	let a = $state(0.5);
	let b = $state(0.3);
	let x0 = $state(0);
	let y0 = $state(0);
	let iterations = $state(2000);
	let lastAppliedConfigKey = $state<string | null>(null);
	let configLoadAbortController: AbortController | null = null;
	let isUnmounted = false;

	// Save dialog state
	const saveState = $state(createInitialSaveState());

	// Share dialog state
	const shareState = $state(createInitialShareState());

	// Stability warning state
	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	// Load config from URL reactively
	$effect(() => {
		const configId = get(page).url.searchParams.get('configId');
		const shareCode = get(page).url.searchParams.get('share');
		const configParam = get(page).url.searchParams.get('config');
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

			void (async () => {
				const fetchWithSignal: typeof fetch = Object.assign(
					(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
						fetch(input, { ...init, signal }),
					{ preconnect: fetch.preconnect }
				);

				try {
					let result: ReturnType<typeof loadSavedConfigParameters<'lozi'>> extends Promise<infer T>
						? T
						: never | undefined;

					if (shareCode) {
						result = await loadSharedConfigParameters({
							shareCode,
							mapType: 'lozi',
							base,
							fetchFn: fetchWithSignal
						});
					} else {
						result = await loadSavedConfigParameters({
							configId: configId!,
							mapType: 'lozi',
							base,
							fetchFn: fetchWithSignal
						});
					}

					if (isUnmounted || signal.aborted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;
					if (!result) {
						configErrors = ['Failed to load configuration'];
						showConfigError = true;
						return;
					}
					if (!result.ok) {
						configErrors = result.errors;
						showConfigError = true;
						return;
					}

					const typedParams = result.parameters;
					a = typedParams.a ?? a;
					b = typedParams.b ?? b;
					x0 = typedParams.x0 ?? x0;
					y0 = typedParams.y0 ?? y0;
					iterations = typedParams.iterations ?? iterations;

					const stability = checkParameterStability('lozi', typedParams);
					if (!stability.isStable) {
						stabilityWarnings = stability.warnings;
						showStabilityWarning = true;
					}
				} catch (e) {
					// Check if this was an abort error (expected during cleanup)
					if (e instanceof Error && e.name === 'AbortError') {
						return; // Silently ignore abort errors
					}
					console.error('Failed to load configuration:', e);
					if (isUnmounted || signal.aborted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;
					configErrors = [
						'Failed to load configuration: ' + (e instanceof Error ? e.message : 'Unknown error')
					];
					showConfigError = true;
					return;
				}
			})();
		} else if (configParam) {
			try {
				configErrors = [];
				showConfigError = false;
				stabilityWarnings = [];
				showStabilityWarning = false;

				// Validate parameters structure before using
				const parsed = parseConfigParam({ mapType: 'lozi', configParam });
				if (!parsed.ok) {
					console.error(parsed.logMessage, parsed.logDetails);
					configErrors = parsed.errors;
					showConfigError = true;
					return;
				}

				// Now we can safely cast since validation passed
				const typedParams = parsed.parameters;
				a = typedParams.a ?? a;
				b = typedParams.b ?? b;
				x0 = typedParams.x0 ?? x0;
				y0 = typedParams.y0 ?? y0;
				iterations = typedParams.iterations ?? iterations;

				const stability = checkParameterStability('lozi', typedParams);
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
	function getParameters(): LoziParameters {
		return { type: 'lozi', a, b, x0, y0, iterations };
	}

	// Create save handler with cleanup
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'lozi',
		saveState,
		getParameters
	);

	// Create share handler with cleanup
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'lozi',
		shareState,
		getParameters
	);

	onMount(() => {
		return () => {
			// Clear save/share handler timeouts to prevent state updates after unmount
			cleanupSaveHandler();
			cleanupShareHandler();
			// Abort any pending config load requests
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
				LOZI_MAP
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_11
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={rendererContainer} targetType="container" mapType="lozi" />
			<a
				href={buildComparisonUrl(
					base,
					'lozi',
					createComparisonStateFromCurrent('lozi', getParameters())
				)}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				⊞ Compare
			</a>
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

	<VisualizationAlerts
		saveSuccess={saveState.saveSuccess}
		saveError={saveState.saveError}
		{configErrors}
		{showConfigError}
		onDismissConfigError={() => (showConfigError = false)}
		{stabilityWarnings}
		{showStabilityWarning}
		onDismissStabilityWarning={() => (showStabilityWarning = false)}
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

		<div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="a" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						a
					</label>
					<span data-testid="value-a" class="font-mono text-accent">{a.toFixed(3)}</span>
				</div>
				<input
					id="a"
					data-testid="slider-a"
					type="range"
					bind:value={a}
					min="0.5"
					max="2"
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
					<label for="x0" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						x₀
					</label>
					<span class="font-mono text-accent">{x0.toFixed(2)}</span>
				</div>
				<input
					id="x0"
					type="range"
					bind:value={x0}
					min="-2"
					max="2"
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
					min="-2"
					max="2"
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
					min="100"
					max="5000"
					step="100"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>x(n+1) = 1 + y(n) - a·|x(n)|</p>
			<p>y(n+1) = b·x(n)</p>
		</div>
	</div>

	<LoziRenderer
		bind:containerElement={rendererContainer}
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
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">DATA_LOG: LOZI_MAP</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Lozi map is a piecewise-linear counterpart to the Hénon map, introduced by René Lozi in
			1978. By replacing the quadratic term with an absolute value, it provides a simpler
			mathematical structure while retaining rich chaotic dynamics. The absolute value creates a
			kink at x = 0, forming two linear branches that enable rigorous theoretical analysis in
			certain parameter regions where hyperbolicity holds.
		</p>
	</div>
</div>

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="lozi"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<!-- Share Configuration Dialog -->
<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="lozi"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
