<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import BifurcationHenonRenderer from '$lib/components/visualizations/BifurcationHenonRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import type { BifurcationHenonParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'bifurcation-henon');
	const defaultParams = getDefaultParameters('bifurcation-henon') as BifurcationHenonParameters;
	const aMinLimit = 0.5;
	const aMaxLimit = 1.5;
	const aStep = 0.01;

	let leftAMin = $state(
		(initialState?.left as BifurcationHenonParameters)?.aMin ?? defaultParams.aMin
	);
	let leftAMax = $state(
		(initialState?.left as BifurcationHenonParameters)?.aMax ?? defaultParams.aMax
	);
	let leftB = $state((initialState?.left as BifurcationHenonParameters)?.b ?? defaultParams.b);
	let leftMaxIterations = $state(
		(initialState?.left as BifurcationHenonParameters)?.maxIterations ?? defaultParams.maxIterations
	);

	let rightAMin = $state((initialState?.right as BifurcationHenonParameters)?.aMin ?? 1.0);
	let rightAMax = $state((initialState?.right as BifurcationHenonParameters)?.aMax ?? 1.2);
	let rightB = $state((initialState?.right as BifurcationHenonParameters)?.b ?? 0.3);
	let rightMaxIterations = $state(
		(initialState?.right as BifurcationHenonParameters)?.maxIterations ??
			defaultParams.maxIterations
	);

	let leftALastMin = leftAMin;
	let leftALastMax = leftAMax;
	let rightALastMin = rightAMin;
	let rightALastMax = rightAMax;
	$effect(() => {
		const previousMin = leftALastMin;
		const previousMax = leftALastMax;
		void leftAMin;
		void leftAMax;
		if (leftAMin < aMinLimit) leftAMin = aMinLimit;
		if (leftAMax > aMaxLimit) leftAMax = aMaxLimit;
		if (leftAMin >= leftAMax) {
			const minChanged = leftAMin !== previousMin;
			const maxChanged = leftAMax !== previousMax;
			if (minChanged && !maxChanged) {
				leftAMax = Math.min(aMaxLimit, leftAMin + aStep);
			} else {
				leftAMin = Math.max(aMinLimit, leftAMax - aStep);
			}
		}
		leftALastMin = leftAMin;
		leftALastMax = leftAMax;
	});
	$effect(() => {
		const previousMin = rightALastMin;
		const previousMax = rightALastMax;
		void rightAMin;
		void rightAMax;
		if (rightAMin < aMinLimit) rightAMin = aMinLimit;
		if (rightAMax > aMaxLimit) rightAMax = aMaxLimit;
		if (rightAMin >= rightAMax) {
			const minChanged = rightAMin !== previousMin;
			const maxChanged = rightAMax !== previousMax;
			if (minChanged && !maxChanged) {
				rightAMax = Math.min(aMaxLimit, rightAMin + aStep);
			} else {
				rightAMin = Math.max(aMinLimit, rightAMax - aStep);
			}
		}
		rightALastMin = rightAMin;
		rightALastMax = rightAMax;
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftAMin;
		void leftAMax;
		void leftB;
		void leftMaxIterations;
		void rightAMin;
		void rightAMax;
		void rightB;
		void rightMaxIterations;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: {
					type: 'bifurcation-henon' as const,
					aMin: leftAMin,
					aMax: leftAMax,
					b: leftB,
					maxIterations: leftMaxIterations
				},
				right: {
					type: 'bifurcation-henon' as const,
					aMin: rightAMin,
					aMax: rightAMax,
					b: rightB,
					maxIterations: rightMaxIterations
				}
			};
			goto(`${base}/bifurcation-henon/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): BifurcationHenonParameters {
		return {
			type: 'bifurcation-henon',
			aMin: leftAMin,
			aMax: leftAMax,
			b: leftB,
			maxIterations: leftMaxIterations
		};
	}
	function getRightParams(): BifurcationHenonParameters {
		return {
			type: 'bifurcation-henon',
			aMin: rightAMin,
			aMax: rightAMax,
			b: rightB,
			maxIterations: rightMaxIterations
		};
	}

	function handleLeftParamsChange(params: BifurcationHenonParameters) {
		leftAMin = params.aMin;
		leftAMax = params.aMax;
		leftB = params.b;
		leftMaxIterations = params.maxIterations;
	}

	function handleRightParamsChange(params: BifurcationHenonParameters) {
		rightAMin = params.aMin;
		rightAMax = params.aMax;
		rightB = params.b;
		rightMaxIterations = params.maxIterations;
	}
</script>

<ComparisonLayout
	mapType="bifurcation-henon"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(params) => handleLeftParamsChange(params as BifurcationHenonParameters)}
	onRightParamsChange={(params) => handleRightParamsChange(params as BifurcationHenonParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-amin"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">a Min</label
							>
							<span class="font-mono text-accent text-sm">{leftAMin.toFixed(3)}</span>
						</div>
						<input
							id="left-amin"
							type="range"
							bind:value={leftAMin}
							min={aMinLimit}
							max={Math.max(aMinLimit, leftAMax - aStep)}
							step={aStep}
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-amax"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">a Max</label
							>
							<span class="font-mono text-accent text-sm">{leftAMax.toFixed(3)}</span>
						</div>
						<input
							id="left-amax"
							type="range"
							bind:value={leftAMax}
							min={Math.min(aMaxLimit, leftAMin + aStep)}
							max={aMaxLimit}
							step={aStep}
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-b"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">b</label
							>
							<span class="font-mono text-accent text-sm">{leftB.toFixed(3)}</span>
						</div>
						<input
							id="left-b"
							type="range"
							bind:value={leftB}
							min="0"
							max="1"
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
				{#snippet equations()}<p>x(n+1) = y(n) + 1 - a*x(n)^2</p>
					<p>y(n+1) = b*x(n)</p>{/snippet}
			</ComparisonParameterPanel>
			<BifurcationHenonRenderer
				bind:aMin={leftAMin}
				bind:aMax={leftAMax}
				bind:b={leftB}
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
								for="right-amin"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">a Min</label
							>
							<span class="font-mono text-accent text-sm">{rightAMin.toFixed(3)}</span>
						</div>
						<input
							id="right-amin"
							type="range"
							bind:value={rightAMin}
							min={aMinLimit}
							max={Math.max(aMinLimit, rightAMax - aStep)}
							step={aStep}
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-amax"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">a Max</label
							>
							<span class="font-mono text-accent text-sm">{rightAMax.toFixed(3)}</span>
						</div>
						<input
							id="right-amax"
							type="range"
							bind:value={rightAMax}
							min={Math.min(aMaxLimit, rightAMin + aStep)}
							max={aMaxLimit}
							step={aStep}
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-b"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">b</label
							>
							<span class="font-mono text-accent text-sm">{rightB.toFixed(3)}</span>
						</div>
						<input
							id="right-b"
							type="range"
							bind:value={rightB}
							min="0"
							max="1"
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
				{#snippet equations()}<p>x(n+1) = y(n) + 1 - a*x(n)^2</p>
					<p>y(n+1) = b*x(n)</p>{/snippet}
			</ComparisonParameterPanel>
			<BifurcationHenonRenderer
				bind:aMin={rightAMin}
				bind:aMax={rightAMax}
				bind:b={rightB}
				bind:maxIterations={rightMaxIterations}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
