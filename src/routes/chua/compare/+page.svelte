<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import ChuaRenderer from '$lib/components/visualizations/ChuaRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { isChuaParameters } from '$lib/type-guards';
	import { useDebouncedEffect } from '$lib/use-debounced-effect';
	import { DEBOUNCE_MS } from '$lib/constants';
	import type { ChuaParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'chua');
	const defaultParams = getDefaultParameters('chua') as ChuaParameters;

	const leftParams = initialState?.left;
	const rightParams = initialState?.right;

	let leftAlpha = $state(
		leftParams && isChuaParameters(leftParams) ? leftParams.alpha : defaultParams.alpha
	);
	let leftBeta = $state(
		leftParams && isChuaParameters(leftParams) ? leftParams.beta : defaultParams.beta
	);
	let leftGamma = $state(
		leftParams && isChuaParameters(leftParams) ? leftParams.gamma : defaultParams.gamma
	);
	let leftA = $state(leftParams && isChuaParameters(leftParams) ? leftParams.a : defaultParams.a);
	let leftB = $state(leftParams && isChuaParameters(leftParams) ? leftParams.b : defaultParams.b);

	let rightAlpha = $state(
		rightParams && isChuaParameters(rightParams) ? rightParams.alpha : defaultParams.alpha
	);
	let rightBeta = $state(
		rightParams && isChuaParameters(rightParams) ? rightParams.beta : defaultParams.beta
	);
	let rightGamma = $state(
		rightParams && isChuaParameters(rightParams) ? rightParams.gamma : defaultParams.gamma
	);
	let rightA = $state(
		rightParams && isChuaParameters(rightParams) ? rightParams.a : defaultParams.a
	);
	let rightB = $state(
		rightParams && isChuaParameters(rightParams) ? rightParams.b : defaultParams.b
	);

	function buildState() {
		return {
			compare: true as const,
			left: {
				type: 'chua' as const,
				alpha: leftAlpha,
				beta: leftBeta,
				gamma: leftGamma,
				a: leftA,
				b: leftB
			},
			right: {
				type: 'chua' as const,
				alpha: rightAlpha,
				beta: rightBeta,
				gamma: rightGamma,
				a: rightA,
				b: rightB
			}
		};
	}

	const urlUpdater = useDebouncedEffect(() => {
		goto(`${base}/chua/compare?${encodeComparisonState(buildState())}`, {
			replaceState: true,
			noScroll: true
		});
	}, DEBOUNCE_MS);

	let initialized = false;
	$effect(() => {
		void leftAlpha;
		void leftBeta;
		void leftGamma;
		void leftA;
		void leftB;
		void rightAlpha;
		void rightBeta;
		void rightGamma;
		void rightA;
		void rightB;
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
		if ($page.url.searchParams.get('compare') !== 'true') {
			goto(`${base}/chua/compare?${encodeComparisonState(buildState())}`, {
				replaceState: true,
				noScroll: true
			});
		}
	});

	function getLeftParams(): ChuaParameters {
		return { type: 'chua', alpha: leftAlpha, beta: leftBeta, gamma: leftGamma, a: leftA, b: leftB };
	}
	function getRightParams(): ChuaParameters {
		return {
			type: 'chua',
			alpha: rightAlpha,
			beta: rightBeta,
			gamma: rightGamma,
			a: rightA,
			b: rightB
		};
	}
	function handleLeftParamsChange(params: ChuaParameters) {
		leftAlpha = params.alpha;
		leftBeta = params.beta;
		leftGamma = params.gamma;
		leftA = params.a;
		leftB = params.b;
	}
	function handleRightParamsChange(params: ChuaParameters) {
		rightAlpha = params.alpha;
		rightBeta = params.beta;
		rightGamma = params.gamma;
		rightA = params.a;
		rightB = params.b;
	}
</script>

<ComparisonLayout
	mapType="chua"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={true}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as ChuaParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as ChuaParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-alpha"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">α (alpha)</label
							>
							<span class="font-mono text-accent text-sm">{leftAlpha.toFixed(2)}</span>
						</div>
						<input
							id="left-alpha"
							type="range"
							bind:value={leftAlpha}
							min="0"
							max="25"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-beta"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">β (beta)</label
							>
							<span class="font-mono text-accent text-sm">{leftBeta.toFixed(2)}</span>
						</div>
						<input
							id="left-beta"
							type="range"
							bind:value={leftBeta}
							min="0"
							max="55"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-gamma"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">γ (gamma)</label
							>
							<span class="font-mono text-accent text-sm">{leftGamma.toFixed(2)}</span>
						</div>
						<input
							id="left-gamma"
							type="range"
							bind:value={leftGamma}
							min="-1"
							max="1"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-a"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">a (m₀)</label
							>
							<span class="font-mono text-accent text-sm">{leftA.toFixed(3)}</span>
						</div>
						<input
							id="left-a"
							type="range"
							bind:value={leftA}
							min="-2"
							max="0"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-b"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">b (m₁)</label
							>
							<span class="font-mono text-accent text-sm">{leftB.toFixed(3)}</span>
						</div>
						<input
							id="left-b"
							type="range"
							bind:value={leftB}
							min="-1.5"
							max="0"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>dx/dt = α(y − x − f(x))</p>
					<p>dy/dt = x − y + z</p>
					<p>dz/dt = −(βy + γz)</p>
				{/snippet}
			</ComparisonParameterPanel>

			<ChuaRenderer
				bind:alpha={leftAlpha}
				bind:beta={leftBeta}
				bind:gamma={leftGamma}
				bind:a={leftA}
				bind:b={leftB}
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
								for="right-alpha"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">α (alpha)</label
							>
							<span class="font-mono text-accent text-sm">{rightAlpha.toFixed(2)}</span>
						</div>
						<input
							id="right-alpha"
							type="range"
							bind:value={rightAlpha}
							min="0"
							max="25"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-beta"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">β (beta)</label
							>
							<span class="font-mono text-accent text-sm">{rightBeta.toFixed(2)}</span>
						</div>
						<input
							id="right-beta"
							type="range"
							bind:value={rightBeta}
							min="0"
							max="55"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-gamma"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">γ (gamma)</label
							>
							<span class="font-mono text-accent text-sm">{rightGamma.toFixed(2)}</span>
						</div>
						<input
							id="right-gamma"
							type="range"
							bind:value={rightGamma}
							min="-1"
							max="1"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-a"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">a (m₀)</label
							>
							<span class="font-mono text-accent text-sm">{rightA.toFixed(3)}</span>
						</div>
						<input
							id="right-a"
							type="range"
							bind:value={rightA}
							min="-2"
							max="0"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-b"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">b (m₁)</label
							>
							<span class="font-mono text-accent text-sm">{rightB.toFixed(3)}</span>
						</div>
						<input
							id="right-b"
							type="range"
							bind:value={rightB}
							min="-1.5"
							max="0"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>dx/dt = α(y − x − f(x))</p>
					<p>dy/dt = x − y + z</p>
					<p>dz/dt = −(βy + γz)</p>
				{/snippet}
			</ComparisonParameterPanel>

			<ChuaRenderer
				bind:alpha={rightAlpha}
				bind:beta={rightBeta}
				bind:gamma={rightGamma}
				bind:a={rightA}
				bind:b={rightB}
				height={400}
				compareMode={true}
				compareSide="right"
			/>
		</div>
	{/snippet}
</ComparisonLayout>
