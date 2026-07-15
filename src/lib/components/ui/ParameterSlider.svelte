<script lang="ts">
	import { PREVIEW_THROTTLE_MS, PREVIEW_IDLE_COMMIT_MS } from '$lib/constants';
	import type { UpdatePolicy } from '$lib/viz/types';
	import { SliderDragManager } from '$lib/slider-drag-manager';
	import { getContext } from 'svelte';

	interface Props {
		id: string;
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		decimals?: number;
		updatePolicy?: UpdatePolicy;
		disabled?: boolean;
		ondraft?: (value: number) => void;
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
		updatePolicy = 'live',
		disabled = false,
		ondraft,
		onchange
	}: Props = $props();

	let internalValue = $state(value);
	let isDragging = false;
	let throttleTimer: ReturnType<typeof setTimeout> | null = null;
	let idleTimer: ReturnType<typeof setTimeout> | null = null;

	const dragManager = getContext<SliderDragManager | undefined>('slider-drag-manager');
	const unregister = dragManager?.register(id, updatePolicy);

	function commit() {
		if (throttleTimer) {
			clearTimeout(throttleTimer);
			throttleTimer = null;
		}
		if (idleTimer) {
			clearTimeout(idleTimer);
			idleTimer = null;
		}
		value = internalValue;
		ondraft?.(internalValue);
		onchange?.(internalValue);
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const newValue = parseFloat(target.value);
		internalValue = newValue;

		if (!isDragging) {
			isDragging = true;
			dragManager?.setDragging(id, true);
		}

		if (updatePolicy === 'live') {
			value = newValue;
			ondraft?.(newValue);
			onchange?.(newValue);
		} else if (updatePolicy === 'preview') {
			// Throttle draft updates
			if (!throttleTimer) {
				throttleTimer = setTimeout(() => {
					throttleTimer = null;
					ondraft?.(internalValue);
				}, PREVIEW_THROTTLE_MS);
			}
		}
		// commit: no value or ondraft during drag

		// Reset idle timer for keyboard commit
		if (idleTimer) clearTimeout(idleTimer);
		if (updatePolicy !== 'live') {
			idleTimer = setTimeout(() => {
				idleTimer = null;
				endDrag();
			}, PREVIEW_IDLE_COMMIT_MS);
		}
	}

	function endDrag() {
		if (!isDragging) return;
		isDragging = false;
		dragManager?.setDragging(id, false);
		commit();
	}

	function handleChange() {
		endDrag();
	}

	// Sync internalValue from external value changes — guarded by isDragging.
	// throttleTimer is only set in handleInput (which sets isDragging=true),
	// and isDragging only clears via endDrag→commit (which clears throttleTimer),
	// so a pending throttle and isDragging=false can never co-occur here.
	$effect(() => {
		if (isDragging) return; // internalValue is authoritative during drag
		internalValue = value;
	});

	// Disabled-mid-drag guarantee
	$effect(() => {
		if (disabled && isDragging) {
			endDrag();
		}
	});

	// Cleanup on unmount
	$effect(() => {
		return () => {
			if (throttleTimer) clearTimeout(throttleTimer);
			if (idleTimer) clearTimeout(idleTimer);
			unregister?.();
		};
	});

	const displayValue = $derived(internalValue.toFixed(decimals));
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
		data-testid={`slider-${id}`}
		type="range"
		value={internalValue}
		{min}
		{max}
		{step}
		{disabled}
		oninput={handleInput}
		onchange={handleChange}
		class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
	/>
</div>
