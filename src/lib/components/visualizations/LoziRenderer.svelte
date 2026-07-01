<script lang="ts">
	import { calculateLoziTuples } from '$lib/lozi';
	import D3PointMapRenderer from './D3PointMapRenderer.svelte';

	interface Props {
		a?: number;
		b?: number;
		x0?: number;
		y0?: number;
		iterations?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}

	let {
		a = $bindable(1.7),
		b = $bindable(0.5),
		x0 = $bindable(0),
		y0 = $bindable(0),
		iterations = $bindable(5000),
		height = 500,
		containerElement = $bindable()
	}: Props = $props();

	const points = $derived.by<[number, number][]>(() => {
		try {
			return calculateLoziTuples({ a, b, x0, y0, iterations });
		} catch (err) {
			console.error('Error calculating Lozi tuples', err);
			return [];
		}
	});
</script>

<D3PointMapRenderer {points} {height} bind:containerElement chrome="plain" r={1.5} opacity={0.7} />
