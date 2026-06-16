<!--
  Test stub for renderers that use bindable props (running/diverged/restartSignal).
  Declares those as $bindable so parent pages under test can two-way bind to them,
  and exposes their current values as data attributes for assertions.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		label?: string;
		running?: boolean;
		diverged?: boolean;
		restartSignal?: number;
		children?: Snippet;
	};

	let {
		label = 'stub',
		running = $bindable(true),
		diverged = $bindable(false),
		restartSignal = 0,
		children
	}: Props = $props();
</script>

<div
	data-testid={label}
	data-running={String(running)}
	data-diverged={String(diverged)}
	data-restart-signal={String(restartSignal)}
>
	<button type="button" data-testid="stub-trigger-diverged" onclick={() => (diverged = true)}>
		Simulate diverged
	</button>
	{#if children}
		{@render children()}
	{/if}
</div>
