<script lang="ts">
	import { calculateHenonTuples } from '$lib/henon';
	import D3PointMapRenderer from './D3PointMapRenderer.svelte';

	interface Props {
		a?: number;
		b?: number;
		iterations?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}

	let {
		a = $bindable(1.4),
		b = $bindable(0.3),
		iterations = $bindable(2000),
		height = 500,
		containerElement = $bindable()
	}: Props = $props();

	const points = $derived(calculateHenonTuples({ a, b, iterations }));
</script>

<D3PointMapRenderer
	{points}
	{height}
	bind:containerElement
	chrome="decorated"
	r={2}
	opacity={0.8}
	glow
	axisLabels={{ x: 'X_AXIS', y: 'Y_AXIS' }}
/>
