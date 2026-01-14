<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { LyapunovParameters } from '$lib/types';

	let { data } = $props();

	let container: HTMLDivElement;
	const R_MIN_LIMIT = 0;
	const R_MAX_LIMIT = 4;
	const DEFAULT_R_MIN = 2.5;
	const DEFAULT_R_MAX = 4.0;
	const DEFAULT_ITERATIONS = 1000;
	const DEFAULT_TRANSIENT_ITERATIONS = 500;

	let rMin = $state(DEFAULT_R_MIN);
	let rMax = $state(DEFAULT_R_MAX);
	let iterations = $state(DEFAULT_ITERATIONS);
	let transientIterations = $state(DEFAULT_TRANSIENT_ITERATIONS);
	let isRendering = false;

	// Save dialog state
	const saveState = $state(createInitialSaveState());

	// Share dialog state
	const shareState = $state(createInitialShareState());

	// Stability warning state
	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);
	let lastConfigParam: string | null = null;
	let lastAppliedConfigKey: string | null = null;

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

		if (shareCode || configId) {
			configErrors = [];
			showConfigError = false;
			stabilityWarnings = [];
			showStabilityWarning = false;

			void (async () => {
				let result;
				if (shareCode) {
					result = await loadSharedConfigParameters({
						shareCode,
						mapType: 'lyapunov',
						base,
						fetchFn: fetch
					});
				} else {
					result = await loadSavedConfigParameters({
						configId: configId!,
						mapType: 'lyapunov',
						base,
						fetchFn: fetch
					});
				}

				if (!result.ok) {
					configErrors = result.errors;
					showConfigError = true;
					return;
				}

				const typedParams = result.parameters;
				const newRMin = typedParams.rMin;
				const newRMax = typedParams.rMax;
				const newIterations = typedParams.iterations;
				const newTransientIterations = typedParams.transientIterations;

				let nextRMin = DEFAULT_R_MIN;
				let nextRMax = DEFAULT_R_MAX;
				let nextIterations = DEFAULT_ITERATIONS;
				let nextTransientIterations = DEFAULT_TRANSIENT_ITERATIONS;

				nextRMin = Math.max(R_MIN_LIMIT, Math.min(R_MAX_LIMIT, newRMin));
				nextRMax = Math.max(R_MIN_LIMIT, Math.min(R_MAX_LIMIT, newRMax));

				if (nextRMin > nextRMax) {
					const temp = nextRMin;
					nextRMin = nextRMax;
					nextRMax = temp;
				}

				nextIterations = Math.max(100, Math.min(10000, newIterations));
				nextTransientIterations = Math.max(50, Math.min(5000, newTransientIterations));

				const stability = checkParameterStability('lyapunov', {
					type: 'lyapunov',
					rMin: nextRMin,
					rMax: nextRMax,
					iterations: nextIterations,
					transientIterations: nextTransientIterations
				});

				rMin = nextRMin;
				rMax = nextRMax;
				iterations = nextIterations;
				transientIterations = nextTransientIterations;

				if (!stability.isStable) {
					stabilityWarnings = stability.warnings;
					showStabilityWarning = true;
				}
			})();
			return;
		}

		if (!configParam) {
			lastConfigParam = null;
			configErrors = [];
			showConfigError = false;
			stabilityWarnings = [];
			showStabilityWarning = false;
			return;
		}
		if (configParam === lastConfigParam) return;
		lastConfigParam = configParam;

		try {
			configErrors = [];
			showConfigError = false;
			stabilityWarnings = [];
			showStabilityWarning = false;

			// Validate parameters structure before using
			const parsed = parseConfigParam({ mapType: 'lyapunov', configParam });
			if (!parsed.ok) {
				console.error(parsed.logMessage, parsed.logDetails);
				configErrors = parsed.errors;
				showConfigError = true;
				return;
			}

			// Now we can safely cast since validation passed
			const typedParams = parsed.parameters;

			const newRMin = typedParams.rMin;
			const newRMax = typedParams.rMax;
			const newIterations = typedParams.iterations;
			const newTransientIterations = typedParams.transientIterations;

			let nextRMin = DEFAULT_R_MIN;
			let nextRMax = DEFAULT_R_MAX;
			let nextIterations = DEFAULT_ITERATIONS;
			let nextTransientIterations = DEFAULT_TRANSIENT_ITERATIONS;

			// Validate and clamp rMin
			nextRMin = Math.max(R_MIN_LIMIT, Math.min(R_MAX_LIMIT, newRMin));

			// Validate and clamp rMax
			nextRMax = Math.max(R_MIN_LIMIT, Math.min(R_MAX_LIMIT, newRMax));

			// Enforce rMin <= rMax
			if (nextRMin > nextRMax) {
				// Swap values to maintain rMin <= rMax
				const temp = nextRMin;
				nextRMin = nextRMax;
				nextRMax = temp;
			}

			// Validate and clamp iterations (100 - 10000)
			nextIterations = Math.max(100, Math.min(10000, newIterations));

			// Validate and clamp transientIterations (50 - 5000)
			nextTransientIterations = Math.max(50, Math.min(5000, newTransientIterations));

			const stability = checkParameterStability('lyapunov', {
				type: 'lyapunov',
				rMin: nextRMin,
				rMax: nextRMax,
				iterations: nextIterations,
				transientIterations: nextTransientIterations
			});

			rMin = nextRMin;
			rMax = nextRMax;
			iterations = nextIterations;
			transientIterations = nextTransientIterations;

			if (!stability.isStable) {
				stabilityWarnings = stability.warnings;
				showStabilityWarning = true;
			}
		} catch (e) {
			console.error('Invalid config parameter:', e);
			configErrors = ['Failed to parse configuration parameters'];
			showConfigError = true;
		}
	});

	// Get current parameters for saving
	function getParameters(): LyapunovParameters {
		return { type: 'lyapunov', rMin, rMax, iterations, transientIterations };
	}

	// Create save handler with cleanup
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'lyapunov',
		saveState,
		getParameters
	);

	// Create share handler with cleanup
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'lyapunov',
		shareState,
		getParameters
	);

	function calculateLyapunovExponent(
		r: number,
		iterations: number,
		transientIterations: number
	): number {
		let x = 0.5; // Initial condition

		// Transient iterations to settle into attractor
		for (let i = 0; i < transientIterations; i++) {
			x = r * x * (1 - x);
			// Restart if x gets stuck at 0 or 1 (fixed points)
			if (x < 1e-10 || x > 1 - 1e-10) {
				x = 0.5; // Reset to initial condition
			}
		}

		let sum = 0;
		let validIterations = 0;

		// Calculate Lyapunov exponent
		for (let i = 0; i < iterations; i++) {
			x = r * x * (1 - x);
			const derivative = Math.abs(r * (1 - 2 * x));

			// Avoid log(0) which would be -infinity
			// Also skip if x is at a fixed point (0 or 1)
			if (derivative > 0 && x > 1e-10 && x < 1 - 1e-10) {
				sum += Math.log(derivative);
				validIterations++;
			} else if (x < 1e-10 || x > 1 - 1e-10) {
				// Restart if we hit a fixed point
				x = 0.5;
			}
		}

		// Return average, handling case where no valid iterations
		return validIterations > 0 ? sum / validIterations : -Infinity;
	}

	function render() {
		if (!container || isRendering) return;
		isRendering = true;

		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 60, left: 70 };
		const width = container.clientWidth - margin.left - margin.right;
		const height = 500 - margin.top - margin.bottom;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', 500)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Calculate data points
		const numPoints = Math.max(2, Math.min(500, width)); // Ensure at least two points, limit for performance

		// Handle degenerate case when rMin equals rMax
		let actualRMin = rMin;
		let actualRMax = rMax;
		let showRangeWarning = false;

		if (Math.abs(rMax - rMin) < 0.001) {
			// Pad the domain with a small epsilon to prevent NaN values
			// Clamp to valid logistic map range
			const epsilon = 0.01;
			actualRMin = Math.max(R_MIN_LIMIT, rMin - epsilon);
			actualRMax = Math.min(R_MAX_LIMIT, rMax + epsilon);

			// If we're at a boundary, pad asymmetrically
			if (actualRMin === R_MIN_LIMIT && actualRMax === R_MIN_LIMIT) {
				actualRMax = Math.min(R_MAX_LIMIT, R_MIN_LIMIT + epsilon * 2);
			} else if (actualRMax === R_MAX_LIMIT && actualRMin === R_MAX_LIMIT) {
				actualRMin = Math.max(R_MIN_LIMIT, R_MAX_LIMIT - epsilon * 2);
			}

			showRangeWarning = true;
		}

		const data = [];
		for (let i = 0; i < numPoints; i++) {
			const r = actualRMin + (actualRMax - actualRMin) * (i / (numPoints - 1));
			const lyapunov = calculateLyapunovExponent(r, iterations, transientIterations);
			data.push({ r, lyapunov });
		}

		// Scales
		const xScale = d3.scaleLinear().domain([actualRMin, actualRMax]).range([0, width]);
		const yScale = d3
			.scaleLinear()
			.domain(d3.extent(data, (d) => d.lyapunov) as [number, number])
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
			.attr('y', height + 45)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('GROWTH PARAMETER r');

		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -50)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('LYAPUNOV EXPONENT λ');

		// Add zero line (chaos threshold)
		svg
			.append('line')
			.attr('x1', 0)
			.attr('x2', width)
			.attr('y1', yScale(0))
			.attr('y2', yScale(0))
			.attr('stroke', '#ff00ff')
			.attr('stroke-width', 2)
			.attr('stroke-dasharray', '5,5')
			.attr('opacity', 0.5);

		// Create line generator
		const line = d3
			.line<{ r: number; lyapunov: number }>()
			.x((d) => xScale(d.r))
			.y((d) => yScale(d.lyapunov))
			.curve(d3.curveLinear);

		// Create line segments with individual colors based on Lyapunov exponent sign
		const defs = svg.append('defs');

		// Glow effect definition
		const filter = defs.append('filter').attr('id', 'glow');
		filter.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'coloredBlur');
		const feMerge = filter.append('feMerge');
		feMerge.append('feMergeNode').attr('in', 'coloredBlur');
		feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

		// Draw the line as individual segments colored by sign
		for (let i = 0; i < data.length - 1; i++) {
			const segment = data.slice(i, i + 2);
			const color = segment[0].lyapunov < 0 ? '#00f3ff' : '#ff00ff'; // Cyan for negative (stable), Magenta for positive (chaotic)

			svg
				.append('path')
				.datum(segment)
				.attr('fill', 'none')
				.attr('stroke', color)
				.attr('stroke-width', 2)
				.attr('d', line)
				.attr('filter', 'url(#glow)');
		}

		// Add labels for regions
		svg
			.append('text')
			.attr('x', width * 0.25)
			.attr('y', 30)
			.attr('fill', '#00f3ff')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '12px')
			.attr('opacity', 0.7)
			.text('ORDER');

		svg
			.append('text')
			.attr('x', width * 0.75)
			.attr('y', 30)
			.attr('fill', '#ff00ff')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '12px')
			.attr('opacity', 0.7)
			.text('CHAOS');

		// Show warning if range was padded
		if (showRangeWarning) {
			svg
				.append('text')
				.attr('x', width / 2)
				.attr('y', height - 10)
				.attr('fill', '#ffaa00')
				.attr('font-family', 'Rajdhani')
				.attr('font-size', '11px')
				.attr('text-anchor', 'middle')
				.attr('opacity', 0.8)
				.text('⚠ Range padded: rMin ≈ rMax');
		}

		isRendering = false;
	}

	onMount(() => {
		render();

		return () => {
			// Clear save/share handler timeouts to prevent state updates after unmount
			cleanupSaveHandler();
			cleanupShareHandler();
		};
	});

	$effect(() => {
		void rMin;
		void rMax;
		void iterations;
		void transientIterations;
		if (container) render();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				LYAPUNOV_EXPONENTS
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				QUANTIFYING_CHAOS // MODULE_10
			</p>
		</div>
		<div class="flex gap-3">
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

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="r-min" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						r min
					</label>
					<span class="font-mono text-accent">{rMin.toFixed(3)}</span>
				</div>
				<input
					id="r-min"
					type="range"
					bind:value={rMin}
					min={R_MIN_LIMIT}
					max={R_MAX_LIMIT}
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="r-max" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						r max
					</label>
					<span class="font-mono text-accent">{rMax.toFixed(3)}</span>
				</div>
				<input
					id="r-max"
					type="range"
					bind:value={rMax}
					min={R_MIN_LIMIT}
					max={R_MAX_LIMIT}
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
					max="10000"
					step="100"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label
						for="transient"
						class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>
						Transient
					</label>
					<span class="font-mono text-accent">{transientIterations}</span>
				</div>
				<input
					id="transient"
					type="range"
					bind:value={transientIterations}
					min="50"
					max="5000"
					step="50"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>λ = lim(n→∞) (1/n) Σ ln|r(1-2xᵢ)|</p>
		</div>
	</div>

	<div
		bind:this={container}
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative p-4"
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
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: LYAPUNOV_ANALYSIS
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl mb-4">
			The Lyapunov exponent provides the most fundamental quantitative measure of chaos,
			characterizing the average rate at which nearby trajectories diverge in phase space. A
			positive exponent indicates exponential divergence of nearby trajectories and serves as the
			primary diagnostic for chaos.
		</p>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
			<div class="bg-black/20 p-4 rounded border border-white/5">
				<h4 class="text-primary font-['Orbitron'] text-sm mb-2">Lyapunov Time Examples</h4>
				<ul class="text-xs text-muted-foreground space-y-1">
					<li>• Weather systems: ~5 days</li>
					<li>• Chaotic circuits: ~1 ms</li>
					<li>• Solar system: 4-5 million years</li>
				</ul>
			</div>
			<div class="bg-black/20 p-4 rounded border border-white/5">
				<h4 class="text-primary font-['Orbitron'] text-sm mb-2">Kaplan-Yorke Dimension</h4>
				<p class="text-xs text-muted-foreground">
					D<sub>L</sub> = j + (λ₁ + ... + λ<sub>j</sub>) / |λ<sub>j+1</sub>|
				</p>
				<p class="text-xs text-muted-foreground mt-1">
					Relates Lyapunov exponents to fractal dimension
				</p>
			</div>
		</div>
	</div>
</div>

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="lyapunov"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<!-- Share Configuration Dialog -->
<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="lyapunov"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
