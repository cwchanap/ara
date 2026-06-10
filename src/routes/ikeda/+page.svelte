<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import IkedaRenderer from '$lib/components/visualizations/IkedaRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { IkedaParameters, IkedaColorMode, IkedaRenderMode } from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';
	import {
		IKEDA_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_IKEDA_PRESET_ID,
		type IkedaPresetState
	} from '$lib/ikeda-presets';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();

	const defaultPreset = getPreset(DEFAULT_IKEDA_PRESET_ID);
	if (!defaultPreset) throw new Error(`Missing default Ikeda preset: ${DEFAULT_IKEDA_PRESET_ID}`);
	const defaultState = defaultPreset.state;
	let u = $state(defaultState.u);
	let x0 = $state(defaultState.x0);
	let y0 = $state(defaultState.y0);
	let iterations = $state(defaultState.iterations);
	let burnIn = $state(defaultState.burnIn);
	let renderMode = $state<IkedaRenderMode>(defaultState.renderMode);
	let seeds = $state(defaultState.seeds);
	let colorMode = $state<IkedaColorMode>(defaultState.colorMode);
	let pointSize = $state(defaultState.pointSize);
	let opacity = $state(defaultState.opacity);

	let lastAppliedConfigKey: string | null = null;
	let configLoadAbortController: AbortController | null = null;
	let isUnmounted = false;

	const saveState = $state(createInitialSaveState());
	const shareState = $state(createInitialShareState());

	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	function currentPresetState(): IkedaPresetState {
		return { u, x0, y0, iterations, burnIn, renderMode, seeds, colorMode, pointSize, opacity };
	}

	const activePresetId = $derived(detectPresetId(currentPresetState()));
	const activePresetLabel = $derived(
		activePresetId ? (getPreset(activePresetId)?.label ?? 'CUSTOM') : 'CUSTOM'
	);

	function applyPreset(id: string) {
		const preset = getPreset(id);
		if (!preset) return;
		const s = preset.state;
		u = s.u;
		x0 = s.x0;
		y0 = s.y0;
		iterations = s.iterations;
		burnIn = s.burnIn;
		renderMode = s.renderMode;
		seeds = s.seeds;
		colorMode = s.colorMode;
		pointSize = s.pointSize;
		opacity = s.opacity;

		stabilityWarnings = [];
		showStabilityWarning = false;
		const stability = checkParameterStability('ikeda', {
			type: 'ikeda',
			u,
			x0,
			y0,
			iterations,
			burnIn
		});
		if (!stability.isStable) {
			stabilityWarnings = stability.warnings;
			showStabilityWarning = true;
		}
	}

	// Load config from URL reactively (mirrors the Lozi page).
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

			void (async () => {
				const _fetch = fetch as typeof fetch & { preconnect?: typeof fetch };
				const fetchWithSignal: typeof fetch = Object.assign(
					(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
						fetch(input, { ...init, signal }),
					{ preconnect: _fetch.preconnect }
				);

				try {
					let result: ReturnType<typeof loadSavedConfigParameters<'ikeda'>> extends Promise<infer T>
						? T
						: never | undefined;

					if (shareCode) {
						result = await loadSharedConfigParameters({
							shareCode,
							mapType: 'ikeda',
							base,
							fetchFn: fetchWithSignal
						});
					} else {
						result = await loadSavedConfigParameters({
							configId: configId!,
							mapType: 'ikeda',
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

					applyParameters(result.parameters);
				} catch (e) {
					if (e instanceof Error && e.name === 'AbortError') return;
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

				const parsed = parseConfigParam({ mapType: 'ikeda', configParam });
				if (!parsed.ok) {
					console.error(parsed.logMessage, parsed.logDetails);
					configErrors = parsed.errors;
					showConfigError = true;
					return;
				}
				applyParameters(parsed.parameters);
			} catch (e) {
				console.error('Invalid config parameter:', e);
				configErrors = ['Failed to parse configuration parameters'];
				showConfigError = true;
			}
		}
	});

	function applyParameters(p: IkedaParameters) {
		u = p.u ?? u;
		x0 = p.x0 ?? x0;
		y0 = p.y0 ?? y0;
		iterations = p.iterations ?? iterations;
		burnIn = p.burnIn ?? burnIn;
		renderMode = p.renderMode ?? renderMode;
		seeds = p.seeds ?? seeds;
		colorMode = p.colorMode ?? colorMode;
		pointSize = p.pointSize ?? pointSize;
		opacity = p.opacity ?? opacity;

		const stability = checkParameterStability('ikeda', {
			type: 'ikeda',
			u,
			x0,
			y0,
			iterations,
			burnIn
		});
		if (!stability.isStable) {
			stabilityWarnings = stability.warnings;
			showStabilityWarning = true;
		} else {
			stabilityWarnings = [];
			showStabilityWarning = false;
		}
	}

	function getParameters(): IkedaParameters {
		return {
			type: 'ikeda',
			u,
			x0,
			y0,
			iterations,
			burnIn,
			renderMode,
			seeds,
			colorMode,
			pointSize,
			opacity
		};
	}

	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'ikeda',
		saveState,
		getParameters
	);
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'ikeda',
		shareState,
		getParameters
	);

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
				IKEDA_MAP
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				NONLINEAR_OPTICAL_FEEDBACK // DISCRETE_CHAOTIC_MAP
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={rendererContainer} targetType="container" mapType="ikeda" />
			<a
				href={buildComparisonUrl(
					base,
					'ikeda',
					createComparisonStateFromCurrent('ikeda', getParameters())
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
				href={base + '/'}
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
		onDismissSaveError={() => (saveState.saveError = null)}
		onDismissSaveSuccess={() => (saveState.saveSuccess = false)}
	/>

	<!-- Presets -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-4 relative"
	>
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
				<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
				PRESETS
			</h2>
			<span
				class="text-xs uppercase tracking-widest text-accent font-mono"
				data-testid="active-preset"
			>
				{activePresetLabel}
			</span>
		</div>
		<div class="flex flex-wrap gap-3">
			{#each IKEDA_PRESETS as preset (preset.id)}
				<button
					onclick={() => applyPreset(preset.id)}
					aria-pressed={activePresetId === preset.id}
					class="px-4 py-2 border rounded-sm uppercase tracking-widest text-xs font-bold transition-all {activePresetId ===
					preset.id
						? 'bg-primary/20 text-primary border-primary/60 shadow-[0_0_15px_rgba(0,243,255,0.2)]'
						: 'bg-primary/5 text-primary/70 border-primary/20 hover:bg-primary/10'}"
				>
					{preset.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- System parameters -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative overflow-hidden group"
	>
		<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
		<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
		<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

		<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
			<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
			SYSTEM_PARAMETERS
		</h2>

		<!-- Feedback (emphasized) -->
		<div class="space-y-2 border border-primary/40 rounded-sm p-4 bg-primary/5">
			<div class="flex justify-between items-end">
				<label for="u" class="text-primary text-sm uppercase tracking-widest font-bold">
					Feedback (u)
				</label>
				<span data-testid="value-u" class="font-mono text-accent text-lg">{u.toFixed(3)}</span>
			</div>
			<input
				id="u"
				data-testid="slider-u"
				type="range"
				bind:value={u}
				min="0"
				max="1"
				step="0.001"
				class="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
			/>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
			<div
				class="space-y-2"
				class:opacity-40={renderMode === 'multi'}
				class:pointer-events-none={renderMode === 'multi'}
			>
				<div class="flex justify-between items-end">
					<label for="x0" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>x₀</label
					>
					<span class="font-mono text-accent">{x0.toFixed(2)}</span>
				</div>
				<input
					id="x0"
					type="range"
					bind:value={x0}
					disabled={renderMode === 'multi'}
					min="-2"
					max="2"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
				{#if renderMode === 'multi'}
					<span class="text-[10px] text-primary/50">Single Orbit only</span>
				{/if}
			</div>
			<div
				class="space-y-2"
				class:opacity-40={renderMode === 'multi'}
				class:pointer-events-none={renderMode === 'multi'}
			>
				<div class="flex justify-between items-end">
					<label for="y0" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>y₀</label
					>
					<span class="font-mono text-accent">{y0.toFixed(2)}</span>
				</div>
				<input
					id="y0"
					type="range"
					bind:value={y0}
					disabled={renderMode === 'multi'}
					min="-2"
					max="2"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
				{#if renderMode === 'multi'}
					<span class="text-[10px] text-primary/50">Single Orbit only</span>
				{/if}
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label
						for="iterations"
						class="text-primary/80 text-xs uppercase tracking-widest font-bold">Iterations</label
					>
					<span class="font-mono text-accent">{iterations}</span>
				</div>
				<input
					id="iterations"
					type="range"
					bind:value={iterations}
					min="100"
					max="5000"
					step="50"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="burnIn" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Burn-in</label
					>
					<span class="font-mono text-accent">{burnIn}</span>
				</div>
				<input
					id="burnIn"
					type="range"
					bind:value={burnIn}
					min="0"
					max="1000"
					step="10"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>t(n) = 0.4 − 6 / (1 + x² + y²)</p>
			<p>x(n+1) = 1 + u·(x·cos t − y·sin t)</p>
			<p>y(n+1) = u·(x·sin t + y·cos t)</p>
		</div>
	</div>

	<!-- Render controls -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative"
	>
		<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
			<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
			RENDER_CONTROLS
		</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
			<div class="space-y-2">
				<label for="renderMode" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>Render Mode</label
				>
				<select
					id="renderMode"
					data-testid="select-render-mode"
					bind:value={renderMode}
					class="w-full bg-black/40 border border-primary/30 text-primary text-sm rounded-sm px-2 py-1"
				>
					<option value="multi">Multi-Seed</option>
					<option value="single">Single Orbit</option>
				</select>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="seeds" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Density (seeds)</label
					>
					<span class="font-mono text-accent">{seeds}</span>
				</div>
				<input
					id="seeds"
					type="range"
					bind:value={seeds}
					min="1"
					max="1500"
					step="1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
				/>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="pointSize" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Point Size</label
					>
					<span class="font-mono text-accent">{pointSize.toFixed(1)}</span>
				</div>
				<input
					id="pointSize"
					type="range"
					bind:value={pointSize}
					min="0.5"
					max="6"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
				/>
			</div>
			<div class="space-y-2">
				<label for="colorMode" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>Color Mode</label
				>
				<select
					id="colorMode"
					data-testid="select-color-mode"
					bind:value={colorMode}
					class="w-full bg-black/40 border border-primary/30 text-primary text-sm rounded-sm px-2 py-1"
				>
					<option value="single">Single</option>
					<option value="iteration">Iteration</option>
					<option value="seed">Seed</option>
					<option value="radius">Radius</option>
				</select>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="opacity" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Opacity</label
					>
					<span class="font-mono text-accent">{opacity.toFixed(2)}</span>
				</div>
				<input
					id="opacity"
					type="range"
					bind:value={opacity}
					min="0"
					max="1"
					step="0.05"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
				/>
			</div>
		</div>
	</div>

	<IkedaRenderer
		bind:containerElement={rendererContainer}
		bind:u
		bind:x0
		bind:y0
		bind:iterations
		bind:burnIn
		bind:renderMode
		bind:seeds
		bind:colorMode
		bind:pointSize
		bind:opacity
		height={VIZ_CONTAINER_HEIGHT}
	/>

	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">DATA_LOG: IKEDA_MAP</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Ikeda Map is a two-dimensional discrete nonlinear system that produces spiral and
			fractal-like chaotic attractors. Each point is repeatedly transformed by a rotation, scaling,
			and shift. As the feedback parameter changes, the system can transition from simple behavior
			to complex chaotic motion. Unlike continuous systems such as the Lorenz or Rössler attractors,
			the Ikeda Map advances in separate steps. This makes it closer to map-based systems such as
			the Hénon, Lozi, Logistic, and Standard Map modules, while giving it a distinct spiral visual
			structure.
		</p>
	</div>
</div>

<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="ikeda"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="ikeda"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
