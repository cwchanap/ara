// src/lib/components/visualizations/lorenz/PresetSelector.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import PresetSelector from './PresetSelector.svelte';

describe('PresetSelector', () => {
	afterEach(() => cleanup());

	it('renders all preset buttons', () => {
		const { getByText } = render(PresetSelector, {
			props: { activeId: 'classic', onSelect: vi.fn() }
		});
		expect(getByText('Classic')).toBeTruthy();
		expect(getByText('High Energy')).toBeTruthy();
	});

	it('calls onSelect with the preset σ/ρ/β when clicked', async () => {
		const onSelect = vi.fn();
		const { getByText } = render(PresetSelector, { props: { activeId: 'classic', onSelect } });
		await fireEvent.click(getByText('Stable'));
		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ sigma: 10, rho: 10 }));
	});
});
