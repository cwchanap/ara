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

	it('auto-dismisses after the success duration and calls onDismiss', () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		render(ToastNotification, {
			props: {
				variant: 'success',
				message: 'Saved!',
				show: true,
				autoDismiss: true,
				onDismiss
			}
		});
		vi.advanceTimersByTime(3001); // TOAST_SUCCESS_DURATION_MS is 3000
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('auto-dismisses after the error duration and calls onDismiss', () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		render(ToastNotification, {
			props: {
				variant: 'error',
				message: 'Failed!',
				show: true,
				autoDismiss: true,
				onDismiss
			}
		});
		vi.advanceTimersByTime(5001); // TOAST_ERROR_DURATION_MS is 5000
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('does not auto-dismiss when autoDismiss is false', () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		render(ToastNotification, {
			props: {
				variant: 'success',
				message: 'Persistent',
				show: true,
				autoDismiss: false,
				onDismiss
			}
		});
		vi.advanceTimersByTime(10000);
		expect(onDismiss).not.toHaveBeenCalled();
		expect(screen.getByText('Persistent')).toBeInTheDocument();
	});

	it('auto-dismisses after the warning duration and calls onDismiss', () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		render(ToastNotification, {
			props: {
				variant: 'warning',
				message: 'Warning!',
				show: true,
				autoDismiss: true,
				onDismiss
			}
		});
		vi.advanceTimersByTime(5001); // TOAST_WARNING_DURATION_MS is 5000
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('renders success icon (✓) for success variant', () => {
		render(ToastNotification, {
			props: { variant: 'success', message: 'Done', show: true, autoDismiss: false }
		});
		expect(screen.getByText('✓')).toBeInTheDocument();
	});

	it('renders error icon (✕) for error variant', () => {
		render(ToastNotification, {
			props: { variant: 'error', message: 'Failed', show: true, autoDismiss: false }
		});
		// The icon is ✕ and the dismiss button also contains ✕, so there are two
		expect(screen.getAllByText('✕').length).toBeGreaterThanOrEqual(1);
	});

	it('renders warning icon (⚠️) for warning variant', () => {
		render(ToastNotification, {
			props: { variant: 'warning', message: 'Careful', show: true, autoDismiss: false }
		});
		expect(screen.getByText('⚠️')).toBeInTheDocument();
	});

	it('has aria-live="polite" for accessibility', () => {
		render(ToastNotification, {
			props: { variant: 'success', message: 'Hello', show: true, autoDismiss: false }
		});
		expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
	});

	it('clears the timer and hides when show transitions to false', async () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		const { rerender } = render(ToastNotification, {
			props: {
				variant: 'success',
				message: 'Timer test',
				show: true,
				autoDismiss: true,
				onDismiss
			}
		});
		// Transition show to false before the timer fires
		rerender({
			variant: 'success',
			message: 'Timer test',
			show: false,
			autoDismiss: true,
			onDismiss
		});
		// Advance past the duration — onDismiss should NOT be called because timer was cleared
		vi.advanceTimersByTime(5000);
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('manual dismiss via button clears the timer and calls onDismiss', async () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		render(ToastNotification, {
			props: {
				variant: 'success',
				message: 'Dismiss me',
				show: true,
				autoDismiss: true,
				onDismiss
			}
		});
		await fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
		expect(onDismiss).toHaveBeenCalledTimes(1);
		// Advance timers — should not fire again
		vi.advanceTimersByTime(5000);
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('toggling autoDismiss from false to true starts the auto-dismiss timer', () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		const { rerender } = render(ToastNotification, {
			props: {
				variant: 'success',
				message: 'Toggle',
				show: true,
				autoDismiss: false,
				onDismiss
			}
		});
		vi.advanceTimersByTime(10000);
		expect(onDismiss).not.toHaveBeenCalled();

		// Now toggle autoDismiss to true — should start timer
		rerender({
			variant: 'success',
			message: 'Toggle',
			show: true,
			autoDismiss: true,
			onDismiss
		});
		vi.advanceTimersByTime(3001); // TOAST_SUCCESS_DURATION_MS
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});
