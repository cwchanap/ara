<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import BifurcationHenonRenderer from '$lib/components/visualizations/BifurcationHenonRenderer.svelte';
	import { bifurcationHenonParamDefs } from '$lib/viz/schemas/bifurcation-henon';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { BifurcationHenonParameters } from '$lib/types';
	let { data } = $props();
</script>

<VisualizationShell
	mapType="bifurcation-henon"
	title="HÉNON_BIFURCATION"
	moduleNumber="05"
	paramDefs={bifurcationHenonParamDefs}
	paramColumns={4}
	buildParameters={(v): BifurcationHenonParameters => ({
		type: 'bifurcation-henon',
		aMin: v.aMin,
		aMax: v.aMax,
		b: v.b,
		maxIterations: v.maxIterations
	})}
	formula={['x(n+1) = y(n) + 1 - a·x(n)²', 'y(n+1) = b·x(n)']}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: HÉNON_BIFURCATION',
		body: 'This diagram shows how the attractor of the Hénon map changes as the parameter a varies. The system exhibits complex bifurcation patterns and chaotic behavior for certain parameter ranges.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet renderer({ values, container })}
		<BifurcationHenonRenderer
			aMin={values.aMin}
			aMax={values.aMax}
			b={values.b}
			maxIterations={values.maxIterations}
			bind:containerElement={container.el}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}
</VisualizationShell>
