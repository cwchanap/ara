<!-- src/lib/components/visualizations/lorenz/TrailControls.svelte -->
<script lang="ts">
	import type { LorenzTrailStyle } from '$lib/types';
	interface Props {
		trailLength: number;
		trailStyle: LorenzTrailStyle;
		onLengthChange: (length: number) => void;
		onStyleChange: (style: LorenzTrailStyle) => void;
	}
	let { trailLength, trailStyle, onLengthChange, onStyleChange }: Props = $props();
	const styleBtn = (active: boolean) =>
		`px-3 py-1 text-xs uppercase tracking-widest font-bold rounded-sm border transition-all ${
			active
				? 'bg-primary/20 text-primary border-primary/60'
				: 'bg-primary/5 text-primary/70 border-primary/20 hover:bg-primary/10'
		}`;
</script>

<div class="space-y-3">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">TRAIL_LENGTH</span>
	<div class="flex justify-between items-end">
		<span class="text-primary/60 text-[10px] uppercase tracking-widest">Points</span>
		<span class="font-mono text-accent text-sm">{trailLength.toLocaleString()}</span>
	</div>
	<input
		type="range"
		min="2000"
		max="100000"
		step="1000"
		value={trailLength}
		oninput={(e) => onLengthChange(Number(e.currentTarget.value))}
		data-testid="slider-trailLength"
		class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
	/>
	<div class="flex gap-2">
		<button
			type="button"
			class={styleBtn(trailStyle === 'comet')}
			aria-pressed={trailStyle === 'comet'}
			onclick={() => onStyleChange('comet')}
		>
			Comet
		</button>
		<button
			type="button"
			class={styleBtn(trailStyle === 'cumulative')}
			aria-pressed={trailStyle === 'cumulative'}
			onclick={() => onStyleChange('cumulative')}
		>
			Cumulative
		</button>
	</div>
</div>
