<!--
  ParameterSlider Component
  
  A single parameter slider control with label, value display, and debouncing.
  Follows sci-fi aesthetic with neon cyan styling.
-->
<script lang="ts">
	import { SLIDER_DEBOUNCE_MS } from '$lib/constants';

	interface Props {
		id: string;
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		/** Number of decimal places to display (default: 2) */
		decimals?: number;
		/** Whether to apply debouncing to value changes (default: true) */
		debounce?: boolean;
		/** Custom debounce delay in ms (default: SLIDER_DEBOUNCE_MS) */
		debounceMs?: number;
		onchange?: (value: number) => void;
	}

	let {
		id,
		label,
		value = $bindable(),
		min,
		max,
		step,
		decimals = 2,
		debounce = true,
		debounceMs = SLIDER_DEBOUNCE_MS,
		onchange
	}: Props = $props();

	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let internalValue = $derived.by(() => value);

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const newValue = parseFloat(target.value);
		internalValue = newValue;

		if (debounce) {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			timeoutId = setTimeout(() => {
				value = newValue;
				onchange?.(newValue);
				timeoutId = null;
			}, debounceMs);
		} else {
			value = newValue;
			onchange?.(newValue);
		}
	}

	// Cleanup on unmount
	$effect(() => {
		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		};
	});

	const displayValue = $derived(
		Number.isInteger(step) && decimals === 2
			? internalValue.toString()
			: internalValue.toFixed(decimals)
	);
</script>

<div class="space-y-2">
	<div class="flex justify-between items-end">
		<label for={id} class="text-primary/80 text-xs uppercase tracking-widest font-bold">
			{label}
		</label>
		<span class="font-mono text-accent">{displayValue}</span>
	</div>
	<input
		{id}
		type="range"
		value={internalValue}
		{min}
		{max}
		{step}
		oninput={handleInput}
		class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
	/>
</div>
