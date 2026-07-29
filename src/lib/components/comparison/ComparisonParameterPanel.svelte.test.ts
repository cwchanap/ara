import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { PANEL_STORAGE_KEYS } from '$lib/chaos-panel-storage';
import { resetPanelOpenStoresForTests } from '$lib/chaos-panel-open-store';
import ComparisonParameterPanel from './ComparisonParameterPanel.svelte';

const childSnippet = createRawSnippet(() => ({
	render: () => '<div data-testid="child-content">Child Controls</div>'
}));

const equationsSnippet = createRawSnippet(() => ({
	render: () => '<div data-testid="equations-content">dx/dt = σ(y−x)</div>'
}));

beforeEach(() => {
	resetPanelOpenStoresForTests();
	localStorage.clear();
});

afterEach(() => {
	cleanup();
	resetPanelOpenStoresForTests();
});

describe('ComparisonParameterPanel', () => {
	it('renders the default title PARAMETERS', () => {
		render(ComparisonParameterPanel, { props: { side: 'left', children: childSnippet } });
		expect(screen.getByText('PARAMETERS')).toBeInTheDocument();
	});

	it('renders the title as a compact level 3 heading containing the toggle', () => {
		render(ComparisonParameterPanel, { props: { side: 'left', children: childSnippet } });
		const heading = screen.getByRole('heading', { level: 3, name: /PARAMETERS/i });
		const toggle = screen.getByRole('button', { name: /PARAMETERS/i });
		expect(heading).toContainElement(toggle);
		expect(toggle).toHaveClass('text-sm');
	});

	it('renders a custom title when provided', () => {
		render(ComparisonParameterPanel, {
			props: { side: 'left', title: 'LORENZ_CONTROLS', children: childSnippet }
		});
		expect(screen.getByText('LORENZ_CONTROLS')).toBeInTheDocument();
	});

	it('renders the children snippet content', () => {
		render(ComparisonParameterPanel, { props: { side: 'left', children: childSnippet } });
		expect(screen.getByTestId('child-content')).toBeInTheDocument();
		expect(screen.getByText('Child Controls')).toBeInTheDocument();
	});

	it('renders the equations snippet when provided', () => {
		render(ComparisonParameterPanel, {
			props: { side: 'left', children: childSnippet, equations: equationsSnippet }
		});
		expect(screen.getByTestId('equations-content')).toBeInTheDocument();
	});

	it('does not render equations section when equations prop is omitted', () => {
		render(ComparisonParameterPanel, { props: { side: 'left', children: childSnippet } });
		expect(screen.queryByTestId('equations-content')).not.toBeInTheDocument();
	});

	it('requires side-derived body id and collapses children + equations', async () => {
		render(ComparisonParameterPanel, {
			props: {
				side: 'left',
				title: 'LEFT_PARAMETERS',
				children: childSnippet,
				equations: equationsSnippet
			}
		});
		expect(document.getElementById('chaos-panel-parameters-body-left')).toBeTruthy();
		expect(screen.getByTestId('child-content')).toBeVisible();
		expect(screen.getByTestId('equations-content')).toBeVisible();
		const toggle = screen.getByRole('button', { name: /LEFT_PARAMETERS/i });
		await fireEvent.click(toggle);
		expect(
			document
				.getElementById('chaos-panel-parameters-body-left')!
				.classList.contains('hidden')
		).toBe(true);
		expect(localStorage.getItem(PANEL_STORAGE_KEYS.parameters)).toBe('false');
	});

	it('live-syncs left and right panels on the parameters key', async () => {
		const { container } = render(ComparisonParameterPanel, {
			props: { side: 'left', title: 'LEFT_PARAMETERS', children: childSnippet }
		});
		const mount = document.createElement('div');
		container.appendChild(mount);
		render(ComparisonParameterPanel, {
			target: mount,
			props: { side: 'right', title: 'RIGHT_PARAMETERS', children: childSnippet }
		});
		expect(document.getElementById('chaos-panel-parameters-body-left')).toBeTruthy();
		expect(document.getElementById('chaos-panel-parameters-body-right')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: /LEFT_PARAMETERS/i }));
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /LEFT_PARAMETERS/i })).toHaveAttribute(
				'aria-expanded',
				'false'
			);
			expect(screen.getByRole('button', { name: /RIGHT_PARAMETERS/i })).toHaveAttribute(
				'aria-expanded',
				'false'
			);
		});
	});
});
