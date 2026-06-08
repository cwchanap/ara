<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		leftPanel?: Snippet;
		rightPanel?: Snippet;
		children?: Snippet;
		[key: string]: unknown;
	};

	let { leftPanel, rightPanel, children }: Props = $props();
</script>

<div data-testid="comparison-layout-stub">
	{#if leftPanel}
		<div data-testid="left-panel">
			{@render leftPanel()}
		</div>
	{/if}
	{#if rightPanel}
		<div data-testid="right-panel">
			{@render rightPanel()}
		</div>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</div>
