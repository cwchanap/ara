<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import GumowskiMiraRenderer from '$lib/components/visualizations/GumowskiMiraRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type {
		GumowskiMiraParameters,
		GumowskiMiraColorMode,
		GumowskiMiraRenderMode
	} from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';
	import {
		GUMOWSKI_MIRA_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_GUMOWSKI_MIRA_PRESET_ID,
		type GumowskiMiraPresetState
	} from '$lib/gumowski-mira-presets';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();

	const defaultPreset = getPreset(DEFAULT_GUMOWSKI_MIRA_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default Gumowski-Mira preset: ${DEFAULT_GUMOWSKI_MIRA_PRESET_ID}`);
	const defaultState = defaultPreset.state;
	let mu = $state(defaultState.mu);
	let a = $state(defaultState.a);
	let b = $state(defaultState.b);
	let x0 = $state(defaultState.x0);
	let y0 = $state(defaultState.y0);
	let iterations = $state(defaultState.iterations);
	let burnIn = $state(defaultState.burnIn);
	let renderMode = $state<GumowskiMiraRenderMode>(defaultState.renderMode);
	let seeds = $state(defaultState.seeds);
	let colorMode = $state<GumowskiMiraColorMode>(defaultState.colorMode);
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

	function currentPresetState(): GumowskiMiraPresetState {
		return {
			mu,
			a,
			b,
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

	const activePresetId = $derived(detectPresetId(currentPresetState()));
	const activePresetLabel = $derived(
		activePresetId ? (getPreset(activePresetId)?.label ?? 'CUSTOM') : 'CUSTOM'
	);

	function applyPreset(id: string) {
		const preset = getPreset(id);
		if (!preset) return;
		const s = preset.state;
		mu = s.mu;
		a = s.a;
		b = s.b;
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
		const stability = checkParameterStability('gumowski-mira', {
			type: 'gumowski-mira',
			mu,
			a,
			b,
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

	function randomize() {
		mu = Math.random() * 1.8 - 0.9;
		a = Math.random() * 0.05;
		b = Math.random() * 0.5;
		x0 = Math.random() * 2 - 1;
		y0 = Math.random() * 2 - 1;
	}

	function reset() {
		applyPreset(DEFAULT_GUMOWSKI_MIRA_PRESET_ID);
	}

	// Load config from URL reactively (mirrors the Ikeda page).
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
					let result: ReturnType<typeof loadSavedConfigParameters<'gumowski-mira'>> extends Promise<
						infer T
					>
						? T
						: never | undefined;

					if (shareCode) {
						result = await loadSharedConfigParameters({
							shareCode,
							mapType: 'gumowski-mira',
							base,
							fetchFn: fetchWithSignal
						});
					} else {
						result = await loadSavedConfigParameters({
							configId: configId!,
							mapType: 'gumowski-mira',
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

				const parsed = parseConfigParam({ mapType: 'gumowski-mira', configParam });
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

	function applyParameters(p: GumowskiMiraParameters) {
		mu = p.mu;
		a = p.a;
		b = p.b;
		x0 = p.x0;
		y0 = p.y0;
		iterations = p.iterations;
		burnIn = p.burnIn;
		renderMode = p.renderMode ?? renderMode;
		seeds = p.seeds ?? seeds;
		colorMode = p.colorMode ?? colorMode;
		pointSize = p.pointSize ?? pointSize;
		opacity = p.opacity ?? opacity;

		const stability = checkParameterStability('gumowski-mira', {
			type: 'gumowski-mira',
			mu,
			a,
			b,
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

	function getParameters(): GumowskiMiraParameters {
		return {
			type: 'gumowski-mira',
			mu,
			a,
			b,
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
		'gumowski-mira',
		saveState,
		getParameters
	);
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'gumowski-mira',
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
				GUMOWSKI–MIRA_MAP
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				NONLINEAR_ITERATIVE_MAP // ORDER_AND_CHAOS
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={rendererContainer} targetType="container" mapType="gumowski-mira" />
			<a
				href={buildComparisonUrl(
					base,
					'gumowski-mira',
					createComparisonStateFromCurrent('gumowski-mira', getParameters())
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
			{#each GUMOWSKI_MIRA_PRESETS as preset (preset.id)}
				<button
					onclick={() => applyPreset(preset.id)}
					aria-pressed={activePresetId === preset.id}
					data-testid="preset-button"
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

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<!-- μ (emphasized) -->
			<div class="space-y-2 border border-primary/40 rounded-sm p-4 bg-primary/5">
				<div class="flex justify-between items-end">
					<label for="mu" class="text-primary text-sm uppercase tracking-widest font-bold">
						Mu (μ)
					</label>
					<span data-testid="value-mu" class="font-mono text-accent text-lg">{mu.toFixed(3)}</span>
				</div>
				<input
					id="mu"
					data-testid="slider-mu"
					type="range"
					bind:value={mu}
					min="-1"
					max="1"
					step="0.001"
					class="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
			<!-- a (emphasized) -->
			<div class="space-y-2 border border-primary/40 rounded-sm p-4 bg-primary/5">
				<div class="flex justify-between items-end">
					<label for="a" class="text-primary text-sm uppercase tracking-widest font-bold">
						Alpha (a)
					</label>
					<span data-testid="value-a" class="font-mono text-accent text-lg">{a.toFixed(4)}</span>
				</div>
				<input
					id="a"
					data-testid="slider-a"
					type="range"
					bind:value={a}
					min="0"
					max="1"
					step="0.0001"
					class="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="b" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Beta (b)
					</label>
					<span class="font-mono text-accent">{b.toFixed(4)}</span>
				</div>
				<input
					id="b"
					type="range"
					bind:value={b}
					min="0"
					max="0.5"
					step="0.001"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
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
					min="-20"
					max="20"
					step="0.1"
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
					min="-20"
					max="20"
					step="0.1"
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
					max="100000"
					step="500"
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
					max="5000"
					step="50"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div class="flex gap-3">
			<button
				data-testid="reset-button"
				onclick={reset}
				class="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-xs font-bold transition-all"
			>
				↺ Reset
			</button>
			<button
				data-testid="randomize-button"
				onclick={randomize}
				class="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm uppercase tracking-widest text-xs font-bold transition-all"
			>
				⚄ Randomize
			</button>
		</div>

		<div
			class="grid grid-cols-1 gap-2 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>g(x) = μ·x + 2(1−μ)·x² / (1 + x²)</p>
			<p>x(n+1) = y + a·(1 − b·y²)·y + g(x)</p>
			<p>y(n+1) = −x + g(x(n+1))</p>
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
					<option value="iteration">Iteration</option>
					<option value="single">Single</option>
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

	<GumowskiMiraRenderer
		bind:containerElement={rendererContainer}
		bind:mu
		bind:a
		bind:b
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
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: GUMOWSKI–MIRA_MAP
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Gumowski–Mira map is a two-dimensional discrete nonlinear system studied for its rich
			transitions between order and chaos. The parameter μ (mu) controls the shape of the Gumowski
			function g(x): negative values produce smooth invariant curves, values near zero create
			KAM-island chains where regular orbits coexist with chaotic layers, and larger positive values
			fill phase space with a chaotic sea. The damping coefficient a governs how far orbits spread,
			while b shapes the nonlinear term. Unlike continuous attractors such as Lorenz or Rössler,
			this map advances in discrete steps, making it a cousin of the Hénon, Ikeda, and Chaos
			Esthetique modules — but with a uniquely broad spectrum of visually distinct behaviors.
		</p>
	</div>
</div>

<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="gumowski-mira"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="gumowski-mira"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
