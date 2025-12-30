<!--
  VisualizationHeader Component
  
  Common header for visualization pages with title, subtitle, and action buttons.
  Follows sci-fi aesthetic with neon cyan styling.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { base } from '$app/paths';

	interface Props {
		title: string;
		moduleNumber?: string;
		children?: Snippet;
	}

	let { title, moduleNumber, children }: Props = $props();
</script>

<div class="flex items-center justify-between border-b border-primary/20 pb-4">
	<div>
		<h1
			class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
		>
			{title}
		</h1>
		{#if moduleNumber}
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_{moduleNumber}
			</p>
		{/if}
	</div>
	<div class="flex gap-3">
		{#if children}
			{@render children()}
		{/if}
		<a
			href="{base}/"
			class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
		>
			← Return
		</a>
	</div>
</div>
