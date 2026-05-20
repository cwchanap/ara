import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet, tick } from 'svelte';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import VisualizationErrorBoundary from './VisualizationErrorBoundary.svelte';

async function captureOnError() {
	// @ts-expect-error svelte/internal/client has no type declarations
	// eslint-disable-next-line svelte/no-svelte-internal
	const svelteClient = await import('svelte/internal/client');
	const origBoundary = svelteClient.boundary;
	let onerror: ((error: unknown, reset: () => void) => void) | null = null;

	vi.spyOn(svelteClient, 'boundary').mockImplementation((...args: unknown[]) => {
		const opts = args[1] as { onerror?: (e: unknown, r: () => void) => void };
		if (opts?.onerror) onerror = opts.onerror;
		return origBoundary.apply(svelteClient, args as [unknown, unknown, unknown]);
	});

	return () => onerror;
}

describe('VisualizationErrorBoundary', () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
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

	it('shows error UI when handleError receives an Error', async () => {
		const getOnError = await captureOnError();

		const child = createRawSnippet(() => ({
			render: () => '<div data-testid="child">OK</div>'
		}));

		render(VisualizationErrorBoundary, {
			props: { mapType: 'lorenz', children: child }
		});

		const onerror = getOnError();
		onerror!(new Error('Test error'), () => {});
		await tick();

		expect(screen.getByText('RENDERING_ERROR')).toBeInTheDocument();
		expect(screen.getByText(/Failed to render lorenz visualization/)).toBeInTheDocument();
		expect(screen.getByText('Test error')).toBeInTheDocument();
		expect(screen.queryByTestId('child')).not.toBeInTheDocument();
	});

	it('shows error UI when handleError receives a non-Error value', async () => {
		const getOnError = await captureOnError();

		const child = createRawSnippet(() => ({
			render: () => '<div data-testid="child">OK</div>'
		}));

		render(VisualizationErrorBoundary, {
			props: { mapType: 'henon', children: child }
		});

		const onerror = getOnError();
		onerror!('string error', () => {});
		await tick();

		expect(screen.getByText('RENDERING_ERROR')).toBeInTheDocument();
		expect(screen.getByText('string error')).toBeInTheDocument();
	});

	it('displays the correct mapType in the error message', async () => {
		const getOnError = await captureOnError();

		const child = createRawSnippet(() => ({
			render: () => '<div data-testid="child">OK</div>'
		}));

		render(VisualizationErrorBoundary, {
			props: { mapType: 'rossler', children: child }
		});

		const onerror = getOnError();
		onerror!(new Error('err'), () => {});
		await tick();

		expect(screen.getByText(/Failed to render rossler visualization/)).toBeInTheDocument();
	});

	it('renders retry button in error UI', async () => {
		const getOnError = await captureOnError();

		const child = createRawSnippet(() => ({
			render: () => '<div data-testid="child">OK</div>'
		}));

		render(VisualizationErrorBoundary, {
			props: { mapType: 'lorenz', children: child }
		});

		const onerror = getOnError();
		onerror!(new Error('err'), () => {});
		await tick();

		const retryBtn = screen.getByRole('button', { name: /retry/i });
		expect(retryBtn).toBeInTheDocument();
	});

	it('restores children after clicking retry', async () => {
		const getOnError = await captureOnError();

		const child = createRawSnippet(() => ({
			render: () => '<div data-testid="child">OK</div>'
		}));

		render(VisualizationErrorBoundary, {
			props: { mapType: 'lorenz', children: child }
		});

		const onerror = getOnError();
		onerror!(new Error('recoverable'), () => {});
		await tick();

		expect(screen.getByText('RENDERING_ERROR')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /retry/i }));
		await tick();

		expect(screen.queryByText('RENDERING_ERROR')).not.toBeInTheDocument();
		expect(screen.getByTestId('child')).toBeInTheDocument();
	});
});
