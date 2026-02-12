<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		label?: string;
		children?: Snippet;
	};

	let { label = 'stub', children }: Props = $props();
</script>

<div data-testid={label}>
	{#if children}
		{@render children()}
	{/if}
</div>
