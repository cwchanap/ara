<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import TinkerbellRenderer from '$lib/components/visualizations/TinkerbellRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { createStabilityReporter } from '$lib/stability-reporter';
	import type { TinkerbellParameters, TinkerbellColorMode, ChaosMapParameters } from '$lib/types';
	import {
		TINKERBELL_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_TINKERBELL_PRESET_ID,
		type TinkerbellPresetState
	} from '$lib/tinkerbell-presets';

	let { data } = $props();

	const defaultPreset = getPreset(DEFAULT_TINKERBELL_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default Tinkerbell preset: ${DEFAULT_TINKERBELL_PRESET_ID}`);
	const defaultState = defaultPreset.state;

	// All Tinkerbell controls are page-owned $state: the preset mechanism mutates
	// every parameter atomically (shape + render + color), and pointSize/opacity
	// carry a colorMode-dependent disabled binding — neither fits the schema
	// slider model. They render via the extraControls snippet instead.
	let a = $state(defaultState.a);
	let b = $state(defaultState.b);
	let c = $state(defaultState.c);
	let d = $state(defaultState.d);
	let iterations = $state(defaultState.iterations);
	let colorMode = $state<TinkerbellColorMode>(defaultState.colorMode);
	let zoom = $state(defaultState.zoom);
	let pointSize = $state(defaultState.pointSize);
	let opacity = $state(defaultState.opacity);

	function currentPresetState(): TinkerbellPresetState {
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
		applyPreset(DEFAULT_TINKERBELL_PRESET_ID);
	}

	function randomizeParameters() {
		const rand = () => Math.round((Math.random() * 6 - 3) * 100) / 100; // [-3, 3], 2dp
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
		mapType: 'tinkerbell',
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

	function buildParameters(): TinkerbellParameters {
		return { type: 'tinkerbell', a, b, c, d, iterations, colorMode, zoom, pointSize, opacity };
	}

	// Restore the full Tinkerbell state (shape + render + color) from a loaded
	// saved/shared config. Matches the pre-shell null-coalescing so a legacy
	// config missing the optional styling fields keeps the current values.
	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'tinkerbell') return;
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
	mapType="tinkerbell"
	title="TINKERBELL_MAP"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	stabilityReporter={stability.stabilityReporter}
	formula={['x(n+1) = x(n)² − y(n)² + a·x(n) + b·y(n)', 'y(n+1) = 2·x(n)·y(n) + c·x(n) + d·y(n)']}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: TINKERBELL_MAP',
		body: 'The Tinkerbell map is a two-dimensional discrete-time chaotic recurrence. Each step squares and cross-multiplies the current coordinates, then adds four linear parameters — a, b, c, and d — that shape the resulting figure. Because the map contains quadratic terms (unlike the sine-and-cosine Clifford attractor, which is forever bounded), its orbit can escape to infinity for many parameter sets; the visualization guards against runaway coordinates and only renders the bounded attractor. Near chaotic parameter values the orbit traces a dense, delicate strange attractor, and small parameter changes transform the structure entirely.'
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
					{#each TINKERBELL_PRESETS as preset (preset.id)}
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
		<!-- prettier-ignore -->
		<TinkerbellRenderer height={VIZ_CONTAINER_HEIGHT} bind:containerElement={container.el}
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
