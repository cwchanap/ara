<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import HenonRenderer from '$lib/components/visualizations/HenonRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import type { HenonParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'henon');
	const defaultParams = getDefaultParameters('henon') as HenonParameters;

	// Left panel parameters
	let leftA = $state((initialState?.left as HenonParameters)?.a ?? defaultParams.a);
	let leftB = $state((initialState?.left as HenonParameters)?.b ?? defaultParams.b);
	let leftIterations = $state(
		(initialState?.left as HenonParameters)?.iterations ?? defaultParams.iterations
	);

	// Right panel parameters
	let rightA = $state((initialState?.right as HenonParameters)?.a ?? 1.2);
	let rightB = $state((initialState?.right as HenonParameters)?.b ?? 0.4);
	let rightIterations = $state(
		(initialState?.right as HenonParameters)?.iterations ?? defaultParams.iterations
	);

	// Sync URL when parameters change
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftA;
		void leftB;
		void leftIterations;
		void rightA;
		void rightB;
		void rightIterations;

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: { type: 'henon' as const, a: leftA, b: leftB, iterations: leftIterations },
				right: { type: 'henon' as const, a: rightA, b: rightB, iterations: rightIterations }
			};
			const params = encodeComparisonState(state);
			goto(`${base}/henon/compare?${params.toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);
	});

	function getLeftParams(): HenonParameters {
		return { type: 'henon', a: leftA, b: leftB, iterations: leftIterations };
	}

	function getRightParams(): HenonParameters {
		return { type: 'henon', a: rightA, b: rightB, iterations: rightIterations };
	}

	function handleLeftParamsChange(params: HenonParameters) {
		leftA = params.a;
		leftB = params.b;
		leftIterations = params.iterations;
	}

	function handleRightParamsChange(params: HenonParameters) {
		rightA = params.a;
		rightB = params.b;
		rightIterations = params.iterations;
	}
</script>

<ComparisonLayout
	mapType="henon"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as HenonParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as HenonParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-a"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								a
							</label>
							<span class="font-mono text-accent text-sm">{leftA.toFixed(3)}</span>
						</div>
						<input
							id="left-a"
							type="range"
							bind:value={leftA}
							min="0.5"
							max="1.5"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>

					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-b"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								b
							</label>
							<span class="font-mono text-accent text-sm">{leftB.toFixed(3)}</span>
						</div>
						<input
							id="left-b"
							type="range"
							bind:value={leftB}
							min="0"
							max="1"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>

					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-iterations"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								Iterations
							</label>
							<span class="font-mono text-accent text-sm">{leftIterations}</span>
						</div>
						<input
							id="left-iterations"
							type="range"
							bind:value={leftIterations}
							min="100"
							max="5000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>x(n+1) = y(n) + 1 - a·x(n)²</p>
					<p>y(n+1) = b·x(n)</p>
				{/snippet}
			</ComparisonParameterPanel>

			<HenonRenderer bind:a={leftA} bind:b={leftB} bind:iterations={leftIterations} height={400} />
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
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								a
							</label>
							<span class="font-mono text-accent text-sm">{rightA.toFixed(3)}</span>
						</div>
						<input
							id="right-a"
							type="range"
							bind:value={rightA}
							min="0.5"
							max="1.5"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>

					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-b"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								b
							</label>
							<span class="font-mono text-accent text-sm">{rightB.toFixed(3)}</span>
						</div>
						<input
							id="right-b"
							type="range"
							bind:value={rightB}
							min="0"
							max="1"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>

					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-iterations"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								Iterations
							</label>
							<span class="font-mono text-accent text-sm">{rightIterations}</span>
						</div>
						<input
							id="right-iterations"
							type="range"
							bind:value={rightIterations}
							min="100"
							max="5000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>x(n+1) = y(n) + 1 - a·x(n)²</p>
					<p>y(n+1) = b·x(n)</p>
				{/snippet}
			</ComparisonParameterPanel>

			<HenonRenderer
				bind:a={rightA}
				bind:b={rightB}
				bind:iterations={rightIterations}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
