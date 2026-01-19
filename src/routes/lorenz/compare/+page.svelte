<script lang="ts">
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
	import type { LorenzParameters } from '$lib/types';

	// Decode state from URL
	const initialState = decodeComparisonState($page.url, 'lorenz');
	const defaultParams = getDefaultParameters('lorenz') as LorenzParameters;

	// Left panel parameters
	let leftSigma = $state((initialState?.left as LorenzParameters)?.sigma ?? defaultParams.sigma);
	let leftRho = $state((initialState?.left as LorenzParameters)?.rho ?? defaultParams.rho);
	let leftBeta = $state((initialState?.left as LorenzParameters)?.beta ?? defaultParams.beta);

	// Right panel parameters
	let rightSigma = $state((initialState?.right as LorenzParameters)?.sigma ?? 15);
	let rightRho = $state((initialState?.right as LorenzParameters)?.rho ?? 25);
	let rightBeta = $state((initialState?.right as LorenzParameters)?.beta ?? 3);

	// Sync URL when parameters change
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		// Track all parameters
		void leftSigma;
		void leftRho;
		void leftBeta;
		void rightSigma;
		void rightRho;
		void rightBeta;

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: { type: 'lorenz' as const, sigma: leftSigma, rho: leftRho, beta: leftBeta },
				right: { type: 'lorenz' as const, sigma: rightSigma, rho: rightRho, beta: rightBeta }
			};
			const params = encodeComparisonState(state);
			goto(`${base}/lorenz/compare?${params.toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);
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
