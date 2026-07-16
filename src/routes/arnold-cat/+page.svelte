<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import ArnoldCatRenderer from '$lib/components/visualizations/ArnoldCatRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { clampInt } from '$lib/math-utils';
	import { createStabilityReporter } from '$lib/stability-reporter';
	import type { ArnoldCatParameters, ChaosMapParameters } from '$lib/types';

	let { data } = $props();

	let pointCount = $state(3000);
	let speed = $state(5);
	let paused = $state(false);
	let resetSignal = $state(0);
	let randomizeSignal = $state(0);
	let stepSignal = $state(0);

	const stability = createStabilityReporter({
		mapType: 'arnold-cat',
		getParams: () => buildParameters(),
		reactive: true
	});

	$effect(() => {
		void pointCount;
		void speed;
		stability.triggerReactive();
		return () => stability.cleanupReactive();
	});

	function buildParameters(): ArnoldCatParameters {
		return { type: 'arnold-cat', pointCount, speed };
	}

	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'arnold-cat') return;
		pointCount = clampInt(p.pointCount, 100, 10000);
		speed = clampInt(p.speed, 1, 30);
	}
</script>

<VisualizationShell
	mapType="arnold-cat"
	title="ARNOLD_CAT_MAP"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	stabilityReporter={stability.stabilityReporter}
	formula={["x' = (x + y) mod 1", "y' = (x + 2y) mod 1"]}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: ARNOLD_CAT_MAP',
		body: 'Arnold\u2019s Cat Map is an area-preserving linear map on the unit torus. Each step shears the square via the matrix [[1,1],[1,2]] (determinant 1) and wraps coordinates. This visualization uses an exact discrete model (integer arithmetic on a fine 2^32 torus) so the simulated map stays a precise bijection without floating-point orbit collapse. The map stretches and folds phase space so nearby points diverge exponentially while overall density stays uniform \u2014 the same stretch-and-fold mechanism that classically scrambles images. Points are colored by their initial height so the shearing and mixing remain visible as iterations proceed.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet extraControls()}
		<div class="space-y-6">
			<!-- Animation parameters -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3
						class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2"
					>
						<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
						PARAMETERS
					</h3>
				</div>

				<div class="space-y-4">
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label
								for="pointCount"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Point Count</label
							>
							<span data-testid="value-pointCount" class="font-mono text-accent">{pointCount}</span>
						</div>
						<input
							id="pointCount"
							data-testid="slider-pointCount"
							type="range"
							bind:value={pointCount}
							min="100"
							max="10000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>

					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label for="speed" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Speed (steps/sec)</label
							>
							<span data-testid="value-speed" class="font-mono text-accent">{speed}</span>
						</div>
						<input
							id="speed"
							data-testid="slider-speed"
							type="range"
							bind:value={speed}
							min="1"
							max="30"
							step="1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
			</div>

			<!-- Controls -->
			<div class="space-y-4">
				<h3 class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
					<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
					CONTROLS
				</h3>
				<div class="flex flex-wrap gap-3">
					<button
						data-testid="btn-pause"
						onclick={() => (paused = !paused)}
						class="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold"
					>
						{paused ? '▶ Resume' : '❚❚ Pause'}
					</button>
					<button
						data-testid="btn-step"
						onclick={() => stepSignal++}
						disabled={!paused}
						class="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
					>
						→ Step
					</button>
					<button
						data-testid="btn-reset"
						onclick={() => resetSignal++}
						class="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold"
					>
						↺ Reset
					</button>
					<button
						data-testid="btn-randomize"
						onclick={() => randomizeSignal++}
						class="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold"
					>
						🎲 Randomize
					</button>
				</div>
			</div>
		</div>
	{/snippet}

	{#snippet renderer({ container })}
		<!-- prettier-ignore -->
		<ArnoldCatRenderer
			height={VIZ_CONTAINER_HEIGHT}
			bind:containerElement={container.el}
			bind:pointCount
			bind:speed
			bind:paused
			{resetSignal}
			{randomizeSignal}
			{stepSignal}
		/>
	{/snippet}
</VisualizationShell>
