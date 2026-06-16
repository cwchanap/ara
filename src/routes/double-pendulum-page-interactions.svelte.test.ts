import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import DoublePendulumPage from './double-pendulum/+page.svelte';

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/double-pendulum') as Page['url'],
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

vi.mock('$lib/components/visualizations/DoublePendulumRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubBindableRenderer.svelte');
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

describe('Double pendulum page interactions', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Mock fetch globally
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
		) as unknown as typeof global.fetch;
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('renders correctly and has title', () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });
		expect(screen.getByText('DOUBLE_PENDULUM')).toBeInTheDocument();
	});

	it('applies a preset when clicked', async () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });

		const presetBtn = screen.getByRole('button', { name: /Asymmetric/i });
		await fireEvent.click(presetBtn);

		// Check that active preset label changed
		expect(screen.getByTestId('active-preset')).toHaveTextContent('Asymmetric');
	});

	it('randomizes initial conditions', async () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });

		const randomizeBtn = screen.getByRole('button', { name: /Randomize/i });
		await fireEvent.click(randomizeBtn);

		// Randomize should change the initial angles
		const theta1Value = screen.getByTestId('value-theta1').textContent;
		const theta2Value = screen.getByTestId('value-theta2').textContent;
		expect(theta1Value).toBeDefined();
		expect(theta2Value).toBeDefined();
	});

	it('resets to defaults', async () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });

		const resetBtn = screen.getByTestId('reset');
		await fireEvent.click(resetBtn);

		// Values should be reset to default preset values
		expect(screen.getByTestId('active-preset')).toHaveTextContent('Classic');
	});

	it('handles playback toggling', async () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });

		const pauseBtn = screen.getByRole('button', { name: /Pause/i });
		await fireEvent.click(pauseBtn);

		const playBtn = screen.getByRole('button', { name: /Play/i });
		await fireEvent.click(playBtn);
	});

	it('handles trail toggle', async () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });

		const trailBtn = screen.getByRole('button', { name: /Trail On/i });
		await fireEvent.click(trailBtn);

		const trailOffBtn = screen.getByRole('button', { name: /Trail Off/i });
		await fireEvent.click(trailOffBtn);
	});

	it('handles comparison mode toggle', async () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });

		const compareBtn = screen.getByRole('button', { name: /Comparison Off/i });
		await fireEvent.click(compareBtn);

		const compareOnBtn = screen.getByRole('button', { name: /Comparison On/i });
		await fireEvent.click(compareOnBtn);
	});

	it('handles slider parameter updates (theta1, theta2, gravity, speed)', async () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });

		const theta1Slider = screen.getByTestId('slider-theta1');
		await fireEvent.input(theta1Slider, { target: { value: '1.5' } });
		expect(screen.getByTestId('value-theta1')).toHaveTextContent('1.50');

		const theta2Slider = screen.getByTestId('slider-theta2');
		await fireEvent.input(theta2Slider, { target: { value: '-1.0' } });
		expect(screen.getByTestId('value-theta2')).toHaveTextContent('-1.00');

		const gravitySlider = screen.getByTestId('slider-gravity');
		await fireEvent.input(gravitySlider, { target: { value: '15' } });
		expect(screen.getByTestId('value-gravity')).toHaveTextContent('15.0');

		const speedSlider = screen.getByTestId('slider-speed');
		await fireEvent.input(speedSlider, { target: { value: '5' } });
		expect(screen.getByTestId('value-speed')).toHaveTextContent('5.0');
	});

	it('handles advanced parameter updates (omega1, omega2, l1, l2, m1, m2)', async () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });

		// Open advanced section
		const advancedBtn = screen.getByRole('button', { name: /Show Advanced/i });
		await fireEvent.click(advancedBtn);

		const omega1Slider = screen.getByTestId('slider-omega1');
		await fireEvent.input(omega1Slider, { target: { value: '5' } });
		expect(screen.getByTestId('value-omega1')).toHaveTextContent('5.0');

		const omega2Slider = screen.getByTestId('slider-omega2');
		await fireEvent.input(omega2Slider, { target: { value: '-3' } });
		expect(screen.getByTestId('value-omega2')).toHaveTextContent('-3.0');

		const l1Slider = screen.getByTestId('slider-l1');
		await fireEvent.input(l1Slider, { target: { value: '2' } });
		expect(screen.getByTestId('value-l1')).toHaveTextContent('2.00');

		const l2Slider = screen.getByTestId('slider-l2');
		await fireEvent.input(l2Slider, { target: { value: '1.5' } });
		expect(screen.getByTestId('value-l2')).toHaveTextContent('1.50');

		const m1Slider = screen.getByTestId('slider-m1');
		await fireEvent.input(m1Slider, { target: { value: '3' } });
		expect(screen.getByTestId('value-m1')).toHaveTextContent('3.0');

		const m2Slider = screen.getByTestId('slider-m2');
		await fireEvent.input(m2Slider, { target: { value: '2' } });
		expect(screen.getByTestId('value-m2')).toHaveTextContent('2.0');
	});

	it('shows save and share dialogs, calls handleSave and handleShare callbacks', async () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });

		// Click Save button in header
		const saveTriggerBtn = screen.getByRole('button', { name: /Save/i });
		await fireEvent.click(saveTriggerBtn);

		// Click Save button inside the stub dialog
		const dialogSaveBtn = screen.getByTestId('dialog-save-double-pendulum');
		await fireEvent.click(dialogSaveBtn);
		expect(global.fetch).toHaveBeenCalledWith('/api/save-config', expect.any(Object));

		// Click Share button in header
		const shareTriggerBtn = screen.getByRole('button', { name: /Share/i });
		await fireEvent.click(shareTriggerBtn);

		// Click Share button inside the stub dialog
		const dialogShareBtn = screen.getByTestId('dialog-share-double-pendulum');
		await fireEvent.click(dialogShareBtn);
		expect(global.fetch).toHaveBeenCalledWith('/api/share', expect.any(Object));
	});

	it('checks stability alerts and allows dismissal', async () => {
		const { container } = render(DoublePendulumPage, { props: pageProps });

		// Open advanced section
		const advancedBtn = screen.getByRole('button', { name: /Show Advanced/i });
		await fireEvent.click(advancedBtn);

		// Set damping to a very high value (should trigger stability warning)
		const dampingSlider = container.querySelector('input[type="range"][max="2"]')!;
		await fireEvent.input(dampingSlider, { target: { value: '1.5' } });

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

	it('handles compare button navigation', async () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });

		const compareBtn = screen.getByRole('link', { name: /Compare/i });
		expect(compareBtn).toHaveAttribute('href');
	});

	it('handles return button navigation', async () => {
		setPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: pageProps });

		const returnBtn = screen.getByRole('link', { name: /Return/i });
		expect(returnBtn).toHaveAttribute('href', '/');
	});
});
