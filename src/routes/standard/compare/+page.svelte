<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import StandardRenderer from '$lib/components/visualizations/StandardRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges, validateParameters } from '$lib/chaos-validation';
	import type { StandardParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'standard');
	const defaultParams = getDefaultParameters('standard') as StandardParameters;
	const standardRanges = getStableRanges('standard');

	const clampValue = (value: number, key: keyof StandardParameters, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		const range = standardRanges?.[key as keyof typeof standardRanges];
		if (!range) return value;
		return Math.min(range.max, Math.max(range.min, value));
	};

	const clampInt = (value: number, key: keyof StandardParameters, fallback: number) => {
		const clamped = clampValue(value, key, fallback);
		const rounded = Math.round(clamped);
		return clampValue(rounded, key, fallback);
	};

	const normalizeStandardParams = (
		params: StandardParameters,
		fallback: StandardParameters
	): StandardParameters => {
		const validation = validateParameters('standard', params);
		if (!validation.isValid) return fallback;
		return {
			type: 'standard',
			K: clampValue(params.K, 'K', fallback.K),
			numP: clampInt(params.numP, 'numP', fallback.numP),
			numQ: clampInt(params.numQ, 'numQ', fallback.numQ),
			iterations: clampInt(params.iterations, 'iterations', fallback.iterations)
		};
	};

	const leftInitial = normalizeStandardParams(
		(initialState?.left as StandardParameters) ?? defaultParams,
		defaultParams
	);
	const rightInitial = normalizeStandardParams(
		(initialState?.right as StandardParameters) ?? defaultParams,
		defaultParams
	);

	let leftK = $state(leftInitial.K);
	let leftNumP = $state(leftInitial.numP);
	let leftNumQ = $state(leftInitial.numQ);
	let leftIterations = $state(leftInitial.iterations);

	let rightK = $state(rightInitial.K);
	let rightNumP = $state(rightInitial.numP);
	let rightNumQ = $state(rightInitial.numQ);
	let rightIterations = $state(rightInitial.iterations);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftK;
		void leftNumP;
		void leftNumQ;
		void leftIterations;
		void rightK;
		void rightNumP;
		void rightNumQ;
		void rightIterations;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const leftParams = normalizeStandardParams(
				{ type: 'standard', K: leftK, numP: leftNumP, numQ: leftNumQ, iterations: leftIterations },
				defaultParams
			);
			const rightParams = normalizeStandardParams(
				{
					type: 'standard',
					K: rightK,
					numP: rightNumP,
					numQ: rightNumQ,
					iterations: rightIterations
				},
				defaultParams
			);
			const state = {
				compare: true as const,
				left: leftParams,
				right: rightParams
			};
			goto(`${base}/standard/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): StandardParameters {
		return {
			type: 'standard',
			K: leftK,
			numP: leftNumP,
			numQ: leftNumQ,
			iterations: leftIterations
		};
	}
	function getRightParams(): StandardParameters {
		return {
			type: 'standard',
			K: rightK,
			numP: rightNumP,
			numQ: rightNumQ,
			iterations: rightIterations
		};
	}

	function handleLeftParamsChange(params: StandardParameters) {
		leftK = params.K;
		leftNumP = params.numP;
		leftNumQ = params.numQ;
		leftIterations = params.iterations;
	}

	function handleRightParamsChange(params: StandardParameters) {
		rightK = params.K;
		rightNumP = params.numP;
		rightNumQ = params.numQ;
		rightIterations = params.iterations;
	}
</script>

<ComparisonLayout
	mapType="standard"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(params) => handleLeftParamsChange(params as StandardParameters)}
	onRightParamsChange={(params) => handleRightParamsChange(params as StandardParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-k"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">K</label
							>
							<span class="font-mono text-accent text-sm">{leftK.toFixed(3)}</span>
						</div>
						<input
							id="left-k"
							type="range"
							bind:value={leftK}
							min="0"
							max="5"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-nump"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">numP</label
							>
							<span class="font-mono text-accent text-sm">{leftNumP}</span>
						</div>
						<input
							id="left-nump"
							type="range"
							bind:value={leftNumP}
							min="1"
							max="20"
							step="1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-numq"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">numQ</label
							>
							<span class="font-mono text-accent text-sm">{leftNumQ}</span>
						</div>
						<input
							id="left-numq"
							type="range"
							bind:value={leftNumQ}
							min="1"
							max="20"
							step="1"
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
							min="1000"
							max="50000"
							step="1000"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>p(n+1) = p(n) + K*sin(q(n))</p>
					<p>q(n+1) = q(n) + p(n+1)</p>{/snippet}
			</ComparisonParameterPanel>
			<StandardRenderer
				bind:K={leftK}
				bind:numP={leftNumP}
				bind:numQ={leftNumQ}
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
								for="right-k"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">K</label
							>
							<span class="font-mono text-accent text-sm">{rightK.toFixed(3)}</span>
						</div>
						<input
							id="right-k"
							type="range"
							bind:value={rightK}
							min="0"
							max="5"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-nump"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">numP</label
							>
							<span class="font-mono text-accent text-sm">{rightNumP}</span>
						</div>
						<input
							id="right-nump"
							type="range"
							bind:value={rightNumP}
							min="1"
							max="20"
							step="1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-numq"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">numQ</label
							>
							<span class="font-mono text-accent text-sm">{rightNumQ}</span>
						</div>
						<input
							id="right-numq"
							type="range"
							bind:value={rightNumQ}
							min="1"
							max="20"
							step="1"
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
							min="1000"
							max="50000"
							step="1000"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>p(n+1) = p(n) + K*sin(q(n))</p>
					<p>q(n+1) = q(n) + p(n+1)</p>{/snippet}
			</ComparisonParameterPanel>
			<StandardRenderer
				bind:K={rightK}
				bind:numP={rightNumP}
				bind:numQ={rightNumQ}
				bind:iterations={rightIterations}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
