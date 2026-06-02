<!-- src/lib/components/visualizations/lorenz/InitialStateControls.svelte -->
<script lang="ts">
	interface State {
		x0: number;
		y0: number;
		z0: number;
		epsilon: number;
		showGhost: boolean;
	}
	interface Props extends State {
		onChange: (next: State) => void;
		onRandomize: () => void;
		onReset: () => void;
	}
	let { x0, y0, z0, epsilon, showGhost, onChange, onRandomize, onReset }: Props = $props();

	function emit(patch: Partial<State>) {
		onChange({ x0, y0, z0, epsilon, showGhost, ...patch });
	}

	function parseAndEmit(key: keyof State, raw: string) {
		if (raw === '' || raw === '-' || raw === '.') return; // intermediate typing
		const val = Number(raw);
		if (Number.isFinite(val)) emit({ [key]: val });
	}
</script>

<div class="space-y-3">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">INITIAL_STATE</span>
	<div class="grid grid-cols-2 gap-3">
		<label class="space-y-1 block">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">x₀</span>
			<input
				type="number"
				step="0.1"
				value={x0}
				oninput={(e) => parseAndEmit('x0', e.currentTarget.value)}
				class="w-full bg-black/30 border border-primary/20 rounded-sm px-2 py-1 font-mono text-accent text-sm"
			/>
		</label>
		<label class="space-y-1 block">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">y₀</span>
			<input
				type="number"
				step="0.1"
				value={y0}
				oninput={(e) => parseAndEmit('y0', e.currentTarget.value)}
				class="w-full bg-black/30 border border-primary/20 rounded-sm px-2 py-1 font-mono text-accent text-sm"
			/>
		</label>
		<label class="space-y-1 block">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">z₀</span>
			<input
				type="number"
				step="0.1"
				value={z0}
				oninput={(e) => parseAndEmit('z0', e.currentTarget.value)}
				class="w-full bg-black/30 border border-primary/20 rounded-sm px-2 py-1 font-mono text-accent text-sm"
			/>
		</label>
		<label class="space-y-1 block">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">ε</span>
			<input
				type="number"
				step="0.0001"
				value={epsilon}
				oninput={(e) => parseAndEmit('epsilon', e.currentTarget.value)}
				class="w-full bg-black/30 border border-primary/20 rounded-sm px-2 py-1 font-mono text-accent text-sm"
			/>
		</label>
	</div>
	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={onRandomize}
			class="px-3 py-1 text-xs uppercase tracking-widest font-bold bg-primary/10 text-primary border border-primary/30 rounded-sm hover:bg-primary/20"
		>
			Randomize
		</button>
		<button
			type="button"
			onclick={onReset}
			class="px-3 py-1 text-xs uppercase tracking-widest font-bold bg-primary/10 text-primary border border-primary/30 rounded-sm hover:bg-primary/20"
		>
			Reset
		</button>
	</div>
	<label class="flex items-center gap-2 text-primary/80 text-xs uppercase tracking-widest">
		<input
			type="checkbox"
			checked={showGhost}
			onchange={(e) => emit({ showGhost: e.currentTarget.checked })}
			class="accent-accent"
		/>
		Show Perturbed Orbit
	</label>
</div>
