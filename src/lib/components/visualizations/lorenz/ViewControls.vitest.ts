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
});
