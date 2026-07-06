import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	createUnauthedPageData,
	resetMockPageStore,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import IkedaPage from './ikeda/+page.svelte';

const checkParameterStabilityMock = vi.hoisted(() =>
	vi.fn(() => ({ isStable: true, warnings: [] as string[] }))
);

vi.mock('$lib/chaos-validation', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/chaos-validation')>();
	return {
		...actual,
		checkParameterStability: checkParameterStabilityMock
	};
});

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

vi.mock('$lib/components/visualizations/IkedaRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

describe('Ikeda page interactions', () => {
	beforeEach(() => {
		resetMockPageStore('http://localhost/ikeda', createUnauthedPageData());
	});

	afterEach(() => cleanup());

	it('renders the IKEDA_MAP header and feedback control', () => {
		render(IkedaPage, { props: unauthedPageProps });
		expect(screen.getByRole('heading', { level: 1, name: /IKEDA_MAP/i })).toBeTruthy();
		expect(screen.getByTestId('slider-u')).toBeTruthy();
	});

	it('shows the default active preset as Classic Ikeda', () => {
		render(IkedaPage, { props: unauthedPageProps });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/classic ikeda/i);
	});

	it('applies a preset when clicked', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const btn = screen.getByRole('button', { name: /Low Feedback/i });
		await fireEvent.click(btn);
		expect(screen.getByTestId('active-preset').textContent).toMatch(/low feedback/i);
		expect((screen.getByTestId('slider-u') as HTMLInputElement).value).toBe('0.6');
	});

	it('switches to CUSTOM when the feedback slider is changed', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const slider = screen.getByTestId('slider-u') as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '0.42' } });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/custom/i);
	});

	it('changes render mode via select', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const select = screen.getByTestId('select-render-mode') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'single' } });
		expect(select.value).toBe('single');
	});

	it('changes color mode via select', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const select = screen.getByTestId('select-color-mode') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'seed' } });
		expect(select.value).toBe('seed');
	});

	it('displays the current feedback value', () => {
		render(IkedaPage, { props: unauthedPageProps });
		expect(screen.getByTestId('value-u').textContent).toBe('0.918');
	});

	it('renders all preset buttons', () => {
		render(IkedaPage, { props: unauthedPageProps });
		expect(screen.getByRole('button', { name: /Classic Ikeda/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Low Feedback/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Transition/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Structured Chaos/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Dense Fractal/i })).toBeTruthy();
	});

	it('displays the Ikeda equations', () => {
		render(IkedaPage, { props: unauthedPageProps });
		expect(screen.getByText(/t\(n\) = 0\.4/i)).toBeTruthy();
	});

	it('renders the data log section', () => {
		render(IkedaPage, { props: unauthedPageProps });
		expect(screen.getByText(/DATA_LOG: IKEDA_MAP/i)).toBeTruthy();
	});

	it('renders the Compare link', () => {
		render(IkedaPage, { props: unauthedPageProps });
		expect(screen.getByRole('link', { name: /Compare/i })).toBeTruthy();
	});

	it('renders the Return link', () => {
		render(IkedaPage, { props: unauthedPageProps });
		expect(screen.getByRole('link', { name: /Return/i })).toBeTruthy();
	});

	it('renders the Share button', () => {
		render(IkedaPage, { props: unauthedPageProps });
		expect(screen.getByRole('button', { name: /Share/i })).toBeTruthy();
	});

	it('renders the Save button', () => {
		render(IkedaPage, { props: unauthedPageProps });
		expect(screen.getByRole('button', { name: /Save/i })).toBeTruthy();
	});

	it('applies Structured Chaos preset when clicked', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const btn = screen.getByRole('button', { name: /Structured Chaos/i });
		await fireEvent.click(btn);
		expect(screen.getByTestId('active-preset').textContent).toMatch(/structured chaos/i);
	});

	it('applies Dense Fractal preset when clicked', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const btn = screen.getByRole('button', { name: /Dense Fractal/i });
		await fireEvent.click(btn);
		expect(screen.getByTestId('active-preset').textContent).toMatch(/dense fractal/i);
	});

	it('applies Transition preset when clicked', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const btn = screen.getByRole('button', { name: /Transition/i });
		await fireEvent.click(btn);
		expect(screen.getByTestId('active-preset').textContent).toMatch(/transition/i);
	});

	it('disables x0 and y0 sliders in multi mode', () => {
		render(IkedaPage, { props: unauthedPageProps });
		const x0 = document.getElementById('x0') as HTMLInputElement;
		const y0 = document.getElementById('y0') as HTMLInputElement;
		expect(x0.disabled).toBe(true);
		expect(y0.disabled).toBe(true);
	});

	it('enables x0 and y0 sliders in single mode', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const select = screen.getByTestId('select-render-mode') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'single' } });
		const x0 = document.getElementById('x0') as HTMLInputElement;
		const y0 = document.getElementById('y0') as HTMLInputElement;
		expect(x0.disabled).toBe(false);
		expect(y0.disabled).toBe(false);
	});

	it('shows Single Orbit hint on x0/y0 when in multi mode', () => {
		render(IkedaPage, { props: unauthedPageProps });
		const hints = screen.getAllByText('Single Orbit only');
		expect(hints.length).toBe(2);
	});

	it('opens the save dialog when Save button is clicked', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const saveBtn = screen.getByRole('button', { name: /Save/i });
		await fireEvent.click(saveBtn);
		const dialog = screen.getByTestId('dialog-stub-ikeda');
		expect(dialog).toBeTruthy();
	});

	it('opens the share dialog when Share button is clicked', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const shareBtn = screen.getByRole('button', { name: /Share/i });
		await fireEvent.click(shareBtn);
		const dialog = screen.getByTestId('dialog-stub-ikeda');
		expect(dialog).toBeTruthy();
	});

	it('closes the save dialog via onClose callback', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const saveBtn = screen.getByRole('button', { name: /Save/i });
		await fireEvent.click(saveBtn);
		const closeBtn = screen.getByTestId('dialog-close-ikeda');
		expect(closeBtn).toBeTruthy();
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-stub-ikeda')).toBeNull();
	});

	it('closes the share dialog via onClose callback', async () => {
		render(IkedaPage, { props: unauthedPageProps });
		const shareBtn = screen.getByRole('button', { name: /Share/i });
		await fireEvent.click(shareBtn);
		const closeBtn = screen.getByTestId('dialog-close-ikeda');
		expect(closeBtn).toBeTruthy();
		await fireEvent.click(closeBtn);
		expect(screen.queryByTestId('dialog-stub-ikeda')).toBeNull();
	});

	it('renders authenticated session data without crashing', () => {
		expect(() =>
			render(IkedaPage, {
				props: {
					data: {
						session: { user: { id: 'user-1' } },
						user: { id: 'user-1' }
					}
				}
			})
		).not.toThrow();
	});

	it('renders the Ikeda renderer component', () => {
		const { container } = render(IkedaPage, { props: unauthedPageProps });
		expect(container.querySelector('[data-testid="stub"]')).toBeTruthy();
	});

	it('cleans up on unmount without throwing', () => {
		const { unmount } = render(IkedaPage, { props: unauthedPageProps });
		expect(() => unmount()).not.toThrow();
	});

	it('runs the debounced stability check (getParams) after a slider edit', async () => {
		vi.useFakeTimers();
		try {
			checkParameterStabilityMock.mockClear();
			render(IkedaPage, { props: unauthedPageProps });

			// Changing the feedback slider triggers the page's stability $effect ->
			// triggerReactive -> debounced checkParameterStability(getParams()).
			const slider = screen.getByTestId('slider-u') as HTMLInputElement;
			await fireEvent.input(slider, { target: { value: '0.42' } });
			await vi.runAllTimersAsync();

			expect(checkParameterStabilityMock).toHaveBeenCalledWith(
				'ikeda',
				expect.objectContaining({ type: 'ikeda', u: 0.42 })
			);
		} finally {
			vi.useRealTimers();
		}
	});
});
