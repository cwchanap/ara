<script lang="ts">
	import { PREVIEW_THROTTLE_MS, PREVIEW_IDLE_COMMIT_MS } from '$lib/constants';
	import type { UpdatePolicy } from '$lib/viz/types';
	import { SliderDragManager } from '$lib/slider-drag-manager.svelte';
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
		decimals = 0,
		updatePolicy = 'live',
		disabled = false,
		ondraft,
		onchange
	}: Props = $props();

	let internalValue = $state(value);
	let isDragging = $state(false);
	// Tracks whether the current interaction is a pointer drag. The idle
	// commit timer is keyboard-only: pointer drags commit via the `change`
	// event on release, so arming the idle timer mid-pointer-drag would
	// fire endDrag() after a 500ms pause and trigger a full render while
	// the pointer is still down.
	let pointerActive = $state(false);
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
		// Live policy already fired ondraft/onchange on the final input event;
		// re-firing here would duplicate the callback for the same value.
		if (updatePolicy === 'live') return;
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

		// Reset idle timer for keyboard commit only. Pointer drags commit via
		// the `change` event on release — arming the idle timer mid-pointer-drag
		// would fire endDrag() after a 500ms pause and trigger a full render
		// while the pointer is still down.
		if (idleTimer) clearTimeout(idleTimer);
		if (updatePolicy !== 'live' && !pointerActive) {
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

	// Discard the in-progress draft without committing: clear drag state and
	// timers, leave `value` untouched. Restore the parent draft to the
	// committed `value` via ondraft so VisualizationShell.draftValues does
	// not retain a stale intermediate from a throttled preview draft. The
	// sync $effect below resets internalValue back to the committed `value`
	// once isDragging is false.
	function cancelDrag() {
		if (!isDragging) return;
		isDragging = false;
		if (throttleTimer) {
			clearTimeout(throttleTimer);
			throttleTimer = null;
		}
		if (idleTimer) {
			clearTimeout(idleTimer);
			idleTimer = null;
		}
		pointerActive = false;
		dragManager?.setDragging(id, false);
		// Restore the parent draft to the committed value so a throttled
		// preview draft does not linger after the drag is discarded.
		ondraft?.(value);
	}

	function handleChange() {
		endDrag();
	}

	// Pointer drag tracking: marks the interaction as pointer-based so the
	// idle commit timer is not armed (pointer drags commit via `change` on
	// release). Cleared on pointerup so subsequent keyboard edits arm the
	// idle timer normally.
	//
	// Capture the pointer on pointerdown so pointerup/pointercancel are
	// delivered to this element even if the pointer is released outside the
	// input (e.g. the user drags the slider thumb off the track and lets
	// go, possibly returning to the original value so no `change` fires).
	// Without capture, a release outside the element would never reach
	// handlePointerUp, leaving isDragging and the manager entry active and
	// the shell frozen with Save/Share/Snapshot disabled. endDrag's
	// `if (!isDragging) return` guard keeps the pointerup→change sequence
	// a single commit.
	function handlePointerDown(event: PointerEvent) {
		pointerActive = true;
		if (idleTimer) {
			clearTimeout(idleTimer);
			idleTimer = null;
		}
		const el = event.currentTarget as HTMLElement | null;
		if (el && typeof el.setPointerCapture === 'function' && event.pointerId != null) {
			el.setPointerCapture(event.pointerId);
		}
	}

	// Commit the drag on pointerup. The `change` event is the normal commit
	// path, but it does not fire when the pointer stream ends without a
	// value change from the start of the interaction (e.g. the user drags
	// away and back to the original value, or the browser drops the pointer
	// without issuing pointercancel). Without this call isDragging and the
	// manager entry would stay active, leaving the shell frozen in
	// PREVIEW/FROZEN with Save/Share/Snapshot disabled. endDrag's
	// `if (!isDragging) return` guard makes this a no-op if `change` already
	// fired, so the normal pointerup→change sequence commits exactly once.
	function handlePointerUp() {
		pointerActive = false;
		endDrag();
	}

	// Pointer cancellation (browser gesture takeover, touch interruption,
	// OS-level cancel) or lost pointer capture: the pointer stream is
	// permanently lost, so the `change` event that pointer drags rely on to
	// commit will never fire. Discard the in-progress draft via cancelDrag
	// — clearing isDragging, the manager's drag entry, and timers — so the
	// shell does not stay frozen in PREVIEW/FROZEN with Save/Share/Snapshot
	// disabled. Clear pointerActive unconditionally (cancelDrag returns
	// early when isDragging is false, e.g. pointerdown with no input yet,
	// which would otherwise leave pointerActive set and suppress the idle
	// timer for subsequent keyboard edits).
	function handlePointerCancel() {
		pointerActive = false;
		cancelDrag();
	}

	// Sync internalValue from external value changes — guarded by isDragging.
	// throttleTimer is only set in handleInput (which sets isDragging=true),
	// and isDragging only clears via endDrag→commit or cancelDrag (both clear
	// throttleTimer), so a pending throttle and isDragging=false can never
	// co-occur here.
	$effect(() => {
		if (isDragging) return; // internalValue is authoritative during drag
		internalValue = value;
	});

	// Disabled-mid-drag guarantee: if the slider is disabled while the user
	// is still dragging (e.g. a preset/randomize/config-load mutates state
	// that disables the control), cancelDrag discards the in-progress draft
	// — clearing drag state and timers without writing to `value`. The action
	// that caused the disable (preset, randomize, config load) takes
	// precedence over the user's in-progress drag. The sync $effect then
	// resets internalValue back to the committed `value`.
	$effect(() => {
		if (disabled && isDragging) {
			cancelDrag();
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
		onpointerdown={handlePointerDown}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerCancel}
		class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
	/>
</div>
