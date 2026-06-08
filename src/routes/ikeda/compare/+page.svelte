<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import IkedaRenderer from '$lib/components/visualizations/IkedaRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges } from '$lib/chaos-validation';
	import type { IkedaParameters, IkedaRenderMode } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'ikeda');
	const defaultParams = getDefaultParameters('ikeda') as IkedaParameters;
	const ranges = getStableRanges('ikeda');

	const clampValue = (value: number, min: number, max: number, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	const clampParams = (params?: IkedaParameters | null): IkedaParameters => {
		const source = params ?? defaultParams;
		if (!ranges) return source;
		return {
			type: 'ikeda',
			u: clampValue(source.u, ranges.u.min, ranges.u.max, defaultParams.u),
			x0: clampValue(source.x0, ranges.x0.min, ranges.x0.max, defaultParams.x0),
			y0: clampValue(source.y0, ranges.y0.min, ranges.y0.max, defaultParams.y0),
			iterations: clampValue(
				source.iterations,
				ranges.iterations.min,
				ranges.iterations.max,
				defaultParams.iterations
			),
			burnIn: clampValue(source.burnIn, ranges.burnIn.min, ranges.burnIn.max, defaultParams.burnIn),
			renderMode: source.renderMode ?? defaultParams.renderMode,
			seeds: source.seeds ?? defaultParams.seeds,
			colorMode: source.colorMode ?? defaultParams.colorMode,
			pointSize: source.pointSize ?? defaultParams.pointSize,
			opacity: source.opacity ?? defaultParams.opacity
		};
	};

	const leftInitial = clampParams(initialState?.left as IkedaParameters | null);
	const rightInitial = clampParams(initialState?.right as IkedaParameters | null);

	let leftU = $state(leftInitial.u);
	let leftX0 = $state(leftInitial.x0);
	let leftY0 = $state(leftInitial.y0);
	let leftIterations = $state(leftInitial.iterations);
	let leftBurnIn = $state(leftInitial.burnIn);
	let leftRenderMode = $state<IkedaRenderMode>(leftInitial.renderMode ?? 'multi');

	let rightU = $state(rightInitial.u);
	let rightX0 = $state(rightInitial.x0);
	let rightY0 = $state(rightInitial.y0);
	let rightIterations = $state(rightInitial.iterations);
	let rightBurnIn = $state(rightInitial.burnIn);
	let rightRenderMode = $state<IkedaRenderMode>(rightInitial.renderMode ?? 'multi');

	const seeds = defaultParams.seeds ?? 250;
	const colorMode = defaultParams.colorMode ?? 'iteration';
	const pointSize = defaultParams.pointSize ?? 1.5;
	const opacity = defaultParams.opacity ?? 0.6;

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftU;
		void leftX0;
		void leftY0;
		void leftIterations;
		void leftBurnIn;
		void leftRenderMode;
		void rightU;
		void rightX0;
		void rightY0;
		void rightIterations;
		void rightBurnIn;
		void rightRenderMode;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: getLeftParams(),
				right: getRightParams()
			};
			goto(`${base}/ikeda/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): IkedaParameters {
		return {
			type: 'ikeda',
			u: leftU,
			x0: leftX0,
			y0: leftY0,
			iterations: leftIterations,
			burnIn: leftBurnIn,
			renderMode: leftRenderMode,
			seeds,
			colorMode,
			pointSize,
			opacity
		};
	}
	function getRightParams(): IkedaParameters {
		return {
			type: 'ikeda',
			u: rightU,
			x0: rightX0,
			y0: rightY0,
			iterations: rightIterations,
			burnIn: rightBurnIn,
			renderMode: rightRenderMode,
			seeds,
			colorMode,
			pointSize,
			opacity
		};
	}

	function handleLeftParamsChange(p: IkedaParameters) {
		leftU = p.u;
		leftX0 = p.x0;
		leftY0 = p.y0;
		leftIterations = p.iterations;
		leftBurnIn = p.burnIn;
		leftRenderMode = p.renderMode ?? leftRenderMode;
	}
	function handleRightParamsChange(p: IkedaParameters) {
		rightU = p.u;
		rightX0 = p.x0;
		rightY0 = p.y0;
		rightIterations = p.iterations;
		rightBurnIn = p.burnIn;
		rightRenderMode = p.renderMode ?? rightRenderMode;
	}
</script>

<ComparisonLayout
	mapType="ikeda"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as IkedaParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as IkedaParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-u"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">u</label
							>
							<span class="font-mono text-accent text-sm">{leftU.toFixed(3)}</span>
						</div>
						<input
							id="left-u"
							type="range"
							bind:value={leftU}
							min="0"
							max="1"
							step="0.001"
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
					<div class="grid grid-cols-2 gap-3">
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
								max="5000"
								step="50"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-burnIn"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">Burn-in</label
								>
								<span class="font-mono text-accent text-sm">{leftBurnIn}</span>
							</div>
							<input
								id="left-burnIn"
								type="range"
								bind:value={leftBurnIn}
								min="0"
								max="1000"
								step="10"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="space-y-1">
						<label
							for="left-renderMode"
							class="text-primary/80 text-xs uppercase tracking-widest font-bold">Render Mode</label
						>
						<select
							id="left-renderMode"
							bind:value={leftRenderMode}
							class="w-full bg-black/40 border border-primary/30 text-primary text-sm rounded-sm px-2 py-1"
						>
							<option value="multi">Multi-Seed</option>
							<option value="single">Single Orbit</option>
						</select>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = 1 + u(x·cos t − y·sin t)</p>
					<p>y(n+1) = u(x·sin t + y·cos t)</p>{/snippet}
			</ComparisonParameterPanel>
			<IkedaRenderer
				bind:u={leftU}
				bind:x0={leftX0}
				bind:y0={leftY0}
				bind:iterations={leftIterations}
				bind:burnIn={leftBurnIn}
				bind:renderMode={leftRenderMode}
				{seeds}
				{colorMode}
				{pointSize}
				{opacity}
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
								for="right-u"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">u</label
							>
							<span class="font-mono text-accent text-sm">{rightU.toFixed(3)}</span>
						</div>
						<input
							id="right-u"
							type="range"
							bind:value={rightU}
							min="0"
							max="1"
							step="0.001"
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
					<div class="grid grid-cols-2 gap-3">
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
								max="5000"
								step="50"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-burnIn"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">Burn-in</label
								>
								<span class="font-mono text-accent text-sm">{rightBurnIn}</span>
							</div>
							<input
								id="right-burnIn"
								type="range"
								bind:value={rightBurnIn}
								min="0"
								max="1000"
								step="10"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="space-y-1">
						<label
							for="right-renderMode"
							class="text-primary/80 text-xs uppercase tracking-widest font-bold">Render Mode</label
						>
						<select
							id="right-renderMode"
							bind:value={rightRenderMode}
							class="w-full bg-black/40 border border-primary/30 text-primary text-sm rounded-sm px-2 py-1"
						>
							<option value="multi">Multi-Seed</option>
							<option value="single">Single Orbit</option>
						</select>
					</div>
				</div>
				{#snippet equations()}<p>x(n+1) = 1 + u(x·cos t − y·sin t)</p>
					<p>y(n+1) = u(x·sin t + y·cos t)</p>{/snippet}
			</ComparisonParameterPanel>
			<IkedaRenderer
				bind:u={rightU}
				bind:x0={rightX0}
				bind:y0={rightY0}
				bind:iterations={rightIterations}
				bind:burnIn={rightBurnIn}
				bind:renderMode={rightRenderMode}
				{seeds}
				{colorMode}
				{pointSize}
				{opacity}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
