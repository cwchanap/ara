<!--
  ParameterPanel Component
  
  A reusable container for parameter controls with sci-fi styling.
  Contains corner decorations, title, and slots for parameter sliders and equations.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		children: Snippet;
		/** Optional formula lines rendered in a mono grid below the controls.
		 *  Omit (or pass an empty array) to skip the equations box entirely. */
		formula?: string[];
		paramColumns?: 1 | 2 | 3 | 4 | 5;
		equationColumns?: 1 | 2 | 3 | 4 | 5;
	}

	let {
		title = 'SYSTEM_PARAMETERS',
		children,
		formula,
		paramColumns = 3,
		equationColumns = 3
	}: Props = $props();

	const COLS: Record<1 | 2 | 3 | 4 | 5, string> = {
		1: 'md:grid-cols-1',
		2: 'md:grid-cols-2',
		3: 'md:grid-cols-3',
		4: 'md:grid-cols-4',
		5: 'md:grid-cols-5'
	};
</script>

<div
	class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative overflow-hidden group"
>
	<!-- Decor corners -->
	<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
	<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
	<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
	<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

	<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
		<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
		{title}
	</h2>

	<div class="grid grid-cols-1 {COLS[paramColumns]} gap-8">
		{@render children()}
	</div>

	{#if formula && formula.length > 0}
		<div
			class="grid grid-cols-1 {COLS[
				equationColumns
			]} gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			{#each formula as line (line)}
				<p>{line}</p>
			{/each}
		</div>
	{/if}
</div>
