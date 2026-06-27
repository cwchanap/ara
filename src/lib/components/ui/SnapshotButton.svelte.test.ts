import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
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
		vi.useRealTimers();
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

	it('shows type mismatch error when targetType is canvas but target is a div', async () => {
		const mockDiv = document.createElement('div');

		render(SnapshotButton, {
			props: {
				target: mockDiv,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await screen.findByText(/Type mismatch/);
		expect(screen.getByTitle(/Type mismatch/)).toHaveTextContent('HTMLDivElement');
	});

	it('shows type mismatch error when targetType is container but target is not an HTMLElement', async () => {
		const textNode = document.createTextNode('not an element');

		render(SnapshotButton, {
			props: {
				target: textNode as unknown as HTMLElement,
				targetType: 'container',
				mapType: 'henon'
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await screen.findByText(/Type mismatch/);
	});

	it('shows unexpected error when captureCanvas throws an exception', async () => {
		const mockCanvas = document.createElement('canvas');
		vi.mocked(captureCanvas).mockRejectedValue(new Error('out of memory'));

		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await screen.findByText('✗ out of memory');
	});

	it('shows generic error when catch block receives non-Error', async () => {
		const mockCanvas = document.createElement('canvas');
		vi.mocked(captureCanvas).mockRejectedValue('string error');

		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await screen.findByText('✗ Unexpected error');
	});

	it('shows unexpected error when captureContainer throws', async () => {
		const mockContainer = document.createElement('div');
		vi.mocked(captureContainer).mockRejectedValue(new Error('render failure'));

		render(SnapshotButton, {
			props: {
				target: mockContainer,
				targetType: 'container',
				mapType: 'lorenz'
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await screen.findByText('✗ render failure');
	});

	it('prevents duplicate captures when isCapturing is true', async () => {
		const mockCanvas = document.createElement('canvas');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let resolveCapture: (value: any) => void;
		const capturePromise = new Promise((resolve) => {
			resolveCapture = resolve;
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.mocked(captureCanvas).mockReturnValue(capturePromise as any);

		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		await fireEvent.click(screen.getByRole('button'));
		expect(screen.getByText('Capturing...')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button'));

		expect(captureCanvas).toHaveBeenCalledTimes(1);

		resolveCapture!({ success: true, dataUrl: 'data:image/png;base64,test' });
		await waitFor(() => expect(screen.queryByText('Capturing...')).not.toBeInTheDocument());
	});

	it('hides success message after timeout (2000ms)', async () => {
		vi.useFakeTimers();
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
		await vi.advanceTimersByTimeAsync(0);
		expect(screen.getByText('✓ Saved')).toBeInTheDocument();

		vi.advanceTimersByTime(2000);
		await vi.advanceTimersByTimeAsync(0);
		expect(screen.queryByText('✓ Saved')).not.toBeInTheDocument();
	});

	it('hides error message after timeout (4000ms) when result has error', async () => {
		vi.useFakeTimers();
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
		await vi.advanceTimersByTimeAsync(0);
		expect(screen.getByText('✗ Capture failed')).toBeInTheDocument();

		vi.advanceTimersByTime(4000);
		await vi.advanceTimersByTimeAsync(0);
		expect(screen.queryByText('✗ Capture failed')).not.toBeInTheDocument();
	});

	it('hides error message after timeout (4000ms) when capture throws', async () => {
		vi.useFakeTimers();
		const mockCanvas = document.createElement('canvas');
		vi.mocked(captureCanvas).mockRejectedValue(new Error('out of memory'));

		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		await fireEvent.click(screen.getByRole('button'));
		await vi.advanceTimersByTimeAsync(0);
		expect(screen.getByText('✗ out of memory')).toBeInTheDocument();

		vi.advanceTimersByTime(4000);
		await vi.advanceTimersByTimeAsync(0);
		expect(screen.queryByText('✗ out of memory')).not.toBeInTheDocument();
	});

	it('shows fallback error message when result.error is undefined', async () => {
		const mockCanvas = document.createElement('canvas');
		vi.mocked(captureCanvas).mockResolvedValue({
			success: false
			// error is undefined
		});

		render(SnapshotButton, {
			props: {
				target: mockCanvas,
				targetType: 'canvas',
				mapType: 'henon'
			}
		});

		await fireEvent.click(screen.getByRole('button'));

		await screen.findByText('✗ Failed to capture snapshot');
	});
});
