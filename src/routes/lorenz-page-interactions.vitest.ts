import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import LorenzPage from './lorenz/+page.svelte';

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/lorenz') as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: {
			session: { user: { id: 'test' } },
			user: { id: 'test' },
			profile: {
				id: 'test',
				username: 'testuser',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-01'
			}
		},
		form: null,
		state: {}
	};
	const subscribers = new Set<(value: Page) => void>();
	return {
		subscribe(run: (value: Page) => void) {
			run(value);
			subscribers.add(run);
			return () => subscribers.delete(run);
		},
		set(next: Page) {
			value = next;
			subscribers.forEach((subscriber) => subscriber(value));
		}
	};
});

vi.mock('$app/stores', () => ({
	page: { subscribe: pageStore.subscribe }
}));

vi.mock('$app/paths', () => ({
	base: ''
}));

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

function setPageUrl(url: string) {
	pageStore.set({
		url: new URL(url) as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: {
			session: { user: { id: 'test' } },
			user: { id: 'test' },
			profile: {
				id: 'test',
				username: 'testuser',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-01'
			}
		},
		form: null,
		state: {}
	});
}

const pageProps = {
	data: {
		session: { user: { id: 'test' } },
		user: { id: 'test' },
		profile: {
			id: 'test',
			username: 'testuser',
			createdAt: '2024-01-01',
			updatedAt: '2024-01-01'
		}
	}
};

describe('Lorenz page interactions', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Mock fetch globally
		// @ts-expect-error mocking fetch in tests
		global.fetch = vi.fn().mockImplementation(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						success: true,
						shareUrl: 'http://loc/shared',
						expiresAt: '2026-06-03'
					})
			} as Response)
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('renders correctly and has title', () => {
		setPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: pageProps });
		expect(screen.getByText('LORENZ_ATTRACTOR')).toBeInTheDocument();
	});

	it('applies a preset when clicked', async () => {
		setPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: pageProps });

		const presetBtn = screen.getByRole('button', { name: /High Energy/i });
		await fireEvent.click(presetBtn);

		// rho slider value should change to 40.00
		expect(screen.getByText('40.00')).toBeInTheDocument();
	});

	it('randomizes and resets initial state', async () => {
		setPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: pageProps });

		const randomizeBtn = screen.getByRole('button', { name: /Randomize/i });
		await fireEvent.click(randomizeBtn);

		// There are two "Reset" buttons in DOM: the first is in InitialStateControls
		const resetBtns = screen.getAllByRole('button', { name: 'Reset' });
		await fireEvent.click(resetBtns[0]);

		// values should be reset to defaults
		expect(screen.getByLabelText('x₀')).toHaveValue(0.1);
	});

	it('resets camera zoom and view mode', async () => {
		setPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: pageProps });

		const resetCamBtn = screen.getByRole('button', { name: /Reset Camera/i });
		await fireEvent.click(resetCamBtn);
	});

	it('handles playback toggling and step/reset triggers', async () => {
		setPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: pageProps });

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
		setPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: pageProps });

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
		const { container } = render(LorenzPage, { props: pageProps });

		// Trail Controls
		const trailSlider = container.querySelector('input[type="range"][max="100000"]')!;
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
		setPageUrl('http://localhost/lorenz');
		render(LorenzPage, { props: pageProps });

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
		const { container } = render(LorenzPage, { props: pageProps });

		// Open ADVANCED to find dt input slider
		const summary = screen.getByText(/ADVANCED/i);
		await fireEvent.click(summary);

		// Select Euler solver (prone to blow up with dt > 0.01)
		const solverSelect = screen.getByLabelText(/Solver/i);
		await fireEvent.change(solverSelect, { target: { value: 'euler' } });

		// Set dt to 0.015 (which triggers Euler blow-up warning)
		const dtSlider = container.querySelector('input[type="range"][max="0.02"]')!;
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
});
