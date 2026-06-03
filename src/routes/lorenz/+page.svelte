<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import LorenzRenderer from '$lib/components/visualizations/LorenzRenderer.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import { useConfigLoader, createInitialConfigLoaderState } from '$lib/use-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { LorenzParameters } from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import PresetSelector from '$lib/components/visualizations/lorenz/PresetSelector.svelte';
	import InitialStateControls from '$lib/components/visualizations/lorenz/InitialStateControls.svelte';
	import PlaybackControls from '$lib/components/visualizations/lorenz/PlaybackControls.svelte';
	import TrailControls from '$lib/components/visualizations/lorenz/TrailControls.svelte';
	import ColorModeSelector from '$lib/components/visualizations/lorenz/ColorModeSelector.svelte';
	import ViewControls from '$lib/components/visualizations/lorenz/ViewControls.svelte';
	import SolverControls from '$lib/components/visualizations/lorenz/SolverControls.svelte';
	import ChaosIndicator from '$lib/components/visualizations/lorenz/ChaosIndicator.svelte';
	import { LORENZ_DEFAULTS, withLorenzDefaults } from '$lib/lorenz/defaults';
	import { matchPreset, type LorenzPreset } from '$lib/lorenz/presets';
	import { estimateLargestLyapunov, LYAPUNOV_STEPS } from '$lib/lorenz/lyapunov';
	import { useDebouncedEffect } from '$lib/use-debounced-effect';
	import { DEBOUNCE_MS } from '$lib/constants';
	import type { LorenzSolver, LorenzColorMode, LorenzTrailStyle, LorenzViewMode } from '$lib/types';
	import type { LyapunovClassification } from '$lib/chua';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();
	let sigma = $state(10);
	let rho = $state(28);
	let beta = $state(8.0 / 3);
	let x0 = $state(LORENZ_DEFAULTS.x0);
	let y0 = $state(LORENZ_DEFAULTS.y0);
	let z0 = $state(LORENZ_DEFAULTS.z0);
	let epsilon = $state(LORENZ_DEFAULTS.epsilon);
	let showGhost = $state(LORENZ_DEFAULTS.showGhost);
	let solver = $state<LorenzSolver>(LORENZ_DEFAULTS.solver);
	let dt = $state(LORENZ_DEFAULTS.dt);
	let stepsPerFrame = $state(LORENZ_DEFAULTS.stepsPerFrame);
	let speed = $state(LORENZ_DEFAULTS.speed);
	let colorMode = $state<LorenzColorMode>(LORENZ_DEFAULTS.colorMode);
	let trailLength = $state(LORENZ_DEFAULTS.trailLength);
	let trailStyle = $state<LorenzTrailStyle>(LORENZ_DEFAULTS.trailStyle);
	let viewMode = $state<LorenzViewMode>(LORENZ_DEFAULTS.viewMode);
	let autoRotate = $state(LORENZ_DEFAULTS.autoRotate);
	let rotationSpeed = $state(LORENZ_DEFAULTS.rotationSpeed);
	let zoom = $state(LORENZ_DEFAULTS.zoom);

	// Playback runtime (ephemeral, not persisted).
	let isPlaying = $state(true);
	let stepNonce = $state(0);
	let resetNonce = $state(0);
	let head = $state(0);
	let diverged = $state(false);

	const activePresetId = $derived(matchPreset({ sigma, rho, beta }));

	// Live Lyapunov estimate (debounced; depends only on math params).
	let lambda = $state(0);
	let lambdaClass = $state<LyapunovClassification>('marginal');
	let lambdaDiverged = $state(false);
	const lyapUpdater = useDebouncedEffect(() => {
		const est = estimateLargestLyapunov({
			sigma,
			rho,
			beta,
			x0,
			y0,
			z0,
			solver: 'rk4',
			dt,
			steps: LYAPUNOV_STEPS
		});
		lambda = est.value;
		lambdaClass = est.classification;
		lambdaDiverged = est.diverged;
	}, DEBOUNCE_MS);
	$effect(() => {
		void sigma;
		void rho;
		void beta;
		void x0;
		void y0;
		void z0;
		void dt;
		lyapUpdater.trigger();
		return () => lyapUpdater.cleanup();
	});

	// Debounced stability checker for interactive parameter edits.
	const stabilityUpdater = useDebouncedEffect(() => {
		const params = getParameters();
		const result = checkParameterStability('lorenz', params);
		configState.warnings = result.warnings;
		configState.showWarning = result.warnings.length > 0;
	}, DEBOUNCE_MS);
	$effect(() => {
		void sigma;
		void rho;
		void beta;
		void x0;
		void y0;
		void z0;
		void dt;
		void solver;
		void epsilon;
		void stepsPerFrame;
		void trailLength;
		stabilityUpdater.trigger();
		return () => stabilityUpdater.cleanup();
	});

	function applyPreset(p: LorenzPreset) {
		sigma = p.sigma;
		rho = p.rho;
		beta = p.beta;
	}

	function randomizeInitialState() {
		x0 = +(Math.random() * 30 - 15).toFixed(3);
		y0 = +(Math.random() * 30 - 15).toFixed(3);
		z0 = +(Math.random() * 30 - 15).toFixed(3);
	}

	function resetInitialState() {
		x0 = LORENZ_DEFAULTS.x0;
		y0 = LORENZ_DEFAULTS.y0;
		z0 = LORENZ_DEFAULTS.z0;
	}

	function resetCamera() {
		viewMode = '3d';
		zoom = 1;
		rotationSpeed = LORENZ_DEFAULTS.rotationSpeed;
	}

	// Save dialog state
	const saveState = $state(createInitialSaveState());

	// Share dialog state
	const shareState = $state(createInitialShareState());

	// Config loading state using the unified loader
	const configState = $state(createInitialConfigLoaderState());

	// Get current parameters for saving
	function getParameters(): LorenzParameters {
		return {
			type: 'lorenz',
			sigma,
			rho,
			beta,
			x0,
			y0,
			z0,
			epsilon,
			showGhost,
			solver,
			dt,
			stepsPerFrame,
			speed,
			colorMode,
			trailLength,
			trailStyle,
			viewMode,
			autoRotate,
			rotationSpeed,
			zoom
		};
	}

	let comparisonUrl = $state('');
	$effect(() => {
		void sigma;
		void rho;
		void beta;
		comparisonUrl = buildComparisonUrl(
			base,
			'lorenz',
			createComparisonStateFromCurrent('lorenz', getParameters())
		);
	});

	// Create save handler with cleanup
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'lorenz',
		saveState,
		getParameters
	);

	// Create share handler with cleanup
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'lorenz',
		shareState,
		getParameters
	);

	// Reactive config loading from URL using unified loader
	$effect(() => {
		const { cleanup } = useConfigLoader(
			{
				page,
				mapType: 'lorenz',
				base,
				onParametersLoaded: (params) => {
					const resolved = withLorenzDefaults(params);
					sigma = resolved.sigma;
					rho = resolved.rho;
					beta = resolved.beta;
					x0 = resolved.x0;
					y0 = resolved.y0;
					z0 = resolved.z0;
					epsilon = resolved.epsilon;
					showGhost = resolved.showGhost;
					solver = resolved.solver;
					dt = resolved.dt;
					stepsPerFrame = resolved.stepsPerFrame;
					speed = resolved.speed;
					colorMode = resolved.colorMode;
					trailLength = resolved.trailLength;
					trailStyle = resolved.trailStyle;
					viewMode = resolved.viewMode;
					autoRotate = resolved.autoRotate;
					rotationSpeed = resolved.rotationSpeed;
					zoom = resolved.zoom;
					return getParameters();
				},
				onCheckStability: (params) => checkParameterStability('lorenz', params)
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
				LORENZ_ATTRACTOR
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_01
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={rendererContainer} targetType="container" mapType="lorenz" />
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
		{diverged}
		onDismissDiverged={() => (diverged = false)}
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

		<PresetSelector activeId={activePresetId} onSelect={applyPreset} />

		<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="sigma" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						σ (sigma)
					</label>
					<span class="font-mono text-accent">{sigma.toFixed(2)}</span>
				</div>
				<input
					id="sigma"
					type="range"
					bind:value={sigma}
					min="0"
					max="50"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="rho" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						ρ (rho)
					</label>
					<span class="font-mono text-accent">{rho.toFixed(2)}</span>
				</div>
				<input
					id="rho"
					type="range"
					bind:value={rho}
					min="0"
					max="100"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="beta" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						β (beta)
					</label>
					<span class="font-mono text-accent">{beta.toFixed(2)}</span>
				</div>
				<input
					id="beta"
					type="range"
					bind:value={beta}
					min="0"
					max="10"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>dx/dt = σ(y - x)</p>
			<p>dy/dt = x(ρ - z) - y</p>
			<p>dz/dt = xy - βz</p>
		</div>
	</div>

	<!-- Extended Controls -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative overflow-hidden"
	>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
			<InitialStateControls
				{x0}
				{y0}
				{z0}
				{epsilon}
				{showGhost}
				onChange={(s) => {
					x0 = s.x0;
					y0 = s.y0;
					z0 = s.z0;
					epsilon = s.epsilon;
					showGhost = s.showGhost;
				}}
				onRandomize={randomizeInitialState}
				onReset={resetInitialState}
			/>
			<div class="space-y-6">
				<PlaybackControls
					{isPlaying}
					{speed}
					onTogglePlay={() => (isPlaying = !isPlaying)}
					onStep={() => (stepNonce += 1)}
					onReset={() => (resetNonce += 1)}
					onSpeedChange={(s) => (speed = s)}
				/>
				<TrailControls
					{trailLength}
					{trailStyle}
					onLengthChange={(l) => (trailLength = l)}
					onStyleChange={(st) => (trailStyle = st)}
				/>
			</div>
			<ColorModeSelector {colorMode} ghostEnabled={showGhost} onChange={(m) => (colorMode = m)} />
			<ViewControls
				{viewMode}
				{autoRotate}
				{rotationSpeed}
				{zoom}
				onChange={(v) => {
					viewMode = v.viewMode;
					autoRotate = v.autoRotate;
					rotationSpeed = v.rotationSpeed;
					zoom = v.zoom;
				}}
				onResetCamera={resetCamera}
			/>
		</div>

		<details class="group/adv">
			<summary class="cursor-pointer text-primary/80 text-xs uppercase tracking-widest font-bold">
				▸ ADVANCED
			</summary>
			<div class="mt-4 max-w-md">
				<SolverControls
					{solver}
					{dt}
					{stepsPerFrame}
					onChange={(s) => {
						solver = s.solver;
						dt = s.dt;
						stepsPerFrame = s.stepsPerFrame;
					}}
				/>
			</div>
		</details>
	</div>

	<!-- Visualization Container -->
	<div class="space-y-2">
		<ChaosIndicator value={lambda} classification={lambdaClass} diverged={lambdaDiverged} />
		<LorenzRenderer
			bind:containerElement={rendererContainer}
			params={getParameters()}
			{isPlaying}
			{stepNonce}
			{resetNonce}
			bind:head
			bind:diverged
			height={VIZ_CONTAINER_HEIGHT}
		/>
	</div>

	<!-- Info Panel -->
	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: LORENZ_SYSTEM
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Lorenz attractor is a set of chaotic solutions to the Lorenz system. It is notable for its
			butterfly shape and for demonstrating sensitive dependence on initial conditions - a hallmark
			of chaos theory. This system, originally derived from simplified equations for convection
			rolls arising in the equations of the atmosphere, exhibits strange attractor behavior.
		</p>
	</div>
</div>

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="lorenz"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<!-- Share Configuration Dialog -->
<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="lorenz"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
