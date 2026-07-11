<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import BakersMapRenderer from '$lib/components/visualizations/BakersMapRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges } from '$lib/chaos-validation';
	import type { BakersMapParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'bakers-map');
	const defaultParams = getDefaultParameters('bakers-map') as BakersMapParameters;
	const ranges = getStableRanges('bakers-map')!;

	const clampValue = (value: number, min: number, max: number, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	const clampParams = (params?: BakersMapParameters | null): BakersMapParameters => {
		const source = params ?? defaultParams;
		return {
			type: 'bakers-map',
			pointCount: clampValue(
				source.pointCount,
				ranges.pointCount.min,
				ranges.pointCount.max,
				defaultParams.pointCount
			),
			speed: clampValue(source.speed, ranges.speed.min, ranges.speed.max, defaultParams.speed)
		};
	};

	const leftInitial = clampParams(initialState?.left as BakersMapParameters | null);
	const rightInitial = clampParams(initialState?.right as BakersMapParameters | null);

	let leftPointCount = $state(leftInitial.pointCount);
	let leftSpeed = $state(leftInitial.speed);
	let rightPointCount = $state(rightInitial.pointCount);
	let rightSpeed = $state(rightInitial.speed);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftPointCount;
		void leftSpeed;
		void rightPointCount;
		void rightSpeed;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: getLeftParams(),
				right: getRightParams()
			};
			goto(`${base}/bakers-map/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): BakersMapParameters {
		return { type: 'bakers-map', pointCount: leftPointCount, speed: leftSpeed };
	}
	function getRightParams(): BakersMapParameters {
		return { type: 'bakers-map', pointCount: rightPointCount, speed: rightSpeed };
	}

	function handleLeftParamsChange(p: BakersMapParameters) {
		leftPointCount = p.pointCount;
		leftSpeed = p.speed;
	}
	function handleRightParamsChange(p: BakersMapParameters) {
		rightPointCount = p.pointCount;
		rightSpeed = p.speed;
	}
</script>

<ComparisonLayout
	mapType="bakers-map"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as BakersMapParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as BakersMapParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-pointCount"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Point Count</label
							>
							<span class="font-mono text-accent text-sm">{leftPointCount}</span>
						</div>
						<input
							id="left-pointCount"
							type="range"
							value={leftPointCount}
							oninput={(e) =>
								(leftPointCount = Number((e.currentTarget as HTMLInputElement).value))}
							min="100"
							max="10000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-speed"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Speed</label
							>
							<span class="font-mono text-accent text-sm">{leftSpeed}</span>
						</div>
						<input
							id="left-speed"
							type="range"
							value={leftSpeed}
							oninput={(e) => (leftSpeed = Number((e.currentTarget as HTMLInputElement).value))}
							min="1"
							max="10"
							step="1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>x(n+1) = 2x(n) mod 1</p>
					<p>y(n+1) = (y(n) + floor(2x(n))) / 2</p>
				{/snippet}
			</ComparisonParameterPanel>
			<BakersMapRenderer bind:pointCount={leftPointCount} bind:speed={leftSpeed} height={400} />
		</div>
	{/snippet}

	{#snippet rightPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="RIGHT_PARAMETERS">
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-pointCount"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Point Count</label
							>
							<span class="font-mono text-accent text-sm">{rightPointCount}</span>
						</div>
						<input
							id="right-pointCount"
							type="range"
							value={rightPointCount}
							oninput={(e) =>
								(rightPointCount = Number((e.currentTarget as HTMLInputElement).value))}
							min="100"
							max="10000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-speed"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Speed</label
							>
							<span class="font-mono text-accent text-sm">{rightSpeed}</span>
						</div>
						<input
							id="right-speed"
							type="range"
							value={rightSpeed}
							oninput={(e) => (rightSpeed = Number((e.currentTarget as HTMLInputElement).value))}
							min="1"
							max="10"
							step="1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>x(n+1) = 2x(n) mod 1</p>
					<p>y(n+1) = (y(n) + floor(2x(n))) / 2</p>
				{/snippet}
			</ComparisonParameterPanel>
			<BakersMapRenderer bind:pointCount={rightPointCount} bind:speed={rightSpeed} height={400} />
		</div>
	{/snippet}
</ComparisonLayout>
