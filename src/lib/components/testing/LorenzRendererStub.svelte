<script lang="ts">
	import { onMount } from 'svelte';
	let {
		head = $bindable(0),
		diverged = $bindable(false),
		containerElement = $bindable<HTMLDivElement | undefined>(undefined)
	} = $props();

	onMount(() => {
		// Mutate bindable props so parent binding code is exercised
		head = 1;
		diverged = true;
	});
</script>

<div data-testid="lorenz-renderer-stub"></div>
