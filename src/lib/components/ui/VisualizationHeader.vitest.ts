import { afterEach, describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { cleanup, render, screen } from '@testing-library/svelte';
import VisualizationHeader from './VisualizationHeader.svelte';

describe('VisualizationHeader', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders the title', () => {
		render(VisualizationHeader, {
			props: { title: 'LORENZ_ATTRACTOR' }
		});
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('LORENZ_ATTRACTOR');
	});

	it('renders module subtitle when moduleNumber is provided', () => {
		render(VisualizationHeader, {
			props: { title: 'HENON_MAP', moduleNumber: '03' }
		});
		expect(screen.getByText(/MODULE_03/)).toBeInTheDocument();
	});

	it('does not render module subtitle when moduleNumber is omitted', () => {
		render(VisualizationHeader, {
			props: { title: 'ROSSLER_ATTRACTOR' }
		});
		expect(screen.queryByText(/MODULE_/)).not.toBeInTheDocument();
	});

	it('renders the Return link pointing to the root', () => {
		render(VisualizationHeader, {
			props: { title: 'LOZI_MAP' }
		});
		const returnLink = screen.getByRole('link', { name: /Return/i });
		expect(returnLink).toBeInTheDocument();
		expect(returnLink).toHaveAttribute('href', '/');
	});

	it('renders children snippet when provided', () => {
		const child = createRawSnippet(() => ({
			render: () => '<button data-testid="action-btn">Share</button>'
		}));

		render(VisualizationHeader, {
			props: { title: 'LORENZ_ATTRACTOR', children: child }
		});

		expect(screen.getByTestId('action-btn')).toBeInTheDocument();
	});

	it('does not render children slot when not provided', () => {
		render(VisualizationHeader, {
			props: { title: 'LORENZ_ATTRACTOR' }
		});
		expect(screen.queryByTestId('action-btn')).not.toBeInTheDocument();
	});
});
