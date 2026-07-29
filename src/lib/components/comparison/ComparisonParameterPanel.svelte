<!--
  ComparisonParameterPanel Component

  A compact parameter panel for use in comparison mode.
  Displays parameter controls and equations in a condensed format.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import CollapsiblePanel from '$lib/components/ui/CollapsiblePanel.svelte';
	import { PANEL_STORAGE_KEYS } from '$lib/chaos-panel-storage';

	interface Props {
		title?: string;
		side: 'left' | 'right';
		children: Snippet;
		equations?: Snippet;
	}

	let { title = 'PARAMETERS', side, children, equations }: Props = $props();

	const bodyId = $derived(`chaos-panel-parameters-body-${side}`);
</script>

<div
	class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-4 space-y-4 relative overflow-hidden"
>
	<!-- Decor corners -->
	<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
	<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
	<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
	<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

	<CollapsiblePanel
		{title}
		storageKey={PANEL_STORAGE_KEYS.parameters}
		defaultOpen={true}
		{bodyId}
		titleLevel="h3"
	>
		<div class="grid grid-cols-1 gap-4">
			{@render children()}
		</div>

		{#if equations}
			<div
				class="text-xs text-muted-foreground font-mono bg-black/20 p-3 rounded border border-white/5 space-y-1"
			>
				{@render equations()}
			</div>
		{/if}
	</CollapsiblePanel>
</div>
