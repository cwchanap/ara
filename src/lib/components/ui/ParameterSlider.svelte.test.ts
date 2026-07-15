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

	it('disabled-mid-drag: setting disabled while dragging commits and ends the drag', async () => {
		vi.useFakeTimers();
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
				onchange
			}
		});
		const slider = screen.getByTestId('slider-test') as HTMLInputElement;
		// Start a drag — isDragging=true, throttle pending.
		await setSliderValue(slider, 9);
		expect(onchange).not.toHaveBeenCalled();
		// Disabling mid-drag must immediately commit the in-flight value and
		// end the drag so the parent state is not left stale.
		rerender({ disabled: true });
		await tick();
		expect(onchange).toHaveBeenCalledWith(9);
		expect(slider.disabled).toBe(true);
		// The pending idle timer must not fire a second commit later.
		vi.advanceTimersByTime(PREVIEW_IDLE_COMMIT_MS + 50);
		expect(onchange).toHaveBeenCalledTimes(1);
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
});
