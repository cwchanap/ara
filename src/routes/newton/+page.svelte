<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import NewtonRenderer from '$lib/components/visualizations/NewtonRenderer.svelte';
	import { newtonParamDefs } from '$lib/viz/schemas/newton';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { NewtonParameters } from '$lib/types';
	let { data } = $props();
</script>

<VisualizationShell
	mapType="newton"
	title="NEWTON_FRACTAL"
	moduleNumber="06"
	paramDefs={newtonParamDefs}
	paramColumns={2}
	buildParameters={(v): NewtonParameters => ({
		type: 'newton',
		xMin: v.xMin,
		xMax: v.xMax,
		yMin: v.yMin,
		yMax: v.yMax,
		maxIterations: v.maxIterations
	})}
	formula={['z(n+1) = z(n) - (z³ - 1) / (3z²)']}
	formulaColumns={1}
	description={{
		heading: 'DATA_LOG: NEWTON_FRACTAL',
		body: "Newton fractals are created by applying Newton's method to find roots of complex functions. Each pixel is colored based on which root it converges to. The intricate boundaries between basins of attraction form beautiful fractal patterns, revealing the chaotic nature of the method's behavior."
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet renderer({ values, container })}
		<NewtonRenderer
			xMin={values.xMin}
			xMax={values.xMax}
			yMin={values.yMin}
			yMax={values.yMax}
			maxIterations={values.maxIterations}
			bind:containerElement={container.el}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}
</VisualizationShell>
