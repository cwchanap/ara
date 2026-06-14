<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import DoublePendulumRenderer from '$lib/components/visualizations/DoublePendulumRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { DoublePendulumParameters } from '$lib/types';
	import { randomizeInitialConditions } from '$lib/double-pendulum';
	import {
		DOUBLE_PENDULUM_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_DOUBLE_PENDULUM_PRESET_ID,
		type DoublePendulumState
	} from '$lib/double-pendulum-presets';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();

	const defaultPreset = getPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default preset: ${DEFAULT_DOUBLE_PENDULUM_PRESET_ID}`);
	const d = defaultPreset.state;

	let theta1 = $state(d.theta1);
	let theta2 = $state(d.theta2);
	let omega1 = $state(d.omega1);
	let omega2 = $state(d.omega2);
	let l1 = $state(d.l1);
	let l2 = $state(d.l2);
	let m1 = $state(d.m1);
	let m2 = $state(d.m2);
	let gravity = $state(d.gravity);
	let damping = $state(d.damping);
	let speed = $state(d.speed);
	let showTrail = $state(d.showTrail);
	let trailLength = $state(d.trailLength);
	let compareMode = $state(d.compareMode);
	let compareOffset = $state(d.compareOffset);

	let running = $state(true);
	let restartSignal = $state(0);
	let divergenceValue = $state(0);
	let diverged = $state(false);
	let showAdvanced = $state(false);

	let lastAppliedConfigKey: string | null = null;
	let configLoadAbortController: AbortController | null = null;
	let isUnmounted = false;

	const saveState = $state(createInitialSaveState());
	const shareState = $state(createInitialShareState());

	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	function currentPresetState(): DoublePendulumState {
		return {
			theta1,
			theta2,
			omega1,
			omega2,
			l1,
			l2,
			m1,
			m2,
			gravity,
			damping,
			speed,
			showTrail,
			trailLength,
			compareMode,
			compareOffset
		};
	}

	const activePresetId = $derived(detectPresetId(currentPresetState()));
	const activePresetLabel = $derived(
		activePresetId ? (getPreset(activePresetId)?.label ?? 'CUSTOM') : 'CUSTOM'
	);

	function applyPreset(id: string) {
		const preset = getPreset(id);
		if (!preset) return;
		const s = preset.state;
		theta1 = s.theta1;
		theta2 = s.theta2;
		omega1 = s.omega1;
		omega2 = s.omega2;
		l1 = s.l1;
		l2 = s.l2;
		m1 = s.m1;
		m2 = s.m2;
		gravity = s.gravity;
		damping = s.damping;
		speed = s.speed;
		showTrail = s.showTrail;
		trailLength = s.trailLength;
		compareMode = s.compareMode;
		compareOffset = s.compareOffset;
		restartSignal += 1;
		runStabilityCheck();
	}

	function runStabilityCheck() {
		const stability = checkParameterStability('double-pendulum', getParameters());
		if (!stability.isStable) {
			stabilityWarnings = stability.warnings;
			showStabilityWarning = true;
		} else {
			stabilityWarnings = [];
			showStabilityWarning = false;
		}
	}

	function resetToDefaults() {
		applyPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID);
	}

	function randomize() {
		const ic = randomizeInitialConditions();
		theta1 = ic.theta1;
		theta2 = ic.theta2;
		omega1 = ic.omega1;
		omega2 = ic.omega2;
		diverged = false;
		running = true;
		restartSignal += 1;
	}

	// Load config from URL reactively (mirrors the Ikeda page).
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
				const _fetch = fetch as typeof fetch & { preconnect?: typeof fetch };
				const fetchWithSignal: typeof fetch = Object.assign(
					(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
						fetch(input, { ...init, signal }),
					{ preconnect: _fetch.preconnect }
				);

				try {
					let result: ReturnType<
						typeof loadSavedConfigParameters<'double-pendulum'>
					> extends Promise<infer T>
						? T
						: never | undefined;

					if (shareCode) {
						result = await loadSharedConfigParameters({
							shareCode,
							mapType: 'double-pendulum',
							base,
							fetchFn: fetchWithSignal
						});
					} else {
						result = await loadSavedConfigParameters({
							configId: configId!,
							mapType: 'double-pendulum',
							base,
							fetchFn: fetchWithSignal
						});
					}

					if (isUnmounted || signal.aborted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;
					if (!result) {
						lastAppliedConfigKey = null;
						configErrors = ['Failed to load configuration'];
						showConfigError = true;
						return;
					}
					if (!result.ok) {
						lastAppliedConfigKey = null;
						configErrors = result.errors;
						showConfigError = true;
						return;
					}

					applyParameters(result.parameters);
				} catch (e) {
					if (e instanceof Error && e.name === 'AbortError') return;
					console.error('Failed to load configuration:', e);
					if (isUnmounted || signal.aborted) return;
					if (lastAppliedConfigKey !== currentConfigKey) return;
					lastAppliedConfigKey = null;
					configErrors = [
						'Failed to load configuration: ' + (e instanceof Error ? e.message : 'Unknown error')
					];
					showConfigError = true;
				}
			})();
		} else if (configParam) {
			try {
				configErrors = [];
				showConfigError = false;
				stabilityWarnings = [];
				showStabilityWarning = false;

				const parsed = parseConfigParam({ mapType: 'double-pendulum', configParam });
				if (!parsed.ok) {
					console.error(parsed.logMessage, parsed.logDetails);
					configErrors = parsed.errors;
					showConfigError = true;
					return;
				}
				applyParameters(parsed.parameters);
			} catch (e) {
				console.error('Invalid config parameter:', e);
				configErrors = ['Failed to parse configuration parameters'];
				showConfigError = true;
			}
		}
	});

	function applyParameters(p: DoublePendulumParameters) {
		theta1 = p.theta1;
		theta2 = p.theta2;
		omega1 = p.omega1;
		omega2 = p.omega2;
		l1 = p.l1;
		l2 = p.l2;
		m1 = p.m1;
		m2 = p.m2;
		gravity = p.gravity;
		damping = p.damping;
		speed = p.speed ?? speed;
		showTrail = p.showTrail ?? showTrail;
		trailLength = p.trailLength ?? trailLength;
		compareMode = p.compareMode ?? compareMode;
		compareOffset = p.compareOffset ?? compareOffset;
		diverged = false;
		running = true;
		restartSignal += 1;
		runStabilityCheck();
	}

	function getParameters(): DoublePendulumParameters {
		return {
			type: 'double-pendulum',
			theta1,
			theta2,
			omega1,
			omega2,
			l1,
			l2,
			m1,
			m2,
			gravity,
			damping,
			speed,
			showTrail,
			trailLength,
			compareMode,
			compareOffset
		};
	}

	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'double-pendulum',
		saveState,
		getParameters
	);
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'double-pendulum',
		shareState,
		getParameters
	);

	onMount(() => {
		return () => {
			cleanupSaveHandler();
			cleanupShareHandler();
			configLoadAbortController?.abort();
			configLoadAbortController = null;
			isUnmounted = true;
		};
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				DOUBLE_PENDULUM
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				REAL_TIME_PHYSICS // SENSITIVE_TO_INITIAL_CONDITIONS
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={rendererContainer} targetType="container" mapType="double-pendulum" />
			<a
				href={base + '/double-pendulum/compare'}
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
		{configErrors}
		{showConfigError}
		onDismissConfigError={() => (showConfigError = false)}
		{stabilityWarnings}
		{showStabilityWarning}
		onDismissStabilityWarning={() => (showStabilityWarning = false)}
		onDismissSaveError={() => (saveState.saveError = null)}
		onDismissSaveSuccess={() => (saveState.saveSuccess = false)}
	/>

	<!-- Presets -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-4 relative"
	>
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
				<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
				PRESETS
			</h2>
			<span
				class="text-xs uppercase tracking-widest text-accent font-mono"
				data-testid="active-preset"
			>
				{activePresetLabel}
			</span>
		</div>
		<div class="flex flex-wrap gap-3">
			{#each DOUBLE_PENDULUM_PRESETS as preset (preset.id)}
				<button
					onclick={() => applyPreset(preset.id)}
					aria-pressed={activePresetId === preset.id}
					class="px-4 py-2 border rounded-sm uppercase tracking-widest text-xs font-bold transition-all {activePresetId ===
					preset.id
						? 'bg-primary/20 text-primary border-primary/60 shadow-[0_0_15px_rgba(0,243,255,0.2)]'
						: 'bg-primary/5 text-primary/70 border-primary/20 hover:bg-primary/10'}"
				>
					{preset.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Renderer -->
	<div bind:this={rendererContainer}>
		<DoublePendulumRenderer
			{theta1}
			{theta2}
			{omega1}
			{omega2}
			{l1}
			{l2}
			{m1}
			{m2}
			{gravity}
			{damping}
			{speed}
			{showTrail}
			{trailLength}
			{compareMode}
			{compareOffset}
			{restartSignal}
			bind:running
			bind:divergenceValue
			bind:diverged
			height={VIZ_CONTAINER_HEIGHT}
		/>
	</div>

	<!-- Playback actions -->
	<div class="flex flex-wrap gap-3">
		<button
			data-testid="toggle-play"
			onclick={() => (running = !running)}
			class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-sm font-bold"
		>
			{running ? '⏸ Pause' : '▶ Play'}
		</button>
		<button
			data-testid="reset"
			onclick={resetToDefaults}
			class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-sm font-bold"
		>
			↺ Reset
		</button>
		<button
			data-testid="randomize"
			onclick={randomize}
			class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm uppercase tracking-widest text-sm font-bold"
		>
			🎲 Randomize
		</button>
		<button
			data-testid="toggle-trail"
			onclick={() => (showTrail = !showTrail)}
			aria-pressed={showTrail}
			class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-sm font-bold"
		>
			{showTrail ? '✦ Trail On' : '✧ Trail Off'}
		</button>
		<button
			data-testid="toggle-compare"
			onclick={() => (compareMode = !compareMode)}
			aria-pressed={compareMode}
			class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm uppercase tracking-widest text-sm font-bold"
		>
			{compareMode ? '⧉ Comparison On' : '⧉ Comparison Off'}
		</button>
	</div>

	<!-- System parameters -->
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

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="theta1" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Angle 1 (θ₁)</label
					>
					<span data-testid="value-theta1" class="font-mono text-accent">{theta1.toFixed(2)}</span>
				</div>
				<input
					id="theta1"
					data-testid="slider-theta1"
					type="range"
					bind:value={theta1}
					min="-3.14159"
					max="3.14159"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="theta2" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Angle 2 (θ₂)</label
					>
					<span data-testid="value-theta2" class="font-mono text-accent">{theta2.toFixed(2)}</span>
				</div>
				<input
					id="theta2"
					data-testid="slider-theta2"
					type="range"
					bind:value={theta2}
					min="-3.14159"
					max="3.14159"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="gravity" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Gravity</label
					>
					<span data-testid="value-gravity" class="font-mono text-accent">{gravity.toFixed(1)}</span
					>
				</div>
				<input
					id="gravity"
					data-testid="slider-gravity"
					type="range"
					bind:value={gravity}
					min="0"
					max="50"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="speed" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
						>Speed</label
					>
					<span data-testid="value-speed" class="font-mono text-accent">{speed.toFixed(1)}</span>
				</div>
				<input
					id="speed"
					data-testid="slider-speed"
					type="range"
					bind:value={speed}
					min="0"
					max="10"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<button
			onclick={() => (showAdvanced = !showAdvanced)}
			class="text-xs uppercase tracking-widest text-primary/70 hover:text-primary font-bold border border-primary/20 rounded-sm px-4 py-2 transition-colors"
		>
			{showAdvanced ? '▾ Hide Advanced' : '▸ Show Advanced'}
		</button>

		{#if showAdvanced}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="omega1" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>Ang. Velocity 1 (ω₁)</label
						>
						<span data-testid="value-omega1" class="font-mono text-accent">{omega1.toFixed(1)}</span
						>
					</div>
					<input
						id="omega1"
						data-testid="slider-omega1"
						type="range"
						bind:value={omega1}
						min="-10"
						max="10"
						step="0.1"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="omega2" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>Ang. Velocity 2 (ω₂)</label
						>
						<span data-testid="value-omega2" class="font-mono text-accent">{omega2.toFixed(1)}</span
						>
					</div>
					<input
						id="omega2"
						data-testid="slider-omega2"
						type="range"
						bind:value={omega2}
						min="-10"
						max="10"
						step="0.1"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="l1" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>Length 1 (L₁)</label
						>
						<span data-testid="value-l1" class="font-mono text-accent">{l1.toFixed(2)}</span>
					</div>
					<input
						id="l1"
						data-testid="slider-l1"
						type="range"
						bind:value={l1}
						min="0.1"
						max="5"
						step="0.05"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="l2" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>Length 2 (L₂)</label
						>
						<span data-testid="value-l2" class="font-mono text-accent">{l2.toFixed(2)}</span>
					</div>
					<input
						id="l2"
						data-testid="slider-l2"
						type="range"
						bind:value={l2}
						min="0.1"
						max="5"
						step="0.05"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="m1" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>Mass 1 (m₁)</label
						>
						<span data-testid="value-m1" class="font-mono text-accent">{m1.toFixed(1)}</span>
					</div>
					<input
						id="m1"
						data-testid="slider-m1"
						type="range"
						bind:value={m1}
						min="0.1"
						max="10"
						step="0.1"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="m2" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>Mass 2 (m₂)</label
						>
						<span data-testid="value-m2" class="font-mono text-accent">{m2.toFixed(1)}</span>
					</div>
					<input
						id="m2"
						data-testid="slider-m2"
						type="range"
						bind:value={m2}
						min="0.1"
						max="10"
						step="0.1"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label for="damping" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>Damping</label
						>
						<span data-testid="value-damping" class="font-mono text-accent"
							>{damping.toFixed(2)}</span
						>
					</div>
					<input
						id="damping"
						data-testid="slider-damping"
						type="range"
						bind:value={damping}
						min="0"
						max="2"
						step="0.01"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label
							for="trailLength"
							class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>Trail Length</label
						>
						<span data-testid="value-trailLength" class="font-mono text-accent">{trailLength}</span>
					</div>
					<input
						id="trailLength"
						data-testid="slider-trailLength"
						type="range"
						bind:value={trailLength}
						min="1"
						max="5000"
						step="1"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
				<div class="space-y-2">
					<div class="flex justify-between items-end">
						<label
							for="compareOffset"
							class="text-primary/80 text-xs uppercase tracking-widest font-bold"
							>Compare Offset</label
						>
						<span data-testid="value-compareOffset" class="font-mono text-accent"
							>{compareOffset.toFixed(3)}</span
						>
					</div>
					<input
						id="compareOffset"
						data-testid="slider-compareOffset"
						type="range"
						bind:value={compareOffset}
						min="0"
						max="0.1"
						step="0.001"
						class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
					/>
				</div>
			</div>
		{/if}
	</div>

	<!-- Educational copy -->
	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-3">
		<h2 class="text-xl font-['Orbitron'] font-semibold text-primary">WHY_IS_IT_CHAOTIC?</h2>
		<p class="text-muted-foreground font-['Rajdhani'] leading-relaxed">
			A double pendulum is two pendulums joined end to end. Its motion is governed by simple, fully
			deterministic equations — yet it is famously unpredictable. The system is acutely
			<span class="text-primary">sensitive to initial conditions</span>: change a starting angle by
			a fraction of a degree and the two paths stay close for a moment, then diverge completely.
			Turn on
			<span class="text-accent">comparison mode</span> to watch a second, almost-identical pendulum peel
			away from the first.
		</p>
	</div>
</div>

<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="double-pendulum"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="double-pendulum"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
