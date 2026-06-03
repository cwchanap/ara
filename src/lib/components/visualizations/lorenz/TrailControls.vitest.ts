// src/lib/components/visualizations/lorenz/TrailControls.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import TrailControls from './TrailControls.svelte';

const base = {
	trailLength: 15000,
	trailStyle: 'comet' as const,
	onLengthChange: vi.fn(),
	onStyleChange: vi.fn()
};

describe('TrailControls', () => {
	afterEach(() => cleanup());

	it('renders the TRAIL_LENGTH title and current length', () => {
		const { getByText } = render(TrailControls, { props: { ...base } });
		expect(getByText('TRAIL_LENGTH')).toBeTruthy();
		expect(getByText(/15000|15,000/)).toBeTruthy();
	});

	it('calls onStyleChange when switching to cumulative', async () => {
		const onStyleChange = vi.fn();
		const { getByText } = render(TrailControls, { props: { ...base, onStyleChange } });
		await fireEvent.click(getByText(/Cumulative/i));
		expect(onStyleChange).toHaveBeenCalledWith('cumulative');
	});

	it('calls onLengthChange when sliding the input', async () => {
		const onLengthChange = vi.fn();
		const { getByRole } = render(TrailControls, { props: { ...base, onLengthChange } });
		const slider = getByRole('slider');
		await fireEvent.input(slider, { target: { value: '25000' } });
		expect(onLengthChange).toHaveBeenCalledWith(25000);
	});

	it('calls onStyleChange when switching to comet', async () => {
		const onStyleChange = vi.fn();
		const { getByText } = render(TrailControls, {
			props: { ...base, trailStyle: 'cumulative', onStyleChange }
		});
		await fireEvent.click(getByText(/Comet/i));
		expect(onStyleChange).toHaveBeenCalledWith('comet');
	});
});
