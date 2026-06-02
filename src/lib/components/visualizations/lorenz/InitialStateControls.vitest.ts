// src/lib/components/visualizations/lorenz/InitialStateControls.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import InitialStateControls from './InitialStateControls.svelte';

const baseProps = {
	x0: 0.1,
	y0: 0,
	z0: 0,
	epsilon: 0.001,
	showGhost: false,
	onChange: vi.fn(),
	onRandomize: vi.fn(),
	onReset: vi.fn()
};

describe('InitialStateControls', () => {
	afterEach(() => cleanup());

	it('renders the INITIAL_STATE title and ghost toggle', () => {
		const { getByText, getByLabelText } = render(InitialStateControls, {
			props: { ...baseProps }
		});
		expect(getByText('INITIAL_STATE')).toBeTruthy();
		expect(getByLabelText(/Show Perturbed Orbit/i)).toBeTruthy();
	});

	it('calls onRandomize when Randomize is clicked', async () => {
		const onRandomize = vi.fn();
		const { getByText } = render(InitialStateControls, {
			props: { ...baseProps, onRandomize }
		});
		await fireEvent.click(getByText('Randomize'));
		expect(onRandomize).toHaveBeenCalled();
	});

	it('calls onChange when the ghost toggle changes', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(InitialStateControls, {
			props: { ...baseProps, onChange }
		});
		await fireEvent.click(getByLabelText(/Show Perturbed Orbit/i));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showGhost: true }));
	});
});
