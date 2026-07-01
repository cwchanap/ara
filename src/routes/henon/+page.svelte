<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import HenonRenderer from '$lib/components/visualizations/HenonRenderer.svelte';
	import { henonParamDefs } from '$lib/viz/schemas/henon';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { HenonParameters } from '$lib/types';
	let { data } = $props();
</script>

<VisualizationShell
	mapType="henon"
	title="HÉNON_MAP"
	moduleNumber="02"
	paramDefs={henonParamDefs}
	buildParameters={(v): HenonParameters => ({
		type: 'henon',
		a: v.a,
		b: v.b,
		iterations: v.iterations
	})}
	formula={['x(n+1) = y(n) + 1 - a·x(n)²', 'y(n+1) = b·x(n)']}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: HÉNON_MAP',
		body: 'The Hénon map is a discrete-time dynamical system introduced by Michel Hénon as a simplified model of the Poincaré section of the Lorenz model. For certain parameter values, the map exhibits chaotic behavior and produces a strange attractor.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet renderer({ values, container })}
		<HenonRenderer
			a={values.a}
			b={values.b}
			iterations={values.iterations}
			bind:containerElement={container.el}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}
</VisualizationShell>
