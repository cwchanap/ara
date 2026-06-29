import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	createUnauthedPageData,
	resetMockPageStore,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import GumowskiMiraPage from './gumowski-mira/+page.svelte';

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

vi.mock('$lib/components/ui/SaveConfigDialog.svelte', async () => {
	const m = await import('$lib/components/testing/DialogStub.svelte');
	return { default: m.default };
});

vi.mock('$lib/components/ui/ShareDialog.svelte', async () => {
	const m = await import('$lib/components/testing/DialogStub.svelte');
	return { default: m.default };
});

vi.mock('$lib/components/ui/SnapshotButton.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});

vi.mock('$lib/components/ui/VisualizationAlerts.svelte', async () => {
	const m = await import('$lib/components/testing/VisualizationAlertsStub.svelte');
	return { default: m.default };
});

vi.mock('$lib/components/visualizations/GumowskiMiraRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

describe('Gumowski–Mira page interactions', () => {
	beforeEach(() => {
		resetMockPageStore('http://localhost/gumowski-mira', createUnauthedPageData());
	});

	afterEach(() => cleanup());

	it('renders the GUMOWSKI–MIRA_MAP header and mu control', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByRole('heading', { level: 1, name: /GUMOWSKI–MIRA_MAP/i })).toBeTruthy();
		expect(screen.getByTestId('slider-mu')).toBeTruthy();
	});

	it('shows the default active preset as Island Structure', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/island structure/i);
	});

	it('applies a preset when clicked', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const btn = screen.getByRole('button', { name: /Ordered Curves/i });
		await fireEvent.click(btn);
		expect(screen.getByTestId('active-preset').textContent).toMatch(/ordered curves/i);
		expect((screen.getByTestId('slider-mu') as HTMLInputElement).value).toBe('-0.4');
	});

	it('switches to CUSTOM when the mu slider is changed', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const slider = screen.getByTestId('slider-mu') as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '0.123' } });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/custom/i);
	});

	it('switches to CUSTOM when the a slider is changed', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const slider = screen.getByTestId('slider-a') as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '0.042' } });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/custom/i);
	});

	it('changes render mode via select', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const select = screen.getByTestId('select-render-mode') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'single' } });
		expect(select.value).toBe('single');
	});

	it('changes color mode via select', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const select = screen.getByTestId('select-color-mode') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'seed' } });
		expect(select.value).toBe('seed');
	});

	it('displays the current mu value', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByTestId('value-mu').textContent).toBe('0.310');
	});

	it('displays the current alpha value', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByTestId('value-a').textContent).toBe('0.0080');
	});

	it('renders all preset buttons', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByRole('button', { name: /Ordered Curves/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Island Structure/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Transitional/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Dense Chaos/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Spiral Sweep/i })).toBeTruthy();
	});

	it('displays the Gumowski–Mira equations', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByText(/g\(x\) = μ·x/i)).toBeTruthy();
	});

	it('renders the data log section', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByText(/DATA_LOG: GUMOWSKI–MIRA_MAP/i)).toBeTruthy();
	});

	it('renders the Compare link', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByRole('link', { name: /Compare/i })).toBeTruthy();
	});

	it('renders the Return link', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByRole('link', { name: /Return/i })).toBeTruthy();
	});

	it('renders the Share button', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByRole('button', { name: /Share/i })).toBeTruthy();
	});

	it('renders the Save button', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByRole('button', { name: /Save/i })).toBeTruthy();
	});

	it('renders the Reset and Randomize buttons', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(screen.getByTestId('reset-button')).toBeTruthy();
		expect(screen.getByTestId('randomize-button')).toBeTruthy();
	});

	it('applies Dense Chaos preset when clicked', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const btn = screen.getByRole('button', { name: /Dense Chaos/i });
		await fireEvent.click(btn);
		expect(screen.getByTestId('active-preset').textContent).toMatch(/dense chaos/i);
	});

	it('applies Transitional preset when clicked', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const btn = screen.getByRole('button', { name: /Transitional/i });
		await fireEvent.click(btn);
		expect(screen.getByTestId('active-preset').textContent).toMatch(/transitional/i);
	});

	it('applies Spiral Sweep preset when clicked', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const btn = screen.getByRole('button', { name: /Spiral Sweep/i });
		await fireEvent.click(btn);
		expect(screen.getByTestId('active-preset').textContent).toMatch(/spiral sweep/i);
	});

	it('reset button restores the default preset', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByRole('button', { name: /Ordered Curves/i }));
		expect(screen.getByTestId('active-preset').textContent).toMatch(/ordered curves/i);
		await fireEvent.click(screen.getByTestId('reset-button'));
		expect(screen.getByTestId('active-preset').textContent).toMatch(/island structure/i);
	});

	it('disables x0 and y0 sliders in multi mode', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const x0 = document.getElementById('x0') as HTMLInputElement;
		const y0 = document.getElementById('y0') as HTMLInputElement;
		expect(x0.disabled).toBe(true);
		expect(y0.disabled).toBe(true);
	});

	it('enables x0 and y0 sliders in single mode', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const select = screen.getByTestId('select-render-mode') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'single' } });
		const x0 = document.getElementById('x0') as HTMLInputElement;
		const y0 = document.getElementById('y0') as HTMLInputElement;
		expect(x0.disabled).toBe(false);
		expect(y0.disabled).toBe(false);
	});

	it('shows Single Orbit hint on x0/y0 when in multi mode', () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const hints = screen.getAllByText('Single Orbit only');
		expect(hints.length).toBe(2);
	});

	it('opens the save dialog when Save button is clicked', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const saveBtn = screen.getByRole('button', { name: /Save/i });
		await fireEvent.click(saveBtn);
		const dialog = screen.getByTestId('dialog-stub-gumowski-mira');
		expect(dialog).toBeTruthy();
	});

	it('opens the share dialog when Share button is clicked', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const shareBtn = screen.getByRole('button', { name: /Share/i });
		await fireEvent.click(shareBtn);
		const dialog = screen.getByTestId('dialog-stub-gumowski-mira');
		expect(dialog).toBeTruthy();
	});

	it('closes the save dialog via onClose callback', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const saveBtn = screen.getByRole('button', { name: /Save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = screen.getByTestId('dialog-close-gumowski-mira');
		expect(closeBtn).toBeTruthy();
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-stub-gumowski-mira')).toBeNull();
	});

	it('closes the share dialog via onClose callback', async () => {
		render(GumowskiMiraPage, { props: unauthedPageProps });
		const shareBtn = screen.getByRole('button', { name: /Share/i });
		await fireEvent.click(shareBtn);
		const closeBtn = screen.getByTestId('dialog-close-gumowski-mira');
		expect(closeBtn).toBeTruthy();
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-stub-gumowski-mira')).toBeNull();
	});

	it('renders authenticated session data without crashing', () => {
		expect(() =>
			render(GumowskiMiraPage, {
				props: {
					data: {
						session: { user: { id: 'user-1' } },
						user: { id: 'user-1' }
					}
				}
			})
		).not.toThrow();
	});

	it('renders the Gumowski–Mira renderer component', () => {
		const { container } = render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(container.querySelector('[data-testid="stub"]')).toBeTruthy();
	});

	it('cleans up on unmount without throwing', () => {
		const { unmount } = render(GumowskiMiraPage, { props: unauthedPageProps });
		expect(() => unmount()).not.toThrow();
	});
});
