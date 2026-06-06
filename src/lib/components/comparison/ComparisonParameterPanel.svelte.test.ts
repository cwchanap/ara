import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import ComparisonParameterPanel from './ComparisonParameterPanel.svelte';

afterEach(() => {
	cleanup();
});

const childSnippet = createRawSnippet(() => ({
	render: () => '<div data-testid="child-content">Child Controls</div>'
}));

const equationsSnippet = createRawSnippet(() => ({
	render: () => '<div data-testid="equations-content">dx/dt = σ(y−x)</div>'
}));

describe('ComparisonParameterPanel', () => {
	it('renders the default title PARAMETERS', () => {
		render(ComparisonParameterPanel, { props: { children: childSnippet } });
		expect(screen.getByText('PARAMETERS')).toBeInTheDocument();
	});

	it('renders a custom title when provided', () => {
		render(ComparisonParameterPanel, {
			props: { title: 'LORENZ_CONTROLS', children: childSnippet }
		});
		expect(screen.getByText('LORENZ_CONTROLS')).toBeInTheDocument();
	});

	it('renders the children snippet content', () => {
		render(ComparisonParameterPanel, { props: { children: childSnippet } });
		expect(screen.getByTestId('child-content')).toBeInTheDocument();
		expect(screen.getByText('Child Controls')).toBeInTheDocument();
	});

	it('renders the equations snippet when provided', () => {
		render(ComparisonParameterPanel, {
			props: { children: childSnippet, equations: equationsSnippet }
		});
		expect(screen.getByTestId('equations-content')).toBeInTheDocument();
	});

	it('does not render equations section when equations prop is omitted', () => {
		render(ComparisonParameterPanel, { props: { children: childSnippet } });
		expect(screen.queryByTestId('equations-content')).not.toBeInTheDocument();
	});
});
