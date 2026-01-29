<!--
  VisualizationContainer Component
  
  Container for the visualization canvas/SVG with consistent styling.
-->
<script lang="ts">
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { Snippet } from 'svelte';

	interface Props {
		renderEngine?: string;
		height?: number;
		containerRef?: HTMLDivElement;
		children?: Snippet;
	}

	let {
		renderEngine = 'CANVAS',
		height = VIZ_CONTAINER_HEIGHT,
		containerRef = $bindable(),
		children
	}: Props = $props();

	const normalizeRenderEngine = (value: string) =>
		value
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');

	const normalizedRenderEngine = $derived(normalizeRenderEngine(renderEngine));
</script>

<div
	bind:this={containerRef}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
	style="height: {height}px;"
>
	<div
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // {normalizedRenderEngine}
	</div>
	{#if children}
		{@render children()}
	{/if}
</div>
