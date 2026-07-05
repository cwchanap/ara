import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	authedPageProps,
	resetMockPageStore,
	restoreFetch,
	setMockPageUrl,
	setupApiFetchMock
} from '$lib/components/testing/page-test-helpers';
import LorenzPage from './lorenz/+page.svelte';

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

vi.mock('$lib/components/visualizations/LorenzRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/LorenzRendererStub.svelte');
	return { default: module.default };
});

describe('Lorenz page interactions', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setupApiFetchMock();
	});

	afterEach(() => {
		vi.useRealTimers();
		restoreFetch();
		resetMockPageStore();
		cleanup();
	});

	it('renders correctly and has title', () => {
		setMockPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: authedPageProps });
		expect(screen.getByText('LORENZ_ATTRACTOR')).toBeInTheDocument();
	});

	it('applies a preset when clicked', async () => {
		setMockPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: authedPageProps });

		const presetBtn = screen.getByRole('button', { name: /High Energy/i });
		await fireEvent.click(presetBtn);

		// rho slider value should change to 40.00
		expect(screen.getByText('40.00')).toBeInTheDocument();
	});

	it('randomizes and resets initial state', async () => {
		setMockPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: authedPageProps });

		const randomizeBtn = screen.getByRole('button', { name: /Randomize/i });
		await fireEvent.click(randomizeBtn);

		// There are two "Reset" buttons in DOM: the first is in InitialStateControls
		const resetBtns = screen.getAllByRole('button', { name: 'Reset' });
		await fireEvent.click(resetBtns[0]);

		// values should be reset to defaults
		expect(screen.getByLabelText('x₀')).toHaveValue(0.1);
	});

	it('resets camera zoom and view mode', async () => {
		setMockPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: authedPageProps });

		const resetCamBtn = screen.getByRole('button', { name: /Reset Camera/i });
		await fireEvent.click(resetCamBtn);
	});

	it('handles playback toggling and step/reset triggers', async () => {
		setMockPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: authedPageProps });

		const pauseBtn = screen.getByRole('button', { name: /Pause/i });
		await fireEvent.click(pauseBtn);

		const playBtn = screen.getByRole('button', { name: /Play/i });
		await fireEvent.click(playBtn);

		const stepBtn = screen.getByRole('button', { name: /Step/i });
		await fireEvent.click(stepBtn);

		// Second "Reset" button in DOM is Simulation playback Reset
		const resetBtns = screen.getAllByRole('button', { name: 'Reset' });
		await fireEvent.click(resetBtns[1]);
	});

	it('handles slider parameter updates (sigma, rho, beta)', async () => {
		setMockPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: authedPageProps });

		const sigmaSlider = screen.getByLabelText(/sigma/i);
		await fireEvent.input(sigmaSlider, { target: { value: '15' } });
		expect(screen.getByText('15.00')).toBeInTheDocument();

		const rhoSlider = screen.getByLabelText(/rho/i);
		await fireEvent.input(rhoSlider, { target: { value: '35' } });
		expect(screen.getByText('35.00')).toBeInTheDocument();

		const betaSlider = screen.getByLabelText(/beta/i);
		await fireEvent.input(betaSlider, { target: { value: '4' } });
		expect(screen.getByText('4.00')).toBeInTheDocument();
	});

	it('handles optional parameter controls (color mode, trail length, view mode, solver)', async () => {
		const { container } = render(LorenzPage, { props: authedPageProps });

		// Trail Controls
		const trailSlider = screen.getByTestId('slider-trailLength');
		await fireEvent.input(trailSlider, { target: { value: '25000' } });

		const cumulativeBtn = screen.getByRole('button', { name: /Cumulative/i });
		await fireEvent.click(cumulativeBtn);

		// Color Mode
		const speedRadio = container.querySelector('input[type="radio"][value="speed"]')!;
		await fireEvent.click(speedRadio);

		// View Mode
		const xyBtn = screen.getByRole('button', { name: /XY/i });
		await fireEvent.click(xyBtn);

		// Advanced / Solver controls
		const summary = screen.getByText(/ADVANCED/i);
		await fireEvent.click(summary);

		const solverSelect = screen.getByLabelText(/Solver/i);
		await fireEvent.change(solverSelect, { target: { value: 'euler' } });
	});

	it('shows save and share dialogs, calls handleSave and handleShare callbacks', async () => {
		setMockPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: authedPageProps });

		// Click Save button in header
		const saveTriggerBtn = screen.getByRole('button', { name: /Save/i });
		await fireEvent.click(saveTriggerBtn);

		// Click Save button inside the stub dialog
		const dialogSaveBtn = screen.getByTestId('dialog-save-lorenz');
		await fireEvent.click(dialogSaveBtn);
		expect(global.fetch).toHaveBeenCalledWith('/api/save-config', expect.any(Object));

		// Click Share button in header
		const shareTriggerBtn = screen.getByRole('button', { name: /Share/i });
		await fireEvent.click(shareTriggerBtn);

		// Click Share button inside the stub dialog
		const dialogShareBtn = screen.getByTestId('dialog-share-lorenz');
		await fireEvent.click(dialogShareBtn);
		expect(global.fetch).toHaveBeenCalledWith('/api/share', expect.any(Object));
	});

	it('checks stability alerts and allows dismissal', async () => {
		render(LorenzPage, { props: authedPageProps });

		// Open ADVANCED to find dt input slider
		const summary = screen.getByText(/ADVANCED/i);
		await fireEvent.click(summary);

		// Select Euler solver (prone to blow up with dt > 0.01)
		const solverSelect = screen.getByLabelText(/Solver/i);
		await fireEvent.change(solverSelect, { target: { value: 'euler' } });

		// Set dt to 0.015 (which triggers Euler blow-up warning)
		const dtSlider = screen.getByTestId('slider-dt');
		await fireEvent.input(dtSlider, { target: { value: '0.015' } });

		// Run timers to trigger debounced stability checker
		await vi.runAllTimersAsync();

		// Stability warning alert should be visible
		expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();

		// Dismiss stability warning alert
		const dismissBtn = screen.getByRole('button', { name: /Dismiss warning/i });
		await fireEvent.click(dismissBtn);

		// Warning should be hidden
		expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).not.toBeInTheDocument();
	});

	it('propagates InitialStateControls edits through onChange', async () => {
		setMockPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: authedPageProps });

		// Edit each numeric initial-state input; each fires oninput -> onChange
		const x0Input = screen.getByLabelText('x₀');
		await fireEvent.input(x0Input, { target: { value: '2.5' } });
		expect(x0Input).toHaveValue(2.5);

		const y0Input = screen.getByLabelText('y₀');
		await fireEvent.input(y0Input, { target: { value: '-1.5' } });
		expect(y0Input).toHaveValue(-1.5);

		const z0Input = screen.getByLabelText('z₀');
		await fireEvent.input(z0Input, { target: { value: '4.25' } });
		expect(z0Input).toHaveValue(4.25);

		const epsilonInput = screen.getByLabelText('ε');
		await fireEvent.input(epsilonInput, { target: { value: '0.05' } });
		expect(epsilonInput).toHaveValue(0.05);

		// Toggle the ghost-orbit checkbox -> emit({ showGhost })
		const ghostCheckbox = screen.getByLabelText(/Show Perturbed Orbit/i);
		await fireEvent.click(ghostCheckbox);
		expect(ghostCheckbox).toBeChecked();
	});

	it('propagates PlaybackControls speed slider through onSpeedChange', async () => {
		setMockPageUrl('http://localhost/lorenz');
		const { container } = render(LorenzPage, { props: authedPageProps });

		// The SIMULATION speed slider is the range input with max="5".
		const speedSlider = container.querySelector(
			'input[type="range"][max="5"]'
		) as HTMLInputElement;
		expect(speedSlider).toBeTruthy();
		await fireEvent.input(speedSlider, { target: { value: '3.2' } });

		// The speed readout should reflect the new value
		expect(screen.getByText('3.2x')).toBeInTheDocument();
	});

	it('dismisses the divergence alert raised by the renderer', async () => {
		setMockPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: authedPageProps });

		// The LorenzRendererStub sets diverged=true on mount; flush any
		// pending microtasks/timers so the alert renders.
		await vi.runAllTimersAsync();

		// Divergence alert should be visible
		expect(screen.getByText(/numerical integration diverged/i)).toBeInTheDocument();

		// Dismiss it
		const dismissBtn = screen.getByRole('button', { name: /Dismiss divergence alert/i });
		await fireEvent.click(dismissBtn);

		// Alert should be hidden
		expect(screen.queryByText(/numerical integration diverged/i)).not.toBeInTheDocument();
	});
});
