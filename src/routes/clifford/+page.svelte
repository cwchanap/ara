<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import CliffordRenderer from '$lib/components/visualizations/CliffordRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { CliffordParameters, CliffordColorMode } from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';
	import {
		CLIFFORD_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_CLIFFORD_PRESET_ID,
		type CliffordPresetState
	} from '$lib/clifford-presets';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();

	const defaultPreset = getPreset(DEFAULT_CLIFFORD_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default Clifford preset: ${DEFAULT_CLIFFORD_PRESET_ID}`);
	const defaultState = defaultPreset.state;
	let a = $state(defaultState.a);
	let b = $state(defaultState.b);
	let c = $state(defaultState.c);
	let d = $state(defaultState.d);
	let iterations = $state(defaultState.iterations);
	let colorMode = $state<CliffordColorMode>(defaultState.colorMode);
	let zoom = $state(defaultState.zoom);
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

	function currentPresetState(): CliffordPresetState {
		return { a, b, c, d, iterations, colorMode, zoom, pointSize, opacity };
	}

	const activePresetId = $derived(detectPresetId(currentPresetState()));
	const activePresetLabel = $derived(
		activePresetId ? (getPreset(activePresetId)?.label ?? 'CUSTOM') : 'CUSTOM'
	);

	function checkStability() {
		const stability = checkParameterStability('clifford', {
			type: 'clifford',
			a,
			b,
			c,
			d,
			iterations
		});
		if (!stability.isStable) {
			stabilityWarnings = stability.warnings;
			showStabilityWarning = true;
		} else {
			stabilityWarnings = [];
			showStabilityWarning = false;
		}
	}

	function applyPreset(id: string) {
		const preset = getPreset(id);
		if (!preset) return;
		const s = preset.state;
		a = s.a;
		b = s.b;
		c = s.c;
		d = s.d;
		iterations = s.iterations;
		colorMode = s.colorMode;
		zoom = s.zoom;
		pointSize = s.pointSize;
		opacity = s.opacity;
		checkStability();
	}

	function resetToDefault() {
		applyPreset(DEFAULT_CLIFFORD_PRESET_ID);
	}

	function randomizeParameters() {
		const rand = () => Math.round((Math.random() * 4 - 2) * 100) / 100; // [-2, 2], 2dp
		a = rand();
		b = rand();
		c = rand();
		d = rand();
		checkStability();
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
					let result: ReturnType<typeof loadSavedConfigParameters<'clifford'>> extends Promise<
						infer T
					>
						? T
						: never | undefined;

					if (shareCode) {
						result = await loadSharedConfigParameters({
							shareCode,
							mapType: 'clifford',
							base,
							fetchFn: fetchWithSignal
						});
					} else {
						result = await loadSavedConfigParameters({
							configId: configId!,
							mapType: 'clifford',
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

				const parsed = parseConfigParam({ mapType: 'clifford', configParam });
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

	function applyParameters(p: CliffordParameters) {
		a = p.a;
		b = p.b;
		c = p.c;
		d = p.d;
		iterations = p.iterations;
		colorMode = p.colorMode ?? colorMode;
		zoom = p.zoom ?? zoom;
		pointSize = p.pointSize ?? pointSize;
		opacity = p.opacity ?? opacity;
		checkStability();
	}

	function getParameters(): CliffordParameters {
		return { type: 'clifford', a, b, c, d, iterations, colorMode, zoom, pointSize, opacity };
	}

	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'clifford',
		saveState,
		getParameters
	);
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'clifford',
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

	const shapeControls = [
		{ key: 'a', label: 'a' },
		{ key: 'b', label: 'b' },
		{ key: 'c', label: 'c' },
		{ key: 'd', label: 'd' }
	] as const;
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				CLIFFORD_ATTRACTOR
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				SINE-COSINE_RECURRENCE // GENERATIVE_CHAOTIC_ATTRACTOR
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={rendererContainer} targetType="container" mapType="clifford" />
			<a
				href={buildComparisonUrl(
					base,
					'clifford',
					createComparisonStateFromCurrent('clifford', getParameters())
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
			{#each CLIFFORD_PRESETS as preset (preset.id)}
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

		<div class="flex items-center justify-between">
			<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
				<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
				SYSTEM_PARAMETERS
			</h2>
			<div class="flex gap-3">
				<button
					data-testid="btn-randomize"
					onclick={randomizeParameters}
					class="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold"
				>
					🎲 Randomize
				</button>
				<button
					data-testid="btn-reset"
					onclick={resetToDefault}
					class="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold"
				>
					↺ Reset
				</button>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
			{#each shapeControls as ctrl (ctrl.key)}
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label
							for={ctrl.key}
							class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>{ctrl.label}</label
						>
						<span data-testid="value-{ctrl.key}" class="font-mono text-accent">
							{#if ctrl.key === 'a'}{a.toFixed(2)}{:else if ctrl.key === 'b'}{b.toFixed(
									2
								)}{:else if ctrl.key === 'c'}{c.toFixed(2)}{:else}{d.toFixed(2)}{/if}
						</span>
					</div>
					{#if ctrl.key === 'a'}
						<input
							id="a"
							data-testid="slider-a"
							type="range"
							bind:value={a}
							min="-3"
							max="3"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					{:else if ctrl.key === 'b'}
						<input
							id="b"
							data-testid="slider-b"
							type="range"
							bind:value={b}
							min="-3"
							max="3"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					{:else if ctrl.key === 'c'}
						<input
							id="c"
							data-testid="slider-c"
							type="range"
							bind:value={c}
							min="-3"
							max="3"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					{:else}
						<input
							id="d"
							data-testid="slider-d"
							type="range"
							bind:value={d}
							min="-3"
							max="3"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					{/if}
				</div>
			{/each}
		</div>

		<div class="space-y-2">
			<div class="flex justify-between items-end">
				<label for="iterations" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>Iterations</label
				>
				<span data-testid="value-iterations" class="font-mono text-accent">{iterations}</span>
			</div>
			<input
				id="iterations"
				data-testid="slider-iterations"
				type="range"
				bind:value={iterations}
				min="10000"
				max="250000"
				step="10000"
				class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
			/>
		</div>

		<div
			class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>x(n+1) = sin(a·y) + c·cos(a·x)</p>
			<p>y(n+1) = sin(b·x) + d·cos(b·y)</p>
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
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
					<option value="density">Density</option>
					<option value="iteration">Iteration</option>
					<option value="radius">Radius</option>
					<option value="angle">Angle</option>
					<option value="single">Single</option>
				</select>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="zoom" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Zoom</label
					>
					<span class="font-mono text-accent">{zoom.toFixed(1)}×</span>
				</div>
				<input
					id="zoom"
					type="range"
					bind:value={zoom}
					min="0.5"
					max="5"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
				/>
			</div>
			<div class="space-y-2" class:opacity-40={colorMode === 'density'}>
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
					disabled={colorMode === 'density'}
					min="0.5"
					max="6"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
				/>
			</div>
			<div class="space-y-2" class:opacity-40={colorMode === 'density'}>
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
					disabled={colorMode === 'density'}
					min="0"
					max="1"
					step="0.05"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
				/>
			</div>
		</div>
	</div>

	<CliffordRenderer
		bind:containerElement={rendererContainer}
		bind:a
		bind:b
		bind:c
		bind:d
		bind:iterations
		bind:colorMode
		bind:zoom
		bind:pointSize
		bind:opacity
		height={VIZ_CONTAINER_HEIGHT}
	/>

	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: CLIFFORD_ATTRACTOR
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Clifford Attractor is a two-dimensional iterative map built from sine and cosine
			functions. Starting from a single point, each step folds the trajectory back on itself, and
			over hundreds of thousands of iterations the orbit traces out a dense, intricate strange
			attractor. Because sine and cosine are bounded, the system can never fly off to infinity —
			instead it settles into a generative structure whose shape is governed entirely by the four
			parameters a, b, c, and d. Small parameter changes can transform the figure completely, making
			it a favourite source of algorithmic art. Unlike continuous flows such as the Lorenz or
			Rössler attractors, the Clifford map advances in discrete steps, like the Hénon, Lozi, and
			Ikeda maps.
		</p>
	</div>
</div>

<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="clifford"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="clifford"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
