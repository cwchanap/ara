<!-- src/lib/components/visualizations/lorenz/ViewControls.svelte -->
<script lang="ts">
	import type { LorenzViewMode } from '$lib/types';
	interface State {
		viewMode: LorenzViewMode;
		autoRotate: boolean;
		rotationSpeed: number;
		zoom: number;
	}
	interface Props extends State {
		onChange: (next: State) => void;
		onResetCamera: () => void;
	}
	let { viewMode, autoRotate, rotationSpeed, zoom, onChange, onResetCamera }: Props = $props();
	const modes: { value: LorenzViewMode; label: string }[] = [
		{ value: '3d', label: '3D' },
		{ value: 'xy', label: 'XY' },
		{ value: 'xz', label: 'XZ' },
		{ value: 'yz', label: 'YZ' }
	];
	function emit(patch: Partial<State>) {
		onChange({ viewMode, autoRotate, rotationSpeed, zoom, ...patch });
	}
	const modeBtn = (active: boolean) =>
		`px-3 py-1 text-xs uppercase tracking-widest font-bold rounded-sm border transition-all ${
			active
				? 'bg-primary/20 text-primary border-primary/60'
				: 'bg-primary/5 text-primary/70 border-primary/20 hover:bg-primary/10'
		}`;
</script>

<div class="space-y-3">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">VIEW_MODE</span>
	<div class="flex gap-2">
		{#each modes as mode (mode.value)}
			<button
				type="button"
				class={modeBtn(viewMode === mode.value)}
				aria-pressed={viewMode === mode.value}
				onclick={() => emit({ viewMode: mode.value })}
			>
				{mode.label}
			</button>
		{/each}
	</div>
	<label class="flex items-center gap-2 text-primary/80 text-xs uppercase tracking-widest">
		<input
			type="checkbox"
			checked={autoRotate}
			onchange={(e) => emit({ autoRotate: e.currentTarget.checked })}
			class="accent-accent"
		/>
		Auto rotate
	</label>
	<label class="space-y-1 block">
		<div class="flex justify-between items-end">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">Rotation</span>
			<span class="font-mono text-accent text-sm">{rotationSpeed.toFixed(1)}x</span>
		</div>
		<input
			type="range"
			min="0"
			max="3"
			step="0.1"
			value={rotationSpeed}
			oninput={(e) => emit({ rotationSpeed: Number(e.currentTarget.value) })}
			class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
		/>
	</label>
	<label class="space-y-1 block">
		<div class="flex justify-between items-end">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">Zoom</span>
			<span class="font-mono text-accent text-sm">{zoom.toFixed(1)}x</span>
		</div>
		<input
			type="range"
			min="0.5"
			max="3"
			step="0.1"
			value={zoom}
			oninput={(e) => emit({ zoom: Number(e.currentTarget.value) })}
			class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
		/>
	</label>
	<button
		type="button"
		onclick={onResetCamera}
		class="px-3 py-1 text-xs uppercase tracking-widest font-bold bg-primary/10 text-primary border border-primary/30 rounded-sm hover:bg-primary/20"
	>
		Reset Camera
	</button>
</div>
