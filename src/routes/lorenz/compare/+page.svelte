<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import LorenzRenderer from '$lib/components/visualizations/LorenzRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { isLorenzParameters } from '$lib/type-guards';
	import { useDebouncedEffect } from '$lib/use-debounced-effect';
	import { DEBOUNCE_MS } from '$lib/constants';
	import type { LorenzParameters } from '$lib/types';

	// Decode state from URL
	const initialState = decodeComparisonState($page.url, 'lorenz');
	const defaultParams = getDefaultParameters('lorenz') as LorenzParameters;

	// Extract params with type guards
	const leftParams = initialState?.left;
	const rightParams = initialState?.right;

	// Left panel parameters
	let leftSigma = $state(
		leftParams && isLorenzParameters(leftParams) ? leftParams.sigma : defaultParams.sigma
	);
	let leftRho = $state(
		leftParams && isLorenzParameters(leftParams) ? leftParams.rho : defaultParams.rho
	);
	let leftBeta = $state(
		leftParams && isLorenzParameters(leftParams) ? leftParams.beta : defaultParams.beta
	);

	// Right panel parameters
	let rightSigma = $state(
		rightParams && isLorenzParameters(rightParams) ? rightParams.sigma : defaultParams.sigma
	);
	let rightRho = $state(
		rightParams && isLorenzParameters(rightParams) ? rightParams.rho : defaultParams.rho
	);
	let rightBeta = $state(
		rightParams && isLorenzParameters(rightParams) ? rightParams.beta : defaultParams.beta
	);

	// Sync URL when parameters change using debounced effect
	const urlUpdater = useDebouncedEffect(() => {
		const state = {
			compare: true as const,
			left: { type: 'lorenz' as const, sigma: leftSigma, rho: leftRho, beta: leftBeta },
			right: { type: 'lorenz' as const, sigma: rightSigma, rho: rightRho, beta: rightBeta }
		};
		goto(`${base}/lorenz/compare?${encodeComparisonState(state)}`, {
			replaceState: true,
			noScroll: true
		});
	}, DEBOUNCE_MS);

	let initialized = $state(false);
	$effect(() => {
		void leftSigma;
		void leftRho;
		void leftBeta;
		void rightSigma;
		void rightRho;
		void rightBeta;
		// Skip first run to avoid conflict with onMount
		if (!initialized) {
			initialized = true;
			return;
		}
		urlUpdater.trigger();
	});

	onDestroy(() => {
		urlUpdater.cleanup();
	});

	onMount(() => {
		const params = encodeComparisonState({
			compare: true as const,
			left: { type: 'lorenz' as const, sigma: leftSigma, rho: leftRho, beta: leftBeta },
			right: { type: 'lorenz' as const, sigma: rightSigma, rho: rightRho, beta: rightBeta }
		});
		if ($page.url.searchParams.get('compare') !== 'true') {
			goto(`${base}/lorenz/compare?${params.toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}
	});

	function getLeftParams(): LorenzParameters {
		return { type: 'lorenz', sigma: leftSigma, rho: leftRho, beta: leftBeta };
	}

	function getRightParams(): LorenzParameters {
		return { type: 'lorenz', sigma: rightSigma, rho: rightRho, beta: rightBeta };
	}

	function handleLeftParamsChange(params: LorenzParameters) {
		leftSigma = params.sigma;
		leftRho = params.rho;
		leftBeta = params.beta;
	}

	function handleRightParamsChange(params: LorenzParameters) {
		rightSigma = params.sigma;
		rightRho = params.rho;
		rightBeta = params.beta;
	}
</script>

<ComparisonLayout
	mapType="lorenz"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={true}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as LorenzParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as LorenzParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-sigma"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								σ (sigma)
							</label>
							<span class="font-mono text-accent text-sm">{leftSigma.toFixed(2)}</span>
						</div>
						<input
							id="left-sigma"
							type="range"
							bind:value={leftSigma}
							min="0"
							max="50"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>

					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-rho"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								ρ (rho)
							</label>
							<span class="font-mono text-accent text-sm">{leftRho.toFixed(2)}</span>
						</div>
						<input
							id="left-rho"
							type="range"
							bind:value={leftRho}
							min="0"
							max="50"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>

					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-beta"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								β (beta)
							</label>
							<span class="font-mono text-accent text-sm">{leftBeta.toFixed(2)}</span>
						</div>
						<input
							id="left-beta"
							type="range"
							bind:value={leftBeta}
							min="0"
							max="10"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>dx/dt = σ(y - x)</p>
					<p>dy/dt = x(ρ - z) - y</p>
					<p>dz/dt = xy - βz</p>
				{/snippet}
			</ComparisonParameterPanel>

			<LorenzRenderer
				bind:sigma={leftSigma}
				bind:rho={leftRho}
				bind:beta={leftBeta}
				height={400}
				compareMode={true}
				compareSide="left"
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
								for="right-sigma"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								σ (sigma)
							</label>
							<span class="font-mono text-accent text-sm">{rightSigma.toFixed(2)}</span>
						</div>
						<input
							id="right-sigma"
							type="range"
							bind:value={rightSigma}
							min="0"
							max="50"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>

					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-rho"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								ρ (rho)
							</label>
							<span class="font-mono text-accent text-sm">{rightRho.toFixed(2)}</span>
						</div>
						<input
							id="right-rho"
							type="range"
							bind:value={rightRho}
							min="0"
							max="50"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>

					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-beta"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								β (beta)
							</label>
							<span class="font-mono text-accent text-sm">{rightBeta.toFixed(2)}</span>
						</div>
						<input
							id="right-beta"
							type="range"
							bind:value={rightBeta}
							min="0"
							max="10"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>dx/dt = σ(y - x)</p>
					<p>dy/dt = x(ρ - z) - y</p>
					<p>dz/dt = xy - βz</p>
				{/snippet}
			</ComparisonParameterPanel>

			<LorenzRenderer
				bind:sigma={rightSigma}
				bind:rho={rightRho}
				bind:beta={rightBeta}
				height={400}
				compareMode={true}
				compareSide="right"
			/>
		</div>
	{/snippet}
</ComparisonLayout>
