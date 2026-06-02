<!-- src/lib/components/visualizations/lorenz/PlaybackControls.svelte -->
<script lang="ts">
	interface Props {
		isPlaying: boolean;
		speed: number;
		onTogglePlay: () => void;
		onStep: () => void;
		onReset: () => void;
		onSpeedChange: (speed: number) => void;
	}
	let { isPlaying, speed, onTogglePlay, onStep, onReset, onSpeedChange }: Props = $props();
	const btn =
		'px-3 py-1 text-xs uppercase tracking-widest font-bold bg-primary/10 text-primary border border-primary/30 rounded-sm hover:bg-primary/20';
</script>

<div class="space-y-3">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">SIMULATION</span>
	<div class="flex items-center gap-2">
		<button type="button" class={btn} onclick={onTogglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
		<button type="button" class={btn} onclick={onStep}>Step</button>
		<button type="button" class={btn} onclick={onReset}>Reset</button>
	</div>
	<label class="space-y-1 block">
		<div class="flex justify-between items-end">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">Speed</span>
			<span class="font-mono text-accent text-sm">{speed.toFixed(1)}x</span>
		</div>
		<input
			type="range"
			min="0.1"
			max="5"
			step="0.1"
			value={speed}
			oninput={(e) => onSpeedChange(Number(e.currentTarget.value))}
			class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
		/>
	</label>
</div>
