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

	it('calls onReset when Reset button is clicked', async () => {
		const onReset = vi.fn();
		const { getByText } = render(InitialStateControls, {
			props: { ...baseProps, onReset }
		});
		await fireEvent.click(getByText('Reset'));
		expect(onReset).toHaveBeenCalled();
	});

	it('calls onChange when valid numeric input is typed', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(InitialStateControls, {
			props: { ...baseProps, onChange }
		});
		const xInput = getByLabelText('x₀');
		await fireEvent.input(xInput, { target: { value: '1.5' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ x0: 1.5 }));
	});

	it('does not call onChange for intermediate input strings like empty, dot, or minus', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(InitialStateControls, {
			props: { ...baseProps, onChange }
		});
		const xInput = getByLabelText('x₀');
		await fireEvent.input(xInput, { target: { value: '' } });
		await fireEvent.input(xInput, { target: { value: '-' } });
		await fireEvent.input(xInput, { target: { value: '.' } });
		expect(onChange).not.toHaveBeenCalled();
	});

	it('does not call onChange for invalid non-finite numbers', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(InitialStateControls, {
			props: { ...baseProps, onChange }
		});
		const xInput = getByLabelText('x₀') as HTMLInputElement;
		// Temporarily change input type to 'text' so jsdom doesn't coerce
		// 'NaN' and 'Infinity' to '' for type="number" inputs.
		xInput.type = 'text';
		await fireEvent.input(xInput, { target: { value: 'NaN' } });
		expect(onChange).not.toHaveBeenCalled();
		await fireEvent.input(xInput, { target: { value: 'Infinity' } });
		expect(onChange).not.toHaveBeenCalled();
	});

	it('calls onChange for y₀, z₀ and epsilon inputs', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(InitialStateControls, {
			props: { ...baseProps, onChange }
		});
		await fireEvent.input(getByLabelText('y₀'), { target: { value: '2.5' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ y0: 2.5 }));

		onChange.mockClear();
		await fireEvent.input(getByLabelText('z₀'), { target: { value: '3.5' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ z0: 3.5 }));

		onChange.mockClear();
		await fireEvent.input(getByLabelText('ε'), { target: { value: '0.01' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ epsilon: 0.01 }));
	});
});
