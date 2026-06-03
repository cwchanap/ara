import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import VisualizationAlerts from './VisualizationAlerts.svelte';

describe('VisualizationAlerts', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('dismisses save success toast', async () => {
		const onDismissSaveSuccess = vi.fn();

		render(VisualizationAlerts, {
			props: {
				saveSuccess: true,
				onDismissSaveSuccess
			}
		});

		expect(screen.getByText('Configuration saved successfully!')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss success' }));

		expect(onDismissSaveSuccess).toHaveBeenCalledTimes(1);
	});

	it('dismisses save error toast', async () => {
		const onDismissSaveError = vi.fn();

		render(VisualizationAlerts, {
			props: {
				saveError: 'Save failed',
				onDismissSaveError
			}
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss save error' }));

		expect(onDismissSaveError).toHaveBeenCalledTimes(1);
	});

	it('dismisses config error alert', async () => {
		const onDismissConfigError = vi.fn();

		render(VisualizationAlerts, {
			props: {
				configErrors: ['Invalid config'],
				showConfigError: true,
				onDismissConfigError
			}
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss config error' }));

		expect(onDismissConfigError).toHaveBeenCalledTimes(1);
	});

	it('dismisses stability warning alert', async () => {
		const onDismissStabilityWarning = vi.fn();

		render(VisualizationAlerts, {
			props: {
				stabilityWarnings: ['Unstable'],
				showStabilityWarning: true,
				onDismissStabilityWarning
			}
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss warning' }));

		expect(onDismissStabilityWarning).toHaveBeenCalledTimes(1);
	});

	it('dismisses divergence alert', async () => {
		const onDismissDiverged = vi.fn();

		render(VisualizationAlerts, {
			props: {
				diverged: true,
				onDismissDiverged
			}
		});

		expect(screen.getByText('INTEGRATION_DIVERGED')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss divergence alert' }));

		expect(onDismissDiverged).toHaveBeenCalledTimes(1);
	});

	it('uses default fallback callbacks without throwing when clicked', async () => {
		// Render with all alerts open but no callbacks provided.
		render(VisualizationAlerts, {
			props: {
				saveSuccess: true,
				saveError: 'Error',
				configErrors: ['Config error'],
				showConfigError: true,
				stabilityWarnings: ['Stability warning'],
				showStabilityWarning: true,
				diverged: true
			}
		});

		// Trigger all clicks, they should run default empty functions and not error.
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss success' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss config error' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss warning' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss divergence alert' }));
	});
});
