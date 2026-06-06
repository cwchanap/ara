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
});
