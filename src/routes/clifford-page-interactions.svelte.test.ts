import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	createUnauthedPageData,
	resetMockPageStore,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import CliffordPage from './clifford/+page.svelte';

vi.mock('$app/stores', async () => {
	const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
	return { page: mockPageStore };
});

vi.mock('$app/paths', async () => {
	const { BASE_PATH } = await import('$lib/components/testing/page-test-helpers');
	return { base: BASE_PATH };
});

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

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
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});

vi.mock('$lib/components/visualizations/CliffordRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});

describe('Clifford page interactions', () => {
	beforeEach(() => {
		resetMockPageStore('http://localhost/clifford', createUnauthedPageData());
	});

	afterEach(() => cleanup());

	it('renders the CLIFFORD_ATTRACTOR header and shape controls', () => {
		render(CliffordPage, { props: unauthedPageProps });
		expect(screen.getByRole('heading', { level: 1, name: /CLIFFORD_ATTRACTOR/i })).toBeTruthy();
		expect(screen.getByTestId('slider-a')).toBeTruthy();
		expect(screen.getByTestId('slider-d')).toBeTruthy();
	});

	it('shows the default active preset as Classic', () => {
		render(CliffordPage, { props: unauthedPageProps });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/classic/i);
	});

	it('displays the default a value', () => {
		render(CliffordPage, { props: unauthedPageProps });
		expect(screen.getByTestId('value-a').textContent).toBe('-1.40');
	});

	it('applies the Wings preset when clicked', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByRole('button', { name: /Wings/i }));
		expect(screen.getByTestId('active-preset').textContent).toMatch(/wings/i);
		expect((screen.getByTestId('slider-a') as HTMLInputElement).value).toBe('1.7');
	});

	it('switches to CUSTOM when a shape slider changes', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		await fireEvent.input(screen.getByTestId('slider-a'), { target: { value: '0.5' } });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/custom/i);
	});

	it('resets to the Classic default', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		await fireEvent.input(screen.getByTestId('slider-a'), { target: { value: '0.5' } });
		await fireEvent.click(screen.getByTestId('btn-reset'));
		expect((screen.getByTestId('slider-a') as HTMLInputElement).value).toBe('-1.4');
		expect(screen.getByTestId('active-preset').textContent).toMatch(/classic/i);
	});

	it('randomizes shape parameters into [-2, 2] and becomes CUSTOM', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByTestId('btn-randomize'));
		for (const id of ['slider-a', 'slider-b', 'slider-c', 'slider-d']) {
			const v = Number((screen.getByTestId(id) as HTMLInputElement).value);
			expect(v).toBeGreaterThanOrEqual(-2);
			expect(v).toBeLessThanOrEqual(2);
		}
		expect(screen.getByTestId('active-preset').textContent).toMatch(/custom/i);
	});

	it('changes color mode via select', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		const select = screen.getByTestId('select-color-mode') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'iteration' } });
		expect(select.value).toBe('iteration');
	});

	it('renders all five preset buttons', () => {
		render(CliffordPage, { props: unauthedPageProps });
		for (const name of [/Classic/i, /Wings/i, /Web/i, /Swirl/i, /Ribbons/i]) {
			expect(screen.getByRole('button', { name })).toBeTruthy();
		}
	});

	it('displays the recurrence equations and the data log', () => {
		render(CliffordPage, { props: unauthedPageProps });
		expect(screen.getByText(/sin\(a/i)).toBeTruthy();
		expect(screen.getByText(/DATA_LOG: CLIFFORD_ATTRACTOR/i)).toBeTruthy();
	});

	it('renders Compare / Return links and Share / Save buttons', () => {
		render(CliffordPage, { props: unauthedPageProps });
		expect(screen.getByRole('link', { name: /Compare/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /Return/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Share/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Save/i })).toBeTruthy();
	});

	it('opens and closes the save dialog', async () => {
		render(CliffordPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
		expect(screen.getByTestId('dialog-stub-clifford')).toBeTruthy();
		await fireEvent.click(screen.getByTestId('dialog-close-clifford'));
		expect(screen.queryByTestId('dialog-stub-clifford')).toBeNull();
	});

	it('cleans up on unmount without throwing', () => {
		const { unmount } = render(CliffordPage, { props: unauthedPageProps });
		expect(() => unmount()).not.toThrow();
	});
});
