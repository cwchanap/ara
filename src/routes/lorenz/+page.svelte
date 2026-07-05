<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import LorenzRenderer from '$lib/components/visualizations/LorenzRenderer.svelte';
	import { createStabilityReporter } from '$lib/stability-reporter';
	import type { LorenzParameters, ChaosMapParameters } from '$lib/types';
	import { VIZ_CONTAINER_HEIGHT, DEBOUNCE_MS } from '$lib/constants';
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
	import type { LorenzSolver, LorenzColorMode, LorenzTrailStyle, LorenzViewMode } from '$lib/types';
	import type { LyapunovClassification } from '$lib/chua';

	let { data } = $props();

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

	function buildParameters(): LorenzParameters {
		return getParameters();
	}

	// Restore the full Lorenz state from a loaded config (defaults applied to
	// any optional fields a legacy config omits).
	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'lorenz') return;
		const resolved = withLorenzDefaults(p);
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
	}

	// Debounced reactive stability on the page-owned controls, reported into
	// the shell's unified alert via stabilityReporter. Tracks the math params
	// so slider edits, presets, randomize, and config loads (which mutate this
	// state via onExtraParametersLoaded) all re-run the check after DEBOUNCE_MS.
	// The shell also runs its own onCheckStability on config load against the
	// raw loaded params; this debounced re-check runs against the applied
	// params, so a dismissed warning on an unstable loaded config will be
	// re-raised once the debounce fires.
	const stability = createStabilityReporter({
		mapType: 'lorenz',
		getParams: () => getParameters(),
		reactive: true
	});
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
		stability.triggerReactive();
		return () => stability.cleanupReactive();
	});
</script>

<VisualizationShell
	mapType="lorenz"
	title="LORENZ_ATTRACTOR"
	moduleNumber="01"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	stabilityReporter={stability.stabilityReporter}
	{diverged}
	onDismissDiverged={() => (diverged = false)}
	formula={['dx/dt = σ(y - x)', 'dy/dt = x(ρ - z) - y', 'dz/dt = xy - βz']}
	formulaColumns={3}
	description={{
		heading: 'DATA_LOG: LORENZ_SYSTEM',
		body: 'The Lorenz attractor is a set of chaotic solutions to the Lorenz system. It is notable for its butterfly shape and for demonstrating sensitive dependence on initial conditions - a hallmark of chaos theory. This system, originally derived from simplified equations for convection rolls arising in the equations of the atmosphere, exhibits strange attractor behavior.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet extraControls()}
		<div class="space-y-6">
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
	{/snippet}

	{#snippet renderer({ container })}
		<div class="space-y-2">
			<ChaosIndicator value={lambda} classification={lambdaClass} diverged={lambdaDiverged} />
			<!-- Keep height on the opening tag line: a static constant attribute on
			its own line maps to an update path that never fires (no executable
			code), so it is reported as uncovered. Co-locating it with the opening
			tag maps it to element-creation code, which is covered on render. -->
			<!-- prettier-ignore -->
			<LorenzRenderer height={VIZ_CONTAINER_HEIGHT} bind:containerElement={container.el}
				params={getParameters()}
				{isPlaying}
				{stepNonce}
				{resetNonce}
				bind:head
				bind:diverged
			/>
		</div>
	{/snippet}
</VisualizationShell>
