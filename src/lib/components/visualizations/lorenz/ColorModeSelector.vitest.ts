// src/lib/components/visualizations/lorenz/ColorModeSelector.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import ColorModeSelector from './ColorModeSelector.svelte';

const base = { colorMode: 'time' as const, ghostEnabled: false, onChange: vi.fn() };

describe('ColorModeSelector', () => {
	afterEach(() => cleanup());

	it('renders all five modes', () => {
		const { getByLabelText } = render(ColorModeSelector, { props: { ...base } });
		for (const label of ['Time', 'Speed', 'Z-height', 'Divergence', 'Single']) {
			expect(getByLabelText(new RegExp(label, 'i'))).toBeTruthy();
		}
	});

	it('disables Divergence when ghost is off', () => {
		const { getByLabelText } = render(ColorModeSelector, {
			props: { ...base, ghostEnabled: false }
		});
		expect((getByLabelText(/Divergence/i) as HTMLInputElement).disabled).toBe(true);
	});

	it('emits the chosen mode', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(ColorModeSelector, { props: { ...base, onChange } });
		await fireEvent.click(getByLabelText(/Z-height/i));
		expect(onChange).toHaveBeenCalledWith('zheight');
	});
});
