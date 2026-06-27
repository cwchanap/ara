import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import DeleteConfirmDialog from './DeleteConfirmDialog.svelte';

beforeEach(() => {
	HTMLDialogElement.prototype.showModal = vi.fn();
	HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
	cleanup();
});

const defaultProps = {
	open: true,
	configName: 'My Lorenz Config',
	isDeleting: false,
	error: '',
	onClose: vi.fn(),
	onConfirm: vi.fn(async () => {})
};

describe('DeleteConfirmDialog', () => {
	it('displays the config name in the confirmation text', () => {
		render(DeleteConfirmDialog, { props: defaultProps });
		expect(screen.getByText('"My Lorenz Config"')).toBeInTheDocument();
	});

	it('shows error message when error prop is non-empty', () => {
		render(DeleteConfirmDialog, {
			props: { ...defaultProps, error: 'Delete failed' }
		});
		expect(screen.getByText('Delete failed')).toBeInTheDocument();
	});

	it('calls onConfirm when DELETE button is clicked', async () => {
		const onConfirm = vi.fn(async () => {});
		render(DeleteConfirmDialog, { props: { ...defaultProps, onConfirm } });
		await fireEvent.click(screen.getByRole('button', { name: /^DELETE$/i, hidden: true }));
		expect(onConfirm).toHaveBeenCalled();
	});

	it('calls onClose when Cancel is clicked', async () => {
		const onClose = vi.fn();
		render(DeleteConfirmDialog, { props: { ...defaultProps, onClose } });
		await fireEvent.click(screen.getByRole('button', { name: /cancel/i, hidden: true }));
		expect(onClose).toHaveBeenCalled();
	});

	it('disables buttons while isDeleting is true', () => {
		render(DeleteConfirmDialog, { props: { ...defaultProps, isDeleting: true } });
		const cancelButton = screen.getByRole('button', { name: /cancel/i, hidden: true });
		expect(cancelButton).toBeDisabled();
	});

	it('disables DELETE button while isDeleting is true', () => {
		render(DeleteConfirmDialog, { props: { ...defaultProps, isDeleting: true } });
		// When isDeleting, the button text changes to DELETING..., so query all buttons
		const buttons = screen.getAllByRole('button', { hidden: true });
		buttons.forEach((btn) => {
			expect(btn).toBeDisabled();
		});
	});

	it('does not show error when error prop is empty', () => {
		render(DeleteConfirmDialog, { props: defaultProps });
		expect(screen.queryByText('Delete failed')).not.toBeInTheDocument();
	});

	it('displays the error message when onConfirm rejects', async () => {
		const onConfirm = vi.fn(async () => {
			throw new Error('Network error');
		});
		render(DeleteConfirmDialog, { props: { ...defaultProps, onConfirm } });
		await fireEvent.click(screen.getByRole('button', { name: /^DELETE$/i, hidden: true }));
		await waitFor(() => {
			expect(screen.getByText('Network error')).toBeInTheDocument();
		});
	});

	it('shows generic error when onConfirm rejects with a non-Error value', async () => {
		const onConfirm = vi.fn(async () => {
			throw 'plain string rejection';
		});
		render(DeleteConfirmDialog, { props: { ...defaultProps, onConfirm } });
		await fireEvent.click(screen.getByRole('button', { name: /^DELETE$/i, hidden: true }));
		await waitFor(() => {
			expect(screen.getByText('An error occurred')).toBeInTheDocument();
		});
	});

	it('shows DELETING text on the button while deletion is in progress', async () => {
		let resolveConfirm!: () => void;
		const onConfirm = vi.fn(
			() =>
				new Promise<void>((res) => {
					resolveConfirm = res;
				})
		);
		render(DeleteConfirmDialog, { props: { ...defaultProps, onConfirm } });
		await fireEvent.click(screen.getByRole('button', { name: /^DELETE$/i, hidden: true }));
		await waitFor(() => {
			expect(screen.getByText('DELETING...')).toBeInTheDocument();
		});
		resolveConfirm();
		await waitFor(() => {
			expect(screen.queryByText('DELETING...')).not.toBeInTheDocument();
		});
	});

	it('handleCancel calls preventDefault when isDeleting is true', () => {
		render(DeleteConfirmDialog, {
			props: { ...defaultProps, isDeleting: true }
		});
		const dialog = document.querySelector('dialog')!;
		const event = new Event('cancel', { cancelable: true, bubbles: true });
		const preventDefault = vi.spyOn(event, 'preventDefault');
		dialog.dispatchEvent(event);
		expect(preventDefault).toHaveBeenCalled();
		expect(screen.getByText('DELETING...')).toBeInTheDocument();
	});

	it('handleKeyDown Escape closes dialog when not deleting', async () => {
		const onClose = vi.fn();
		render(DeleteConfirmDialog, { props: { ...defaultProps, onClose } });
		const dialog = document.querySelector('dialog')!;
		await fireEvent.keyDown(dialog, { key: 'Escape' });
		expect(onClose).toHaveBeenCalled();
	});

	it('handleKeyDown Escape does not close dialog when isDeleting', async () => {
		const onClose = vi.fn();
		render(DeleteConfirmDialog, { props: { ...defaultProps, isDeleting: true, onClose } });
		const dialog = document.querySelector('dialog')!;
		await fireEvent.keyDown(dialog, { key: 'Escape' });
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByText('DELETING...')).toBeInTheDocument();
	});
});
