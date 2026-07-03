<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import IkedaRenderer from '$lib/components/visualizations/IkedaRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type {
		IkedaParameters,
		IkedaColorMode,
		IkedaRenderMode,
		ChaosMapParameters
	} from '$lib/types';
	import {
		IKEDA_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_IKEDA_PRESET_ID,
		type IkedaPresetState
	} from '$lib/ikeda-presets';

	let { data } = $props();

	const defaultPreset = getPreset(DEFAULT_IKEDA_PRESET_ID);
	if (!defaultPreset) throw new Error(`Missing default Ikeda preset: ${DEFAULT_IKEDA_PRESET_ID}`);
	const defaultState = defaultPreset.state;

	// All Ikeda controls are page-owned $state: applyPreset mutates every
	// parameter atomically, x0/y0 carry a renderMode-dependent disabled
	// binding (with "Single Orbit only" hints), and the interaction tests
	// assert value-u / slider-u testids. They render via extraControls.
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
	}

	function buildParameters(): IkedaParameters {
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

	// Restore the full Ikeda state from a loaded config with the pre-shell
	// null-coalescing for the optional styling fields.
	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'ikeda') return;
		u = p.u;
		x0 = p.x0;
		y0 = p.y0;
		iterations = p.iterations;
		burnIn = p.burnIn;
		renderMode = p.renderMode ?? renderMode;
		seeds = p.seeds ?? seeds;
		colorMode = p.colorMode ?? colorMode;
		pointSize = p.pointSize ?? pointSize;
		opacity = p.opacity ?? opacity;
	}
</script>

<VisualizationShell
	mapType="ikeda"
	title="IKEDA_MAP"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	formula={[
		't(n) = 0.4 − 6 / (1 + x² + y²)',
		'x(n+1) = 1 + u·(x·cos t − y·sin t)',
		'y(n+1) = u·(x·sin t + y·cos t)'
	]}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: IKEDA_MAP',
		body: 'The Ikeda Map is a two-dimensional discrete nonlinear system that produces spiral and fractal-like chaotic attractors. Each point is repeatedly transformed by a rotation, scaling, and shift. As the feedback parameter changes, the system can transition from simple behavior to complex chaotic motion. Unlike continuous systems such as the Lorenz or Rössler attractors, the Ikeda Map advances in separate steps. This makes it closer to map-based systems such as the Hénon, Lozi, Logistic, and Standard Map modules, while giving it a distinct spiral visual structure.'
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
			<div class="space-y-4">
				<h3 class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
					<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
					SHAPE_PARAMETERS
				</h3>

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
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Iterations</label
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
							<label
								for="burnIn"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Burn-in</label
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
			</div>

			<!-- Render controls -->
			<div class="space-y-4">
				<h3 class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
					<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
					RENDER_CONTROLS
				</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
					<div class="space-y-2">
						<label
							for="renderMode"
							class="text-primary/80 text-xs uppercase tracking-widest font-bold">Render Mode</label
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
							<label
								for="pointSize"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
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
							<option value="single">Single</option>
							<option value="iteration">Iteration</option>
							<option value="seed">Seed</option>
							<option value="radius">Radius</option>
						</select>
					</div>
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label
								for="opacity"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Opacity</label
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
		</div>
	{/snippet}

	{#snippet renderer({ container })}
		<IkedaRenderer
			bind:containerElement={container.el}
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
	{/snippet}
</VisualizationShell>
