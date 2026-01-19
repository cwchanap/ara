<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import BifurcationLogisticRenderer from '$lib/components/visualizations/BifurcationLogisticRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import type { BifurcationLogisticParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'bifurcation-logistic');
	const defaultParams = getDefaultParameters(
		'bifurcation-logistic'
	) as BifurcationLogisticParameters;

	let leftRMin = $state(
		(initialState?.left as BifurcationLogisticParameters)?.rMin ?? defaultParams.rMin
	);
	let leftRMax = $state(
		(initialState?.left as BifurcationLogisticParameters)?.rMax ?? defaultParams.rMax
	);
	let leftMaxIterations = $state(
		(initialState?.left as BifurcationLogisticParameters)?.maxIterations ??
			defaultParams.maxIterations
	);

	let rightRMin = $state((initialState?.right as BifurcationLogisticParameters)?.rMin ?? 3.5);
	let rightRMax = $state((initialState?.right as BifurcationLogisticParameters)?.rMax ?? 3.7);
	let rightMaxIterations = $state(
		(initialState?.right as BifurcationLogisticParameters)?.maxIterations ??
			defaultParams.maxIterations
	);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftRMin;
		void leftRMax;
		void leftMaxIterations;
		void rightRMin;
		void rightRMax;
		void rightMaxIterations;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: {
					type: 'bifurcation-logistic' as const,
					rMin: leftRMin,
					rMax: leftRMax,
					maxIterations: leftMaxIterations
				},
				right: {
					type: 'bifurcation-logistic' as const,
					rMin: rightRMin,
					rMax: rightRMax,
					maxIterations: rightMaxIterations
				}
			};
			goto(`${base}/bifurcation-logistic/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);
	});

	function getLeftParams(): BifurcationLogisticParameters {
		return {
			type: 'bifurcation-logistic',
			rMin: leftRMin,
			rMax: leftRMax,
			maxIterations: leftMaxIterations
		};
	}
	function getRightParams(): BifurcationLogisticParameters {
		return {
			type: 'bifurcation-logistic',
			rMin: rightRMin,
			rMax: rightRMax,
			maxIterations: rightMaxIterations
		};
	}
</script>

<ComparisonLayout
	mapType="bifurcation-logistic"
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
								for="left-rmin"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">r Min</label
							>
							<span class="font-mono text-accent text-sm">{leftRMin.toFixed(3)}</span>
						</div>
						<input
							id="left-rmin"
							type="range"
							bind:value={leftRMin}
							min="2.5"
							max="4"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-rmax"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">r Max</label
							>
							<span class="font-mono text-accent text-sm">{leftRMax.toFixed(3)}</span>
						</div>
						<input
							id="left-rmax"
							type="range"
							bind:value={leftRMax}
							min="2.5"
							max="4"
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
							<span class="font-mono text-accent text-sm">{leftMaxIterations}</span>
						</div>
						<input
							id="left-iterations"
							type="range"
							bind:value={leftMaxIterations}
							min="100"
							max="2000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = r*x(n)*(1 - x(n))</p>{/snippet}
			</ComparisonParameterPanel>
			<BifurcationLogisticRenderer
				bind:rMin={leftRMin}
				bind:rMax={leftRMax}
				bind:maxIterations={leftMaxIterations}
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
								for="right-rmin"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">r Min</label
							>
							<span class="font-mono text-accent text-sm">{rightRMin.toFixed(3)}</span>
						</div>
						<input
							id="right-rmin"
							type="range"
							bind:value={rightRMin}
							min="2.5"
							max="4"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-rmax"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">r Max</label
							>
							<span class="font-mono text-accent text-sm">{rightRMax.toFixed(3)}</span>
						</div>
						<input
							id="right-rmax"
							type="range"
							bind:value={rightRMax}
							min="2.5"
							max="4"
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
							<span class="font-mono text-accent text-sm">{rightMaxIterations}</span>
						</div>
						<input
							id="right-iterations"
							type="range"
							bind:value={rightMaxIterations}
							min="100"
							max="2000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = r*x(n)*(1 - x(n))</p>{/snippet}
			</ComparisonParameterPanel>
			<BifurcationLogisticRenderer
				bind:rMin={rightRMin}
				bind:rMax={rightRMax}
				bind:maxIterations={rightMaxIterations}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
