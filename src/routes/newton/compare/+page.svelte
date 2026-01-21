<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import NewtonRenderer from '$lib/components/visualizations/NewtonRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import type { NewtonParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'newton');
	const defaultParams = getDefaultParameters('newton') as NewtonParameters;

	let leftXMin = $state((initialState?.left as NewtonParameters)?.xMin ?? defaultParams.xMin);
	let leftXMax = $state((initialState?.left as NewtonParameters)?.xMax ?? defaultParams.xMax);
	let leftYMin = $state((initialState?.left as NewtonParameters)?.yMin ?? defaultParams.yMin);
	let leftYMax = $state((initialState?.left as NewtonParameters)?.yMax ?? defaultParams.yMax);
	let leftMaxIterations = $state(
		(initialState?.left as NewtonParameters)?.maxIterations ?? defaultParams.maxIterations
	);

	let rightXMin = $state((initialState?.right as NewtonParameters)?.xMin ?? -1);
	let rightXMax = $state((initialState?.right as NewtonParameters)?.xMax ?? 1);
	let rightYMin = $state((initialState?.right as NewtonParameters)?.yMin ?? -1);
	let rightYMax = $state((initialState?.right as NewtonParameters)?.yMax ?? 1);
	let rightMaxIterations = $state((initialState?.right as NewtonParameters)?.maxIterations ?? 100);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftXMin;
		void leftXMax;
		void leftYMin;
		void leftYMax;
		void leftMaxIterations;
		void rightXMin;
		void rightXMax;
		void rightYMin;
		void rightYMax;
		void rightMaxIterations;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: {
					type: 'newton' as const,
					xMin: leftXMin,
					xMax: leftXMax,
					yMin: leftYMin,
					yMax: leftYMax,
					maxIterations: leftMaxIterations
				},
				right: {
					type: 'newton' as const,
					xMin: rightXMin,
					xMax: rightXMax,
					yMin: rightYMin,
					yMax: rightYMax,
					maxIterations: rightMaxIterations
				}
			};
			goto(`${base}/newton/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): NewtonParameters {
		return {
			type: 'newton',
			xMin: leftXMin,
			xMax: leftXMax,
			yMin: leftYMin,
			yMax: leftYMax,
			maxIterations: leftMaxIterations
		};
	}
	function getRightParams(): NewtonParameters {
		return {
			type: 'newton',
			xMin: rightXMin,
			xMax: rightXMax,
			yMin: rightYMin,
			yMax: rightYMax,
			maxIterations: rightMaxIterations
		};
	}

	function handleLeftParamsChange(params: NewtonParameters) {
		leftXMin = params.xMin;
		leftXMax = params.xMax;
		leftYMin = params.yMin;
		leftYMax = params.yMax;
		leftMaxIterations = params.maxIterations;
	}

	function handleRightParamsChange(params: NewtonParameters) {
		rightXMin = params.xMin;
		rightXMax = params.xMax;
		rightYMin = params.yMin;
		rightYMax = params.yMax;
		rightMaxIterations = params.maxIterations;
	}
</script>

<ComparisonLayout
	mapType="newton"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(params) => handleLeftParamsChange(params as NewtonParameters)}
	onRightParamsChange={(params) => handleRightParamsChange(params as NewtonParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<label
								for="left-xmin"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">X Min</label
							>
							<input
								id="left-xmin"
								type="range"
								bind:value={leftXMin}
								min="-5"
								max="0"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<label
								for="left-xmax"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">X Max</label
							>
							<input
								id="left-xmax"
								type="range"
								bind:value={leftXMax}
								min="0"
								max="5"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between">
							<label for="left-max-iterations" class="text-primary/80 text-xs uppercase font-bold"
								>Max Iterations</label
							><span class="font-mono text-accent text-sm">{leftMaxIterations}</span>
						</div>
						<input
							id="left-max-iterations"
							type="range"
							bind:value={leftMaxIterations}
							min="10"
							max="100"
							step="5"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>z(n+1) = z(n) - f(z)/f'(z)</p>
					<p>f(z) = z³ - 1</p>{/snippet}
			</ComparisonParameterPanel>
			<NewtonRenderer
				bind:xMin={leftXMin}
				bind:xMax={leftXMax}
				bind:yMin={leftYMin}
				bind:yMax={leftYMax}
				bind:maxIterations={leftMaxIterations}
				height={400}
			/>
		</div>
	{/snippet}

	{#snippet rightPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="RIGHT_PARAMETERS">
				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<label
								for="right-xmin"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">X Min</label
							>
							<input
								id="right-xmin"
								type="range"
								bind:value={rightXMin}
								min="-5"
								max="0"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<label
								for="right-xmax"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">X Max</label
							>
							<input
								id="right-xmax"
								type="range"
								bind:value={rightXMax}
								min="0"
								max="5"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between">
							<label for="right-max-iterations" class="text-primary/80 text-xs uppercase font-bold"
								>Max Iterations</label
							><span class="font-mono text-accent text-sm">{rightMaxIterations}</span>
						</div>
						<input
							id="right-max-iterations"
							type="range"
							bind:value={rightMaxIterations}
							min="10"
							max="100"
							step="5"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>z(n+1) = z(n) - f(z)/f'(z)</p>
					<p>f(z) = z³ - 1</p>{/snippet}
			</ComparisonParameterPanel>
			<NewtonRenderer
				bind:xMin={rightXMin}
				bind:xMax={rightXMax}
				bind:yMin={rightYMin}
				bind:yMax={rightYMax}
				bind:maxIterations={rightMaxIterations}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
