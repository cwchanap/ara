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

	it('triggers onChange("time") fallback when ghost is disabled but divergence is selected', () => {
		const onChange = vi.fn();
		render(ColorModeSelector, {
			props: {
				colorMode: 'divergence',
				ghostEnabled: false,
				onChange
			}
		});
		// Note: $effect is microtask scheduled, so it should run right after render.
		expect(onChange).toHaveBeenCalledWith('time');
	});

	it('selects each mode including single and divergence when ghost is on', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(ColorModeSelector, {
			props: { colorMode: 'time', ghostEnabled: true, onChange }
		});
		await fireEvent.click(getByLabelText(/Single/i));
		expect(onChange).toHaveBeenCalledWith('single');
		onChange.mockClear();
		await fireEvent.click(getByLabelText(/Divergence/i));
		expect(onChange).toHaveBeenCalledWith('divergence');
	});
});
