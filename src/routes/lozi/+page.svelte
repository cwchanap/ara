<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import LoziRenderer from '$lib/components/visualizations/LoziRenderer.svelte';
	import { loziParamDefs } from '$lib/viz/schemas/lozi';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { LoziParameters } from '$lib/types';
	let { data } = $props();
</script>

<VisualizationShell
	mapType="lozi"
	title="LOZI_MAP"
	moduleNumber="11"
	paramDefs={loziParamDefs}
	buildParameters={(v): LoziParameters => ({
		type: 'lozi',
		a: v.a,
		b: v.b,
		x0: v.x0,
		y0: v.y0,
		iterations: v.iterations
	})}
	formula={['x(n+1) = 1 + y(n) - a·|x(n)|', 'y(n+1) = b·x(n)']}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: LOZI_MAP',
		body: 'The Lozi map is a piecewise-linear counterpart to the Hénon map, introduced by René Lozi in 1978. By replacing the quadratic term with an absolute value, it provides a simpler mathematical structure while retaining rich chaotic dynamics. The absolute value creates a kink at x = 0, forming two linear branches that enable rigorous theoretical analysis in certain parameter regions where hyperbolicity holds.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet renderer({ values, container })}
		<LoziRenderer
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
