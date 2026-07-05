<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import GumowskiMiraRenderer from '$lib/components/visualizations/GumowskiMiraRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { createStabilityReporter } from '$lib/stability-reporter';
	import type {
		GumowskiMiraParameters,
		GumowskiMiraColorMode,
		GumowskiMiraRenderMode,
		ChaosMapParameters
	} from '$lib/types';
	import {
		GUMOWSKI_MIRA_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_GUMOWSKI_MIRA_PRESET_ID,
		type GumowskiMiraPresetState
	} from '$lib/gumowski-mira-presets';

	let { data } = $props();

	const defaultPreset = getPreset(DEFAULT_GUMOWSKI_MIRA_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default Gumowski-Mira preset: ${DEFAULT_GUMOWSKI_MIRA_PRESET_ID}`);
	const defaultState = defaultPreset.state;

	// All Gumowski-Mira controls are page-owned $state: presets/randomize mutate
	// every parameter atomically, x0/y0 carry a renderMode-dependent disabled
	// binding (with "Single Orbit only" hints), and the interaction tests assert
	// value-mu / value-a / slider-mu / slider-a testids. They render via
	// extraControls.
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
	}

	function reset() {
		applyPreset(DEFAULT_GUMOWSKI_MIRA_PRESET_ID);
	}

	function randomize() {
		mu = Math.random() * 1.8 - 0.9;
		a = Math.random() * 0.05;
		b = Math.random() * 0.5;
		x0 = Math.random() * 2 - 1;
		y0 = Math.random() * 2 - 1;
	}

	// Reactive stability: page-owned sliders aren't watched by the shell's
	// reactiveStability effect, so re-run the check (debounced) whenever the
	// inputs that affect stability change and report into the unified alert.
	// Also covers preset/randomize, which mutate the same $state.
	const stability = createStabilityReporter({
		mapType: 'gumowski-mira',
		getParams: () => buildParameters(),
		reactive: true
	});
	$effect(() => {
		void mu;
		void a;
		void b;
		void x0;
		void y0;
		void iterations;
		void burnIn;
		stability.triggerReactive();
		return () => stability.cleanupReactive();
	});

	function buildParameters(): GumowskiMiraParameters {
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

	// Restore the full Gumowski-Mira state from a loaded config with the
	// pre-shell null-coalescing for the optional styling fields.
	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'gumowski-mira') return;
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
	}
</script>

<VisualizationShell
	mapType="gumowski-mira"
	title="GUMOWSKI–MIRA_MAP"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	stabilityReporter={stability.stabilityReporter}
	formula={[
		'g(x) = μ·x + 2(1−μ)·x² / (1 + x²)',
		'x(n+1) = y + a·(1 − b·y²)·y + g(x)',
		'y(n+1) = −x + g(x(n+1))'
	]}
	formulaColumns={1}
	description={{
		heading: 'DATA_LOG: GUMOWSKI–MIRA_MAP',
		body: 'The Gumowski–Mira map is a two-dimensional discrete nonlinear system studied for its rich transitions between order and chaos. The parameter μ (mu) controls the shape of the Gumowski function g(x): negative values produce smooth invariant curves, values near zero create KAM-island chains where regular orbits coexist with chaotic layers, and larger positive values fill phase space with a chaotic sea. The damping coefficient a governs how far orbits spread, while b shapes the nonlinear term. Unlike continuous attractors such as Lorenz or Rössler, this map advances in discrete steps, making it a cousin of the Hénon, Ikeda, and Chaos Esthetique modules — but with a uniquely broad spectrum of visually distinct behaviors.'
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
			<div class="space-y-4">
				<h3 class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
					<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
					SHAPE_PARAMETERS
				</h3>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- μ (emphasized) -->
					<div class="space-y-2 border border-primary/40 rounded-sm p-4 bg-primary/5">
						<div class="flex justify-between items-end">
							<label for="mu" class="text-primary text-sm uppercase tracking-widest font-bold">
								Mu (μ)
							</label>
							<span data-testid="value-mu" class="font-mono text-accent text-lg"
								>{mu.toFixed(3)}</span
							>
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
							<span data-testid="value-a" class="font-mono text-accent text-lg">{a.toFixed(4)}</span
							>
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
							max="100000"
							step="500"
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
							<option value="iteration">Iteration</option>
							<option value="single">Single</option>
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
		<!-- Keep height on the opening tag line: a static constant attribute on
		its own line maps to an update path that never fires (no executable
		code), so it is reported as uncovered. Co-locating it with the opening
		tag maps it to element-creation code, which is covered on render. -->
		<!-- prettier-ignore -->
		<GumowskiMiraRenderer height={VIZ_CONTAINER_HEIGHT} bind:containerElement={container.el}
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
		/>
	{/snippet}
</VisualizationShell>
