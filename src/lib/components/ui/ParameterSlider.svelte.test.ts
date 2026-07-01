import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import ParameterSlider from './ParameterSlider.svelte';

afterEach(() => {
	cleanup();
	vi.useRealTimers();
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
	});

	it('calls onchange with the final value after the debounce period', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, { props: { ...defaultProps, debounce: true, onchange } });
		const input = screen.getByRole('slider');
		await fireEvent.input(input, { target: { value: '25' } });
		vi.advanceTimersByTime(51); // SLIDER_DEBOUNCE_MS is 50
		expect(onchange).toHaveBeenCalledWith(25);
		expect(onchange).toHaveBeenCalledTimes(1);
	});

	it('debounces rapid inputs — only the last value triggers onchange', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, { props: { ...defaultProps, debounce: true, onchange } });
		const input = screen.getByRole('slider');
		await fireEvent.input(input, { target: { value: '10' } });
		await fireEvent.input(input, { target: { value: '20' } });
		await fireEvent.input(input, { target: { value: '30' } });
		vi.advanceTimersByTime(51);
		expect(onchange).toHaveBeenCalledTimes(1);
		expect(onchange).toHaveBeenCalledWith(30);
	});

	it('respects a custom debounceMs value', async () => {
		vi.useFakeTimers();
		const onchange = vi.fn();
		render(ParameterSlider, {
			props: { ...defaultProps, debounce: true, debounceMs: 200, onchange }
		});
		const input = screen.getByRole('slider');
		await fireEvent.input(input, { target: { value: '15' } });
		vi.advanceTimersByTime(100); // less than custom 200ms → not yet fired
		expect(onchange).not.toHaveBeenCalled();
		vi.advanceTimersByTime(101); // now past 200ms total
		expect(onchange).toHaveBeenCalledWith(15);
	});
});

describe('ParameterSlider no-debounce + id', () => {
	it('uses the provided id on the input and label for', () => {
		const { container } = render(ParameterSlider, {
			props: { id: 'param-a', label: 'a', value: 1, min: 0, max: 2, step: 0.1, decimals: 3 }
		});
		expect(container.querySelector('input[id="param-a"]')).toBeTruthy();
		expect(container.querySelector('label[for="param-a"]')).toBeTruthy();
	});

	it('commits value immediately and shows formatted value when debounce=false', async () => {
		const { container } = render(ParameterSlider, {
			props: {
				id: 'a',
				label: 'a',
				value: 1,
				min: 0,
				max: 2,
				step: 0.001,
				decimals: 3,
				debounce: false
			}
		});
		const input = container.querySelector('input[id="a"]') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '1.5' } });
		expect(screen.getByText('1.500')).toBeInTheDocument();
	});
});
