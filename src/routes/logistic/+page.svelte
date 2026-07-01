<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import LogisticRenderer from '$lib/components/visualizations/LogisticRenderer.svelte';
	import { logisticParamDefs } from '$lib/viz/schemas/logistic';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { LogisticParameters } from '$lib/types';
	let { data } = $props();
</script>

<VisualizationShell
	mapType="logistic"
	title="LOGISTIC_MAP"
	moduleNumber="03"
	paramDefs={logisticParamDefs}
	buildParameters={(v): LogisticParameters => ({
		type: 'logistic',
		r: v.r,
		x0: v.x0,
		iterations: v.iterations
	})}
	formula={['x(n+1) = r·x(n)·(1 - x(n))']}
	formulaColumns={1}
	description={{
		heading: 'DATA_LOG: LOGISTIC_MAP',
		body: 'The logistic map is a polynomial mapping that exhibits very complicated chaotic behavior. It was popularized by Robert May as a simple model for population growth with limited resources. As the parameter r increases, the system transitions from stable to periodic to chaotic behavior.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet renderer({ values, container })}
		<LogisticRenderer
			r={values.r}
			x0={values.x0}
			iterations={values.iterations}
			bind:containerElement={container.el}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}
</VisualizationShell>
