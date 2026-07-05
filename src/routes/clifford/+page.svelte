<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import CliffordRenderer from '$lib/components/visualizations/CliffordRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { createStabilityReporter } from '$lib/stability-reporter';
	import type { CliffordParameters, CliffordColorMode, ChaosMapParameters } from '$lib/types';
	import {
		CLIFFORD_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_CLIFFORD_PRESET_ID,
		type CliffordPresetState
	} from '$lib/clifford-presets';

	let { data } = $props();

	const defaultPreset = getPreset(DEFAULT_CLIFFORD_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default Clifford preset: ${DEFAULT_CLIFFORD_PRESET_ID}`);
	const defaultState = defaultPreset.state;

	// All Clifford controls are page-owned $state: the preset mechanism mutates
	// every parameter atomically (shape + render + color), and pointSize/opacity
	// carry a colorMode-dependent disabled binding — neither fits the schema
	// slider model. They render via the extraControls snippet instead.
	let a = $state(defaultState.a);
	let b = $state(defaultState.b);
	let c = $state(defaultState.c);
	let d = $state(defaultState.d);
	let iterations = $state(defaultState.iterations);
	let colorMode = $state<CliffordColorMode>(defaultState.colorMode);
	let zoom = $state(defaultState.zoom);
	let pointSize = $state(defaultState.pointSize);
	let opacity = $state(defaultState.opacity);

	function currentPresetState(): CliffordPresetState {
		return { a, b, c, d, iterations, colorMode, zoom, pointSize, opacity };
	}

	const activePresetId = $derived(detectPresetId(currentPresetState()));
	const activePresetLabel = $derived(
		activePresetId ? (getPreset(activePresetId)?.label ?? 'CUSTOM') : 'CUSTOM'
	);

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
	}

	// Reactive stability: page-owned sliders aren't watched by the shell's
	// reactiveStability effect, so re-run the check (debounced) whenever the
	// inputs that affect stability change and report into the unified alert.
	// Also covers preset/randomize, which mutate the same $state.
	const stability = createStabilityReporter({
		mapType: 'clifford',
		getParams: () => buildParameters(),
		reactive: true
	});
	$effect(() => {
		void a;
		void b;
		void c;
		void d;
		void iterations;
		stability.triggerReactive();
		return () => stability.cleanupReactive();
	});

	function buildParameters(): CliffordParameters {
		return { type: 'clifford', a, b, c, d, iterations, colorMode, zoom, pointSize, opacity };
	}

	// Restore the full Clifford state (shape + render + color) from a loaded
	// saved/shared config. Matches the pre-shell null-coalescing so a legacy
	// config missing the optional styling fields keeps the current values.
	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'clifford') return;
		a = p.a;
		b = p.b;
		c = p.c;
		d = p.d;
		iterations = p.iterations;
		colorMode = p.colorMode ?? colorMode;
		zoom = p.zoom ?? zoom;
		pointSize = p.pointSize ?? pointSize;
		opacity = p.opacity ?? opacity;
	}
</script>

<VisualizationShell
	mapType="clifford"
	title="CLIFFORD_ATTRACTOR"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	stabilityReporter={stability.stabilityReporter}
	formula={['x(n+1) = sin(a·y) + c·cos(a·x)', 'y(n+1) = sin(b·x) + d·cos(b·y)']}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: CLIFFORD_ATTRACTOR',
		body: 'The Clifford Attractor is a two-dimensional iterative map built from sine and cosine functions. Starting from a single point, each step folds the trajectory back on itself, and over hundreds of thousands of iterations the orbit traces out a dense, intricate strange attractor. Because sine and cosine are bounded, the system can never fly off to infinity — instead it settles into a generative structure whose shape is governed entirely by the four parameters a, b, c, and d. Small parameter changes can transform the figure completely, making it a favourite source of algorithmic art. Unlike continuous flows such as the Lorenz or Rössler attractors, the Clifford map advances in discrete steps, like the Hénon, Lozi, and Ikeda maps.'
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

			<!-- Shape parameters -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3
						class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2"
					>
						<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
						SHAPE_PARAMETERS
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

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label for="a" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>a</label
							>
							<span data-testid="value-a" class="font-mono text-accent">{a.toFixed(2)}</span>
						</div>
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
					</div>
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label for="b" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>b</label
							>
							<span data-testid="value-b" class="font-mono text-accent">{b.toFixed(2)}</span>
						</div>
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
					</div>
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label for="c" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>c</label
							>
							<span data-testid="value-c" class="font-mono text-accent">{c.toFixed(2)}</span>
						</div>
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
					</div>
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label for="d" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>d</label
							>
							<span data-testid="value-d" class="font-mono text-accent">{d.toFixed(2)}</span>
						</div>
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
					</div>
				</div>

				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label
							for="iterations"
							class="text-primary/80 text-xs uppercase tracking-widest font-bold">Iterations</label
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
							<label
								for="pointSize"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Point Size</label
							>
							<span class="font-mono text-accent">{pointSize.toFixed(1)}</span>
						</div>
						<input
							id="pointSize"
							data-testid="slider-pointSize"
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
							<label
								for="opacity"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Opacity</label
							>
							<span class="font-mono text-accent">{opacity.toFixed(2)}</span>
						</div>
						<input
							id="opacity"
							data-testid="slider-opacity"
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
		</div>
	{/snippet}

	{#snippet renderer({ container })}
		<!-- Keep height on the opening tag line: a static constant attribute on
		its own line maps to an update path that never fires (no executable
		code), so it is reported as uncovered. Co-locating it with the opening
		tag maps it to element-creation code, which is covered on render. -->
		<!-- prettier-ignore -->
		<CliffordRenderer height={VIZ_CONTAINER_HEIGHT} bind:containerElement={container.el}
			bind:a
			bind:b
			bind:c
			bind:d
			bind:iterations
			bind:colorMode
			bind:zoom
			bind:pointSize
			bind:opacity
		/>
	{/snippet}
</VisualizationShell>
