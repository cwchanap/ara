import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import InfoPanel from './InfoPanel.svelte';

describe('InfoPanel', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders the DATA_LOG prefix with the title', () => {
		render(InfoPanel, {
			props: { title: 'LORENZ_ATTRACTOR', description: 'A chaotic system.' }
		});
		expect(screen.getByText(/DATA_LOG: LORENZ_ATTRACTOR/)).toBeInTheDocument();
	});

	it('renders the description text', () => {
		render(InfoPanel, {
			props: { title: 'HENON_MAP', description: 'A 2D discrete-time dynamical system.' }
		});
		expect(screen.getByText('A 2D discrete-time dynamical system.')).toBeInTheDocument();
	});

	it('renders with different title values', () => {
		render(InfoPanel, {
			props: { title: 'ROSSLER_ATTRACTOR', description: 'Continuous scroll structure.' }
		});
		expect(screen.getByText(/DATA_LOG: ROSSLER_ATTRACTOR/)).toBeInTheDocument();
	});

	it('renders the heading inside an h3 element', () => {
		render(InfoPanel, {
			props: { title: 'LYAPUNOV_EXPONENT', description: 'Quantifying chaos.' }
		});
		expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
			/DATA_LOG: LYAPUNOV_EXPONENT/
		);
	});
});
