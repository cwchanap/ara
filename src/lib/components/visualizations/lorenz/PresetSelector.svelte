<!-- src/lib/components/visualizations/lorenz/PresetSelector.svelte -->
<script lang="ts">
	import { LORENZ_PRESETS, type LorenzPreset } from '$lib/lorenz/presets';

	interface Props {
		activeId: string;
		onSelect: (preset: LorenzPreset) => void;
	}
	let { activeId, onSelect }: Props = $props();
</script>

<div class="space-y-2">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">PRESETS</span>
	<div class="flex flex-wrap gap-2">
		{#each LORENZ_PRESETS as preset (preset.id)}
			<button
				type="button"
				onclick={() => onSelect(preset)}
				class="px-3 py-1 text-xs uppercase tracking-widest font-bold rounded-sm border transition-all
					{activeId === preset.id
					? 'bg-primary/20 text-primary border-primary/60'
					: 'bg-primary/5 text-primary/70 border-primary/20 hover:bg-primary/10'}"
			>
				{preset.label}
			</button>
		{/each}
	</div>
</div>
