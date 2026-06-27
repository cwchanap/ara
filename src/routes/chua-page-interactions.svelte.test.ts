import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	createUnauthedPageData,
	resetMockPageStore,
	setMockPageUrl,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import ChuaPage from './chua/+page.svelte';

const setMockPageUrlUnauthed = (url: string) => setMockPageUrl(url, createUnauthedPageData());

vi.mock('$app/stores', async () => {
	const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
	return { page: mockPageStore };
});

vi.mock('$app/paths', async () => {
	const { BASE_PATH } = await import('$lib/components/testing/page-test-helpers');
	return { base: BASE_PATH };
});

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/chua', () => ({
	calculateChua: vi.fn(() => ({
		points: [
			{ x: 1, y: 2, z: 3 },
			{ x: 4, y: 5, z: 6 }
		],
		diverged: false
	})),
	computePoincareSection: vi.fn(() => [{ u: 1, v: 2 }]),
	estimateLargestLyapunov: vi.fn(() => ({
		value: 0.5,
		classification: 'chaotic',
		diverged: false
	}))
}));

vi.mock('$lib/components/ui/SaveConfigDialog.svelte', async () => {
	const module = await import('$lib/components/testing/DialogStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/ui/ShareDialog.svelte', async () => {
	const module = await import('$lib/components/testing/DialogStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/ui/SnapshotButton.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/ui/VisualizationAlerts.svelte', async () => {
	const module = await import('$lib/components/testing/VisualizationAlertsStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/ChuaRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

describe('Chua page interactions', () => {
	afterEach(() => {
		resetMockPageStore('http://localhost/', createUnauthedPageData());
		cleanup();
	});

	it('applies a preset when clicked', async () => {
		setMockPageUrlUnauthed('http://localhost/chua');
		render(ChuaPage, { props: unauthedPageProps });

		const presetBtn = screen.getByRole('button', { name: /Periodic Orbit/i });
		await fireEvent.click(presetBtn);

		// beta should change from 28 to 33
		expect(screen.getByText('33.00')).toBeInTheDocument();
	});

	it('switches to poincare view mode', async () => {
		setMockPageUrlUnauthed('http://localhost/chua');
		render(ChuaPage, { props: unauthedPageProps });

		const poincareBtn = screen.getByRole('button', { name: /POINCARÉ/i });
		await fireEvent.click(poincareBtn);

		expect(screen.getByLabelText(/Poincaré Plane/i)).toBeInTheDocument();
	});

	it('changes poincare plane selection', async () => {
		setMockPageUrlUnauthed('http://localhost/chua');
		render(ChuaPage, { props: unauthedPageProps });

		const poincareBtn = screen.getByRole('button', { name: /POINCARÉ/i });
		await fireEvent.click(poincareBtn);

		const select = screen.getByLabelText(/Poincaré Plane/i);
		await fireEvent.change(select, { target: { value: 'x=0' } });

		expect(select).toHaveValue('x=0');
	});

	it('toggles transient removal checkbox', async () => {
		setMockPageUrlUnauthed('http://localhost/chua');
		render(ChuaPage, { props: unauthedPageProps });

		const checkbox = screen.getByLabelText(/Discard initial transient/i);
		await fireEvent.click(checkbox);

		expect(checkbox).toBeChecked();
	});

	it('changes color mode selection', async () => {
		setMockPageUrlUnauthed('http://localhost/chua');
		render(ChuaPage, { props: unauthedPageProps });

		const select = screen.getByLabelText(/Color By/i);
		await fireEvent.change(select, { target: { value: 'velocity' } });

		expect(select).toHaveValue('velocity');
	});

	it('switches between view modes', async () => {
		setMockPageUrlUnauthed('http://localhost/chua');
		render(ChuaPage, { props: unauthedPageProps });

		const xyBtn = screen.getByRole('button', { name: /XY/i });
		await fireEvent.click(xyBtn);

		// Poincaré plane select should not appear in XY mode
		expect(screen.queryByLabelText(/Poincaré Plane/i)).not.toBeInTheDocument();

		const poincareBtn = screen.getByRole('button', { name: /POINCARÉ/i });
		await fireEvent.click(poincareBtn);

		expect(screen.getByLabelText(/Poincaré Plane/i)).toBeInTheDocument();
	});
});
