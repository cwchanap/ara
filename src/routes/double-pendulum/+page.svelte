<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import DoublePendulumRenderer from '$lib/components/visualizations/DoublePendulumRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { createStabilityReporter } from '$lib/stability-reporter';
	import type { DoublePendulumParameters, ChaosMapParameters } from '$lib/types';
	import { randomizeInitialConditions } from '$lib/double-pendulum';
	import {
		DOUBLE_PENDULUM_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_DOUBLE_PENDULUM_PRESET_ID,
		type DoublePendulumState
	} from '$lib/double-pendulum-presets';

	let { data } = $props();

	const defaultPreset = getPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default preset: ${DEFAULT_DOUBLE_PENDULUM_PRESET_ID}`);
	const d = defaultPreset.state;

	// All controls are page-owned $state: presets mutate every parameter
	// atomically (and bump restartSignal), the advanced toggle conditionally
	// hides 9 sliders, and the interaction tests assert value-<key>/slider-<key>
	// testids. They render via extraControls.
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
		diverged = false;
		running = true;
		restartSignal += 1;
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

	function buildParameters(): DoublePendulumParameters {
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

	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'double-pendulum') return;
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
	}

	// Reactive stability: page-owned sliders aren't watched by the shell's
	// reactiveStability effect, so re-run the check (debounced) whenever the
	// inputs that affect stability change and report into the unified alert.
	// Also covers preset/randomize/config-load, which mutate the same $state.
	const stability = createStabilityReporter({
		mapType: 'double-pendulum',
		getParams: () => buildParameters(),
		reactive: true
	});
	$effect(() => {
		void theta1;
		void theta2;
		void omega1;
		void omega2;
		void l1;
		void l2;
		void m1;
		void m2;
		void gravity;
		void damping;
		stability.triggerReactive();
		return () => stability.cleanupReactive();
	});
</script>

<VisualizationShell
	mapType="double-pendulum"
	title="DOUBLE_PENDULUM"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	stabilityReporter={stability.stabilityReporter}
	{diverged}
	onDismissDiverged={() => (diverged = false)}
	description={{
		heading: 'WHY_IS_IT_CHAOTIC?',
		body: 'A double pendulum is two pendulums joined end to end. Its motion is governed by simple, fully deterministic equations — yet it is famously unpredictable. The system is acutely sensitive to initial conditions: change a starting angle by a fraction of a degree and the two paths stay close for a moment, then diverge completely. Turn on comparison mode to watch a second, almost-identical pendulum peel away from the first.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet extraControls()}
		<div class="space-y-6">
			<!-- Presets -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3
						class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2"
					>
						<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
						PRESETS
					</h3>
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

			<!-- Playback actions -->
			<div class="flex flex-wrap gap-3">
				<button
					data-testid="toggle-play"
					onclick={() => {
						if (diverged) {
							diverged = false;
							restartSignal += 1;
							running = true;
						} else {
							running = !running;
						}
					}}
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
			<div class="space-y-4">
				<h3 class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
					<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
					SHAPE_PARAMETERS
				</h3>

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label
								for="theta1"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Angle 1 (θ₁)</label
							>
							<span data-testid="value-theta1" class="font-mono text-accent"
								>{theta1.toFixed(2)}</span
							>
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
							<label
								for="theta2"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Angle 2 (θ₂)</label
							>
							<span data-testid="value-theta2" class="font-mono text-accent"
								>{theta2.toFixed(2)}</span
							>
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
							<label
								for="gravity"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Gravity</label
							>
							<span data-testid="value-gravity" class="font-mono text-accent"
								>{gravity.toFixed(1)}</span
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
							<span data-testid="value-speed" class="font-mono text-accent">{speed.toFixed(1)}</span
							>
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
								<label
									for="omega1"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold"
									>Ang. Velocity 1 (ω₁)</label
								>
								<span data-testid="value-omega1" class="font-mono text-accent"
									>{omega1.toFixed(1)}</span
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
								<label
									for="omega2"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold"
									>Ang. Velocity 2 (ω₂)</label
								>
								<span data-testid="value-omega2" class="font-mono text-accent"
									>{omega2.toFixed(1)}</span
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
								<label
									for="damping"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">Damping</label
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
								<span data-testid="value-trailLength" class="font-mono text-accent"
									>{trailLength}</span
								>
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
								min="-0.1"
								max="0.1"
								step="0.001"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
							/>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet renderer({ container })}
		<div bind:this={container.el}>
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
	{/snippet}
</VisualizationShell>
