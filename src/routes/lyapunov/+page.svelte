<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import LyapunovRenderer from '$lib/components/visualizations/LyapunovRenderer.svelte';
	import { lyapunovParamDefs } from '$lib/viz/schemas/lyapunov';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { LyapunovParameters } from '$lib/types';
	let { data } = $props();
</script>

<VisualizationShell
	mapType="lyapunov"
	title="LYAPUNOV_EXPONENTS"
	moduleNumber="10"
	paramDefs={lyapunovParamDefs}
	paramColumns={2}
	showSnapshot={false}
	buildParameters={(v): LyapunovParameters => ({
		type: 'lyapunov',
		rMin: v.rMin,
		rMax: v.rMax,
		iterations: v.iterations,
		transientIterations: v.transientIterations
	})}
	formula={['λ = lim(n→∞) (1/n) Σ ln|r(1-2xᵢ)|']}
	formulaColumns={1}
	description={{
		heading: 'DATA_LOG: LYAPUNOV_ANALYSIS',
		body: 'The Lyapunov exponent provides the most fundamental quantitative measure of chaos, characterizing the average rate at which nearby trajectories diverge in phase space. A positive exponent indicates exponential divergence of nearby trajectories and serves as the primary diagnostic for chaos.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet renderer({ values })}
		<LyapunovRenderer
			rMin={values.rMin}
			rMax={values.rMax}
			iterations={values.iterations}
			transientIterations={values.transientIterations}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}
	{#snippet afterDescription()}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
			<div class="bg-black/20 p-4 rounded border border-white/5">
				<h4 class="text-primary font-['Orbitron'] text-sm mb-2">Lyapunov Time Examples</h4>
				<ul class="text-xs text-muted-foreground space-y-1">
					<li>• Weather systems: ~5 days</li>
					<li>• Chaotic circuits: ~1 ms</li>
					<li>• Solar system: 4-5 million years</li>
				</ul>
			</div>
			<div class="bg-black/20 p-4 rounded border border-white/5">
				<h4 class="text-primary font-['Orbitron'] text-sm mb-2">Kaplan-Yorke Dimension</h4>
				<p class="text-xs text-muted-foreground">
					D<sub>L</sub> = j + (λ₁ + ... + λ<sub>j</sub>) / |λ<sub>j+1</sub>|
				</p>
				<p class="text-xs text-muted-foreground mt-1">
					Relates Lyapunov exponents to fractal dimension
				</p>
			</div>
		</div>
	{/snippet}
</VisualizationShell>
