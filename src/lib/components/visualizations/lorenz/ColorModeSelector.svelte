<!-- src/lib/components/visualizations/lorenz/ColorModeSelector.svelte -->
<script lang="ts">
	import type { LorenzColorMode } from '$lib/types';
	interface Props {
		colorMode: LorenzColorMode;
		ghostEnabled: boolean;
		onChange: (mode: LorenzColorMode) => void;
	}
	let { colorMode, ghostEnabled, onChange }: Props = $props();
	const modes: { value: LorenzColorMode; label: string }[] = [
		{ value: 'time', label: 'Time' },
		{ value: 'speed', label: 'Speed' },
		{ value: 'zheight', label: 'Z-height' },
		{ value: 'divergence', label: 'Divergence' },
		{ value: 'single', label: 'Single' }
	];

	$effect(() => {
		if (!ghostEnabled && colorMode === 'divergence') {
			onChange('time');
		}
	});
</script>

<div class="space-y-2">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">COLOR_MODE</span>
	<div class="grid grid-cols-2 gap-1">
		{#each modes as mode (mode.value)}
			{@const disabled = mode.value === 'divergence' && !ghostEnabled}
			<label class="flex items-center gap-2 text-xs {disabled ? 'opacity-40' : 'text-primary/80'}">
				<input
					type="radio"
					name="lorenz-color-mode"
					value={mode.value}
					checked={colorMode === mode.value}
					{disabled}
					onchange={() => onChange(mode.value)}
					class="accent-accent"
				/>
				{mode.label}
			</label>
		{/each}
	</div>
</div>
