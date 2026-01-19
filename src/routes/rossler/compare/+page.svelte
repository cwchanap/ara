<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import RosslerRenderer from '$lib/components/visualizations/RosslerRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import type { RosslerParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'rossler');
	const defaultParams = getDefaultParameters('rossler') as RosslerParameters;

	// Left panel parameters
	let leftA = $state((initialState?.left as RosslerParameters)?.a ?? defaultParams.a);
	let leftB = $state((initialState?.left as RosslerParameters)?.b ?? defaultParams.b);
	let leftC = $state((initialState?.left as RosslerParameters)?.c ?? defaultParams.c);

	// Right panel parameters
	let rightA = $state((initialState?.right as RosslerParameters)?.a ?? 0.3);
	let rightB = $state((initialState?.right as RosslerParameters)?.b ?? 0.3);
	let rightC = $state((initialState?.right as RosslerParameters)?.c ?? 4.5);

	// Sync URL when parameters change
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftA;
		void leftB;
		void leftC;
		void rightA;
		void rightB;
		void rightC;

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: { type: 'rossler' as const, a: leftA, b: leftB, c: leftC },
				right: { type: 'rossler' as const, a: rightA, b: rightB, c: rightC }
			};
			const params = encodeComparisonState(state);
			goto(`${base}/rossler/compare?${params.toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);
	});

	function getLeftParams(): RosslerParameters {
		return { type: 'rossler', a: leftA, b: leftB, c: leftC };
	}

	function getRightParams(): RosslerParameters {
		return { type: 'rossler', a: rightA, b: rightB, c: rightC };
	}

	function handleLeftParamsChange(params: RosslerParameters) {
		leftA = params.a;
		leftB = params.b;
		leftC = params.c;
	}

	function handleRightParamsChange(params: RosslerParameters) {
		rightA = params.a;
		rightB = params.b;
		rightC = params.c;
	}
</script>

<ComparisonLayout
	mapType="rossler"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={true}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as RosslerParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as RosslerParameters)}
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
							min="0"
							max="1"
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
								for="left-c"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								c
							</label>
							<span class="font-mono text-accent text-sm">{leftC.toFixed(2)}</span>
						</div>
						<input
							id="left-c"
							type="range"
							bind:value={leftC}
							min="1"
							max="20"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>dx/dt = -y - z</p>
					<p>dy/dt = x + a·y</p>
					<p>dz/dt = b + z·(x - c)</p>
				{/snippet}
			</ComparisonParameterPanel>

			<RosslerRenderer
				bind:a={leftA}
				bind:b={leftB}
				bind:c={leftC}
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
							min="0"
							max="1"
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
								for="right-c"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>
								c
							</label>
							<span class="font-mono text-accent text-sm">{rightC.toFixed(2)}</span>
						</div>
						<input
							id="right-c"
							type="range"
							bind:value={rightC}
							min="1"
							max="20"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>dx/dt = -y - z</p>
					<p>dy/dt = x + a·y</p>
					<p>dz/dt = b + z·(x - c)</p>
				{/snippet}
			</ComparisonParameterPanel>

			<RosslerRenderer
				bind:a={rightA}
				bind:b={rightB}
				bind:c={rightC}
				height={400}
				compareMode={true}
				compareSide="right"
			/>
		</div>
	{/snippet}
</ComparisonLayout>
