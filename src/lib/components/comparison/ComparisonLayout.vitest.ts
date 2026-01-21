import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import ComparisonLayout from './ComparisonLayout.svelte';
import { cameraSyncStore } from '$lib/stores/camera-sync';

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$app/paths', () => ({
	base: ''
}));

const leftPanel = createRawSnippet(() => ({
	render: () => '<div data-testid="left-panel"></div>'
}));

const rightPanel = createRawSnippet(() => ({
	render: () => '<div data-testid="right-panel"></div>'
}));

const defaultLeftParams = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 8 / 3 };
const defaultRightParams = { type: 'lorenz' as const, sigma: 15, rho: 25, beta: 3 };

const renderLayout = () =>
	render(ComparisonLayout, {
		props: {
			mapType: 'lorenz',
			leftParams: defaultLeftParams,
			rightParams: defaultRightParams,
			showCameraSync: true,
			leftPanel,
			rightPanel
		}
	});

describe('ComparisonLayout', () => {
	beforeEach(() => {
		cameraSyncStore.reset();
	});

	afterEach(() => {
		cleanup();
	});

	it('applies aria state to the camera sync toggle', () => {
		renderLayout();

		const button = screen.getByRole('button', { name: 'Camera sync enabled' });
		expect(button).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByText('🔗')).toHaveAttribute('aria-hidden', 'true');
	});

	it('updates aria state when camera sync is toggled', async () => {
		renderLayout();

		const button = screen.getByRole('button', { name: 'Camera sync enabled' });
		await fireEvent.click(button);

		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Camera sync disabled' })).toHaveAttribute(
				'aria-pressed',
				'false'
			)
		);
		expect(screen.getByText('🔓')).toHaveAttribute('aria-hidden', 'true');
	});
});
