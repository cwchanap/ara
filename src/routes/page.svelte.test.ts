import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';

vi.mock('$app/paths', () => ({ base: '' }));

describe('Homepage (+page.svelte)', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders the main CHAOS_THEORY heading', () => {
		render(Page);
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('CHAOS_THEORY');
	});

	it('renders the VISUALIZATIONS subtitle', () => {
		render(Page);
		expect(screen.getByText('VISUALIZATIONS')).toBeInTheDocument();
	});

	it('renders the descriptive tagline', () => {
		render(Page);
		expect(
			screen.getByText(/Explore the beautiful complexity of mathematical chaos/)
		).toBeInTheDocument();
	});

	it('renders all 13 visualization cards', () => {
		render(Page);
		const links = screen.getAllByRole('link');
		expect(links).toHaveLength(13);
	});

	it('shows the Ikeda Map card linking to /ikeda', () => {
		render(Page);
		const link = screen.getByRole('link', { name: /Ikeda Map/i });
		expect(link.getAttribute('href')).toContain('/ikeda');
	});

	const visualizations = [
		{ name: 'Lorenz Attractor', url: '/lorenz' },
		{ name: 'Hénon Map', url: '/henon' },
		{ name: 'Lozi Map', url: '/lozi' },
		{ name: 'Ikeda Map', url: '/ikeda' },
		{ name: 'Logistic Map', url: '/logistic' },
		{ name: 'Bifurcation (Logistic)', url: '/bifurcation-logistic' },
		{ name: 'Bifurcation (Hénon)', url: '/bifurcation-henon' },
		{ name: 'Newton Fractal', url: '/newton' },
		{ name: 'Standard Map', url: '/standard' },
		{ name: 'Chaos Esthetique', url: '/chaos-esthetique' },
		{ name: 'Rössler Attractor', url: '/rossler' },
		{ name: 'Lyapunov Exponents', url: '/lyapunov' },
		{ name: 'Chua Circuit', url: '/chua' }
	];

	for (const { name, url } of visualizations) {
		it(`renders "${name}" card with correct link`, () => {
			render(Page);
			const link = screen.getByRole('link', {
				name: new RegExp(name.replace(/[()]/g, '\\$&'))
			});
			expect(link).toBeInTheDocument();
			expect(link).toHaveAttribute('href', url);
		});
	}

	it('renders "Initialize Module" call-to-action on each card', () => {
		render(Page);
		const ctaElements = screen.getAllByText('Initialize Module');
		expect(ctaElements).toHaveLength(13);
	});

	it('renders card descriptions', () => {
		render(Page);
		expect(
			screen.getByText('A 3D chaotic system exhibiting butterfly effect')
		).toBeInTheDocument();
		expect(
			screen.getByText('A 2D discrete-time dynamical system with strange attractor')
		).toBeInTheDocument();
	});
});
