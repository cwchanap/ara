<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import ChuaRenderer from '$lib/components/visualizations/ChuaRenderer.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import { useConfigLoader, createInitialConfigLoaderState } from '$lib/use-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import { useDebouncedEffect } from '$lib/use-debounced-effect';
	import { estimateLargestLyapunov, type PoincarePlane } from '$lib/chua';
	import type { ChuaParameters } from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';
	import { VIZ_CONTAINER_HEIGHT, DEBOUNCE_MS } from '$lib/constants';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();

	// Math parameters (saved / shared / validated).
	let alpha = $state(15.6);
	let beta = $state(28);
	let gamma = $state(0);
	let a = $state(-8 / 7);
	let b = $state(-5 / 7);

	// Session-only controls.
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

	const saveState = $state(createInitialSaveState());
	const shareState = $state(createInitialShareState());
	const configState = $state(createInitialConfigLoaderState());

	function getParameters(): ChuaParameters {
		return { type: 'chua', alpha, beta, gamma, a, b };
	}

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
	});

	let comparisonUrl = $state('');
	$effect(() => {
		void alpha;
		void beta;
		void gamma;
		void a;
		void b;
		comparisonUrl = buildComparisonUrl(
			base,
			'chua',
			createComparisonStateFromCurrent('chua', getParameters())
		);
	});

	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'chua',
		saveState,
		getParameters
	);
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'chua',
		shareState,
		getParameters
	);

	$effect(() => {
		const { cleanup } = useConfigLoader(
			{
				page,
				mapType: 'chua',
				base,
				onParametersLoaded: (params) => {
					alpha = params.alpha;
					beta = params.beta;
					gamma = params.gamma;
					a = params.a;
					b = params.b;
					return { type: 'chua', alpha, beta, gamma, a, b };
				},
				onCheckStability: (params) => checkParameterStability('chua', params)
			},
			configState
		);
		return cleanup;
	});

	$effect(() => {
		return () => {
			cleanupSaveHandler();
			cleanupShareHandler();
			lyapUpdater.cleanup();
		};
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				CHUA_CIRCUIT
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_12
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={rendererContainer} targetType="container" mapType="chua" />
			{#if comparisonUrl}
				<a
					href={comparisonUrl}
					class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
				>
					⊞ Compare
				</a>
			{/if}
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
				href={base + '/'}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				← Return
			</a>
		</div>
	</div>

	<VisualizationAlerts
		saveSuccess={saveState.saveSuccess}
		saveError={saveState.saveError}
		configErrors={configState.errors}
		showConfigError={configState.showError}
		onDismissConfigError={() => (configState.showError = false)}
		stabilityWarnings={configState.warnings}
		showStabilityWarning={configState.showWarning}
		onDismissStabilityWarning={() => (configState.showWarning = false)}
		onDismissSaveError={() => (saveState.saveError = null)}
		onDismissSaveSuccess={() => (saveState.saveSuccess = false)}
	/>

	<!-- Control Panel -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative overflow-hidden"
	>
		<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
		<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
		<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

		<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
			<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
			SYSTEM_PARAMETERS
		</h2>

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
				<label for="colorMode" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
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
				<label class="text-primary/80 text-xs uppercase tracking-widest font-bold" for="transient">
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

		<div
			class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>dx/dt = α(y − x − f(x))</p>
			<p>dy/dt = x − y + z</p>
			<p>dz/dt = −(βy + γz)</p>
			<p class="md:col-span-3">f(x) = b·x + ½(a − b)(|x+1| − |x−1|)</p>
		</div>
	</div>

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

	<ChuaRenderer
		bind:containerElement={rendererContainer}
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

	<!-- Lyapunov readout strip -->
	<div
		class="flex items-center gap-6 bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm px-6 py-3 font-mono text-sm"
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

	<!-- Info Panel -->
	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: CHUA_CIRCUIT
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Chua circuit is one of the simplest electronic circuits capable of chaos. Its state
			spirals between two equilibrium lobes, tracing the famous double-scroll attractor. The
			nonlinear Chua diode — a piecewise-linear resistor with negative slopes — drives the rich
			bifurcation structure of this 3D system.
		</p>
	</div>
</div>

<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="chua"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="chua"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
