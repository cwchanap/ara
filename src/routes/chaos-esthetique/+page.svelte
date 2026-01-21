<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { ChaosEsthetiqueParameters } from '$lib/types';

	let { data } = $props();

	let container: HTMLDivElement | undefined = $state();
	const MAX_POINTS = 15000;
	const DEBOUNCE_MS = 250;
	let renderTimeout: ReturnType<typeof setTimeout> | null = null;
	let worker: Worker | null = null;
	let workerRequestId = 0;
	let latestWorkerRequestId = 0;
	let workerAvailable = false;
	let a = $state(0.9);
	let b = $state(0.9999);
	let x0 = $state(18);
	let y0 = $state(0);
	let iterations = $state(10000);
	let isComputing = $state(false);

	// Save dialog state
	const saveState = $state(createInitialSaveState());

	// Share dialog state
	const shareState = $state(createInitialShareState());

	// Stability warning state
	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);
	let lastAppliedConfigKey = $state<string | null>(null);
	let configLoadAbortController: AbortController | null = null;
	let isUnmounted = false;

	// Load config from URL on mount
	$effect(() => {
		const configId = $page.url.searchParams.get('configId');
		const shareCode = $page.url.searchParams.get('share');
		const configParam = $page.url.searchParams.get('config');
		const configKey = shareCode
			? `share:${shareCode}`
			: configId
				? `id:${configId}`
				: configParam
					? `param:${configParam}`
					: null;
		if (configKey === lastAppliedConfigKey) return;
		lastAppliedConfigKey = configKey;

		configLoadAbortController?.abort();
		configLoadAbortController = null;

		if (shareCode || configId) {
			configErrors = [];
			showConfigError = false;
			stabilityWarnings = [];
			showStabilityWarning = false;
			const controller = new AbortController();
			configLoadAbortController = controller;
			const { signal } = controller;
			const currentConfigKey = configKey;

			void (async () => {
				const fetchWithSignal: typeof fetch = Object.assign(
					(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
						fetch(input, { ...init, signal }),
					{ preconnect: fetch.preconnect }
				);

				try {
					let result;
					if (shareCode) {
						result = await loadSharedConfigParameters({
							shareCode,
							mapType: 'chaos-esthetique',
							base,
							fetchFn: fetchWithSignal
						});
					} else {
						result = await loadSavedConfigParameters({
							configId: configId!,
							mapType: 'chaos-esthetique',
							base,
							fetchFn: fetchWithSignal
						});
					}

					if (isUnmounted || signal.aborted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;
					if (!result.ok) {
						configErrors = result.errors;
						showConfigError = true;
						return;
					}

					const typedParams = result.parameters;
					if (typeof typedParams.a === 'number') a = typedParams.a;
					if (typeof typedParams.b === 'number') b = typedParams.b;
					if (typeof typedParams.x0 === 'number') x0 = typedParams.x0;
					if (typeof typedParams.y0 === 'number') y0 = typedParams.y0;
					if (typeof typedParams.iterations === 'number') iterations = typedParams.iterations;

					const stability = checkParameterStability('chaos-esthetique', typedParams);
					if (!stability.isStable) {
						stabilityWarnings = stability.warnings;
						showStabilityWarning = true;
					}
				} catch (err) {
					if (
						isUnmounted ||
						signal.aborted ||
						(err instanceof DOMException && err.name === 'AbortError') ||
						(err instanceof Error && err.name === 'AbortError')
					) {
						return;
					}
					configErrors = ['Failed to load configuration parameters'];
					showConfigError = true;
				} finally {
					if (configLoadAbortController === controller) {
						configLoadAbortController = null;
					}
				}
			})();
		} else if (configParam) {
			try {
				configErrors = [];
				showConfigError = false;
				stabilityWarnings = [];
				showStabilityWarning = false;

				// Validate parameters structure before using
				const parsed = parseConfigParam({ mapType: 'chaos-esthetique', configParam });
				if (!parsed.ok) {
					console.error(parsed.logMessage, parsed.logDetails);
					configErrors = parsed.errors;
					showConfigError = true;
					return;
				}

				// Now we can safely cast since validation passed
				const typedParams = parsed.parameters;
				if (typeof typedParams.a === 'number') a = typedParams.a;
				if (typeof typedParams.b === 'number') b = typedParams.b;
				if (typeof typedParams.x0 === 'number') x0 = typedParams.x0;
				if (typeof typedParams.y0 === 'number') y0 = typedParams.y0;
				if (typeof typedParams.iterations === 'number') iterations = typedParams.iterations;

				const stability = checkParameterStability('chaos-esthetique', typedParams);
				if (!stability.isStable) {
					stabilityWarnings = stability.warnings;
					showStabilityWarning = true;
				}
			} catch (e) {
				console.error('Invalid config parameter:', e);
				configErrors = ['Failed to parse configuration parameters'];
				showConfigError = true;
			}
		}
	});

	// Get current parameters for saving
	function getParameters(): ChaosEsthetiqueParameters {
		return { type: 'chaos-esthetique', a, b, x0, y0, iterations };
	}

	// Create save handler with cleanup
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'chaos-esthetique',
		saveState,
		getParameters
	);

	// Create share handler with cleanup
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'chaos-esthetique',
		shareState,
		getParameters
	);

	function f(x: number, a: number): number {
		return a * x + (2 * (1 - a) * x * x) / (1 + x * x);
	}

	function calculateChaos(
		a: number,
		b: number,
		x0: number,
		y0: number,
		iterations: number,
		maxPoints: number
	) {
		const points: [number, number][] = [];
		let x = x0;
		let y = y0;

		const steps = Math.min(iterations, maxPoints);
		for (let i = 0; i < steps; i++) {
			const xNew = y + f(x, a);
			const yNew = -b * x + f(xNew, a);

			points.push([xNew, yNew]);

			x = xNew;
			y = yNew;
		}

		return points;
	}

	function render(points: [number, number][]) {
		if (!container) return;

		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = container.clientWidth - margin.left - margin.right;
		const height = 600 - margin.top - margin.bottom;

		const canvasSelection = d3
			.select(container)
			.append('canvas')
			.attr('width', width)
			.attr('height', height)
			.style('position', 'absolute')
			.style('top', `${margin.top}px`)
			.style('left', `${margin.left}px`);

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', 600)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const xExtentRaw = d3.extent(points, (d) => d[0]);
		const yExtentRaw = d3.extent(points, (d) => d[1]);
		const xExtent: [number, number] = [xExtentRaw[0] ?? -1, xExtentRaw[1] ?? 1];
		const yExtent: [number, number] = [yExtentRaw[0] ?? -1, yExtentRaw[1] ?? 1];

		const xScale = d3
			.scaleLinear()
			.domain([xExtent[0] - 1, xExtent[1] + 1])
			.range([0, width]);

		const yScale = d3
			.scaleLinear()
			.domain([yExtent[0] - 1, yExtent[1] + 1])
			.range([height, 0]);

		// Add axes
		const xAxis = d3.axisBottom(xScale).tickSize(-height).tickPadding(10);
		const yAxis = d3.axisLeft(yScale).tickSize(-width).tickPadding(10);

		svg
			.append('g')
			.attr('class', 'grid-lines')
			.attr('transform', `translate(0,${height})`)
			.call(xAxis)
			.call((g) => {
				g.select('.domain').remove();
				g.selectAll('line').attr('stroke', '#00f3ff').attr('stroke-opacity', 0.1);
				g.selectAll('text')
					.attr('fill', '#00f3ff')
					.attr('font-family', 'Rajdhani')
					.attr('font-size', '12px');
			});

		svg
			.append('g')
			.attr('class', 'grid-lines')
			.call(yAxis)
			.call((g) => {
				g.select('.domain').remove();
				g.selectAll('line').attr('stroke', '#00f3ff').attr('stroke-opacity', 0.1);
				g.selectAll('text')
					.attr('fill', '#00f3ff')
					.attr('font-family', 'Rajdhani')
					.attr('font-size', '12px');
			});

		// Add axis labels
		svg
			.append('text')
			.attr('x', width / 2)
			.attr('y', height + 40)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('X');

		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -40)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('Y');

		const canvas = canvasSelection.node() as HTMLCanvasElement | null;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;

		ctx.clearRect(0, 0, width, height);
		ctx.globalAlpha = 0.6;
		ctx.shadowBlur = 4;
		ctx.shadowColor = 'rgba(255, 0, 255, 0.5)';

		for (let i = 0; i < points.length; i++) {
			const [xVal, yVal] = points[i];
			const x = xScale(xVal);
			const y = yScale(yVal);
			const t = i / points.length;
			const color = d3.interpolate('#ff00ff', '#8a2be2')(t);
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(x, y, 1.5, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.globalAlpha = 1;
		ctx.shadowBlur = 0;
	}

	function requestPoints() {
		const payload = {
			type: 'chaos' as const,
			id: ++workerRequestId,
			a,
			b,
			x0,
			y0,
			iterations,
			maxPoints: MAX_POINTS
		};

		if (worker && workerAvailable) {
			latestWorkerRequestId = payload.id;
			isComputing = true;
			worker.postMessage(payload);
		} else {
			isComputing = true;
			const points = calculateChaos(a, b, x0, y0, iterations, MAX_POINTS);
			render(points);
			isComputing = false;
		}
	}

	function scheduleRender() {
		if (!container || isComputing) return;
		if (renderTimeout !== null) {
			clearTimeout(renderTimeout);
		}
		renderTimeout = setTimeout(() => {
			renderTimeout = null;
			requestPoints();
		}, DEBOUNCE_MS);
	}

	onMount(() => {
		if (typeof window !== 'undefined' && 'Worker' in window) {
			try {
				worker = new Worker(new URL('../../lib/workers/chaosMapsWorker.ts', import.meta.url), {
					type: 'module'
				});
				workerAvailable = true;
				worker.onmessage = (event: MessageEvent) => {
					const data = event.data as {
						type: string;
						id: number;
						points: [number, number][];
					};
					if (!data || data.type !== 'chaosResult') return;
					if (data.id !== latestWorkerRequestId) return;
					isComputing = false;
					render(data.points);
				};
			} catch {
				worker = null;
				workerAvailable = false;
			}
		}

		scheduleRender();
	});

	onMount(() => {
		return () => {
			isUnmounted = true;
			configLoadAbortController?.abort();
			configLoadAbortController = null;
			if (worker) {
				worker.terminate();
				worker = null;
			}
			if (renderTimeout !== null) {
				clearTimeout(renderTimeout);
				renderTimeout = null;
			}
			// Clear save/share handler timeouts to prevent state updates after unmount
			cleanupSaveHandler();
			cleanupShareHandler();
		};
	});

	$effect(() => {
		void a;
		void b;
		void x0;
		void y0;
		void iterations;
		scheduleRender();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				CHAOS_ESTHETIQUE
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_08
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={container} targetType="container" mapType="chaos-esthetique" />
			<button
				onclick={() => (shareState.showShareDialog = true)}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				🔗 Share
			</button>
			<button
				onclick={() => (saveState.showSaveDialog = true)}
				class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				💾 Save
			</button>
			<a
				href="{base}/"
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				← Return
			</a>
		</div>
	</div>

	<!-- Save Success Toast -->
	{#if saveState.saveSuccess}
		<div
			class="fixed top-20 right-4 z-50 px-6 py-4 bg-green-500/10 border border-green-500/30 rounded-lg backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-right-5"
		>
			<div class="flex items-center gap-3">
				<span class="text-green-400">✓</span>
				<span class="text-green-200">Configuration saved successfully!</span>
			</div>
		</div>
	{/if}

	<!-- Save Error Toast -->
	{#if saveState.saveError}
		<div
			class="fixed top-20 right-4 z-50 px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-right-5"
		>
			<div class="flex items-center gap-3">
				<span class="text-red-400">✕</span>
				<span class="text-red-200">{saveState.saveError}</span>
				<button
					onclick={() => (saveState.saveError = null)}
					class="ml-2 text-red-400/60 hover:text-red-400 transition-colors"
					aria-label="Close error message"
				>
					×
				</button>
			</div>
		</div>
	{/if}

	{#if showConfigError && configErrors.length > 0}
		<div class="bg-red-500/10 border border-red-500/30 rounded-sm p-4 relative">
			<div class="flex items-start gap-3">
				<span class="text-red-400 text-xl">✕</span>
				<div class="flex-1">
					<h3 class="font-['Orbitron'] text-red-400 font-semibold mb-1">INVALID_CONFIGURATION</h3>
					<p class="text-red-200/80 text-sm mb-2">
						The loaded configuration could not be applied due to validation errors:
					</p>
					<ul class="text-xs text-red-200/60 list-disc list-inside space-y-1">
						{#each configErrors as err, i (i)}
							<li>{err}</li>
						{/each}
					</ul>
				</div>
				<button
					onclick={() => (showConfigError = false)}
					class="text-red-400/60 hover:text-red-400"
				>
					✕
				</button>
			</div>
		</div>
	{/if}

	<!-- Stability Warning -->
	{#if showStabilityWarning && stabilityWarnings.length > 0}
		<div class="bg-amber-500/10 border border-amber-500/30 rounded-sm p-4 relative">
			<div class="flex items-start gap-3">
				<span class="text-amber-400 text-xl">⚠️</span>
				<div class="flex-1">
					<h3 class="font-['Orbitron'] text-amber-400 font-semibold mb-1">
						UNSTABLE_PARAMETERS_DETECTED
					</h3>
					<p class="text-amber-200/80 text-sm mb-2">
						The loaded configuration contains parameters outside recommended stable ranges:
					</p>
					<ul class="text-xs text-amber-200/60 list-disc list-inside space-y-1">
						{#each stabilityWarnings as warning, i (i)}
							<li>{warning}</li>
						{/each}
					</ul>
				</div>
				<button
					onclick={() => (showStabilityWarning = false)}
					class="text-amber-400/60 hover:text-amber-400"
				>
					✕
				</button>
			</div>
		</div>
	{/if}

	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative overflow-hidden group"
	>
		<!-- Decor corners -->
		<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
		<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
		<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

		<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
			<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
			SYSTEM_PARAMETERS
		</h2>

		<div class="grid grid-cols-1 md:grid-cols-5 gap-4">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="a" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						a
					</label>
					<span class="font-mono text-accent">{a.toFixed(4)}</span>
				</div>
				<input
					id="a"
					type="range"
					bind:value={a}
					disabled={isComputing}
					min="0"
					max="2"
					step="0.0001"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="b" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						b
					</label>
					<span class="font-mono text-accent">{b.toFixed(4)}</span>
				</div>
				<input
					id="b"
					type="range"
					bind:value={b}
					disabled={isComputing}
					min="0"
					max="1.5"
					step="0.0001"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="x0" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						x₀
					</label>
					<span class="font-mono text-accent">{x0.toFixed(2)}</span>
				</div>
				<input
					id="x0"
					type="range"
					bind:value={x0}
					disabled={isComputing}
					min="-20"
					max="20"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="y0" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						y₀
					</label>
					<span class="font-mono text-accent">{y0.toFixed(2)}</span>
				</div>
				<input
					id="y0"
					type="range"
					bind:value={y0}
					disabled={isComputing}
					min="-20"
					max="20"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label
						for="iterations"
						class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>
						Iterations
					</label>
					<span class="font-mono text-accent">{iterations}</span>
				</div>
				<input
					id="iterations"
					type="range"
					bind:value={iterations}
					disabled={isComputing}
					min="1000"
					max="20000"
					step="1000"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>x(n+1) = y(n) + a·x(n) + 2(1-a)·x(n)² / (1+x(n)²)</p>
			<p>y(n+1) = -b·x(n) + f(x(n+1))</p>
		</div>
	</div>

	<div
		bind:this={container}
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative h-[600px]"
	>
		<div
			class={`absolute top-4 right-4 text-xs font-mono px-2 py-1 pointer-events-none select-none bg-black/60 backdrop-blur-sm border ${
				isComputing ? 'text-accent border-accent' : 'text-primary/60 border-primary/40'
			}`}
		>
			LIVE_RENDER // D3.JS
			<span class="ml-2 text-[0.65rem] tracking-widest uppercase">
				COMPUTE: {isComputing ? 'BUSY' : 'IDLE'}
			</span>
		</div>
	</div>

	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: CHAOS_ESTHETIQUE
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			This is a custom aesthetic chaos system that generates beautiful patterns through iterative
			transformations. The function f(x) creates a nonlinear mapping, and the coupled equations
			produce intricate attractors. The system is highly sensitive to parameters a and b, displaying
			a wide variety of behaviors from stable orbits to chaotic attractors.
		</p>
	</div>
</div>

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="chaos-esthetique"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<!-- Share Configuration Dialog -->
<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="chaos-esthetique"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
