/**
 * Tests for ShareDialog.svelte
 *
 * Covers: unauthenticated state, initial authenticated state, share success,
 * error handling, close/cancel, and clipboard copy.
 *
 * Note: jsdom treats <dialog> as hidden by default (showModal() is a no-op).
 * All queries use { hidden: true } to reach elements inside the dialog element.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import ShareDialog from './ShareDialog.svelte';

// jsdom does not implement HTMLDialogElement.showModal/close — stub them.
HTMLDialogElement.prototype.showModal = vi.fn();
HTMLDialogElement.prototype.close = vi.fn();

vi.mock('$app/paths', () => ({ base: '' }));
vi.mock('$lib/constants', () => ({ SHARE_EXPIRATION_DAYS: 7 }));

const defaultProps = {
	open: true,
	mapType: 'lorenz',
	isAuthenticated: true,
	currentPath: '/lorenz',
	onClose: vi.fn(),
	onShare: vi.fn()
};

/** Query helper: always include hidden elements (dialog content is hidden in jsdom). */
const q = { hidden: true } as const;

describe('ShareDialog', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	describe('unauthenticated state', () => {
		it('shows login prompt when user is not authenticated', () => {
			render(ShareDialog, {
				props: { ...defaultProps, isAuthenticated: false }
			});
			expect(screen.getByText('Please log in to share configurations')).toBeInTheDocument();
		});

		it('has a login link that includes redirect to current path', () => {
			render(ShareDialog, {
				props: { ...defaultProps, isAuthenticated: false, currentPath: '/henon' }
			});
			const loginLink = screen.getByRole('link', { name: /LOG_IN/i, ...q });
			expect(loginLink).toHaveAttribute('href', expect.stringContaining('/login'));
			// currentPath '/henon' is URL-encoded as '%2Fhenon' in the redirect param
			expect(loginLink).toHaveAttribute('href', expect.stringContaining('%2Fhenon'));
		});
	});

	describe('initial authenticated state (before share)', () => {
		it('shows the map type in the dialog', () => {
			render(ShareDialog, {
				props: { ...defaultProps, mapType: 'lorenz' }
			});
			expect(screen.getByText('LORENZ')).toBeInTheDocument();
		});

		it('shows generate link button', () => {
			render(ShareDialog, { props: defaultProps });
			expect(
				screen.getByRole('button', { name: /GENERATE_LINK/i, ...q })
			).toBeInTheDocument();
		});

		it('shows expiration information', () => {
			render(ShareDialog, { props: defaultProps });
			expect(screen.getByText(/Link expires in 7 days/)).toBeInTheDocument();
		});

		it('shows cancel button', () => {
			render(ShareDialog, { props: defaultProps });
			expect(screen.getByRole('button', { name: 'Cancel', ...q })).toBeInTheDocument();
		});

		it('calls onClose when Cancel is clicked', async () => {
			const onClose = vi.fn();
			render(ShareDialog, { props: { ...defaultProps, onClose } });
			await fireEvent.click(screen.getByRole('button', { name: 'Cancel', ...q }));
			expect(onClose).toHaveBeenCalledTimes(1);
		});

		it('normalizes hyphenated map types to underscored uppercase', () => {
			render(ShareDialog, {
				props: { ...defaultProps, mapType: 'bifurcation-logistic' }
			});
			expect(screen.getByText('BIFURCATION_LOGISTIC')).toBeInTheDocument();
		});
	});

	describe('share success state', () => {
		it('shows share URL after successful share', async () => {
			const onShare = vi.fn().mockResolvedValue({
				shareUrl: 'https://example.com/s/ABCD1234',
				expiresAt: '2030-01-01T00:00:00Z'
			});
			render(ShareDialog, { props: { ...defaultProps, onShare } });

			await fireEvent.click(screen.getByRole('button', { name: /GENERATE_LINK/i, ...q }));
			await waitFor(() => {
				expect(
					screen.getByDisplayValue('https://example.com/s/ABCD1234')
				).toBeInTheDocument();
			});
		});

		it('shows a DONE button after share URL is generated', async () => {
			const onShare = vi.fn().mockResolvedValue({
				shareUrl: 'https://example.com/s/ABCD1234',
				expiresAt: '2030-01-01T00:00:00Z'
			});
			render(ShareDialog, { props: { ...defaultProps, onShare } });

			await fireEvent.click(screen.getByRole('button', { name: /GENERATE_LINK/i, ...q }));
			await waitFor(() => {
				expect(screen.getByRole('button', { name: 'DONE', ...q })).toBeInTheDocument();
			});
		});

		it('calls onClose when DONE is clicked', async () => {
			const onClose = vi.fn();
			const onShare = vi.fn().mockResolvedValue({
				shareUrl: 'https://example.com/s/ABCD1234',
				expiresAt: '2030-01-01T00:00:00Z'
			});
			render(ShareDialog, { props: { ...defaultProps, onClose, onShare } });

			await fireEvent.click(screen.getByRole('button', { name: /GENERATE_LINK/i, ...q }));
			await waitFor(() => screen.getByRole('button', { name: 'DONE', ...q }));
			await fireEvent.click(screen.getByRole('button', { name: 'DONE', ...q }));
			expect(onClose).toHaveBeenCalledTimes(1);
		});
	});

	describe('error state', () => {
		it('shows error when onShare resolves to null', async () => {
			const onShare = vi.fn().mockResolvedValue(null);
			render(ShareDialog, { props: { ...defaultProps, onShare } });

			await fireEvent.click(screen.getByRole('button', { name: /GENERATE_LINK/i, ...q }));
			await waitFor(() => {
				expect(screen.getByText('Failed to create share link')).toBeInTheDocument();
			});
		});

		it('shows error message when onShare rejects', async () => {
			const onShare = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));
			render(ShareDialog, { props: { ...defaultProps, onShare } });

			await fireEvent.click(screen.getByRole('button', { name: /GENERATE_LINK/i, ...q }));
			await waitFor(() => {
				expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
			});
		});

		it('shows generic error when onShare rejects with non-Error', async () => {
			const onShare = vi.fn().mockRejectedValue('something bad');
			render(ShareDialog, { props: { ...defaultProps, onShare } });

			await fireEvent.click(screen.getByRole('button', { name: /GENERATE_LINK/i, ...q }));
			await waitFor(() => {
				expect(screen.getByText('Failed to create share link')).toBeInTheDocument();
			});
		});
	});

	describe('clipboard copy', () => {
		function mockClipboard(resolveOrReject: 'resolve' | 'reject') {
			Object.defineProperty(navigator, 'clipboard', {
				value: {
					writeText:
						resolveOrReject === 'resolve'
							? vi.fn().mockResolvedValue(undefined)
							: vi.fn().mockRejectedValue(new Error('Permission denied'))
				},
				writable: true,
				configurable: true
			});
		}

		it('shows copied confirmation after copying', async () => {
			mockClipboard('resolve');
			const onShare = vi.fn().mockResolvedValue({
				shareUrl: 'https://example.com/s/ABCD1234',
				expiresAt: '2030-01-01T00:00:00Z'
			});

			render(ShareDialog, { props: { ...defaultProps, onShare } });

			await fireEvent.click(screen.getByRole('button', { name: /GENERATE_LINK/i, ...q }));
			await waitFor(() => screen.getByDisplayValue('https://example.com/s/ABCD1234'));

			const buttons = screen.getAllByRole('button', q);
			const copyBtn = buttons.find((b) => b.textContent?.includes('📋'));
			expect(copyBtn).toBeDefined();
			await fireEvent.click(copyBtn!);

			await waitFor(() => {
				expect(screen.getByText('Copied to clipboard!')).toBeInTheDocument();
			});
		});

		it('sets the error state internally when clipboard write fails', async () => {
			mockClipboard('reject');
			const onShare = vi.fn().mockResolvedValue({
				shareUrl: 'https://example.com/s/ABCD1234',
				expiresAt: '2030-01-01T00:00:00Z'
			});

			render(ShareDialog, { props: { ...defaultProps, onShare } });

			await fireEvent.click(screen.getByRole('button', { name: /GENERATE_LINK/i, ...q }));
			await waitFor(() => screen.getByDisplayValue('https://example.com/s/ABCD1234'));

			const buttons = screen.getAllByRole('button', q);
			const copyBtn = buttons.find((b) => b.textContent?.includes('📋'));
			expect(copyBtn).toBeDefined();

			// Clicking copy when clipboard rejects should not throw and copy indicator stays off
			await fireEvent.click(copyBtn!);

			// The "Copied!" indicator should not show since copy failed
			await waitFor(() => {
				expect(screen.queryByText('Copied to clipboard!')).not.toBeInTheDocument();
			});
		});
	});
});
