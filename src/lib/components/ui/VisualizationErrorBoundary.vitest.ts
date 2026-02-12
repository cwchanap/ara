import { afterEach, describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { cleanup, render, screen } from '@testing-library/svelte';
import VisualizationErrorBoundary from './VisualizationErrorBoundary.svelte';

describe('VisualizationErrorBoundary', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders children when no error occurs', () => {
		const child = createRawSnippet(() => ({
			render: () => '<div data-testid="child">OK</div>'
		}));

		render(VisualizationErrorBoundary, {
			props: {
				mapType: 'lorenz',
				children: child
			}
		});

		expect(screen.getByTestId('child')).toBeInTheDocument();
	});

	// Error boundaries are exercised in E2E; unit test ensures default render path works.
});
