<!-- src/lib/components/visualizations/lorenz/ChaosIndicator.svelte -->
<script lang="ts">
	import type { LyapunovClassification } from '$lib/chua';
	interface Props {
		value: number;
		classification: LyapunovClassification;
		diverged: boolean;
	}
	let { value, classification, diverged }: Props = $props();

	const label = $derived(
		diverged
			? 'Unstable / diverged'
			: classification === 'chaotic'
				? 'Chaotic'
				: classification === 'stable'
					? 'Stable'
					: 'Periodic / Quasi-periodic'
	);
	const badgeColor = $derived(
		diverged || classification === 'chaotic'
			? 'text-accent border-accent/50'
			: classification === 'stable'
				? 'text-primary border-primary/50'
				: 'text-yellow-300 border-yellow-300/50'
	);
	const formatted = $derived(
		diverged || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
	);
</script>

<div class="flex items-center gap-3 bg-black/30 border border-primary/20 rounded-sm px-3 py-2">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">CHAOS_INDICATOR</span>
	<span class="font-mono text-accent text-sm">λ₁: {formatted}</span>
	<span
		class="px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold rounded-sm border {badgeColor}"
	>
		{label}
	</span>
</div>
