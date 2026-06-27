// src/lib/components/visualizations/lorenz/SolverControls.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import SolverControls from './SolverControls.svelte';

const base = {
	solver: 'rk4' as const,
	dt: 0.005,
	stepsPerFrame: 5,
	onChange: vi.fn()
};

describe('SolverControls', () => {
	afterEach(() => cleanup());

	it('renders the NUMERICAL_SOLVER title and solver select', () => {
		const { getByText, getByLabelText } = render(SolverControls, { props: { ...base } });
		expect(getByText('NUMERICAL_SOLVER')).toBeTruthy();
		expect(getByLabelText(/Solver/i)).toBeTruthy();
	});

	it('emits a solver change', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(SolverControls, { props: { ...base, onChange } });
		await fireEvent.change(getByLabelText(/Solver/i), { target: { value: 'euler' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ solver: 'euler' }));
	});

	it('emits a solver change to rk2', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(SolverControls, { props: { ...base, onChange } });
		await fireEvent.change(getByLabelText(/Solver/i), { target: { value: 'rk2' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ solver: 'rk2' }));
	});

	it('emits dt change when dt slider is moved', async () => {
		const onChange = vi.fn();
		const { container } = render(SolverControls, {
			props: { ...base, dt: 0.005, onChange }
		});
		const dtSlider = container.querySelector('[data-testid="slider-dt"]') as HTMLInputElement;
		await fireEvent.input(dtSlider, { target: { value: '0.01' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dt: 0.01 }));
	});

	it('emits stepsPerFrame change when stepsPerFrame slider is moved', async () => {
		const onChange = vi.fn();
		const { container } = render(SolverControls, {
			props: { ...base, stepsPerFrame: 5, onChange }
		});
		// The stepsPerFrame slider is the second range input
		const sliders = container.querySelectorAll('input[type="range"]');
		const stepsSlider = sliders[1] as HTMLInputElement;
		await fireEvent.input(stepsSlider, { target: { value: '20' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ stepsPerFrame: 20 }));
	});
});
