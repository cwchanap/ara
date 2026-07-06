<script lang="ts">
	import { createRawSnippet } from 'svelte';
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import type { ChaosMapParameters } from '$lib/types';

	// Simulates a page-managed page (Clifford/Ikeda/etc.): the slider lives in
	// extraControls against page-owned $state, paramDefs is empty, and
	// buildParameters ignores the shell's `values` arg and reads `a` directly.
	// Used to verify the shell's $derived comparisonUrl tracks reads of page
	// state inside buildParameters — not just the schema-driven `values`.
	let a = $state(1.4);

	const renderer = createRawSnippet(() => ({ render: () => '<div data-testid="renderer"></div>' }));

	function buildParameters(): ChaosMapParameters {
		// Reads page-owned $state `a` — the shell's $derived comparisonUrl must
		// track this read even though the `values` arg is unused.
		return {
			type: 'clifford',
			a,
			b: -1.8,
			c: -1.9,
			d: -1.9,
			iterations: 100000
		};
	}
</script>

<VisualizationShell
	mapType="clifford"
	title="CLIFFORD_ATTRACTOR"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	formula={['x(n+1) = sin(a*y) + c*cos(a*x)', 'y(n+1) = sin(b*x) + d*cos(b*y)']}
	description={{ heading: 'DATA_LOG: CLIFFORD', body: 'desc' }}
	isAuthenticated={true}
	{renderer}
>
	{#snippet extraControls()}
		<input type="range" data-testid="page-owned-a" bind:value={a} min="-3" max="3" step="0.1" />
	{/snippet}
</VisualizationShell>
