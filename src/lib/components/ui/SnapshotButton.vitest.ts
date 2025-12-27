import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import SnapshotButton from './SnapshotButton.svelte';

// Mock the snapshot module
vi.mock('$lib/snapshot', () => ({
	captureCanvas: vi.fn(),
	captureContainer: vi.fn(),
	downloadSnapshot: vi.fn(),
	generateFilename: vi.fn((mapType: string) => `${mapType}_2024-01-01_12-00-00.png`)
}));

import { captureCanvas, captureContainer, downloadSnapshot } from '$lib/snapshot';

describe('SnapshotButton', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it('renders with default text', () => {
		const mockCanvas = document.createElement('canvas');
		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		expect(screen.getByRole('button')).toBeInTheDocument();
		expect(screen.getByText('Snapshot')).toBeInTheDocument();
	});

	it('is disabled when target is undefined', () => {
		render(SnapshotButton, {
			props: {
				target: undefined,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		expect(screen.getByRole('button')).toBeDisabled();
	});

	it('is disabled when disabled prop is true', () => {
		const mockCanvas = document.createElement('canvas');
		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon',
				disabled: true
			}
		});

		expect(screen.getByRole('button')).toBeDisabled();
	});

	it('calls captureCanvas for canvas targetType', async () => {
		const mockCanvas = document.createElement('canvas');
		vi.mocked(captureCanvas).mockResolvedValue({
			success: true,
			dataUrl: 'data:image/png;base64,test'
		});

		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await waitFor(() => expect(captureCanvas).toHaveBeenCalledWith(mockCanvas, {}));
	});

	it('calls captureContainer for container targetType', async () => {
		const mockContainer = document.createElement('div');
		vi.mocked(captureContainer).mockResolvedValue({
			success: true,
			dataUrl: 'data:image/png;base64,test'
		});

		render(SnapshotButton, {
			props: {
				target: mockContainer,
				targetType: 'container',
				mapType: 'logistic'
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await waitFor(() => expect(captureContainer).toHaveBeenCalledWith(mockContainer, {}));
	});

	it('calls downloadSnapshot on successful capture', async () => {
		const mockCanvas = document.createElement('canvas');
		vi.mocked(captureCanvas).mockResolvedValue({
			success: true,
			dataUrl: 'data:image/png;base64,test'
		});

		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'standard'
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await waitFor(() =>
			expect(downloadSnapshot).toHaveBeenCalledWith(
				'data:image/png;base64,test',
				'standard_2024-01-01_12-00-00.png'
			)
		);
	});

	it('shows success message after successful capture', async () => {
		const mockCanvas = document.createElement('canvas');
		vi.mocked(captureCanvas).mockResolvedValue({
			success: true,
			dataUrl: 'data:image/png;base64,test'
		});

		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await screen.findByText('✓ Saved');
	});

	it('shows error message on failed capture', async () => {
		const mockCanvas = document.createElement('canvas');
		vi.mocked(captureCanvas).mockResolvedValue({
			success: false,
			error: 'Capture failed'
		});

		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await screen.findByText('✗ Capture failed');
	});

	it('has correct aria-label for accessibility', () => {
		const mockCanvas = document.createElement('canvas');
		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		expect(screen.getByRole('button')).toHaveAttribute(
			'aria-label',
			'Take snapshot of visualization'
		);
	});

	it('passes options to capture function', async () => {
		const mockCanvas = document.createElement('canvas');
		vi.mocked(captureCanvas).mockResolvedValue({
			success: true,
			dataUrl: 'data:image/jpeg;base64,test'
		});

		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon',
				options: { format: 'jpeg', quality: 0.8 }
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await waitFor(() =>
			expect(captureCanvas).toHaveBeenCalledWith(mockCanvas, { format: 'jpeg', quality: 0.8 })
		);
	});
});
