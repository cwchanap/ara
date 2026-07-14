import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
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
});
