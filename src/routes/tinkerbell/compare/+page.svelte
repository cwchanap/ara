<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import TinkerbellRenderer from '$lib/components/visualizations/TinkerbellRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges } from '$lib/chaos-validation';
	import type { TinkerbellParameters, TinkerbellColorMode } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'tinkerbell');
	const defaultParams = getDefaultParameters('tinkerbell') as TinkerbellParameters;
	const ranges = getStableRanges('tinkerbell')!;

	const clampValue = (value: number, min: number, max: number, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	const clampParams = (params?: TinkerbellParameters | null): TinkerbellParameters => {
		const source = params ?? defaultParams;
		return {
			type: 'tinkerbell',
			a: clampValue(source.a, ranges.a.min, ranges.a.max, defaultParams.a),
			b: clampValue(source.b, ranges.b.min, ranges.b.max, defaultParams.b),
			c: clampValue(source.c, ranges.c.min, ranges.c.max, defaultParams.c),
			d: clampValue(source.d, ranges.d.min, ranges.d.max, defaultParams.d),
			iterations: clampValue(
				source.iterations,
				ranges.iterations.min,
				ranges.iterations.max,
				defaultParams.iterations
			),
			colorMode: source.colorMode ?? defaultParams.colorMode,
			zoom: source.zoom ?? defaultParams.zoom,
			pointSize: source.pointSize ?? defaultParams.pointSize,
			opacity: source.opacity ?? defaultParams.opacity
		};
	};

	const leftInitial = clampParams(initialState?.left as TinkerbellParameters | null);
	const rightInitial = clampParams(initialState?.right as TinkerbellParameters | null);

	let leftA = $state(leftInitial.a);
	let leftB = $state(leftInitial.b);
	let leftC = $state(leftInitial.c);
	let leftD = $state(leftInitial.d);
	let leftIterations = $state(leftInitial.iterations);

	let rightA = $state(rightInitial.a);
	let rightB = $state(rightInitial.b);
	let rightC = $state(rightInitial.c);
	let rightD = $state(rightInitial.d);
	let rightIterations = $state(rightInitial.iterations);

	// Styling params are intentionally shared from the left side only, so the
	// two panels differ only by their mathematical parameters.
	const colorMode: TinkerbellColorMode =
		leftInitial.colorMode ?? defaultParams.colorMode ?? 'density';
	const zoom = leftInitial.zoom ?? defaultParams.zoom ?? 1;
	const pointSize = leftInitial.pointSize ?? defaultParams.pointSize ?? 1.5;
	const opacity = leftInitial.opacity ?? defaultParams.opacity ?? 0.6;

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftA;
		void leftB;
		void leftC;
		void leftD;
		void leftIterations;
		void rightA;
		void rightB;
		void rightC;
		void rightD;
		void rightIterations;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: getLeftParams(),
				right: getRightParams()
			};
			goto(`${base}/tinkerbell/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): TinkerbellParameters {
		return {
			type: 'tinkerbell',
			a: leftA,
			b: leftB,
			c: leftC,
			d: leftD,
			iterations: leftIterations,
			colorMode,
			zoom,
			pointSize,
			opacity
		};
	}
	function getRightParams(): TinkerbellParameters {
		return {
			type: 'tinkerbell',
			a: rightA,
			b: rightB,
			c: rightC,
			d: rightD,
			iterations: rightIterations,
			colorMode,
			zoom,
			pointSize,
			opacity
		};
	}

	function handleLeftParamsChange(p: TinkerbellParameters) {
		leftA = p.a;
		leftB = p.b;
		leftC = p.c;
		leftD = p.d;
		leftIterations = p.iterations;
	}
	function handleRightParamsChange(p: TinkerbellParameters) {
		rightA = p.a;
		rightB = p.b;
		rightC = p.c;
		rightD = p.d;
		rightIterations = p.iterations;
	}

	const leftControls = [
		{ id: 'left-a', label: 'a', get: () => leftA, set: (v: number) => (leftA = v) },
		{ id: 'left-b', label: 'b', get: () => leftB, set: (v: number) => (leftB = v) },
		{ id: 'left-c', label: 'c', get: () => leftC, set: (v: number) => (leftC = v) },
		{ id: 'left-d', label: 'd', get: () => leftD, set: (v: number) => (leftD = v) }
	];
	const rightControls = [
		{ id: 'right-a', label: 'a', get: () => rightA, set: (v: number) => (rightA = v) },
		{ id: 'right-b', label: 'b', get: () => rightB, set: (v: number) => (rightB = v) },
		{ id: 'right-c', label: 'c', get: () => rightC, set: (v: number) => (rightC = v) },
		{ id: 'right-d', label: 'd', get: () => rightD, set: (v: number) => (rightD = v) }
	];
</script>

<ComparisonLayout
	mapType="tinkerbell"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as TinkerbellParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as TinkerbellParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="grid grid-cols-2 gap-3">
					{#each leftControls as ctrl (ctrl.id)}
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for={ctrl.id}
									class="text-primary/80 text-xs uppercase tracking-widest font-bold"
									>{ctrl.label}</label
								>
								<span class="font-mono text-accent text-sm">{ctrl.get().toFixed(2)}</span>
							</div>
							<input
								id={ctrl.id}
								type="range"
								value={ctrl.get()}
								oninput={(e) => ctrl.set(Number((e.currentTarget as HTMLInputElement).value))}
								min="-3"
								max="3"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					{/each}
					<div class="space-y-1 col-span-2">
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
							min="10000"
							max="250000"
							step="10000"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = x(n)² − y(n)² + a·x(n) + b·y(n)</p>
					<p>y(n+1) = 2·x(n)·y(n) + c·x(n) + d·y(n)</p>{/snippet}
			</ComparisonParameterPanel>
			<TinkerbellRenderer
				bind:a={leftA}
				bind:b={leftB}
				bind:c={leftC}
				bind:d={leftD}
				bind:iterations={leftIterations}
				{colorMode}
				{zoom}
				{pointSize}
				{opacity}
				height={400}
			/>
		</div>
	{/snippet}

	{#snippet rightPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="RIGHT_PARAMETERS">
				<div class="grid grid-cols-2 gap-3">
					{#each rightControls as ctrl (ctrl.id)}
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for={ctrl.id}
									class="text-primary/80 text-xs uppercase tracking-widest font-bold"
									>{ctrl.label}</label
								>
								<span class="font-mono text-accent text-sm">{ctrl.get().toFixed(2)}</span>
							</div>
							<input
								id={ctrl.id}
								type="range"
								value={ctrl.get()}
								oninput={(e) => ctrl.set(Number((e.currentTarget as HTMLInputElement).value))}
								min="-3"
								max="3"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					{/each}
					<div class="space-y-1 col-span-2">
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
							min="10000"
							max="250000"
							step="10000"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = x(n)² − y(n)² + a·x(n) + b·y(n)</p>
					<p>y(n+1) = 2·x(n)·y(n) + c·x(n) + d·y(n)</p>{/snippet}
			</ComparisonParameterPanel>
			<TinkerbellRenderer
				bind:a={rightA}
				bind:b={rightB}
				bind:c={rightC}
				bind:d={rightD}
				bind:iterations={rightIterations}
				{colorMode}
				{zoom}
				{pointSize}
				{opacity}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
