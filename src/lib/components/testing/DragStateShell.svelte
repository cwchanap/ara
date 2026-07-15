<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import type { ChaosMapParameters } from '$lib/types';
	import type { ParamDef } from '$lib/viz/types';

	// A shell harness with schema-driven preview AND commit policy sliders, plus
	// a renderer snippet that exposes onRenderStateChange via clickable buttons.
	// Used to exercise the shell's drag-state wiring (status badge, disabled
	// action buttons, draftValues ondraft callback) and the onRenderStateChange
	// path — none of which the default live-policy henon/lyapunov shells trigger.
	const defs: ParamDef[] = [
		{
			key: 'a',
			label: 'a',
			min: 0.5,
			max: 1.5,
			step: 0.001,
			decimals: 3,
			default: 1.4,
			updatePolicy: 'preview'
		},
		{
			key: 'b',
			label: 'b',
			min: 0,
			max: 1,
			step: 0.01,
			decimals: 2,
			default: 0.3,
			updatePolicy: 'commit'
		}
	];

	function buildParameters(v: Record<string, number>): ChaosMapParameters {
		return { type: 'henon', a: v.a, b: v.b, iterations: 2000 };
	}
</script>

<VisualizationShell
	mapType="henon"
	title="HÉNON_MAP"
	moduleNumber="02"
	paramDefs={defs}
	{buildParameters}
	formula={['x(n+1) = …']}
	description={{ heading: 'DATA_LOG: HÉNON_MAP', body: 'desc' }}
	isAuthenticated={true}
>
	{#snippet renderer(args)}
		<div data-testid="renderer" data-draft-a={args.draftValues.a}>
			<button data-testid="trigger-rendering" onclick={() => args.onRenderStateChange('rendering')}>
				trigger rendering
			</button>
			<button data-testid="trigger-idle" onclick={() => args.onRenderStateChange('idle')}>
				trigger idle
			</button>
		</div>
	{/snippet}
</VisualizationShell>
