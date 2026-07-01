<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import BifurcationLogisticRenderer from '$lib/components/visualizations/BifurcationLogisticRenderer.svelte';
	import { bifurcationLogisticParamDefs } from '$lib/viz/schemas/bifurcation-logistic';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { BifurcationLogisticParameters } from '$lib/types';
	let { data } = $props();
</script>

<VisualizationShell
	mapType="bifurcation-logistic"
	title="LOGISTIC_BIFURCATION"
	moduleNumber="04"
	paramDefs={bifurcationLogisticParamDefs}
	buildParameters={(v): BifurcationLogisticParameters => ({
		type: 'bifurcation-logistic',
		rMin: v.rMin,
		rMax: v.rMax,
		maxIterations: v.maxIterations
	})}
	formula={['x(n+1) = r·x(n)·(1 - x(n))']}
	formulaColumns={1}
	description={{
		heading: 'DATA_LOG: BIFURCATION_ANALYSIS',
		body: 'The bifurcation diagram shows the long-term behavior of the logistic map for different values of the growth parameter r. As r increases, the system undergoes a series of period-doubling bifurcations, eventually leading to chaos. The famous Feigenbaum constant appears in the spacing of these bifurcations.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet renderer({ values, container })}
		<BifurcationLogisticRenderer
			rMin={values.rMin}
			rMax={values.rMax}
			maxIterations={values.maxIterations}
			bind:containerElement={container.el}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}
</VisualizationShell>
