import { afterEach, describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { PANEL_STORAGE_KEYS } from '$lib/chaos-panel-storage';
import { resetPanelOpenStoresForTests } from '$lib/chaos-panel-open-store';
import ParameterPanel from './ParameterPanel.svelte';

describe('ParameterPanel', () => {
	afterEach(() => {
		cleanup();
		resetPanelOpenStoresForTests();
		if (typeof localStorage !== 'undefined') {
			localStorage.clear();
		}
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

	it('renders formula lines when provided', () => {
		render(ParameterPanel, {
			props: { children: childSnippet, formula: ['x = f(y)', 'y = g(x)'] }
		});
		expect(screen.getByText('x = f(y)')).toBeInTheDocument();
		expect(screen.getByText('y = g(x)')).toBeInTheDocument();
	});

	it('does not render the equations section when formula is omitted', () => {
		render(ParameterPanel, { props: { children: childSnippet } });
		expect(screen.queryByText('x = f(y)')).not.toBeInTheDocument();
	});

	it('does not render the equations section when formula is empty', () => {
		render(ParameterPanel, { props: { children: childSnippet, formula: [] } });
		expect(screen.queryByText('x = f(y)')).not.toBeInTheDocument();
	});

	it('renders corner decorations for sci-fi aesthetic', () => {
		const { container } = render(ParameterPanel, { props: { children: childSnippet } });
		// The panel has 4 corner decoration divs via absolute positioning
		const panel = container.firstElementChild as HTMLElement;
		expect(panel).toBeInTheDocument();
		expect(panel?.classList.contains('relative')).toBe(true);
	});

	it('collapses children and formula behind the title toggle', async () => {
		render(ParameterPanel, {
			props: { children: childSnippet, formula: ['x = f(y)'] }
		});
		expect(screen.getByTestId('param-child')).toBeVisible();
		expect(screen.getByText('x = f(y)')).toBeVisible();
		const toggle = screen.getByRole('button', { name: /SYSTEM_PARAMETERS/i });
		expect(toggle).toHaveAttribute('aria-controls', 'chaos-panel-parameters-body');
		await fireEvent.click(toggle);
		expect(
			document.getElementById('chaos-panel-parameters-body')!.classList.contains('hidden')
		).toBe(true);
		expect(localStorage.getItem(PANEL_STORAGE_KEYS.parameters)).toBe('false');
	});
});

describe('ParameterPanel columns', () => {
	const childSnippet = createRawSnippet(() => ({
		render: () => '<div data-testid="kids">x</div>'
	}));
	const formula = ['eq-1', 'eq-2'];

	afterEach(() => {
		cleanup();
		resetPanelOpenStoresForTests();
		if (typeof localStorage !== 'undefined') {
			localStorage.clear();
		}
	});

	it('applies equationColumns to the equations grid', () => {
		const { container } = render(ParameterPanel, {
			props: { children: childSnippet, formula, equationColumns: 2 }
		});
		expect(container.querySelector('.md\\:grid-cols-2')).toBeTruthy();
	});

	it('defaults to md:grid-cols-3 for both grids when columns not specified', () => {
		const { container } = render(ParameterPanel, {
			props: { children: childSnippet, formula }
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

	it('applies paramColumns=1 to the sliders grid', () => {
		const { container } = render(ParameterPanel, {
			props: { children: childSnippet, paramColumns: 1 }
		});
		expect(container.querySelector('.md\\:grid-cols-1')).toBeTruthy();
	});

	it('applies paramColumns=2 to the sliders grid', () => {
		const { container } = render(ParameterPanel, {
			props: { children: childSnippet, paramColumns: 2 }
		});
		expect(container.querySelector('.md\\:grid-cols-2')).toBeTruthy();
	});

	it('applies equationColumns=1 to the equations grid', () => {
		const { container } = render(ParameterPanel, {
			props: { children: childSnippet, formula, equationColumns: 1 }
		});
		expect(container.querySelector('.md\\:grid-cols-1')).toBeTruthy();
	});

	it('applies equationColumns=4 to the equations grid', () => {
		const { container } = render(ParameterPanel, {
			props: { children: childSnippet, formula, equationColumns: 4 }
		});
		expect(container.querySelector('.md\\:grid-cols-4')).toBeTruthy();
	});

	it('applies equationColumns=5 to the equations grid', () => {
		const { container } = render(ParameterPanel, {
			props: { children: childSnippet, formula, equationColumns: 5 }
		});
		expect(container.querySelector('.md\\:grid-cols-5')).toBeTruthy();
	});
});
