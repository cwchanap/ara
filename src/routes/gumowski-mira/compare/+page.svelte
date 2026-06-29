<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import GumowskiMiraRenderer from '$lib/components/visualizations/GumowskiMiraRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges } from '$lib/chaos-validation';
	import type { GumowskiMiraParameters, GumowskiMiraRenderMode } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'gumowski-mira');
	const defaultParams = getDefaultParameters('gumowski-mira') as GumowskiMiraParameters;
	const ranges = getStableRanges('gumowski-mira')!;

	const clampValue = (value: number, min: number, max: number, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	const clampParams = (params?: GumowskiMiraParameters | null): GumowskiMiraParameters => {
		const source = params ?? defaultParams;
		return {
			type: 'gumowski-mira',
			mu: clampValue(source.mu, ranges.mu.min, ranges.mu.max, defaultParams.mu),
			a: clampValue(source.a, ranges.a.min, ranges.a.max, defaultParams.a),
			b: clampValue(source.b, ranges.b.min, ranges.b.max, defaultParams.b),
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

	const leftInitial = clampParams(initialState?.left as GumowskiMiraParameters | null);
	const rightInitial = clampParams(initialState?.right as GumowskiMiraParameters | null);

	let leftMu = $state(leftInitial.mu);
	let leftA = $state(leftInitial.a);
	let leftB = $state(leftInitial.b);
	let leftX0 = $state(leftInitial.x0);
	let leftY0 = $state(leftInitial.y0);
	let leftIterations = $state(leftInitial.iterations);
	let leftBurnIn = $state(leftInitial.burnIn);
	let leftRenderMode = $state<GumowskiMiraRenderMode>(leftInitial.renderMode ?? 'multi');

	let rightMu = $state(rightInitial.mu);
	let rightA = $state(rightInitial.a);
	let rightB = $state(rightInitial.b);
	let rightX0 = $state(rightInitial.x0);
	let rightY0 = $state(rightInitial.y0);
	let rightIterations = $state(rightInitial.iterations);
	let rightBurnIn = $state(rightInitial.burnIn);
	let rightRenderMode = $state<GumowskiMiraRenderMode>(rightInitial.renderMode ?? 'multi');

	// Styling params are intentionally shared from the left side only.
	const seeds = leftInitial.seeds ?? defaultParams.seeds!;
	const colorMode = leftInitial.colorMode ?? defaultParams.colorMode!;
	const pointSize = leftInitial.pointSize ?? defaultParams.pointSize!;
	const opacity = leftInitial.opacity ?? defaultParams.opacity!;

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftMu;
		void leftA;
		void leftB;
		void leftX0;
		void leftY0;
		void leftIterations;
		void leftBurnIn;
		void leftRenderMode;
		void rightMu;
		void rightA;
		void rightB;
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
			goto(`${base}/gumowski-mira/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): GumowskiMiraParameters {
		return {
			type: 'gumowski-mira',
			mu: leftMu,
			a: leftA,
			b: leftB,
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
	function getRightParams(): GumowskiMiraParameters {
		return {
			type: 'gumowski-mira',
			mu: rightMu,
			a: rightA,
			b: rightB,
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

	function handleLeftParamsChange(p: GumowskiMiraParameters) {
		leftMu = p.mu;
		leftA = p.a;
		leftB = p.b;
		leftX0 = p.x0;
		leftY0 = p.y0;
		leftIterations = p.iterations;
		leftBurnIn = p.burnIn;
		leftRenderMode = p.renderMode ?? leftRenderMode;
	}
	function handleRightParamsChange(p: GumowskiMiraParameters) {
		rightMu = p.mu;
		rightA = p.a;
		rightB = p.b;
		rightX0 = p.x0;
		rightY0 = p.y0;
		rightIterations = p.iterations;
		rightBurnIn = p.burnIn;
		rightRenderMode = p.renderMode ?? rightRenderMode;
	}
</script>

<ComparisonLayout
	mapType="gumowski-mira"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as GumowskiMiraParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as GumowskiMiraParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-mu"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">mu</label
							>
							<span class="font-mono text-accent text-sm">{leftMu.toFixed(3)}</span>
						</div>
						<input
							id="left-mu"
							type="range"
							bind:value={leftMu}
							min="-1"
							max="1"
							step="0.001"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-a"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">a</label
								>
								<span class="font-mono text-accent text-sm">{leftA.toFixed(4)}</span>
							</div>
							<input
								id="left-a"
								type="range"
								bind:value={leftA}
								min="0"
								max="1"
								step="0.0001"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-b"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">b</label
								>
								<span class="font-mono text-accent text-sm">{leftB.toFixed(4)}</span>
							</div>
							<input
								id="left-b"
								type="range"
								bind:value={leftB}
								min="0"
								max="0.5"
								step="0.001"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div
						class="grid grid-cols-2 gap-3"
						class:opacity-40={leftRenderMode === 'multi'}
						class:pointer-events-none={leftRenderMode === 'multi'}
					>
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
								disabled={leftRenderMode === 'multi'}
								min="-20"
								max="20"
								step="0.1"
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
								disabled={leftRenderMode === 'multi'}
								min="-20"
								max="20"
								step="0.1"
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
								max="100000"
								step="500"
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
								max="5000"
								step="50"
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
				{#snippet equations()}
					<p>g(x) = μ·x + 2(1−μ)·x² / (1 + x²)</p>
					<p>x' = y + a(1−by²)y + g(x)</p>
					<p>y' = −x + g(x')</p>
				{/snippet}
			</ComparisonParameterPanel>
			<GumowskiMiraRenderer
				bind:mu={leftMu}
				bind:a={leftA}
				bind:b={leftB}
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
								for="right-mu"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">mu</label
							>
							<span class="font-mono text-accent text-sm">{rightMu.toFixed(3)}</span>
						</div>
						<input
							id="right-mu"
							type="range"
							bind:value={rightMu}
							min="-1"
							max="1"
							step="0.001"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-a"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">a</label
								>
								<span class="font-mono text-accent text-sm">{rightA.toFixed(4)}</span>
							</div>
							<input
								id="right-a"
								type="range"
								bind:value={rightA}
								min="0"
								max="1"
								step="0.0001"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-b"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">b</label
								>
								<span class="font-mono text-accent text-sm">{rightB.toFixed(4)}</span>
							</div>
							<input
								id="right-b"
								type="range"
								bind:value={rightB}
								min="0"
								max="0.5"
								step="0.001"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div
						class="grid grid-cols-2 gap-3"
						class:opacity-40={rightRenderMode === 'multi'}
						class:pointer-events-none={rightRenderMode === 'multi'}
					>
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
								disabled={rightRenderMode === 'multi'}
								min="-20"
								max="20"
								step="0.1"
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
								disabled={rightRenderMode === 'multi'}
								min="-20"
								max="20"
								step="0.1"
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
								max="100000"
								step="500"
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
								max="5000"
								step="50"
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
				{#snippet equations()}
					<p>g(x) = μ·x + 2(1−μ)·x² / (1 + x²)</p>
					<p>x' = y + a(1−by²)y + g(x)</p>
					<p>y' = −x + g(x')</p>
				{/snippet}
			</ComparisonParameterPanel>
			<GumowskiMiraRenderer
				bind:mu={rightMu}
				bind:a={rightA}
				bind:b={rightB}
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
