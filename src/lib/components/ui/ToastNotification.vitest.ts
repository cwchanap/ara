import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import ToastNotification from './ToastNotification.svelte';

afterEach(() => {
	vi.useRealTimers();
	cleanup();
});

describe('ToastNotification', () => {
	it('renders message when show is true', () => {
		render(ToastNotification, {
			props: { variant: 'success', message: 'Saved!', show: true }
		});
		expect(screen.getByText('Saved!')).toBeInTheDocument();
	});

	it('does not render when show is false', () => {
		render(ToastNotification, {
			props: { variant: 'success', message: 'Hidden', show: false }
		});
		expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
	});

	it('calls onDismiss when dismiss button is clicked', async () => {
		const onDismiss = vi.fn();
		render(ToastNotification, {
			props: {
				variant: 'error',
				message: 'An error',
				show: true,
				dismissable: true,
				autoDismiss: false,
				onDismiss
			}
		});
		await fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
		expect(onDismiss).toHaveBeenCalled();
	});

	it('hides dismiss button when dismissable is false', () => {
		render(ToastNotification, {
			props: { variant: 'warning', message: 'Warning', show: true, dismissable: false }
		});
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	it('shows dismiss button when dismissable is true', () => {
		render(ToastNotification, {
			props: {
				variant: 'success',
				message: 'Done',
				show: true,
				dismissable: true,
				autoDismiss: false
			}
		});
		expect(screen.getByRole('button', { name: /dismiss notification/i })).toBeInTheDocument();
	});

	it('renders with role alert for accessibility', () => {
		render(ToastNotification, {
			props: { variant: 'error', message: 'Error occurred', show: true }
		});
		expect(screen.getByRole('alert')).toBeInTheDocument();
	});

	it('renders warning variant message', () => {
		render(ToastNotification, {
			props: { variant: 'warning', message: 'Be careful', show: true }
		});
		expect(screen.getByText('Be careful')).toBeInTheDocument();
	});
});
