/**
 * Page interaction tests for the Gingerbreadman visualization.
 * Covers presets, reset/randomize, ParameterSlider test ids, draft vs
 * committed wiring (preview-policy sliders + buildParameters), and
 * reactive stability getParams.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { PREVIEW_THROTTLE_MS } from '$lib/constants';
import {
	createUnauthedPageData,
	resetMockPageStore,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import GingerbreadmanPage from './gingerbreadman/+page.svelte';

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
	const m = await import('$lib/components/testing/VisualizationAlertsStub.svelte');
	return { default: m.default };
});

// Renderer stub exposes IC/iterations + fidelity so draft-vs-committed paths
// (preview fidelity → draftX0, full → committed x0) are observable.
vi.mock('$lib/components/visualizations/GingerbreadmanRenderer.svelte', async () => {
	const { default: Stub } = await import(
		'$lib/components/testing/GingerbreadmanRendererStub.svelte'
	);
	return { default: Stub };
});

describe('Gingerbreadman page interactions', () => {
	beforeEach(() => {
		resetMockPageStore('http://localhost/gingerbreadman', createUnauthedPageData());
		checkParameterStabilityMock.mockClear();
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it('renders the GINGERBREADMAN_MAP header and ParameterSlider test ids', () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		expect(screen.getByRole('heading', { level: 1, name: /GINGERBREADMAN_MAP/i })).toBeTruthy();
		expect(screen.getByTestId('slider-x0')).toBeTruthy();
		expect(screen.getByTestId('slider-y0')).toBeTruthy();
		expect(screen.getByTestId('slider-iterations')).toBeTruthy();
		expect(screen.getByTestId('value-x0')).toBeTruthy();
		expect(screen.getByTestId('value-y0')).toBeTruthy();
		expect(screen.getByTestId('value-iterations')).toBeTruthy();
		expect(screen.getByTestId('slider-zoom')).toBeTruthy();
		expect(screen.getByTestId('slider-pointSize')).toBeTruthy();
		expect(screen.getByTestId('slider-opacity')).toBeTruthy();
	});

	it('shows the default active preset as Classic with classic IC values', () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		expect(screen.getByTestId('active-preset').textContent).toMatch(/classic/i);
		// Prefer value-* labels (toFixed) over range-input .value — jsdom can
		// mis-report fractional negatives on <input type="range">.
		expect(screen.getByTestId('value-x0').textContent).toBe('-0.10');
		expect(screen.getByTestId('value-y0').textContent).toBe('0.00');
		expect(screen.getByTestId('value-iterations').textContent).toBe('100000');
	});

	it('applies a preset when clicked (updates committed + draft + active label)', async () => {
		// applyPreset writes committed IC + styling then syncDraftsFromCommitted()
		// so display labels (bound to committed via ParameterSlider) and any
		// full-fidelity render props all match the preset state.
		render(GingerbreadmanPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByRole('button', { name: /Offset Seed/i }));
		expect(screen.getByTestId('active-preset').textContent).toMatch(/offset seed/i);
		expect(screen.getByTestId('value-x0').textContent).toBe('-0.75');
		expect(screen.getByTestId('value-y0').textContent).toBe('0.10');
		expect((screen.getByTestId('slider-x0') as HTMLInputElement).value).toBe('-0.75');
		// Full fidelity → renderer receives committed (synced drafts equal committed).
		const stub = screen.getByTestId('gingerbreadman-renderer-stub');
		expect(stub.getAttribute('data-x0')).toBe('-0.75');
		expect(stub.getAttribute('data-y0')).toBe('0.1');
		expect(stub.getAttribute('data-fidelity')).toBe('full');
	});

	it('marks the active preset button as pressed', () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		const classicBtn = screen.getByRole('button', { name: 'Classic' });
		expect(classicBtn).toHaveAttribute('aria-pressed', 'true');
	});

	it('renders all four preset buttons', () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		for (const name of [/Classic/i, /Near Origin/i, /Offset Seed/i, /Far Field/i]) {
			expect(screen.getByRole('button', { name })).toBeTruthy();
		}
	});

	it('reset restores the classic preset', async () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByRole('button', { name: /Far Field/i }));
		expect(screen.getByTestId('active-preset').textContent).toMatch(/far field/i);
		await fireEvent.click(screen.getByTestId('btn-reset'));
		expect(screen.getByTestId('active-preset').textContent).toMatch(/classic/i);
		expect(screen.getByTestId('value-x0').textContent).toBe('-0.10');
		expect(screen.getByTestId('value-y0').textContent).toBe('0.00');
		expect((screen.getByTestId('slider-x0') as HTMLInputElement).value).toBe('-0.1');
	});

	it('randomize changes x0/y0 into [-5, 5] and becomes CUSTOM', async () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		const beforeX = screen.getByTestId('value-x0').textContent;
		const beforeY = screen.getByTestId('value-y0').textContent;
		// Randomize until at least one IC changes (extremely likely on first try).
		let changed = false;
		for (let i = 0; i < 20 && !changed; i++) {
			await fireEvent.click(screen.getByTestId('btn-randomize'));
			const afterX = screen.getByTestId('value-x0').textContent;
			const afterY = screen.getByTestId('value-y0').textContent;
			changed = afterX !== beforeX || afterY !== beforeY;
		}
		expect(changed).toBe(true);
		const x = Number((screen.getByTestId('slider-x0') as HTMLInputElement).value);
		const y = Number((screen.getByTestId('slider-y0') as HTMLInputElement).value);
		expect(x).toBeGreaterThanOrEqual(-5);
		expect(x).toBeLessThanOrEqual(5);
		expect(y).toBeGreaterThanOrEqual(-5);
		expect(y).toBeLessThanOrEqual(5);
		expect(screen.getByTestId('active-preset').textContent).toMatch(/custom/i);
	});

	it('switches to CUSTOM when a committed IC slider changes', async () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		const slider = screen.getByTestId('slider-x0');
		await fireEvent.input(slider, { target: { value: '1.23' } });
		await fireEvent.change(slider);
		expect(screen.getByTestId('active-preset').textContent).toMatch(/custom/i);
		expect(screen.getByTestId('value-x0').textContent).toBe('1.23');
	});

	it('mid-drag preview drafts do not commit; buildParameters uses committed x0', async () => {
		// Preview-policy x0: pointer drag updates draft (ondraft after throttle)
		// and fidelity=preview feeds the renderer draftX0, but committed x0
		// (and thus buildParameters / stability getParams) stays at classic -0.1
		// until release (change / pointerup).
		vi.useFakeTimers();
		try {
			render(GingerbreadmanPage, { props: unauthedPageProps });
			// Let the mount-time reactive stability debounce fire, then clear.
			await vi.advanceTimersByTimeAsync(400);
			checkParameterStabilityMock.mockClear();

			const slider = screen.getByTestId('slider-x0');
			await fireEvent.pointerDown(slider);
			await fireEvent.input(slider, { target: { value: '3.5' } });
			// Display tracks internal (mid-drag) value.
			expect(screen.getByTestId('value-x0').textContent).toBe('3.50');
			// detectPresetId / buildParameters read committed x0 → still Classic.
			expect(screen.getByTestId('active-preset').textContent).toMatch(/classic/i);

			// Throttled ondraft → draftX0=3.5; fidelity is preview.
			await vi.advanceTimersByTimeAsync(PREVIEW_THROTTLE_MS + 20);
			const stub = screen.getByTestId('gingerbreadman-renderer-stub');
			expect(stub.getAttribute('data-fidelity')).toBe('preview');
			expect(stub.getAttribute('data-x0')).toBe('3.5');

			// Stability should NOT have re-run solely from a draft-only drag
			// (committed x0/y0/iterations are unchanged).
			expect(checkParameterStabilityMock).not.toHaveBeenCalled();

			// Commit the drag → committed x0 becomes 3.5, stability getParams sees it.
			await fireEvent.change(slider);
			await fireEvent.pointerUp(slider);
			await vi.advanceTimersByTimeAsync(400);
			expect(checkParameterStabilityMock).toHaveBeenCalledWith(
				'gingerbreadman',
				expect.objectContaining({ type: 'gingerbreadman', x0: 3.5, y0: 0 })
			);
			expect(screen.getByTestId('active-preset').textContent).toMatch(/custom/i);
		} finally {
			vi.useRealTimers();
		}
	});

	it('changes color mode via select and toggles pointSize/opacity disabled in density', async () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		// Classic preset uses colorMode=iteration → sliders enabled.
		expect((screen.getByTestId('slider-pointSize') as HTMLInputElement).disabled).toBe(false);
		expect((screen.getByTestId('slider-opacity') as HTMLInputElement).disabled).toBe(false);

		const select = screen.getByTestId('select-color-mode') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'density' } });
		expect(select.value).toBe('density');
		expect((screen.getByTestId('slider-pointSize') as HTMLInputElement).disabled).toBe(true);
		expect((screen.getByTestId('slider-opacity') as HTMLInputElement).disabled).toBe(true);
	});

	it('displays the recurrence equations and data log', () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		expect(screen.getByText(/1 − y\(n\) \+ \|x\(n\)\|/i)).toBeTruthy();
		expect(screen.getByText(/DATA_LOG: GINGERBREADMAN_MAP/i)).toBeTruthy();
	});

	it('renders Compare / Return links and Share / Save buttons', () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		expect(screen.getByRole('link', { name: /Compare/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /Return/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Share/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Save/i })).toBeTruthy();
	});

	it('opens and closes the save dialog', async () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByRole('button', { name: /Save/i }));
		expect(screen.getByTestId('dialog-stub-gingerbreadman')).toBeTruthy();
		await fireEvent.click(screen.getByTestId('dialog-close-gingerbreadman'));
		expect(screen.queryByTestId('dialog-stub-gingerbreadman')).toBeNull();
	});

	it('opens the share dialog when Share button is clicked', async () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });
		await fireEvent.click(screen.getByRole('button', { name: /Share/i }));
		expect(screen.getByTestId('dialog-stub-gingerbreadman')).toBeTruthy();
	});

	it('cleans up on unmount without throwing', () => {
		const { unmount } = render(GingerbreadmanPage, { props: unauthedPageProps });
		expect(() => unmount()).not.toThrow();
	});

	it('runs the debounced stability check (getParams) after a committed slider edit', async () => {
		vi.useFakeTimers();
		try {
			checkParameterStabilityMock.mockClear();
			render(GingerbreadmanPage, { props: unauthedPageProps });

			const slider = screen.getByTestId('slider-x0');
			await fireEvent.input(slider, { target: { value: '0.42' } });
			await fireEvent.change(slider);
			await vi.runAllTimersAsync();

			expect(checkParameterStabilityMock).toHaveBeenCalledWith(
				'gingerbreadman',
				expect.objectContaining({ type: 'gingerbreadman', x0: 0.42 })
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it('triggers ondraft for y0 and iterations sliders during drag', async () => {
		vi.useFakeTimers();
		try {
			render(GingerbreadmanPage, { props: unauthedPageProps });
			await vi.advanceTimersByTimeAsync(400);

			// y0 slider drag → ondraft sets draftY0
			const ySlider = screen.getByTestId('slider-y0');
			await fireEvent.pointerDown(ySlider);
			await fireEvent.input(ySlider, { target: { value: '2.5' } });
			await vi.advanceTimersByTimeAsync(PREVIEW_THROTTLE_MS + 20);
			const stub = screen.getByTestId('gingerbreadman-renderer-stub');
			expect(stub.getAttribute('data-fidelity')).toBe('preview');
			expect(stub.getAttribute('data-y0')).toBe('2.5');
			await fireEvent.change(ySlider);
			await fireEvent.pointerUp(ySlider);

			// iterations slider drag → ondraft sets draftIterations
			const iterSlider = screen.getByTestId('slider-iterations');
			await fireEvent.pointerDown(iterSlider);
			await fireEvent.input(iterSlider, { target: { value: '200000' } });
			await vi.advanceTimersByTimeAsync(PREVIEW_THROTTLE_MS + 20);
			expect(stub.getAttribute('data-iterations')).toBe('200000');
			await fireEvent.change(iterSlider);
			await fireEvent.pointerUp(iterSlider);
		} finally {
			vi.useRealTimers();
		}
	});

	it('updates zoom, pointSize, and opacity via live-policy slider edits', async () => {
		render(GingerbreadmanPage, { props: unauthedPageProps });

		// zoom is a live-policy slider → bind:value commits immediately.
		const zoomSlider = screen.getByTestId('slider-zoom');
		await fireEvent.input(zoomSlider, { target: { value: '2.5' } });
		await fireEvent.change(zoomSlider);
		expect(screen.getByTestId('value-zoom').textContent).toBe('2.5');

		// pointSize is live-policy.
		const psSlider = screen.getByTestId('slider-pointSize');
		await fireEvent.input(psSlider, { target: { value: '3.0' } });
		await fireEvent.change(psSlider);
		expect(screen.getByTestId('value-pointSize').textContent).toBe('3.0');

		// opacity is live-policy.
		const opSlider = screen.getByTestId('slider-opacity');
		await fireEvent.input(opSlider, { target: { value: '0.5' } });
		await fireEvent.change(opSlider);
		expect(screen.getByTestId('value-opacity').textContent).toBe('0.50');
	});
});
