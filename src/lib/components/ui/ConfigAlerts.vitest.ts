import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import ConfigAlerts from './ConfigAlerts.svelte';

describe('ConfigAlerts', () => {
	afterEach(() => {
		cleanup();
	});

	describe('config error alert', () => {
		it('renders nothing when showConfigError is false', () => {
			render(ConfigAlerts, {
				props: {
					configErrors: ['Error 1'],
					showConfigError: false,
					stabilityWarnings: [],
					showStabilityWarning: false
				}
			});
			expect(screen.queryByText('INVALID_CONFIGURATION')).not.toBeInTheDocument();
		});

		it('renders nothing when configErrors is empty even if showConfigError is true', () => {
			render(ConfigAlerts, {
				props: {
					configErrors: [],
					showConfigError: true,
					stabilityWarnings: [],
					showStabilityWarning: false
				}
			});
			expect(screen.queryByText('INVALID_CONFIGURATION')).not.toBeInTheDocument();
		});

		it('renders config error alert with error messages', () => {
			render(ConfigAlerts, {
				props: {
					configErrors: ['Invalid sigma value', 'Rho out of range'],
					showConfigError: true,
					stabilityWarnings: [],
					showStabilityWarning: false
				}
			});
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
			expect(screen.getByText('Invalid sigma value')).toBeInTheDocument();
			expect(screen.getByText('Rho out of range')).toBeInTheDocument();
		});

		it('calls onDismissError and hides alert when dismiss button clicked', async () => {
			const onDismissError = vi.fn();
			render(ConfigAlerts, {
				props: {
					configErrors: ['Bad config'],
					showConfigError: true,
					stabilityWarnings: [],
					showStabilityWarning: false,
					onDismissError
				}
			});

			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
			await fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));
			expect(onDismissError).toHaveBeenCalledTimes(1);
			expect(screen.queryByText('INVALID_CONFIGURATION')).not.toBeInTheDocument();
		});

		it('hides alert after dismiss without callback', async () => {
			render(ConfigAlerts, {
				props: {
					configErrors: ['Bad config'],
					showConfigError: true,
					stabilityWarnings: [],
					showStabilityWarning: false
				}
			});

			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
			await fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));
			expect(screen.queryByText('INVALID_CONFIGURATION')).not.toBeInTheDocument();
		});
	});

	describe('stability warning alert', () => {
		it('renders nothing when showStabilityWarning is false', () => {
			render(ConfigAlerts, {
				props: {
					configErrors: [],
					showConfigError: false,
					stabilityWarnings: ['Sigma is high'],
					showStabilityWarning: false
				}
			});
			expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).not.toBeInTheDocument();
		});

		it('renders stability warning with messages', () => {
			render(ConfigAlerts, {
				props: {
					configErrors: [],
					showConfigError: false,
					stabilityWarnings: ['sigma exceeds stable range'],
					showStabilityWarning: true
				}
			});
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
			expect(screen.getByText('sigma exceeds stable range')).toBeInTheDocument();
		});

		it('calls onDismissWarning when dismiss button clicked', async () => {
			const onDismissWarning = vi.fn();
			render(ConfigAlerts, {
				props: {
					configErrors: [],
					showConfigError: false,
					stabilityWarnings: ['Unstable params'],
					showStabilityWarning: true,
					onDismissWarning
				}
			});

			await fireEvent.click(screen.getByRole('button', { name: 'Dismiss warning' }));
			expect(onDismissWarning).toHaveBeenCalledTimes(1);
		});

		it('hides warning after dismiss without callback', async () => {
			render(ConfigAlerts, {
				props: {
					configErrors: [],
					showConfigError: false,
					stabilityWarnings: ['Unstable params'],
					showStabilityWarning: true
				}
			});

			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
			await fireEvent.click(screen.getByRole('button', { name: 'Dismiss warning' }));
			expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).not.toBeInTheDocument();
		});
	});

	describe('both alerts', () => {
		it('renders both error and warning simultaneously', () => {
			render(ConfigAlerts, {
				props: {
					configErrors: ['Bad config'],
					showConfigError: true,
					stabilityWarnings: ['Unstable'],
					showStabilityWarning: true
				}
			});
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});
	});
});
