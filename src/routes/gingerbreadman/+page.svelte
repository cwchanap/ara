<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import ParameterSlider from '$lib/components/ui/ParameterSlider.svelte';
	import GingerbreadmanRenderer from '$lib/components/visualizations/GingerbreadmanRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { createStabilityReporter } from '$lib/stability-reporter';
	import type {
		GingerbreadmanParameters,
		GingerbreadmanColorMode,
		ChaosMapParameters
	} from '$lib/types';
	import {
		GINGERBREADMAN_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_GINGERBREADMAN_PRESET_ID,
		type GingerbreadmanPresetState
	} from '$lib/gingerbreadman-presets';

	let { data } = $props();

	const defaultPreset = getPreset(DEFAULT_GINGERBREADMAN_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default Gingerbreadman preset: ${DEFAULT_GINGERBREADMAN_PRESET_ID}`);
	const d = defaultPreset.state;

	// Committed IC + iterations (save/share/stability; ParameterSlider bind:value)
	let x0 = $state(d.x0);
	let y0 = $state(d.y0);
	let iterations = $state(d.iterations);
	// Draft mirrors for preview-policy sliders (ondraft during drag)
	let draftX0 = $state(d.x0);
	let draftY0 = $state(d.y0);
	let draftIterations = $state(d.iterations);
	// Live style controls
	let colorMode = $state<GingerbreadmanColorMode>(d.colorMode);
	let zoom = $state(d.zoom);
	let pointSize = $state(d.pointSize);
	let opacity = $state(d.opacity);

	function syncDraftsFromCommitted() {
		draftX0 = x0;
		draftY0 = y0;
		draftIterations = iterations;
	}

	function currentPresetState(): GingerbreadmanPresetState {
		return { x0, y0, iterations, colorMode, zoom, pointSize, opacity };
	}

	const activePresetId = $derived(detectPresetId(currentPresetState()));
	const activePresetLabel = $derived(
		activePresetId ? (getPreset(activePresetId)?.label ?? 'CUSTOM') : 'CUSTOM'
	);

	function applyPreset(id: string) {
		const p = getPreset(id);
		if (!p) return;
		const s = p.state;
		x0 = s.x0;
		y0 = s.y0;
		iterations = s.iterations;
		colorMode = s.colorMode;
		zoom = s.zoom;
		pointSize = s.pointSize;
		opacity = s.opacity;
		syncDraftsFromCommitted();
	}

	function resetToDefault() {
		applyPreset(DEFAULT_GINGERBREADMAN_PRESET_ID);
	}

	function clamp(n: number, min: number, max: number) {
		if (!Number.isFinite(n)) return min;
		return Math.min(max, Math.max(min, n));
	}

	// Committed values only — never draft — for save/share/compare/stability
	function buildParameters(): GingerbreadmanParameters {
		return { type: 'gingerbreadman', x0, y0, iterations, colorMode, zoom, pointSize, opacity };
	}

	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'gingerbreadman') return;
		x0 = clamp(p.x0, -10, 10);
		y0 = clamp(p.y0, -10, 10);
		iterations = clamp(p.iterations, 10000, 250000);
		if (p.colorMode) colorMode = p.colorMode;
		if (p.zoom != null) zoom = clamp(p.zoom, 0.5, 5);
		if (p.pointSize != null) pointSize = clamp(p.pointSize, 0.5, 6);
		if (p.opacity != null) opacity = clamp(p.opacity, 0, 1);
		syncDraftsFromCommitted();
	}

	const stability = createStabilityReporter({
		mapType: 'gingerbreadman',
		getParams: () => buildParameters(),
		reactive: true
	});
	$effect(() => {
		void x0;
		void y0;
		void iterations;
		stability.triggerReactive();
		return () => stability.cleanupReactive();
	});

	function randomizeParameters() {
		const r = () => Math.round((Math.random() * 10 - 5) * 100) / 100; // [-5,5] 2dp
		x0 = r();
		y0 = r();
		syncDraftsFromCommitted();
	}
</script>

<VisualizationShell
	mapType="gingerbreadman"
	title="GINGERBREADMAN_MAP"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	stabilityReporter={stability.stabilityReporter}
	formula={['x(n+1) = 1 − y(n) + |x(n)|', 'y(n+1) = x(n)']}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: GINGERBREADMAN_MAP',
		body: 'The Gingerbreadman map is a piecewise-linear discrete-time system with a single absolute-value term — a simple rule that builds a complex fractal-like “gingerbread” silhouette. There are no free shape parameters: the orbit is driven by the initial condition (x0, y0) and how long you iterate. Nearby starts can separate even though the rule never changes; the effect is milder than maps like Lorenz or Hénon, so think fractal silhouette and discrete iteration rather than strong strange-attractor chaos. Runaway coordinates are rare for in-range ICs, but the renderer still guards non-finite and oversized points.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet extraControls()}
		<div class="space-y-6">
			<!-- Presets -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3
						class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2"
					>
						<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
						PRESETS
					</h3>
					<span
						class="text-xs uppercase tracking-widest text-accent font-mono"
						data-testid="active-preset"
					>
						{activePresetLabel}
					</span>
				</div>
				<div class="flex flex-wrap gap-3">
					{#each GINGERBREADMAN_PRESETS as preset (preset.id)}
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

			<!-- Initial conditions + orbit -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3
						class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2"
					>
						<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
						INITIAL_CONDITIONS
					</h3>
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

				<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
					<ParameterSlider
						id="x0"
						label="x0"
						bind:value={x0}
						min={-10}
						max={10}
						step={0.01}
						decimals={2}
						updatePolicy="preview"
						ondraft={(v) => (draftX0 = v)}
					/>
					<ParameterSlider
						id="y0"
						label="y0"
						bind:value={y0}
						min={-10}
						max={10}
						step={0.01}
						decimals={2}
						updatePolicy="preview"
						ondraft={(v) => (draftY0 = v)}
					/>
				</div>

				<ParameterSlider
					id="iterations"
					label="Iterations"
					bind:value={iterations}
					min={10000}
					max={250000}
					step={10000}
					decimals={0}
					updatePolicy="preview"
					ondraft={(v) => (draftIterations = v)}
				/>
			</div>

			<!-- Render controls -->
			<div class="space-y-4">
				<h3 class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
					<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
					RENDER_CONTROLS
				</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					<div class="space-y-2">
						<label
							for="colorMode"
							class="text-primary/80 text-xs uppercase tracking-widest font-bold">Color Mode</label
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
					<ParameterSlider
						id="zoom"
						label="Zoom"
						bind:value={zoom}
						min={0.5}
						max={5}
						step={0.1}
						decimals={1}
						updatePolicy="live"
					/>
					<div class:opacity-40={colorMode === 'density'}>
						<ParameterSlider
							id="pointSize"
							label="Point Size"
							bind:value={pointSize}
							min={0.5}
							max={6}
							step={0.1}
							decimals={1}
							updatePolicy="live"
							disabled={colorMode === 'density'}
						/>
					</div>
					<div class:opacity-40={colorMode === 'density'}>
						<ParameterSlider
							id="opacity"
							label="Opacity"
							bind:value={opacity}
							min={0}
							max={1}
							step={0.05}
							decimals={2}
							updatePolicy="live"
							disabled={colorMode === 'density'}
						/>
					</div>
				</div>
			</div>
		</div>
	{/snippet}

	{#snippet renderer({ container, fidelity, onRenderStateChange })}
		{@const renderX0 = fidelity === 'preview' ? draftX0 : x0}
		{@const renderY0 = fidelity === 'preview' ? draftY0 : y0}
		{@const renderIterations = fidelity === 'preview' ? draftIterations : iterations}
		<GingerbreadmanRenderer
			x0={renderX0}
			y0={renderY0}
			iterations={renderIterations}
			{colorMode}
			{zoom}
			{pointSize}
			{opacity}
			{fidelity}
			{onRenderStateChange}
			bind:containerElement={container.el}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}
</VisualizationShell>
