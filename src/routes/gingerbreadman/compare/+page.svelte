<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import GingerbreadmanRenderer from '$lib/components/visualizations/GingerbreadmanRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges } from '$lib/chaos-validation';
	import {
		GINGERBREADMAN_COLOR_MODES,
		type GingerbreadmanParameters,
		type GingerbreadmanColorMode
	} from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'gingerbreadman');
	const defaultParams = getDefaultParameters('gingerbreadman') as GingerbreadmanParameters;
	const ranges = getStableRanges('gingerbreadman')!;

	const STYLE_ZOOM = { min: 0.5, max: 5 };
	const STYLE_POINT_SIZE = { min: 0.5, max: 6 };
	const STYLE_OPACITY = { min: 0, max: 1 };
	const colorModeSet = new Set<string>(GINGERBREADMAN_COLOR_MODES);

	const clampValue = (value: number, min: number, max: number, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	const clampColorMode = (mode?: GingerbreadmanColorMode | null): GingerbreadmanColorMode => {
		if (mode && colorModeSet.has(mode)) return mode;
		return defaultParams.colorMode ?? 'iteration';
	};

	const clampParams = (params?: GingerbreadmanParameters | null): GingerbreadmanParameters => {
		const source = params ?? defaultParams;
		return {
			type: 'gingerbreadman',
			x0: clampValue(source.x0, ranges.x0.min, ranges.x0.max, defaultParams.x0),
			y0: clampValue(source.y0, ranges.y0.min, ranges.y0.max, defaultParams.y0),
			iterations: Math.floor(
				clampValue(
					source.iterations,
					ranges.iterations.min,
					ranges.iterations.max,
					defaultParams.iterations
				)
			),
			colorMode: clampColorMode(source.colorMode),
			zoom: clampValue(
				source.zoom ?? defaultParams.zoom ?? 1,
				STYLE_ZOOM.min,
				STYLE_ZOOM.max,
				defaultParams.zoom ?? 1
			),
			pointSize: clampValue(
				source.pointSize ?? defaultParams.pointSize ?? 1.5,
				STYLE_POINT_SIZE.min,
				STYLE_POINT_SIZE.max,
				defaultParams.pointSize ?? 1.5
			),
			opacity: clampValue(
				source.opacity ?? defaultParams.opacity ?? 0.6,
				STYLE_OPACITY.min,
				STYLE_OPACITY.max,
				defaultParams.opacity ?? 0.6
			)
		};
	};

	const leftInitial = clampParams(initialState?.left as GingerbreadmanParameters | null);
	const rightInitial = clampParams(initialState?.right as GingerbreadmanParameters | null);

	let leftX0 = $state(leftInitial.x0);
	let leftY0 = $state(leftInitial.y0);
	let leftIterations = $state(leftInitial.iterations);

	let rightX0 = $state(rightInitial.x0);
	let rightY0 = $state(rightInitial.y0);
	let rightIterations = $state(rightInitial.iterations);

	// Shared styling is $state (not const) so external URL changes (back/forward,
	// same-route links) can update both panels. Left payload is source of truth.
	let colorMode = $state<GingerbreadmanColorMode>(
		leftInitial.colorMode ?? defaultParams.colorMode ?? 'iteration'
	);
	let zoom = $state(leftInitial.zoom ?? defaultParams.zoom ?? 1);
	let pointSize = $state(leftInitial.pointSize ?? defaultParams.pointSize ?? 1.5);
	let opacity = $state(leftInitial.opacity ?? defaultParams.opacity ?? 0.6);

	// React to external query-string changes (browser back/forward, same-route
	// links). State reads/writes are untracked so slider edits don't retrigger
	// this effect and snap values back to the URL (same pattern as Arnold Cat).
	$effect(() => {
		const url = $page.url;
		untrack(() => {
			const incoming = decodeComparisonState(url, 'gingerbreadman');
			const L = clampParams(incoming?.left as GingerbreadmanParameters | null);
			const R = clampParams(incoming?.right as GingerbreadmanParameters | null);
			if (L.x0 !== leftX0) leftX0 = L.x0;
			if (L.y0 !== leftY0) leftY0 = L.y0;
			if (L.iterations !== leftIterations) leftIterations = L.iterations;
			if (R.x0 !== rightX0) rightX0 = R.x0;
			if (R.y0 !== rightY0) rightY0 = R.y0;
			if (R.iterations !== rightIterations) rightIterations = R.iterations;
			const nextColor = L.colorMode ?? 'iteration';
			if (nextColor !== colorMode) colorMode = nextColor;
			const nextZoom = L.zoom ?? 1;
			if (nextZoom !== zoom) zoom = nextZoom;
			const nextPointSize = L.pointSize ?? 1.5;
			if (nextPointSize !== pointSize) pointSize = nextPointSize;
			const nextOpacity = L.opacity ?? 0.6;
			if (nextOpacity !== opacity) opacity = nextOpacity;
		});
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftX0;
		void leftY0;
		void leftIterations;
		void rightX0;
		void rightY0;
		void rightIterations;
		void colorMode;
		void zoom;
		void pointSize;
		void opacity;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: getLeftParams(),
				right: getRightParams()
			};
			goto(`${base}/gingerbreadman/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): GingerbreadmanParameters {
		return {
			type: 'gingerbreadman',
			x0: leftX0,
			y0: leftY0,
			iterations: leftIterations,
			colorMode,
			zoom,
			pointSize,
			opacity
		};
	}
	function getRightParams(): GingerbreadmanParameters {
		return {
			type: 'gingerbreadman',
			x0: rightX0,
			y0: rightY0,
			iterations: rightIterations,
			colorMode,
			zoom,
			pointSize,
			opacity
		};
	}

	function handleLeftParamsChange(p: GingerbreadmanParameters) {
		leftX0 = p.x0;
		leftY0 = p.y0;
		leftIterations = p.iterations;
		if (p.colorMode) colorMode = p.colorMode;
		if (p.zoom != null) zoom = p.zoom;
		if (p.pointSize != null) pointSize = p.pointSize;
		if (p.opacity != null) opacity = p.opacity;
	}
	function handleRightParamsChange(p: GingerbreadmanParameters) {
		rightX0 = p.x0;
		rightY0 = p.y0;
		rightIterations = p.iterations;
	}

	const leftControls = [
		{ id: 'left-x0', label: 'x0', get: () => leftX0, set: (v: number) => (leftX0 = v) },
		{ id: 'left-y0', label: 'y0', get: () => leftY0, set: (v: number) => (leftY0 = v) }
	];
	const rightControls = [
		{ id: 'right-x0', label: 'x0', get: () => rightX0, set: (v: number) => (rightX0 = v) },
		{ id: 'right-y0', label: 'y0', get: () => rightY0, set: (v: number) => (rightY0 = v) }
	];
</script>

<ComparisonLayout
	mapType="gingerbreadman"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as GingerbreadmanParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as GingerbreadmanParameters)}
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
								min="-10"
								max="10"
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
							value={leftIterations}
							oninput={(e) =>
								(leftIterations = Number((e.currentTarget as HTMLInputElement).value))}
							min="10000"
							max="250000"
							step="10000"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>x(n+1) = 1 − y(n) + |x(n)|</p>
					<p>y(n+1) = x(n)</p>
				{/snippet}
			</ComparisonParameterPanel>
			<GingerbreadmanRenderer
				bind:x0={leftX0}
				bind:y0={leftY0}
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
								min="-10"
								max="10"
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
							value={rightIterations}
							oninput={(e) =>
								(rightIterations = Number((e.currentTarget as HTMLInputElement).value))}
							min="10000"
							max="250000"
							step="10000"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>x(n+1) = 1 − y(n) + |x(n)|</p>
					<p>y(n+1) = x(n)</p>
				{/snippet}
			</ComparisonParameterPanel>
			<GingerbreadmanRenderer
				bind:x0={rightX0}
				bind:y0={rightY0}
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
