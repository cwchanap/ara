import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import ParameterSlider from './ParameterSlider.svelte';

afterEach(() => {
	cleanup();
});

const defaultProps = {
	id: 'test-slider',
	label: 'Sigma',
	value: 10,
	min: 0,
	max: 50,
	step: 0.1
};

describe('ParameterSlider', () => {
	it('renders label and value', () => {
		render(ParameterSlider, { props: defaultProps });
		expect(screen.getByText('Sigma')).toBeInTheDocument();
	});

	it('renders the range input with correct attributes', () => {
		render(ParameterSlider, { props: defaultProps });
		const input = screen.getByRole('slider') as HTMLInputElement;
		expect(input).toBeInTheDocument();
		expect(input.min).toBe('0');
		expect(input.max).toBe('50');
	});

	it('calls onchange with the new numeric value when input changes (debounce disabled)', async () => {
		const onchange = vi.fn();
		render(ParameterSlider, { props: { ...defaultProps, debounce: false, onchange } });
		const input = screen.getByRole('slider');
		await fireEvent.input(input, { target: { value: '25' } });
		expect(onchange).toHaveBeenCalledWith(25);
	});

	it('displays the initial value with correct decimal places', () => {
		render(ParameterSlider, { props: { ...defaultProps, value: 10, decimals: 2 } });
		expect(screen.getByText('10.00')).toBeInTheDocument();
	});

	it('renders label associated with input via for/id', () => {
		render(ParameterSlider, { props: defaultProps });
		const input = screen.getByLabelText('Sigma') as HTMLInputElement;
		expect(input).toBeInTheDocument();
		expect(input.type).toBe('range');
	});

	it('renders the range input with correct step attribute', () => {
		render(ParameterSlider, { props: defaultProps });
		const input = screen.getByRole('slider') as HTMLInputElement;
		expect(input.step).toBe('0.1');
	});

	it('does not call onchange immediately when debounce is enabled', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, { props: { ...defaultProps, debounce: true, onchange } });
		const input = screen.getByRole('slider');
		await fireEvent.input(input, { target: { value: '25' } });
		// onchange should not be called yet (debounce pending)
		expect(onchange).not.toHaveBeenCalled();
		vi.useRealTimers();
	});
});
