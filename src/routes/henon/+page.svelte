<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
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
	import type { HenonParameters } from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';

	let { data } = $props();

	let container: HTMLDivElement | undefined = $state();
	let a = $state(1.4);
	let b = $state(0.3);
	let iterations = $state(2000);
	let lastAppliedConfigKey = $state<string | null>(null);
	let configLoadAbortController: AbortController | null = null;
	let isUnmounted = false;

	// Save dialog state
	const saveState = $state(createInitialSaveState());

	// Share dialog state
	const shareState = $state(createInitialShareState());

	// Stability warning state
	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	// Load config from URL reactively
	$effect(() => {
		const configId = get(page).url.searchParams.get('configId');
		const shareCode = get(page).url.searchParams.get('share');
		const configParam = get(page).url.searchParams.get('config');
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

				let result;
				try {
					if (shareCode) {
						result = await loadSharedConfigParameters({
							shareCode,
							mapType: 'henon',
							base,
							fetchFn: fetchWithSignal
						});
					} else {
						result = await loadSavedConfigParameters({
							configId: configId!,
							mapType: 'henon',
							base,
							fetchFn: fetchWithSignal
						});
					}
				} catch (e) {
					// Check if this was an abort error (expected during cleanup)
					if (e instanceof Error && e.name === 'AbortError') {
						return; // Silently ignore abort errors
					}
					console.error('Failed to load configuration:', e);
					if (isUnmounted || signal.aborted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;
					configErrors = [
						'Failed to load configuration: ' + (e instanceof Error ? e.message : 'Unknown error')
					];
					showConfigError = true;
					return;
				}

				if (isUnmounted || signal.aborted) return;
				if (lastAppliedConfigKey !== currentConfigKey) return;
				if (!result.ok) {
					configErrors = result.errors;
					showConfigError = true;
					return;
				}

				const typedParams = result.parameters;
				a = typedParams.a ?? a;
				b = typedParams.b ?? b;
				iterations = typedParams.iterations ?? iterations;

				const stability = checkParameterStability('henon', typedParams);
				if (!stability.isStable) {
					stabilityWarnings = stability.warnings;
					showStabilityWarning = true;
				}
			})();
		} else if (configParam) {
			try {
				configErrors = [];
				showConfigError = false;
				stabilityWarnings = [];
				showStabilityWarning = false;

				// Validate parameters structure before using
				const parsed = parseConfigParam({ mapType: 'henon', configParam });
				if (!parsed.ok) {
					console.error(parsed.logMessage, parsed.logDetails);
					configErrors = parsed.errors;
					showConfigError = true;
					return;
				}

				// Now we can safely cast since validation passed
				const typedParams = parsed.parameters;
				a = typedParams.a ?? a;
				b = typedParams.b ?? b;
				iterations = typedParams.iterations ?? iterations;

				const stability = checkParameterStability('henon', typedParams);
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
	function getParameters(): HenonParameters {
		return { type: 'henon', a, b, iterations };
	}

	// Create save handler with cleanup
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'henon',
		saveState,
		getParameters
	);

	// Create share handler with cleanup
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'henon',
		shareState,
		getParameters
	);

	function calculateHenon(a: number, b: number, iterations: number) {
		const points: [number, number][] = [];
		let x = 0;
		let y = 0;

		for (let i = 0; i < iterations; i++) {
			const xNew = y + 1 - a * x * x;
			const yNew = b * x;
			points.push([xNew, yNew]);
			x = xNew;
			y = yNew;
		}

		return points;
	}

	function render() {
		if (!container) return;

		// Clear previous content
		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = container.clientWidth - margin.left - margin.right;
		const height = 600 - margin.top - margin.bottom;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', 600)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const points = calculateHenon(a, b, iterations);

		const xExtent = d3.extent(points, (d) => d[0]) as [number, number];
		const yExtent = d3.extent(points, (d) => d[1]) as [number, number];

		const xScale = d3
			.scaleLinear()
			.domain([xExtent[0] - 0.1, xExtent[1] + 0.1])
			.range([0, width]);

		const yScale = d3
			.scaleLinear()
			.domain([yExtent[0] - 0.1, yExtent[1] + 0.1])
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
			.text('X_AXIS');

		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -40)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('Y_AXIS');

		// Plot points
		svg
			.selectAll('circle')
			.data(points)
			.enter()
			.append('circle')
			.attr('cx', (d) => xScale(d[0]))
			.attr('cy', (d) => yScale(d[1]))
			.attr('r', 2)
			.attr('fill', (d, i) => {
				// Cyan to Magenta gradient based on iteration
				const t = i / points.length;
				return d3.interpolate('#00f3ff', '#bc13fe')(t);
			})
			.attr('opacity', 0.8)
			.attr('filter', 'drop-shadow(0 0 2px rgba(0, 243, 255, 0.5))');
	}

	onMount(() => {
		render();

		return () => {
			// Clear save/share handler timeouts to prevent state updates after unmount
			cleanupSaveHandler();
			cleanupShareHandler();
			// Abort any pending config load requests
			configLoadAbortController?.abort();
			configLoadAbortController = null;
			isUnmounted = true;
		};
	});

	$effect(() => {
		void a;
		void b;
		void iterations;
		if (container) render();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				HÉNON_MAP
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_02
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={container} targetType="container" mapType="henon" />
			<a
				href={buildComparisonUrl(
					base,
					'henon',
					createComparisonStateFromCurrent('henon', getParameters())
				)}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				⊞ Compare
			</a>
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
				<span class="text-red-400">✗</span>
				<span class="text-red-200">{saveState.saveError}</span>
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

		<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="a" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						a
					</label>
					<span class="font-mono text-accent">{a.toFixed(3)}</span>
				</div>
				<input
					id="a"
					type="range"
					bind:value={a}
					min="0.5"
					max="1.5"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="b" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						b
					</label>
					<span class="font-mono text-accent">{b.toFixed(3)}</span>
				</div>
				<input
					id="b"
					type="range"
					bind:value={b}
					min="0"
					max="1"
					step="0.01"
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
					min="100"
					max="5000"
					step="100"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>x(n+1) = y(n) + 1 - a·x(n)²</p>
			<p>y(n+1) = b·x(n)</p>
		</div>
	</div>

	<div
		bind:this={container}
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
		style="height: 600px;"
	>
		<div
			class="absolute top-4 right-4 text-xs font-mono text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
		>
			LIVE_RENDER // D3.JS
		</div>
	</div>

	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">DATA_LOG: HÉNON_MAP</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Hénon map is a discrete-time dynamical system introduced by Michel Hénon as a simplified
			model of the Poincaré section of the Lorenz model. For certain parameter values, the map
			exhibits chaotic behavior and produces a strange attractor.
		</p>
	</div>
</div>

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="henon"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<!-- Share Configuration Dialog -->
<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="henon"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
