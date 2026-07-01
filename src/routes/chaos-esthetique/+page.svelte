<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import ChaosEsthetiqueRenderer from '$lib/components/visualizations/ChaosEsthetiqueRenderer.svelte';
	import { chaosEsthetiqueParamDefs } from '$lib/viz/schemas/chaos-esthetique';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { ChaosEsthetiqueParameters } from '$lib/types';
	let { data } = $props();
</script>

<VisualizationShell
	mapType="chaos-esthetique"
	title="CHAOS_ESTHETIQUE"
	moduleNumber="08"
	paramDefs={chaosEsthetiqueParamDefs}
	paramColumns={5}
	buildParameters={(v): ChaosEsthetiqueParameters => ({
		type: 'chaos-esthetique',
		a: v.a,
		b: v.b,
		x0: v.x0,
		y0: v.y0,
		iterations: v.iterations
	})}
	formula={['x(n+1) = y(n) + a·x(n) + 2(1-a)·x(n)² / (1+x(n)²)', 'y(n+1) = -b·x(n) + f(x(n+1))']}
	formulaColumns={1}
	description={{
		heading: 'DATA_LOG: CHAOS_ESTHETIQUE',
		body: 'This is a custom aesthetic chaos system that generates beautiful patterns through iterative transformations. The function f(x) creates a nonlinear mapping, and the coupled equations produce intricate attractors. The system is highly sensitive to parameters a and b, displaying a wide variety of behaviors from stable orbits to chaotic attractors.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet renderer({ values, container })}
		<ChaosEsthetiqueRenderer
			a={values.a}
			b={values.b}
			x0={values.x0}
			y0={values.y0}
			iterations={values.iterations}
			bind:containerElement={container.el}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}
</VisualizationShell>
