import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import SaveConfigDialog from './SaveConfigDialog.svelte';

vi.mock('$app/paths', () => ({ base: '' }));

beforeEach(() => {
	HTMLDialogElement.prototype.showModal = vi.fn();
	HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
	cleanup();
});

const defaultProps = {
	open: true,
	mapType: 'lorenz',
	isAuthenticated: true,
	currentPath: '/lorenz',
	onClose: vi.fn(),
	onSave: vi.fn(async () => {})
};

describe('SaveConfigDialog', () => {
	it('renders the save form when authenticated', () => {
		render(SaveConfigDialog, { props: defaultProps });
		expect(screen.getByLabelText(/configuration name/i)).toBeInTheDocument();
	});

	it('shows login link when not authenticated', () => {
		render(SaveConfigDialog, {
			props: { ...defaultProps, isAuthenticated: false }
		});
		expect(screen.getByText('LOG_IN')).toBeInTheDocument();
	});

	it('disables save button when name is empty', () => {
		render(SaveConfigDialog, { props: defaultProps });
		const saveButton = screen.getByRole('button', { name: /^SAVE$/i, hidden: true });
		expect(saveButton).toBeDisabled();
	});

	it('enables save button when name is entered', async () => {
		render(SaveConfigDialog, { props: defaultProps });
		const input = screen.getByLabelText(/configuration name/i, { selector: 'input' });
		await fireEvent.input(input, { target: { value: 'My Config' } });
		const saveButton = screen.getByRole('button', { name: /^SAVE$/i, hidden: true });
		expect(saveButton).not.toBeDisabled();
	});

	it('calls onSave with trimmed name on submit', async () => {
		const onSave = vi.fn(async () => {});
		render(SaveConfigDialog, { props: { ...defaultProps, onSave } });
		const input = screen.getByLabelText(/configuration name/i, { selector: 'input' });
		await fireEvent.input(input, { target: { value: '  My Config  ' } });
		const form = screen.getByRole('button', { name: /^SAVE$/i, hidden: true }).closest('form')!;
		await fireEvent.submit(form);
		expect(onSave).toHaveBeenCalledWith('My Config');
	});

	it('calls onClose when cancel is clicked', async () => {
		const onClose = vi.fn();
		render(SaveConfigDialog, { props: { ...defaultProps, onClose } });
		await fireEvent.click(screen.getByRole('button', { name: /cancel/i, hidden: true }));
		expect(onClose).toHaveBeenCalled();
	});

	it('shows error for name exceeding 100 characters', async () => {
		render(SaveConfigDialog, { props: defaultProps });
		const input = screen.getByLabelText(/configuration name/i, { selector: 'input' });
		await fireEvent.input(input, { target: { value: 'a'.repeat(101) } });
		const form = screen.getByRole('button', { name: /^SAVE$/i, hidden: true }).closest('form')!;
		await fireEvent.submit(form);
		expect(screen.getByText(/100 characters or less/i)).toBeInTheDocument();
	});

	it('displays the map type in uppercase', () => {
		render(SaveConfigDialog, { props: { ...defaultProps, mapType: 'chaos-esthetique' } });
		expect(screen.getByText('CHAOS_ESTHETIQUE')).toBeInTheDocument();
	});
});
