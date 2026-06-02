<!-- src/lib/components/visualizations/lorenz/SolverControls.svelte -->
<script lang="ts">
	import type { LorenzSolver } from '$lib/types';
	interface State {
		solver: LorenzSolver;
		dt: number;
		stepsPerFrame: number;
	}
	interface Props extends State {
		onChange: (next: State) => void;
	}
	let { solver, dt, stepsPerFrame, onChange }: Props = $props();
	function emit(patch: Partial<State>) {
		onChange({ solver, dt, stepsPerFrame, ...patch });
	}
</script>

<div class="space-y-3">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">NUMERICAL_SOLVER</span>
	<label class="space-y-1 block">
		<span class="text-primary/60 text-[10px] uppercase tracking-widest">Solver</span>
		<select
			value={solver}
			onchange={(e) => emit({ solver: e.currentTarget.value as LorenzSolver })}
			class="w-full bg-black/30 border border-primary/20 rounded-sm px-2 py-1 font-mono text-accent text-sm"
		>
			<option value="euler">Euler</option>
			<option value="rk2">RK2</option>
			<option value="rk4">RK4</option>
		</select>
	</label>
	<label class="space-y-1 block">
		<div class="flex justify-between items-end">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">dt</span>
			<span class="font-mono text-accent text-sm">{dt.toFixed(3)}</span>
		</div>
		<input
			type="range"
			min="0.001"
			max="0.02"
			step="0.001"
			value={dt}
			oninput={(e) => emit({ dt: Number(e.currentTarget.value) })}
			class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
		/>
	</label>
	<label class="space-y-1 block">
		<div class="flex justify-between items-end">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">Iterations/frame</span>
			<span class="font-mono text-accent text-sm">{stepsPerFrame}</span>
		</div>
		<input
			type="range"
			min="1"
			max="50"
			step="1"
			value={stepsPerFrame}
			oninput={(e) => emit({ stepsPerFrame: Number(e.currentTarget.value) })}
			class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
		/>
	</label>
</div>
