// src/lib/components/visualizations/lorenz/ViewControls.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import ViewControls from './ViewControls.svelte';

const base = {
	viewMode: '3d' as const,
	autoRotate: true,
	rotationSpeed: 0.5,
	zoom: 1,
	onChange: vi.fn(),
	onResetCamera: vi.fn()
};

describe('ViewControls', () => {
	afterEach(() => cleanup());

	it('renders the projection buttons', () => {
		const { getByText } = render(ViewControls, { props: { ...base } });
		for (const label of ['3D', 'XY', 'XZ', 'YZ']) expect(getByText(label)).toBeTruthy();
	});

	it('emits a viewMode change when XY is clicked', async () => {
		const onChange = vi.fn();
		const { getByText } = render(ViewControls, { props: { ...base, onChange } });
		await fireEvent.click(getByText('XY'));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ viewMode: 'xy' }));
	});

	it('emits a viewMode change when XZ is clicked', async () => {
		const onChange = vi.fn();
		const { getByText } = render(ViewControls, { props: { ...base, onChange } });
		await fireEvent.click(getByText('XZ'));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ viewMode: 'xz' }));
	});

	it('emits a viewMode change when YZ is clicked', async () => {
		const onChange = vi.fn();
		const { getByText } = render(ViewControls, { props: { ...base, onChange } });
		await fireEvent.click(getByText('YZ'));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ viewMode: 'yz' }));
	});

	it('emits a viewMode change when 3D is clicked', async () => {
		const onChange = vi.fn();
		const { getByText } = render(ViewControls, {
			props: { ...base, viewMode: 'xy', onChange }
		});
		await fireEvent.click(getByText('3D'));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ viewMode: '3d' }));
	});

	it('emits autoRotate change when checkbox is toggled', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(ViewControls, {
			props: { ...base, autoRotate: true, onChange }
		});
		const checkbox = getByLabelText(/auto rotate/i);
		await fireEvent.change(checkbox, { target: { checked: false } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ autoRotate: false }));
	});

	it('emits rotationSpeed change when slider is moved', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(ViewControls, {
			props: { ...base, rotationSpeed: 0.5, onChange }
		});
		const slider = getByLabelText(/rotation/i) as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '1.5' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rotationSpeed: 1.5 }));
	});

	it('emits zoom change when zoom slider is moved', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(ViewControls, {
			props: { ...base, zoom: 1, onChange }
		});
		const zoomSlider = getByLabelText(/zoom/i) as HTMLInputElement;
		await fireEvent.input(zoomSlider, { target: { value: '2.0' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ zoom: 2.0 }));
	});

	it('calls onResetCamera when Reset Camera button is clicked', async () => {
		const onResetCamera = vi.fn();
		const { getByText } = render(ViewControls, {
			props: { ...base, onResetCamera }
		});
		await fireEvent.click(getByText('Reset Camera'));
		expect(onResetCamera).toHaveBeenCalledTimes(1);
	});
});
