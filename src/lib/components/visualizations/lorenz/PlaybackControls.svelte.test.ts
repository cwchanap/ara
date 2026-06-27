// src/lib/components/visualizations/lorenz/PlaybackControls.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import PlaybackControls from './PlaybackControls.svelte';

const base = {
	isPlaying: true,
	speed: 1,
	onTogglePlay: vi.fn(),
	onStep: vi.fn(),
	onReset: vi.fn(),
	onSpeedChange: vi.fn()
};

describe('PlaybackControls', () => {
	afterEach(() => cleanup());

	it('shows Pause when playing and Play when paused', () => {
		const { getByText, rerender } = render(PlaybackControls, {
			props: { ...base, isPlaying: true }
		});
		expect(getByText(/Pause/i)).toBeTruthy();
		rerender({ ...base, isPlaying: false });
		expect(getByText(/Play/i)).toBeTruthy();
	});

	it('calls onStep and onReset', async () => {
		const onStep = vi.fn();
		const onReset = vi.fn();
		const { getByText } = render(PlaybackControls, { props: { ...base, onStep, onReset } });
		await fireEvent.click(getByText('Step'));
		await fireEvent.click(getByText('Reset'));
		expect(onStep).toHaveBeenCalled();
		expect(onReset).toHaveBeenCalled();
	});

	it('calls onTogglePlay when Play/Pause button is clicked', async () => {
		const onTogglePlay = vi.fn();
		const { getByText } = render(PlaybackControls, {
			props: { ...base, isPlaying: true, onTogglePlay }
		});
		await fireEvent.click(getByText('Pause'));
		expect(onTogglePlay).toHaveBeenCalledTimes(1);
	});

	it('calls onTogglePlay when Play button is clicked (paused state)', async () => {
		const onTogglePlay = vi.fn();
		const { getByText } = render(PlaybackControls, {
			props: { ...base, isPlaying: false, onTogglePlay }
		});
		await fireEvent.click(getByText('Play'));
		expect(onTogglePlay).toHaveBeenCalledTimes(1);
	});

	it('calls onSpeedChange when speed slider is moved', async () => {
		const onSpeedChange = vi.fn();
		const { container } = render(PlaybackControls, {
			props: { ...base, speed: 1, onSpeedChange }
		});
		const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '2.5' } });
		expect(onSpeedChange).toHaveBeenCalledWith(2.5);
	});
});
