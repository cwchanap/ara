<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		mapType: string;
	}

	let { children, mapType }: Props = $props();

	// Handle errors from child components
	function handleError(error: unknown, reset: () => void) {
		// Store error for fallback UI
		errorState = error instanceof Error ? error : new Error(String(error));
		resetFn = reset;
	}

	let errorState = $state<Error | null>(null);
	let resetFn: (() => void) | null = null;

	function handleRetry() {
		if (resetFn) {
			resetFn();
		}
		errorState = null;
	}
</script>

{#if errorState}
	<div
		class="flex flex-col items-center justify-center h-full min-h-[400px] bg-red-500/10 border border-red-500/30 rounded-lg p-8"
	>
		<div class="text-center space-y-4">
			<h3 class="text-red-400 font-orbitron text-lg">RENDERING_ERROR</h3>
			<p class="text-red-400/80 font-rajdhani">Failed to render {mapType} visualization</p>
			<p class="text-red-400/60 font-rajdhani text-sm">{errorState.message}</p>
			<button
				onclick={handleRetry}
				class="mt-4 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 hover:bg-red-500/30 font-rajdhani"
			>
				Retry
			</button>
		</div>
	</div>
{:else}
	<svelte:boundary onerror={handleError}>{@render children()}</svelte:boundary>
{/if}
