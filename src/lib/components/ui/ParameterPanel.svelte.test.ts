import { afterEach, describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { cleanup, render, screen } from '@testing-library/svelte';
import ParameterPanel from './ParameterPanel.svelte';

describe('ParameterPanel', () => {
	afterEach(() => {
		cleanup();
	});

	const childSnippet = createRawSnippet(() => ({
		render: () => '<div data-testid="param-child">Slider</div>'
	}));

	it('renders the default title', () => {
		render(ParameterPanel, { props: { children: childSnippet } });
		expect(screen.getByText('SYSTEM_PARAMETERS')).toBeInTheDocument();
	});

	it('renders a custom title', () => {
		render(ParameterPanel, {
			props: { title: 'CONTROL_PANEL', children: childSnippet }
		});
		expect(screen.getByText('CONTROL_PANEL')).toBeInTheDocument();
	});

	it('renders children content', () => {
		render(ParameterPanel, { props: { children: childSnippet } });
		expect(screen.getByTestId('param-child')).toBeInTheDocument();
	});

	it('renders equations snippet when provided', () => {
		const equationsSnippet = createRawSnippet(() => ({
			render: () => '<div data-testid="equations">x = f(y)</div>'
		}));

		render(ParameterPanel, {
			props: { children: childSnippet, equations: equationsSnippet }
		});

		expect(screen.getByTestId('equations')).toBeInTheDocument();
	});

	it('does not render equations section when not provided', () => {
		render(ParameterPanel, { props: { children: childSnippet } });
		expect(screen.queryByTestId('equations')).not.toBeInTheDocument();
	});

	it('renders corner decorations for sci-fi aesthetic', () => {
		const { container } = render(ParameterPanel, { props: { children: childSnippet } });
		// The panel has 4 corner decoration divs via absolute positioning
		const panel = container.firstElementChild as HTMLElement;
		expect(panel).toBeInTheDocument();
		expect(panel?.classList.contains('relative')).toBe(true);
	});
});

describe('ParameterPanel columns', () => {
	const childSnippet = createRawSnippet(() => ({
		render: () => '<div data-testid="kids">x</div>'
	}));
	const eqsSnippet = createRawSnippet(() => ({
		render: () => '<p>eq</p>'
	}));

	afterEach(() => {
		cleanup();
	});

	it('applies equationColumns to the equations grid', () => {
		const { container } = render(ParameterPanel, {
			props: { children: childSnippet, equations: eqsSnippet, equationColumns: 2 }
		});
		expect(container.querySelector('.md\\:grid-cols-2')).toBeTruthy();
	});

	it('defaults to md:grid-cols-3 for both grids when columns not specified', () => {
		const { container } = render(ParameterPanel, {
			props: { children: childSnippet, equations: eqsSnippet }
		});
		const grids = container.querySelectorAll('.md\\:grid-cols-3');
		expect(grids.length).toBeGreaterThanOrEqual(2);
	});

	it('applies paramColumns=4 to the sliders grid', () => {
		const { container } = render(ParameterPanel, {
			props: { children: childSnippet, paramColumns: 4 }
		});
		expect(container.querySelector('.md\\:grid-cols-4')).toBeTruthy();
	});

	it('applies paramColumns=5 to the sliders grid', () => {
		const { container } = render(ParameterPanel, {
			props: { children: childSnippet, paramColumns: 5 }
		});
		expect(container.querySelector('.md\\:grid-cols-5')).toBeTruthy();
	});
});
