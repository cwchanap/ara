<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import StandardRenderer from '$lib/components/visualizations/StandardRenderer.svelte';
	import { standardParamDefs } from '$lib/viz/schemas/standard';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { StandardParameters } from '$lib/types';
	let { data } = $props();
</script>

<VisualizationShell
	mapType="standard"
	title="STANDARD_MAP"
	moduleNumber="07"
	paramDefs={standardParamDefs}
	paramColumns={4}
	buildParameters={(v): StandardParameters => ({
		type: 'standard',
		k: v.k,
		numP: v.numP,
		numQ: v.numQ,
		iterations: v.iterations
	})}
	formula={['p(n+1) = p(n) + K·sin(q(n)) mod 2π', 'q(n+1) = q(n) + p(n+1) mod 2π']}
	formulaColumns={1}
	description={{
		heading: 'DATA_LOG: STANDARD_MAP',
		body: 'The standard map (also called the Chirikov-Taylor map) is an area-preserving chaotic map from a square with side 2π onto itself. It was introduced as a simplified model for motion in a magnetic field. For low values of K, the map displays regular behavior with stable orbits, while larger K values lead to chaotic dynamics.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet renderer({ values, container })}
		<StandardRenderer
			k={values.k}
			numP={values.numP}
			numQ={values.numQ}
			iterations={values.iterations}
			bind:containerElement={container.el}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}
</VisualizationShell>
