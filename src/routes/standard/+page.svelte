<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import type { StandardParameters } from '$lib/types';

	let { data } = $props();

	let container: HTMLDivElement;
	const MAX_POINTS = 20000;
	const DEBOUNCE_MS = 150;
	let renderTimeout: ReturnType<typeof setTimeout> | null = null;
	let worker: Worker | null = null;
	let workerRequestId = 0;
	let latestWorkerRequestId = 0;
	let workerAvailable = false;
	let K = $state(0.971635);
	let numP = $state(10);
	let numQ = $state(10);
	let iterations = $state(20000);
	let isComputing = $state(false);

	// Save dialog state
	let showSaveDialog = $state(false);
	let saveSuccess = $state(false);
	let saveError = $state<string | null>(null);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;

	// Stability warning state
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	// Get current parameters for saving
	function getParameters(): StandardParameters {
		return { K, numP, numQ, iterations };
	}

	// Handle save
	async function handleSave(name: string) {
		// Clear previous error state
		saveError = null;

		try {
			const response = await fetch(`${base}/api/save-config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					mapType: 'standard',
					parameters: getParameters()
				})
			});

			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ error: 'Failed to save configuration' }));
				saveError = errorData.error || 'Failed to save configuration';
				return;
			}

			saveSuccess = true;
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
			}
			saveTimeout = setTimeout(() => {
				saveSuccess = false;
				saveTimeout = null;
			}, 3000);
		} catch (error) {
			saveError =
				'Failed to save configuration: ' +
				(error instanceof Error ? error.message : 'Network error');
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
			}
			saveTimeout = setTimeout(() => {
				saveError = null;
				saveTimeout = null;
			}, 5000);
		}
	}

	function standardMap(
		numP: number,
		numQ: number,
		iterations: number,
		K: number,
		maxPoints: number
	) {
		const points: [number, number][] = [];

		outer: for (let i = 1; i <= numP; i++) {
			for (let j = 1; j <= numQ; j++) {
				let p = (i / numP) % (2 * Math.PI);
				let q = (j / numQ) % (2 * Math.PI);

				for (let k = 0; k < iterations; k++) {
					const pNew = (p + K * Math.sin(q)) % (2 * Math.PI);
					const qNew = (q + pNew) % (2 * Math.PI);

					points.push([qNew, pNew]);

					p = pNew;
					q = qNew;

					if (points.length >= maxPoints) {
						break outer;
					}
				}
			}
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

		const xScale = d3
			.scaleLinear()
			.domain([0, 2 * Math.PI])
			.range([0, width]);

		const yScale = d3
			.scaleLinear()
			.domain([0, 2 * Math.PI])
			.range([height, 0]);

		// Add axes
		const xAxis = d3.axisBottom(xScale).ticks(8).tickSize(-height).tickPadding(10);
		const yAxis = d3.axisLeft(yScale).ticks(8).tickSize(-width).tickPadding(10);

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
			.text('q');

		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -40)
			.attr('fill', '#00f3ff')
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text('p');

		const canvas = canvasSelection.node() as HTMLCanvasElement | null;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;

		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = '#00ffcc';
		ctx.globalAlpha = 0.4;

		for (const [qVal, pVal] of points) {
			const x = xScale(qVal);
			const y = yScale(pVal);
			ctx.beginPath();
			ctx.arc(x, y, 0.8, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.globalAlpha = 1;
	}

	function requestPoints() {
		const payload = {
			type: 'standard' as const,
			id: ++workerRequestId,
			numP,
			numQ,
			iterations,
			K,
			maxPoints: MAX_POINTS
		};

		if (worker && workerAvailable) {
			latestWorkerRequestId = payload.id;
			isComputing = true;
			worker.postMessage(payload);
		} else {
			isComputing = true;
			const points = standardMap(numP, numQ, iterations, K, MAX_POINTS);
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
		// Load config from URL on mount
		const configParam = $page.url.searchParams.get('config');
		if (configParam) {
			try {
				const params = JSON.parse(decodeURIComponent(configParam)) as StandardParameters;
				K = params.K ?? K;
				numP = params.numP ?? numP;
				numQ = params.numQ ?? numQ;
				iterations = params.iterations ?? iterations;

				const stability = checkParameterStability('standard', params);
				if (!stability.isStable) {
					stabilityWarnings = stability.warnings;
					showStabilityWarning = true;
				}
			} catch (e) {
				console.error('Invalid config parameter:', e);
			}
		}

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
					if (!data || data.type !== 'standardResult') return;
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

	onDestroy(() => {
		if (worker) {
			worker.terminate();
			worker = null;
		}
		if (renderTimeout !== null) {
			clearTimeout(renderTimeout);
			renderTimeout = null;
		}
		if (saveTimeout !== null) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
	});

	$effect(() => {
		void K;
		void numP;
		void numQ;
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
				STANDARD_MAP
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_07
			</p>
		</div>
		<div class="flex gap-3">
			<button
				onclick={() => (showSaveDialog = true)}
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
	{#if saveSuccess}
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
	{#if saveError}
		<div
			class="fixed top-20 right-4 z-50 px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-right-5"
		>
			<div class="flex items-center gap-3">
				<span class="text-red-400">✗</span>
				<span class="text-red-200">{saveError}</span>
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

		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> K </label>
					<span class="font-mono text-accent">{K.toFixed(6)}</span>
				</div>
				<input
					type="range"
					bind:value={K}
					disabled={isComputing}
					min="0"
					max="5"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Initial p points
					</label>
					<span class="font-mono text-accent">{numP}</span>
				</div>
				<input
					type="range"
					bind:value={numP}
					disabled={isComputing}
					min="1"
					max="20"
					step="1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Initial q points
					</label>
					<span class="font-mono text-accent">{numQ}</span>
				</div>
				<input
					type="range"
					bind:value={numQ}
					disabled={isComputing}
					min="1"
					max="20"
					step="1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Iterations
					</label>
					<span class="font-mono text-accent">{iterations}</span>
				</div>
				<input
					type="range"
					bind:value={iterations}
					disabled={isComputing}
					min="1000"
					max="50000"
					step="1000"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>p(n+1) = p(n) + K·sin(q(n)) mod 2π</p>
			<p>q(n+1) = q(n) + p(n+1) mod 2π</p>
		</div>

		<div class="text-xs text-accent/80 font-mono border-l-2 border-accent pl-2">
			ALERT: High iteration counts may cause rendering latency.
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
			DATA_LOG: STANDARD_MAP
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The standard map (also called the Chirikov-Taylor map) is an area-preserving chaotic map from
			a square with side 2π onto itself. It was introduced as a simplified model for motion in a
			magnetic field. For low values of K, the map displays regular behavior with stable orbits,
			while larger K values lead to chaotic dynamics.
		</p>
	</div>
</div>

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={showSaveDialog}
	mapType="standard"
	isAuthenticated={!!data.session}
	currentPath={$page.url.pathname}
	onClose={() => (showSaveDialog = false)}
	onSave={handleSave}
/>
