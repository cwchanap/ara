import { afterEach, describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { cleanup, render, screen } from '@testing-library/svelte';
import VisualizationContainer from './VisualizationContainer.svelte';

describe('VisualizationContainer', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders with default render engine label', () => {
		render(VisualizationContainer, { props: {} });
		expect(screen.getByText(/LIVE_RENDER.*CANVAS/)).toBeInTheDocument();
	});

	it('renders with a custom render engine label', () => {
		render(VisualizationContainer, {
			props: { renderEngine: 'THREE.JS' }
		});
		expect(screen.getByText(/LIVE_RENDER.*THREE_JS/)).toBeInTheDocument();
	});

	it('normalizes render engine name to uppercase with underscores', () => {
		render(VisualizationContainer, {
			props: { renderEngine: 'd3 svg' }
		});
		expect(screen.getByText(/D3_SVG/)).toBeInTheDocument();
	});

	it('applies the specified height style', () => {
		const { container } = render(VisualizationContainer, {
			props: { height: 400 }
		});
		const wrapper = container.firstElementChild as HTMLElement;
		expect(wrapper?.style.height).toBe('400px');
	});

	it('uses the default height of 600px when not specified', () => {
		const { container } = render(VisualizationContainer, { props: {} });
		const wrapper = container.firstElementChild as HTMLElement;
		expect(wrapper?.style.height).toBe('600px');
	});

	it('renders children snippet inside the container', () => {
		const child = createRawSnippet(() => ({
			render: () => '<canvas data-testid="viz-canvas"></canvas>'
		}));

		render(VisualizationContainer, {
			props: { children: child }
		});

		expect(screen.getByTestId('viz-canvas')).toBeInTheDocument();
	});
});
