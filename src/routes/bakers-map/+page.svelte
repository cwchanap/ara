<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import BakersMapRenderer from '$lib/components/visualizations/BakersMapRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { createStabilityReporter } from '$lib/stability-reporter';
	import type { BakersMapParameters, ChaosMapParameters } from '$lib/types';

	let { data } = $props();

	let pointCount = $state(3000);
	let speed = $state(1);
	let paused = $state(false);
	let resetSignal = $state(0);
	let randomizeSignal = $state(0);
	let stepSignal = $state(0);

	function clampInt(v: number, min: number, max: number): number {
		if (!Number.isFinite(v)) return min;
		return Math.min(max, Math.max(min, Math.round(v)));
	}

	const stability = createStabilityReporter({
		mapType: 'bakers-map',
		getParams: () => buildParameters(),
		reactive: true
	});

	$effect(() => {
		void pointCount;
		void speed;
		stability.triggerReactive();
		return () => stability.cleanupReactive();
	});

	function buildParameters(): BakersMapParameters {
		return { type: 'bakers-map', pointCount, speed };
	}

	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'bakers-map') return;
		pointCount = clampInt(p.pointCount, 100, 10000);
		speed = clampInt(p.speed, 1, 10);
	}
</script>

<VisualizationShell
	mapType="bakers-map"
	title="BAKERS_MAP"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	stabilityReporter={stability.stabilityReporter}
	formula={['x(n+1) = 2x(n) mod 1', 'y(n+1) = (y(n) + floor(2x(n))) / 2']}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: BAKERS_MAP',
		body: 'The Baker\u2019s Map is the simplest model of chaotic mixing. Each step stretches the unit square horizontally by a factor of two, cuts it at the midpoint, and stacks the right half on top of the left. The map is measure-preserving, so a uniform distribution stays uniform forever \u2014 but points colored by their initial height interleave into ever-finer horizontal bands, making the stretch/cut/stack mechanism visible. This is the same kneading action that gives chaotic systems their mixing property: after enough folds, any two nearby points end up far apart.'
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
								>Speed</label
							>
							<span data-testid="value-speed" class="font-mono text-accent">{speed}</span>
						</div>
						<input
							id="speed"
							data-testid="slider-speed"
							type="range"
							bind:value={speed}
							min="1"
							max="10"
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
		<BakersMapRenderer
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
