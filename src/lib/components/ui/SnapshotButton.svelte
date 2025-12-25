<!--
  SnapshotButton Component
  
  A reusable button for capturing 2D chaos visualizations as images.
  Works with both Canvas elements and D3 containers (Canvas + SVG).
  Follows sci-fi aesthetic with neon cyan styling.
-->
<script lang="ts">
	import {
		captureCanvas,
		captureContainer,
		downloadSnapshot,
		generateFilename,
		type SnapshotOptions
	} from '$lib/snapshot';

	type TargetType = 'canvas' | 'container';

	interface Props {
		/** The target element to capture - either a canvas or a container div */
		target: HTMLCanvasElement | HTMLDivElement | undefined;
		/** Type of target: 'canvas' for direct canvas, 'container' for div with canvas/svg */
		targetType?: TargetType;
		/** The chaos map type, used for filename */
		mapType: string;
		/** Optional snapshot options */
		options?: SnapshotOptions;
		/** Whether the button is disabled */
		disabled?: boolean;
	}

	let {
		target,
		targetType = 'container',
		mapType,
		options = {},
		disabled = false
	}: Props = $props();

	let isCapturing = $state(false);
	let showSuccess = $state(false);
	let showError = $state(false);
	let errorMessage = $state('');
	let successTimeout: ReturnType<typeof setTimeout> | null = null;
	let errorTimeout: ReturnType<typeof setTimeout> | null = null;

	async function handleSnapshot() {
		if (!target || isCapturing || disabled) return;

		isCapturing = true;
		showSuccess = false;
		showError = false;

		// Clear any existing timeouts
		if (successTimeout) clearTimeout(successTimeout);
		if (errorTimeout) clearTimeout(errorTimeout);

		try {
			let result;

			if (targetType === 'canvas') {
				result = await captureCanvas(target as HTMLCanvasElement, options);
			} else {
				result = await captureContainer(target as HTMLDivElement, options);
			}

			if (result.success && result.dataUrl) {
				const filename = generateFilename(mapType, options.format === 'jpeg' ? 'jpeg' : 'png');
				downloadSnapshot(result.dataUrl, filename);

				showSuccess = true;
				successTimeout = setTimeout(() => {
					showSuccess = false;
				}, 2000);
			} else {
				errorMessage = result.error || 'Failed to capture snapshot';
				showError = true;
				errorTimeout = setTimeout(() => {
					showError = false;
				}, 4000);
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unexpected error';
			showError = true;
			errorTimeout = setTimeout(() => {
				showError = false;
			}, 4000);
		} finally {
			isCapturing = false;
		}
	}

	// Cleanup timeouts on destroy
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (successTimeout) clearTimeout(successTimeout);
		if (errorTimeout) clearTimeout(errorTimeout);
	});
</script>

<div class="relative inline-block">
	<button
		onclick={handleSnapshot}
		disabled={disabled || isCapturing || !target}
		class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
		aria-label="Take snapshot of visualization"
	>
		{#if isCapturing}
			<span class="animate-spin">⟳</span>
			<span>Capturing...</span>
		{:else}
			<span>📷</span>
			<span>Snapshot</span>
		{/if}
	</button>

	<!-- Success feedback -->
	{#if showSuccess}
		<div
			class="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-green-400 font-mono animate-in fade-in slide-in-from-top-1"
		>
			✓ Saved
		</div>
	{/if}

	<!-- Error feedback -->
	{#if showError}
		<div
			class="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-red-400 font-mono animate-in fade-in slide-in-from-top-1 max-w-48 truncate"
			title={errorMessage}
		>
			✗ {errorMessage}
		</div>
	{/if}
</div>
