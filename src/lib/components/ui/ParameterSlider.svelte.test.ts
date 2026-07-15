import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { PREVIEW_IDLE_COMMIT_MS, PREVIEW_THROTTLE_MS } from '$lib/constants';
import ParameterSlider from './ParameterSlider.svelte';

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

async function setSliderValue(slider: HTMLElement, value: number) {
	await fireEvent.input(slider, { target: { value: String(value) } });
}

async function releaseSlider(slider: HTMLElement) {
	await fireEvent.change(slider);
}

describe('ParameterSlider', () => {
	it('live policy: every input updates value immediately', async () => {
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'live' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		await setSliderValue(slider, 7);
		expect(slider.value).toBe('7');
		expect(onchange).toHaveBeenCalledWith(7);
	});

	it('commit policy: value does NOT update during drag, only on release', async () => {
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'commit' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		await setSliderValue(slider, 8);
		// During drag: value is not committed, so onchange must not fire.
		expect(onchange).not.toHaveBeenCalled();
		// Release (change event) → commit fires with the final value.
		await releaseSlider(slider);
		expect(onchange).toHaveBeenCalledWith(8);
	});

	it('commit policy: display value updates immediately during drag', async () => {
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				decimals: 2,
				updatePolicy: 'commit' as const
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		await setSliderValue(slider, 8);
		expect(screen.getByText('8.00')).toBeInTheDocument();
	});

	it('preview policy: ondraft fires after throttle delay', async () => {
		vi.useFakeTimers();
		const ondraft = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				ondraft
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		await setSliderValue(slider, 7);
		// Throttled — ondraft must not fire immediately.
		expect(ondraft).not.toHaveBeenCalled();
		// Advance past PREVIEW_THROTTLE_MS (100ms).
		vi.advanceTimersByTime(150);
		expect(ondraft).toHaveBeenCalledWith(7);
	});

	it('disabled prop: slider has disabled attribute', async () => {
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'live' as const,
				disabled: true
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		expect(slider.disabled).toBe(true);
	});

	it('throttle rewind guard: external value change does NOT overwrite internalValue during drag', async () => {
		vi.useFakeTimers();
		const { rerender } = render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Start a drag — sets isDragging=true and internalValue=7.
		await setSliderValue(slider, 7);
		expect(slider.value).toBe('7');
		// Simulate an external value change (e.g. a stale throttle rewinding
		// the parent's bound value). During drag the guard must keep
		// internalValue authoritative so the slider is not "rewound".
		rerender({ value: 3 });
		await tick();
		expect(slider.value).toBe('7');
		// Release the drag — endDrag → commit clears timers and commits 7.
		// isDragging reverts to false so the sync effect resumes tracking value.
		await releaseSlider(slider);
		// An external value change after release must now sync into the slider,
		// confirming the guard is lifted once the drag ends.
		rerender({ value: 9 });
		await tick();
		expect(slider.value).toBe('9');
	});

	it('preview policy: releasing the slider clears the pending throttle and commits the value', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		const ondraft = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				ondraft,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Start a drag — schedules a throttled ondraft (throttleTimer set).
		await setSliderValue(slider, 7);
		expect(ondraft).not.toHaveBeenCalled();
		// Release (change event) → endDrag → commit must clear the pending
		// throttle timer and fire both ondraft and onchange with the final value.
		await releaseSlider(slider);
		expect(ondraft).toHaveBeenCalledWith(7);
		expect(onchange).toHaveBeenCalledWith(7);
		// Advancing past the throttle window must NOT fire a stale ondraft —
		// commit cleared the timer.
		vi.advanceTimersByTime(PREVIEW_THROTTLE_MS + 50);
		expect(ondraft).toHaveBeenCalledTimes(1);
		expect(onchange).toHaveBeenCalledTimes(1);
	});

	it('preview policy: idle timer commits the value after PREVIEW_IDLE_COMMIT_MS (keyboard commit)', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		await setSliderValue(slider, 8);
		// During drag (before idle expiry) onchange must not fire.
		expect(onchange).not.toHaveBeenCalled();
		// Advance past the idle commit window → idle timer fires endDrag →
		// commit → onchange fires with the final value.
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 10);
		expect(onchange).toHaveBeenCalledWith(8);
	});

	it('preview policy: a second input resets the idle timer', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		await setSliderValue(slider, 6);
		// Advance most of the idle window — not yet committed.
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS - 50);
		expect(onchange).not.toHaveBeenCalled();
		// A second input resets the idle timer (clears the prior one).
		await setSliderValue(slider, 7);
		// 50ms later the ORIGINAL idle window would have elapsed — but because
		// the second input reset it, onchange must still not have fired.
		vi.advanceTimersByTime(60);
		expect(onchange).not.toHaveBeenCalled();
		// Advancing the remainder of the new idle window commits.
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS);
		expect(onchange).toHaveBeenCalledWith(7);
	});

	it('endDrag is a no-op when the slider is not being dragged', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Drag, then let the idle timer auto-commit (isDragging becomes false).
		await setSliderValue(slider, 8);
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 10);
		expect(onchange).toHaveBeenCalledTimes(1);
		// A subsequent change event (release) must NOT trigger a second commit —
		// endDrag returns early when not dragging.
		await releaseSlider(slider);
		expect(onchange).toHaveBeenCalledTimes(1);
	});

	it('disabled-mid-drag: setting disabled while dragging discards the draft and ends the drag', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		const ondraft = vi.fn();
		const { rerender } = render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				disabled: false,
				ondraft,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Start a drag — isDragging=true, throttle pending, internalValue=9.
		await setSliderValue(slider, 9);
		expect(onchange).not.toHaveBeenCalled();
		// Disabling mid-drag must discard the in-progress draft (no commit)
		// and end the drag so the parent state is not left stale. The action
		// that caused the disable takes precedence over the user's drag.
		rerender({ disabled: true });
		await tick();
		expect(onchange).not.toHaveBeenCalled();
		// cancelDrag restores the parent draft to the committed value (5)
		// via ondraft so VisualizationShell.draftValues does not retain the
		// stale intermediate (9) from the in-progress preview drag.
		expect(ondraft).toHaveBeenCalledWith(5);
		expect(slider.disabled).toBe(true);
		// internalValue must reset back to the committed value (5) via the
		// sync effect once isDragging is false.
		expect(slider.value).toBe('5');
		// The pending idle/throttle timers must not fire stale callbacks.
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 50);
		expect(onchange).not.toHaveBeenCalled();
		// ondraft was called exactly once (the restore in cancelDrag) — no
		// stale throttle or idle callback fires after timer advance.
		expect(ondraft).toHaveBeenCalledTimes(1);
		expect(ondraft).toHaveBeenCalledWith(5);
	});

	it('live policy: ondraft fires immediately with the new value', async () => {
		const ondraft = vi.fn();
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'live' as const,
				ondraft,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		await setSliderValue(slider, 6);
		expect(ondraft).toHaveBeenCalledWith(6);
		expect(onchange).toHaveBeenCalledWith(6);
	});

	it('pointer drag: idle commit timer is NOT armed during pointer interaction', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Simulate a pointer drag: pointerdown → input → pause → pointerup/change.
		// The idle timer must not arm during a pointer drag, so a 500ms pause
		// mid-drag must NOT trigger endDrag/commit while the pointer is down.
		await fireEvent.pointerDown(slider);
		await setSliderValue(slider, 8);
		// Advance past the idle commit window — onchange must NOT fire because
		// the idle timer was never armed (pointerActive is true).
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 50);
		expect(onchange).not.toHaveBeenCalled();
		// Release the pointer → change event → endDrag → commit fires.
		await fireEvent.pointerUp(slider);
		await releaseSlider(slider);
		expect(onchange).toHaveBeenCalledWith(8);
	});

	it('pointerup without change: commits the drag so the slider does not stay stuck', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Start a pointer drag — isDragging=true, pointerActive=true.
		await fireEvent.pointerDown(slider);
		await setSliderValue(slider, 8);
		// Release the pointer WITHOUT a change event (e.g. the user drags
		// away and back to the original value, so the browser does not fire
		// change). handlePointerUp must call endDrag to commit the drag;
		// otherwise isDragging stays true and the shell stays frozen.
		await fireEvent.pointerUp(slider);
		expect(onchange).toHaveBeenCalledWith(8);
		// Advancing timers must not fire a stale idle commit — the drag
		// already ended.
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 50);
		expect(onchange).toHaveBeenCalledTimes(1);
	});

	it('pointerup without change: no-op when no input preceded it (no drag started)', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// pointerdown with no input — isDragging stays false. pointerup
		// must not fire onchange (endDrag returns early). pointerActive is
		// cleared so a subsequent keyboard edit arms the idle timer.
		await fireEvent.pointerDown(slider);
		await fireEvent.pointerUp(slider);
		expect(onchange).not.toHaveBeenCalled();
		// A keyboard edit after the aborted pointer press must arm the idle
		// timer and commit normally.
		await setSliderValue(slider, 7);
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 10);
		expect(onchange).toHaveBeenCalledWith(7);
	});

	it('pointerdown captures the pointer so release outside the input still commits', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Stub setPointerCapture — jsdom may not implement it, so assign a
		// mock directly to verify the handler calls it on pointerdown.
		const captureSpy = vi.fn();
		slider.setPointerCapture = captureSpy;
		await fireEvent.pointerDown(slider);
		expect(captureSpy).toHaveBeenCalled();
	});

	it('pointercancel: discards the in-progress draft and ends the drag', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		const ondraft = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				ondraft,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Start a pointer drag — pointerActive=true so the idle commit timer
		// is never armed (pointer drags commit via `change` on release).
		await fireEvent.pointerDown(slider);
		await setSliderValue(slider, 8);
		// Cancel the pointer stream (browser gesture takeover, touch
		// interruption, OS-level cancel). cancelDrag must discard the
		// in-progress draft, clear drag state + timers, and restore the
		// parent draft to the committed value (5). Without this handler the
		// idle timer would never arm (pointerActive stayed true) and the
		// drag would never end — leaving the shell frozen.
		await fireEvent.pointerCancel(slider);
		expect(onchange).not.toHaveBeenCalled();
		expect(ondraft).toHaveBeenCalledWith(5);
		// internalValue reverts to the committed value via the sync effect
		// once isDragging is false.
		expect(slider.value).toBe('5');
		// Advancing timers must not fire any stale commit — the drag was
		// discarded, not committed.
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 50);
		expect(onchange).not.toHaveBeenCalled();
	});

	it('pointercancel without a preceding input: clears pointerActive so keyboard edits arm the idle timer', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// pointerdown with no input yet — isDragging stays false but
		// pointerActive is true. A pointercancel here must clear
		// pointerActive so a subsequent keyboard edit arms the idle timer.
		await fireEvent.pointerDown(slider);
		await fireEvent.pointerCancel(slider);
		// A keyboard edit (no pointerdown) must arm the idle commit timer.
		await setSliderValue(slider, 7);
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 10);
		expect(onchange).toHaveBeenCalledWith(7);
	});

	it('lostpointercapture without a preceding pointerup: discards the in-progress draft', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		const ondraft = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				ondraft,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Start a pointer drag — pointerActive=true so the idle commit timer
		// is never armed (pointer drags commit via `change` on release).
		await fireEvent.pointerDown(slider);
		await setSliderValue(slider, 8);
		// Fire lostpointercapture WITHOUT a preceding pointerup/pointercancel
		// (e.g. capture stolen by another element, or the pointer removed
		// implicitly). handlePointerCancel must discard the in-progress
		// draft, clear drag state + timers, and restore the parent draft to
		// the committed value (5) — otherwise isDragging stays true and the
		// shell stays frozen with Save/Share/Snapshot disabled.
		await fireEvent.lostPointerCapture(slider);
		expect(onchange).not.toHaveBeenCalled();
		expect(ondraft).toHaveBeenCalledWith(5);
		// internalValue reverts to the committed value via the sync effect
		// once isDragging is false.
		expect(slider.value).toBe('5');
		// Advancing timers must not fire any stale commit — the drag was
		// discarded, not committed.
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 50);
		expect(onchange).not.toHaveBeenCalled();
	});

	it('lostpointercapture after a normal pointerup is a no-op (no double commit)', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Normal pointer drag: pointerdown → input → pointerup → change.
		await fireEvent.pointerDown(slider);
		await setSliderValue(slider, 8);
		await fireEvent.pointerUp(slider);
		await releaseSlider(slider);
		expect(onchange).toHaveBeenCalledWith(8);
		expect(onchange).toHaveBeenCalledTimes(1);
		// The browser fires lostpointercapture AFTER pointerup. endDrag/
		// commit already set isDragging=false, so handlePointerCancel →
		// cancelDrag returns early — no second commit.
		await fireEvent.lostPointerCapture(slider);
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 50);
		expect(onchange).toHaveBeenCalledTimes(1);
	});

	it('cancelDrag restores the parent draft after a throttled preview fired', async () => {
		vi.useFakeTimers();
		const ondraft = vi.fn();
		const onchange = vi.fn();
		const { rerender } = render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				disabled: false,
				ondraft,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Start a preview drag — throttle pending, internalValue=9.
		await setSliderValue(slider, 9);
		expect(ondraft).not.toHaveBeenCalled();
		// Advance past the throttle window — ondraft fires with the intermediate
		// value (9), updating the parent draftValues.
		vi.advanceTimersByTime(PREVIEW_THROTTLE_MS + 10);
		expect(ondraft).toHaveBeenCalledWith(9);
		// Disabling mid-drag must discard the draft and restore the parent
		// draftValues to the committed value (5) via ondraft.
		rerender({ disabled: true });
		await tick();
		expect(onchange).not.toHaveBeenCalled();
		expect(ondraft).toHaveBeenCalledWith(5);
		// ondraft was called twice: once for the throttled draft (9), once for
		// the restore (5). No stale callbacks fire after timer advance.
		expect(ondraft).toHaveBeenCalledTimes(2);
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 50);
		expect(ondraft).toHaveBeenCalledTimes(2);
		expect(onchange).not.toHaveBeenCalled();
	});

	it('unmount mid-drag after throttle emitted: restores the parent draft to the committed value', async () => {
		vi.useFakeTimers();
		const ondraft = vi.fn();
		const onchange = vi.fn();
		const { unmount } = render(ParameterSlider, {
			props: {
				id: 'test',
				label: 'Test',
				value: 5,
				min: 0,
				max: 10,
				step: 1,
				updatePolicy: 'preview' as const,
				ondraft,
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Start a preview drag — throttle pending, internalValue=9.
		await setSliderValue(slider, 9);
		expect(ondraft).not.toHaveBeenCalled();
		// Advance past the throttle window — ondraft fires with the intermediate
		// value (9), updating the parent draftValues.
		vi.advanceTimersByTime(PREVIEW_THROTTLE_MS + 10);
		expect(ondraft).toHaveBeenCalledWith(9);
		// Unmount the slider mid-drag (e.g. a config load swaps the slider
		// set). The unmount cleanup must restore the parent draft to the
		// committed value (5) via ondraft — mirroring cancelDrag — so the
		// stale intermediate (9) does not linger in draftValues. No commit
		// (onchange) must fire.
		unmount();
		expect(onchange).not.toHaveBeenCalled();
		expect(ondraft).toHaveBeenCalledWith(5);
		// ondraft was called twice: once for the throttled draft (9), once for
		// the unmount restore (5). No stale callbacks fire after timer advance.
		expect(ondraft).toHaveBeenCalledTimes(2);
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 50);
		expect(ondraft).toHaveBeenCalledTimes(2);
		expect(onchange).not.toHaveBeenCalled();
	});
});
