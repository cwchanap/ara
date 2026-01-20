<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import LogisticRenderer from '$lib/components/visualizations/LogisticRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import type { LogisticParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'logistic');
	const defaultParams = getDefaultParameters('logistic') as LogisticParameters;

	let leftR = $state((initialState?.left as LogisticParameters)?.r ?? defaultParams.r);
	let leftX0 = $state((initialState?.left as LogisticParameters)?.x0 ?? defaultParams.x0);
	let leftIterations = $state(
		(initialState?.left as LogisticParameters)?.iterations ?? defaultParams.iterations
	);

	let rightR = $state((initialState?.right as LogisticParameters)?.r ?? 3.5);
	let rightX0 = $state((initialState?.right as LogisticParameters)?.x0 ?? 0.1);
	let rightIterations = $state(
		(initialState?.right as LogisticParameters)?.iterations ?? defaultParams.iterations
	);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftR;
		void leftX0;
		void leftIterations;
		void rightR;
		void rightX0;
		void rightIterations;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: { type: 'logistic' as const, r: leftR, x0: leftX0, iterations: leftIterations },
				right: { type: 'logistic' as const, r: rightR, x0: rightX0, iterations: rightIterations }
			};
			goto(`${base}/logistic/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): LogisticParameters {
		return { type: 'logistic', r: leftR, x0: leftX0, iterations: leftIterations };
	}
	function getRightParams(): LogisticParameters {
		return { type: 'logistic', r: rightR, x0: rightX0, iterations: rightIterations };
	}
</script>

<ComparisonLayout
	mapType="logistic"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-r"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">r</label
							>
							<span class="font-mono text-accent text-sm">{leftR.toFixed(3)}</span>
						</div>
						<input
							id="left-r"
							type="range"
							bind:value={leftR}
							min="2.5"
							max="4"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-x0"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">x₀</label
							>
							<span class="font-mono text-accent text-sm">{leftX0.toFixed(3)}</span>
						</div>
						<input
							id="left-x0"
							type="range"
							bind:value={leftX0}
							min="0.01"
							max="0.99"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-iterations"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Iterations</label
							>
							<span class="font-mono text-accent text-sm">{leftIterations}</span>
						</div>
						<input
							id="left-iterations"
							type="range"
							bind:value={leftIterations}
							min="10"
							max="200"
							step="10"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = r·x(n)·(1 - x(n))</p>{/snippet}
			</ComparisonParameterPanel>
			<LogisticRenderer
				bind:r={leftR}
				bind:x0={leftX0}
				bind:iterations={leftIterations}
				height={400}
			/>
		</div>
	{/snippet}

	{#snippet rightPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="RIGHT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-r"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">r</label
							>
							<span class="font-mono text-accent text-sm">{rightR.toFixed(3)}</span>
						</div>
						<input
							id="right-r"
							type="range"
							bind:value={rightR}
							min="2.5"
							max="4"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-x0"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">x₀</label
							>
							<span class="font-mono text-accent text-sm">{rightX0.toFixed(3)}</span>
						</div>
						<input
							id="right-x0"
							type="range"
							bind:value={rightX0}
							min="0.01"
							max="0.99"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-iterations"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Iterations</label
							>
							<span class="font-mono text-accent text-sm">{rightIterations}</span>
						</div>
						<input
							id="right-iterations"
							type="range"
							bind:value={rightIterations}
							min="10"
							max="200"
							step="10"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = r·x(n)·(1 - x(n))</p>{/snippet}
			</ComparisonParameterPanel>
			<LogisticRenderer
				bind:r={rightR}
				bind:x0={rightX0}
				bind:iterations={rightIterations}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
