<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import LyapunovRenderer from '$lib/components/visualizations/LyapunovRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import type { LyapunovParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'lyapunov');
	const defaultParams = getDefaultParameters('lyapunov') as LyapunovParameters;

	let leftRMin = $state((initialState?.left as LyapunovParameters)?.rMin ?? defaultParams.rMin);
	let leftRMax = $state((initialState?.left as LyapunovParameters)?.rMax ?? defaultParams.rMax);
	let leftIterations = $state(
		(initialState?.left as LyapunovParameters)?.iterations ?? defaultParams.iterations
	);
	let leftTransientIterations = $state(
		(initialState?.left as LyapunovParameters)?.transientIterations ??
			defaultParams.transientIterations
	);

	let rightRMin = $state((initialState?.right as LyapunovParameters)?.rMin ?? 3.0);
	let rightRMax = $state((initialState?.right as LyapunovParameters)?.rMax ?? 3.8);
	let rightIterations = $state(
		(initialState?.right as LyapunovParameters)?.iterations ?? defaultParams.iterations
	);
	let rightTransientIterations = $state(
		(initialState?.right as LyapunovParameters)?.transientIterations ??
			defaultParams.transientIterations
	);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let initialized = false;
	$effect(() => {
		void leftRMin;
		void leftRMax;
		void leftIterations;
		void leftTransientIterations;
		void rightRMin;
		void rightRMax;
		void rightIterations;
		void rightTransientIterations;
		if (!initialized) {
			initialized = true;
			return;
		}
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: {
					type: 'lyapunov' as const,
					rMin: leftRMin,
					rMax: leftRMax,
					iterations: leftIterations,
					transientIterations: leftTransientIterations
				},
				right: {
					type: 'lyapunov' as const,
					rMin: rightRMin,
					rMax: rightRMax,
					iterations: rightIterations,
					transientIterations: rightTransientIterations
				}
			};
			goto(`${base}/lyapunov/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): LyapunovParameters {
		return {
			type: 'lyapunov',
			rMin: leftRMin,
			rMax: leftRMax,
			iterations: leftIterations,
			transientIterations: leftTransientIterations
		};
	}
	function getRightParams(): LyapunovParameters {
		return {
			type: 'lyapunov',
			rMin: rightRMin,
			rMax: rightRMax,
			iterations: rightIterations,
			transientIterations: rightTransientIterations
		};
	}

	function handleLeftParamsChange(params: LyapunovParameters) {
		leftRMin = params.rMin;
		leftRMax = params.rMax;
		leftIterations = params.iterations;
		leftTransientIterations = params.transientIterations;
	}

	function handleRightParamsChange(params: LyapunovParameters) {
		rightRMin = params.rMin;
		rightRMax = params.rMax;
		rightIterations = params.iterations;
		rightTransientIterations = params.transientIterations;
	}
</script>

<ComparisonLayout
	mapType="lyapunov"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(params) => handleLeftParamsChange(params as LyapunovParameters)}
	onRightParamsChange={(params) => handleRightParamsChange(params as LyapunovParameters)}
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
							min="0"
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
							min={leftRMin}
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
							<span class="font-mono text-accent text-sm">{leftIterations}</span>
						</div>
						<input
							id="left-iterations"
							type="range"
							bind:value={leftIterations}
							min="100"
							max="5000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-transient"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Transient</label
							>
							<span class="font-mono text-accent text-sm">{leftTransientIterations}</span>
						</div>
						<input
							id="left-transient"
							type="range"
							bind:value={leftTransientIterations}
							min="50"
							max="2000"
							step="50"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>Lyapunov Exponent</p>{/snippet}
			</ComparisonParameterPanel>
			<LyapunovRenderer
				bind:rMin={leftRMin}
				bind:rMax={leftRMax}
				bind:iterations={leftIterations}
				bind:transientIterations={leftTransientIterations}
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
							min="0"
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
							min={rightRMin}
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
							<span class="font-mono text-accent text-sm">{rightIterations}</span>
						</div>
						<input
							id="right-iterations"
							type="range"
							bind:value={rightIterations}
							min="100"
							max="5000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-transient"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Transient</label
							>
							<span class="font-mono text-accent text-sm">{rightTransientIterations}</span>
						</div>
						<input
							id="right-transient"
							type="range"
							bind:value={rightTransientIterations}
							min="50"
							max="2000"
							step="50"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>Lyapunov Exponent</p>{/snippet}
			</ComparisonParameterPanel>
			<LyapunovRenderer
				bind:rMin={rightRMin}
				bind:rMax={rightRMax}
				bind:iterations={rightIterations}
				bind:transientIterations={rightTransientIterations}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
