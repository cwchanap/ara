<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import LoziRenderer from '$lib/components/visualizations/LoziRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges } from '$lib/chaos-validation';
	import type { LoziParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'lozi');
	const defaultParams = getDefaultParameters('lozi') as LoziParameters;
	const loziRanges = getStableRanges('lozi');

	const clampValue = (value: number, min: number, max: number, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	const clampLoziParams = (params?: LoziParameters | null): LoziParameters => {
		const source = params ?? defaultParams;
		if (!loziRanges) return source;
		return {
			type: 'lozi',
			a: clampValue(source.a, loziRanges.a.min, loziRanges.a.max, defaultParams.a),
			b: clampValue(source.b, loziRanges.b.min, loziRanges.b.max, defaultParams.b),
			x0: clampValue(source.x0, loziRanges.x0.min, loziRanges.x0.max, defaultParams.x0),
			y0: clampValue(source.y0, loziRanges.y0.min, loziRanges.y0.max, defaultParams.y0),
			iterations: clampValue(
				source.iterations,
				loziRanges.iterations.min,
				loziRanges.iterations.max,
				defaultParams.iterations
			)
		};
	};

	const leftInitial = clampLoziParams(initialState?.left as LoziParameters | null);
	const rightInitial = clampLoziParams(initialState?.right as LoziParameters | null);

	let leftA = $state(leftInitial.a);
	let leftB = $state(leftInitial.b);
	let leftX0 = $state(leftInitial.x0);
	let leftY0 = $state(leftInitial.y0);
	let leftIterations = $state(leftInitial.iterations);

	let rightA = $state(rightInitial.a);
	let rightB = $state(rightInitial.b);
	let rightX0 = $state(rightInitial.x0);
	let rightY0 = $state(rightInitial.y0);
	let rightIterations = $state(rightInitial.iterations);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftA;
		void leftB;
		void leftX0;
		void leftY0;
		void leftIterations;
		void rightA;
		void rightB;
		void rightX0;
		void rightY0;
		void rightIterations;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: {
					type: 'lozi' as const,
					a: leftA,
					b: leftB,
					x0: leftX0,
					y0: leftY0,
					iterations: leftIterations
				},
				right: {
					type: 'lozi' as const,
					a: rightA,
					b: rightB,
					x0: rightX0,
					y0: rightY0,
					iterations: rightIterations
				}
			};
			goto(`${base}/lozi/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): LoziParameters {
		return { type: 'lozi', a: leftA, b: leftB, x0: leftX0, y0: leftY0, iterations: leftIterations };
	}
	function getRightParams(): LoziParameters {
		return {
			type: 'lozi',
			a: rightA,
			b: rightB,
			x0: rightX0,
			y0: rightY0,
			iterations: rightIterations
		};
	}

	function handleLeftParamsChange(params: LoziParameters) {
		leftA = params.a;
		leftB = params.b;
		leftX0 = params.x0;
		leftY0 = params.y0;
		leftIterations = params.iterations;
	}

	function handleRightParamsChange(params: LoziParameters) {
		rightA = params.a;
		rightB = params.b;
		rightX0 = params.x0;
		rightY0 = params.y0;
		rightIterations = params.iterations;
	}
</script>

<ComparisonLayout
	mapType="lozi"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(params) => handleLeftParamsChange(params as LoziParameters)}
	onRightParamsChange={(params) => handleRightParamsChange(params as LoziParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-a"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">a</label
							>
							<span class="font-mono text-accent text-sm">{leftA.toFixed(2)}</span>
						</div>
						<input
							id="left-a"
							type="range"
							bind:value={leftA}
							min="0"
							max="2"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-b"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">b</label
							>
							<span class="font-mono text-accent text-sm">{leftB.toFixed(2)}</span>
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
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-x0"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">x0</label
								>
								<span class="font-mono text-accent text-sm">{leftX0.toFixed(2)}</span>
							</div>
							<input
								id="left-x0"
								type="range"
								bind:value={leftX0}
								min="-2"
								max="2"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-y0"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">y0</label
								>
								<span class="font-mono text-accent text-sm">{leftY0.toFixed(2)}</span>
							</div>
							<input
								id="left-y0"
								type="range"
								bind:value={leftY0}
								min="-2"
								max="2"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
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
							max="10000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = 1 + y(n) - a|x(n)|</p>
					<p>y(n+1) = b·x(n)</p>{/snippet}
			</ComparisonParameterPanel>
			<LoziRenderer
				bind:a={leftA}
				bind:b={leftB}
				bind:x0={leftX0}
				bind:y0={leftY0}
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
								for="right-a"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">a</label
							>
							<span class="font-mono text-accent text-sm">{rightA.toFixed(2)}</span>
						</div>
						<input
							id="right-a"
							type="range"
							bind:value={rightA}
							min="0"
							max="2"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-b"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">b</label
							>
							<span class="font-mono text-accent text-sm">{rightB.toFixed(2)}</span>
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
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-x0"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">x0</label
								>
								<span class="font-mono text-accent text-sm">{rightX0.toFixed(2)}</span>
							</div>
							<input
								id="right-x0"
								type="range"
								bind:value={rightX0}
								min="-2"
								max="2"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-y0"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">y0</label
								>
								<span class="font-mono text-accent text-sm">{rightY0.toFixed(2)}</span>
							</div>
							<input
								id="right-y0"
								type="range"
								bind:value={rightY0}
								min="-2"
								max="2"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
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
							max="10000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = 1 + y(n) - a|x(n)|</p>
					<p>y(n+1) = b·x(n)</p>{/snippet}
			</ComparisonParameterPanel>
			<LoziRenderer
				bind:a={rightA}
				bind:b={rightB}
				bind:x0={rightX0}
				bind:y0={rightY0}
				bind:iterations={rightIterations}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
