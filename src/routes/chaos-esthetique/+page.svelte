<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import { checkParameterStability, validateParameters } from '$lib/chaos-validation';
	import type { ChaosEsthetiqueParameters } from '$lib/types';

	let { data } = $props();

	let container: HTMLDivElement;
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
	let showSaveDialog = $state(false);
	let saveSuccess = $state(false);

	// Stability warning state
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	// Load config from URL on mount
	$effect(() => {
		const configParam = $page.url.searchParams.get('config');
		if (configParam) {
			try {
				const params = JSON.parse(decodeURIComponent(configParam));

				// Validate parameters structure before using
				const validation = validateParameters('chaos-esthetique', params);
				if (!validation.isValid) {
					console.error('Invalid parameters structure:', validation.errors);
					stabilityWarnings = validation.errors;
					showStabilityWarning = true;
					return;
				}

				// Now we can safely cast since validation passed
				const typedParams = params as ChaosEsthetiqueParameters;
				a = typedParams.a ?? a;
				b = typedParams.b ?? b;
				x0 = typedParams.x0 ?? x0;
				y0 = typedParams.y0 ?? y0;
				iterations = typedParams.iterations ?? iterations;

				const stability = checkParameterStability('chaos-esthetique', typedParams);
				if (!stability.isStable) {
					stabilityWarnings = stability.warnings;
					showStabilityWarning = true;
				}
			} catch (e) {
				console.error('Invalid config parameter:', e);
				stabilityWarnings = ['Failed to parse configuration parameters'];
				showStabilityWarning = true;
			}
		}
	});

	// Get current parameters for saving
	function getParameters(): ChaosEsthetiqueParameters {
		return { type: 'chaos-esthetique', a, b, x0, y0, iterations };
	}

	// Handle save
	async function handleSave(name: string) {
		const response = await fetch(`${base}/api/save-config`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name,
				mapType: 'chaos-esthetique',
				parameters: getParameters()
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ error: 'Failed to save' }));
			throw new Error(errorData.error || 'Failed to save configuration');
		}

		saveSuccess = true;
		setTimeout(() => {
			saveSuccess = false;
		}, 3000);
	}

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

		const xExtent = d3.extent(points, (d) => d[0]) as [number, number];
		const yExtent = d3.extent(points, (d) => d[1]) as [number, number];

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

	onDestroy(() => {
		if (worker) {
			worker.terminate();
			worker = null;
		}
		if (renderTimeout !== null) {
			clearTimeout(renderTimeout);
			renderTimeout = null;
		}
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
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> a </label>
					<span class="font-mono text-accent">{a.toFixed(4)}</span>
				</div>
				<input
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
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> b </label>
					<span class="font-mono text-accent">{b.toFixed(4)}</span>
				</div>
				<input
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
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> x₀ </label>
					<span class="font-mono text-accent">{x0.toFixed(2)}</span>
				</div>
				<input
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
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold"> y₀ </label>
					<span class="font-mono text-accent">{y0.toFixed(2)}</span>
				</div>
				<input
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
	bind:open={showSaveDialog}
	mapType="chaos-esthetique"
	isAuthenticated={!!data.session}
	currentPath={$page.url.pathname}
	onClose={() => (showSaveDialog = false)}
	onSave={handleSave}
/>
