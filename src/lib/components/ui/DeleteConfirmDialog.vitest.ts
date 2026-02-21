import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
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
});
