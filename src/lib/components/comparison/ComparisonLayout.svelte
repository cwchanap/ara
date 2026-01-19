<!--
  ComparisonLayout Component

  Main wrapper for side-by-side comparison mode.
  Handles split-screen layout, swap functionality, and navigation.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import type { ChaosMapType, ChaosMapParameters } from '$lib/types';
	import { CHAOS_MAP_DISPLAY_NAMES } from '$lib/types';
	import {
		encodeComparisonState,
		swapParameters,
		type ComparisonURLState
	} from '$lib/comparison-url-state';
	import { cameraSyncStore } from '$lib/stores/camera-sync';
	import type { Snippet } from 'svelte';

	interface Props {
		mapType: ChaosMapType;
		leftParams: ChaosMapParameters;
		rightParams: ChaosMapParameters;
		showCameraSync?: boolean;
		leftPanel: Snippet;
		rightPanel: Snippet;
		onLeftParamsChange?: (params: ChaosMapParameters) => void;
		onRightParamsChange?: (params: ChaosMapParameters) => void;
	}

	let {
		mapType,
		leftParams,
		rightParams,
		showCameraSync = false,
		leftPanel,
		rightPanel,
		onLeftParamsChange,
		onRightParamsChange
	}: Props = $props();

	let cameraSyncEnabled = $state(true);

	// Subscribe to camera sync store
	$effect(() => {
		return cameraSyncStore.subscribe((state) => {
			cameraSyncEnabled = state.enabled;
		});
	});

	function handleSwap() {
		const currentState: ComparisonURLState = {
			compare: true,
			left: leftParams,
			right: rightParams
		};
		const swapped = swapParameters(currentState);

		// Update URL with swapped state
		const params = encodeComparisonState(swapped);
		goto(`${base}/${mapType}/compare?${params.toString()}`, {
			replaceState: true,
			noScroll: true
		});

		// Notify parent of param changes
		onLeftParamsChange?.(swapped.left);
		onRightParamsChange?.(swapped.right);
	}

	function handleExitCompare() {
		cameraSyncStore.reset();
		goto(`${base}/${mapType}`);
	}

	function toggleCameraSync() {
		cameraSyncStore.toggle();
	}
</script>

<div class="space-y-4">
	<!-- Comparison Header -->
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-3xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				{CHAOS_MAP_DISPLAY_NAMES[mapType]}_COMPARE
			</h1>
			<p class="text-muted-foreground mt-1 font-light tracking-wide">
				SIDE_BY_SIDE_COMPARISON // DUAL_VIEW
			</p>
		</div>
		<div class="flex gap-3 flex-wrap justify-end">
			<button
				onclick={handleSwap}
				class="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				⇄ Swap
			</button>
			{#if showCameraSync}
				<button
					onclick={toggleCameraSync}
					class="px-4 py-2 {cameraSyncEnabled
						? 'bg-accent/20 text-accent border-accent/30'
						: 'bg-primary/10 text-primary border-primary/30'} border rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
				>
					{cameraSyncEnabled ? '🔗 Sync On' : '🔓 Sync Off'}
				</button>
			{/if}
			<button
				onclick={handleExitCompare}
				class="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				← Exit Compare
			</button>
		</div>
	</div>

	<!-- Split Screen Layout -->
	<div class="comparison-grid">
		<!-- Left Panel -->
		<div class="comparison-panel">
			<div
				class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-3 mb-3 flex items-center gap-2"
			>
				<span class="inline-block w-2 h-2 bg-cyan-400 rounded-full"></span>
				<span class="text-sm font-['Orbitron'] text-primary uppercase tracking-wider"
					>LEFT_PANEL</span
				>
			</div>
			{@render leftPanel()}
		</div>

		<!-- Divider -->
		<div class="comparison-divider"></div>

		<!-- Right Panel -->
		<div class="comparison-panel">
			<div
				class="bg-card/30 backdrop-blur-md border border-accent/20 rounded-sm p-3 mb-3 flex items-center gap-2"
			>
				<span class="inline-block w-2 h-2 bg-purple-400 rounded-full"></span>
				<span class="text-sm font-['Orbitron'] text-accent uppercase tracking-wider"
					>RIGHT_PANEL</span
				>
			</div>
			{@render rightPanel()}
		</div>
	</div>
</div>

<style>
	.comparison-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.comparison-panel {
		flex: 1;
		min-height: 0;
	}

	.comparison-divider {
		height: 1px;
		background: linear-gradient(
			to right,
			transparent,
			oklch(0.7 0.15 200 / 0.3),
			oklch(0.6 0.2 300 / 0.3),
			transparent
		);
	}

	/* Desktop: side-by-side */
	@media (min-width: 1024px) {
		.comparison-grid {
			flex-direction: row;
			gap: 0;
		}

		.comparison-divider {
			width: 1px;
			height: auto;
			margin: 0 1rem;
			background: linear-gradient(
				to bottom,
				transparent,
				oklch(0.7 0.15 200 / 0.3),
				oklch(0.6 0.2 300 / 0.3),
				transparent
			);
		}
	}
</style>
