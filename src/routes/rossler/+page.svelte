<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import RosslerRenderer from '$lib/components/visualizations/RosslerRenderer.svelte';
	import { rosslerParamDefs } from '$lib/viz/schemas/rossler';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { RosslerParameters } from '$lib/types';
	let { data } = $props();
</script>

<VisualizationShell
	mapType="rossler"
	title="RÖSSLER_ATTRACTOR"
	moduleNumber="09"
	paramDefs={rosslerParamDefs}
	buildParameters={(v): RosslerParameters => ({
		type: 'rossler',
		a: v.a,
		b: v.b,
		c: v.c
	})}
	formula={['dx/dt = -y - z', 'dy/dt = x + a·y', 'dz/dt = b + z(x - c)']}
	formulaColumns={3}
	description={{
		heading: 'DATA_LOG: RÖSSLER_SYSTEM',
		body: "The Rössler attractor is a system of three non-linear ordinary differential equations originally studied by Otto Rössler in the 1970s. Unlike the Lorenz attractor's butterfly shape, the Rössler attractor has a continuous band structure with a characteristic scroll pattern when viewed from certain angles, making it one of the simplest continuous dynamical systems that can exhibit chaotic behavior."
	}}
	isAuthenticated={!!data?.session}
	showSnapshot={false}
>
	{#snippet renderer({ values })}
		<RosslerRenderer a={values.a} b={values.b} c={values.c} height={VIZ_CONTAINER_HEIGHT} />
	{/snippet}
</VisualizationShell>
