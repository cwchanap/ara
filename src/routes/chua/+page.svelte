<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import ChuaRenderer from '$lib/components/visualizations/ChuaRenderer.svelte';
	import { useDebouncedEffect } from '$lib/use-debounced-effect';
	import { estimateLargestLyapunov, type PoincarePlane } from '$lib/chua';
	import type { ChuaParameters, ChaosMapParameters } from '$lib/types';
	import { VIZ_CONTAINER_HEIGHT, DEBOUNCE_MS } from '$lib/constants';

	let { data } = $props();

	// Math parameters (saved / shared / validated).
	let alpha = $state(15.6);
	let beta = $state(28);
	let gamma = $state(0);
	let a = $state(-8 / 7);
	let b = $state(-5 / 7);

	// Session-only controls (not persisted in ChuaParameters).
	let dt = $state(0.005);
	let trailLength = $state(30000);
	let colorMode = $state<'time' | 'velocity' | 'z-height'>('time');
	let transientRemoval = $state(false);
	let viewMode = $state<'3d' | 'xy' | 'xz' | 'yz' | 'poincare'>('3d');
	let poincarePlane = $state<PoincarePlane>('y=0');

	// Lyapunov readout.
	let lyapunovValue = $state(0);
	let lyapunovClass = $state<'chaotic' | 'marginal' | 'stable'>('marginal');
	let lyapunovDiverged = $state(false);

	// Renderer divergence state.
	let rendererDiverged = $state(false);

	const presets = [
		{ name: 'Classic Double Scroll', alpha: 15.6, beta: 28, gamma: 0, a: -8 / 7, b: -5 / 7 },
		{ name: 'Periodic Orbit', alpha: 15.6, beta: 33, gamma: 0, a: -8 / 7, b: -5 / 7 },
		{ name: 'One-Lobe Spiral', alpha: 8.0, beta: 14.3, gamma: 0, a: -8 / 7, b: -5 / 7 },
		{ name: 'Parameter Sweep', alpha: 15.6, beta: 25, gamma: 0, a: -8 / 7, b: -5 / 7 },
		{ name: 'Experimental / Unstable', alpha: 20, beta: 10, gamma: 0.2, a: -1.2, b: -0.6 }
	] as const;

	function applyPreset(p: (typeof presets)[number]) {
		alpha = p.alpha;
		beta = p.beta;
		gamma = p.gamma;
		a = p.a;
		b = p.b;
	}

	const viewModes: Array<{ id: typeof viewMode; label: string }> = [
		{ id: '3d', label: '3D' },
		{ id: 'xy', label: 'XY' },
		{ id: 'xz', label: 'XZ' },
		{ id: 'yz', label: 'YZ' },
		{ id: 'poincare', label: 'POINCARÉ' }
	];

	// Debounced Lyapunov recompute (capped step count for responsiveness).
	const lyapUpdater = useDebouncedEffect(() => {
		const est = estimateLargestLyapunov({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: Math.min(trailLength, 20000),
			dt,
			alpha,
			beta,
			gamma,
			a,
			b
		});
		lyapunovDiverged = est.diverged;
		lyapunovValue = est.value;
		lyapunovClass = est.classification;
	}, DEBOUNCE_MS);

	$effect(() => {
		void alpha;
		void beta;
		void gamma;
		void a;
		void b;
		void dt;
		void trailLength;
		lyapUpdater.trigger();
		return () => lyapUpdater.cleanup();
	});

	// Only the five math parameters are persisted in ChuaParameters; the
	// session-only controls (dt, trailLength, colorMode, transientRemoval,
	// viewMode, poincarePlane) are page-owned and not restored from a config.
	function buildParameters(): ChuaParameters {
		return { type: 'chua', alpha, beta, gamma, a, b };
	}

	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'chua') return;
		alpha = p.alpha;
		beta = p.beta;
		gamma = p.gamma;
		a = p.a;
		b = p.b;
	}
</script>

<VisualizationShell
	mapType="chua"
	title="CHUA_CIRCUIT"
	moduleNumber="12"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	diverged={rendererDiverged}
	onDismissDiverged={() => (rendererDiverged = false)}
	formula={[
		'dx/dt = α(y − x − f(x))',
		'dy/dt = x − y + z',
		'dz/dt = −(βy + γz)',
		'f(x) = b·x + ½(a − b)(|x+1| − |x−1|)'
	]}
	formulaColumns={3}
	description={{
		heading: 'DATA_LOG: CHUA_CIRCUIT',
		body: 'The Chua circuit is one of the simplest electronic circuits capable of chaos. Its state spirals between two equilibrium lobes, tracing the famous double-scroll attractor. The nonlinear Chua diode — a piecewise-linear resistor with negative slopes — drives the rich bifurcation structure of this 3D system.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet extraControls()}
		<div class="space-y-6">
			<!-- View mode toggle -->
			<div class="flex flex-wrap gap-2">
				{#each viewModes as mode (mode.id)}
					<button
						onclick={() => (viewMode = mode.id)}
						class="px-4 py-1.5 border rounded-sm uppercase tracking-widest text-xs font-bold transition-all {viewMode ===
						mode.id
							? 'bg-primary/20 text-primary border-primary'
							: 'bg-primary/5 text-primary/70 border-primary/30 hover:bg-primary/15'}"
					>
						{mode.label}
					</button>
				{/each}
			</div>

			<!-- Presets -->
			<div class="flex flex-wrap gap-2">
				{#each presets as preset (preset.name)}
					<button
						onclick={() => applyPreset(preset)}
						class="px-3 py-1.5 bg-primary/5 hover:bg-primary/20 text-primary/90 border border-primary/30 rounded-sm transition-all uppercase tracking-wider text-xs font-bold"
					>
						{preset.name}
					</button>
				{/each}
			</div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="alpha" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
							α (alpha)
						</label>
						<span class="font-mono text-accent">{alpha.toFixed(2)}</span>
					</div>
					<input
						id="alpha"
						type="range"
						bind:value={alpha}
						min="0"
						max="25"
						step="0.1"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>

				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="beta" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
							β (beta)
						</label>
						<span class="font-mono text-accent">{beta.toFixed(2)}</span>
					</div>
					<input
						id="beta"
						type="range"
						bind:value={beta}
						min="0"
						max="55"
						step="0.1"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>

				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="gamma" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
							γ (gamma)
						</label>
						<span class="font-mono text-accent">{gamma.toFixed(2)}</span>
					</div>
					<input
						id="gamma"
						type="range"
						bind:value={gamma}
						min="-1"
						max="1"
						step="0.01"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>

				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="a" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
							a (m₀)
						</label>
						<span class="font-mono text-accent">{a.toFixed(3)}</span>
					</div>
					<input
						id="a"
						type="range"
						bind:value={a}
						min="-2"
						max="0"
						step="0.01"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>

				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="b" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
							b (m₁)
						</label>
						<span class="font-mono text-accent">{b.toFixed(3)}</span>
					</div>
					<input
						id="b"
						type="range"
						bind:value={b}
						min="-1.5"
						max="0"
						step="0.01"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>

				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="dt" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
							dt (step)
						</label>
						<span class="font-mono text-accent">{dt.toFixed(4)}</span>
					</div>
					<input
						id="dt"
						type="range"
						bind:value={dt}
						min="0.001"
						max="0.02"
						step="0.001"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>

				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="trail" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
							Trail Length
						</label>
						<span class="font-mono text-accent">{trailLength.toLocaleString()}</span>
					</div>
					<input
						id="trail"
						type="range"
						bind:value={trailLength}
						min="5000"
						max="100000"
						step="1000"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>

				<div class="space-y-2">
					<label
						for="colorMode"
						class="text-primary/80 text-xs uppercase tracking-widest font-bold"
					>
						Color By
					</label>
					<select
						id="colorMode"
						bind:value={colorMode}
						class="w-full bg-black/40 text-primary border border-primary/30 rounded-sm px-2 py-1 text-sm"
					>
						<option value="time">Time</option>
						<option value="velocity">Velocity</option>
						<option value="z-height">Z-Height</option>
					</select>
				</div>

				<div class="space-y-2">
					<label
						class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						for="transient"
					>
						Transient Removal
					</label>
					<label class="flex items-center gap-2 text-sm text-muted-foreground">
						<input
							id="transient"
							type="checkbox"
							bind:checked={transientRemoval}
							class="accent-primary"
						/>
						Discard initial transient
					</label>
				</div>
			</div>

			{#if viewMode === 'poincare'}
				<div class="space-y-2 max-w-xs">
					<label for="plane" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Poincaré Plane
					</label>
					<select
						id="plane"
						bind:value={poincarePlane}
						class="w-full bg-black/40 text-primary border border-primary/30 rounded-sm px-2 py-1 text-sm"
					>
						<option value="x=0">x = 0</option>
						<option value="y=0">y = 0</option>
						<option value="z=0">z = 0</option>
					</select>
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet renderer({ container })}
		<ChuaRenderer
			bind:containerElement={container.el}
			bind:alpha
			bind:beta
			bind:gamma
			bind:a
			bind:b
			{dt}
			{trailLength}
			{viewMode}
			{colorMode}
			{transientRemoval}
			{poincarePlane}
			bind:diverged={rendererDiverged}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}

	{#snippet afterDescription()}
		<!-- Lyapunov readout strip -->
		<div
			class="mt-4 flex items-center gap-6 bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm px-6 py-3 font-mono text-sm"
		>
			<span class="text-primary/80 uppercase tracking-widest text-xs font-bold">Analysis</span>
			{#if lyapunovDiverged}
				<span class="text-fuchsia-400">λₘₐₓ ≈ DIVERGED</span>
				<span class="uppercase tracking-wider text-xs text-fuchsia-400">
					reduce dt or adjust parameters
				</span>
			{:else}
				<span class="text-accent">λₘₐₓ ≈ {lyapunovValue.toFixed(3)}</span>
				<span
					class="uppercase tracking-wider text-xs {lyapunovClass === 'chaotic'
						? 'text-fuchsia-400'
						: lyapunovClass === 'stable'
							? 'text-emerald-400'
							: 'text-yellow-400'}"
				>
					{lyapunovClass}
				</span>
			{/if}
		</div>
	{/snippet}
</VisualizationShell>
