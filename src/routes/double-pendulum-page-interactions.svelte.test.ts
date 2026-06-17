import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	authedPageProps,
	resetMockPageStore,
	restoreFetch,
	setMockPageUrl,
	setupApiFetchMock
} from '$lib/components/testing/page-test-helpers';
import DoublePendulumPage from './double-pendulum/+page.svelte';

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

vi.mock('$lib/components/visualizations/DoublePendulumRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubBindableRenderer.svelte');
	return { default: module.default };
});

describe('Double pendulum page interactions', () => {
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
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });
		expect(screen.getByText('DOUBLE_PENDULUM')).toBeInTheDocument();
	});

	it('applies a preset when clicked', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const presetBtn = screen.getByRole('button', { name: /Asymmetric/i });
		await fireEvent.click(presetBtn);

		// Check that active preset label changed
		expect(screen.getByTestId('active-preset')).toHaveTextContent('Asymmetric');
	});

	it('randomizes initial conditions', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const randomizeBtn = screen.getByRole('button', { name: /Randomize/i });
		await fireEvent.click(randomizeBtn);

		// Randomize should change the initial angles
		const theta1Value = screen.getByTestId('value-theta1').textContent;
		const theta2Value = screen.getByTestId('value-theta2').textContent;
		expect(theta1Value).toBeDefined();
		expect(theta2Value).toBeDefined();
	});

	it('resets to defaults', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const resetBtn = screen.getByTestId('reset');
		await fireEvent.click(resetBtn);

		// Values should be reset to default preset values
		expect(screen.getByTestId('active-preset')).toHaveTextContent('Classic');
	});

	it('handles playback toggling', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const pauseBtn = screen.getByRole('button', { name: /Pause/i });
		await fireEvent.click(pauseBtn);

		const playBtn = screen.getByRole('button', { name: /Play/i });
		await fireEvent.click(playBtn);
	});

	it('handles trail toggle', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const trailBtn = screen.getByRole('button', { name: /Trail On/i });
		await fireEvent.click(trailBtn);

		const trailOffBtn = screen.getByRole('button', { name: /Trail Off/i });
		await fireEvent.click(trailOffBtn);
	});

	it('handles comparison mode toggle', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const compareBtn = screen.getByRole('button', { name: /Comparison Off/i });
		await fireEvent.click(compareBtn);

		const compareOnBtn = screen.getByRole('button', { name: /Comparison On/i });
		await fireEvent.click(compareOnBtn);
	});

	it('handles slider parameter updates (theta1, theta2, gravity, speed)', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

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
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

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
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

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
		render(DoublePendulumPage, { props: authedPageProps });

		// Open advanced section
		const advancedBtn = screen.getByRole('button', { name: /Show Advanced/i });
		await fireEvent.click(advancedBtn);

		// Set damping to a very high value (should trigger stability warning)
		const dampingSlider = screen.getByTestId('slider-damping');
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
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const compareBtn = screen.getByRole('link', { name: /Compare/i });
		expect(compareBtn).toHaveAttribute('href');
	});

	it('handles return button navigation', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const returnBtn = screen.getByRole('link', { name: /Return/i });
		expect(returnBtn).toHaveAttribute('href', '/');
	});

	it('loads configuration from configId URL parameter', async () => {
		vi.useFakeTimers();
		setMockPageUrl('http://localhost/double-pendulum?configId=test-config-123');
		render(DoublePendulumPage, { props: authedPageProps });

		await vi.runAllTimersAsync();
		vi.useRealTimers();
	});

	it('loads configuration from share URL parameter', async () => {
		vi.useFakeTimers();
		setMockPageUrl('http://localhost/double-pendulum?share=test-share-code');
		render(DoublePendulumPage, { props: authedPageProps });

		await vi.runAllTimersAsync();
		vi.useRealTimers();
	});

	it('loads configuration from config URL parameter', async () => {
		setMockPageUrl('http://localhost/double-pendulum?config=eyJ0aGV0YTEiOjEuNX0=');
		render(DoublePendulumPage, { props: authedPageProps });
	});

	it('handles config load error and shows error alert', async () => {
		vi.useFakeTimers();
		global.fetch = vi.fn().mockImplementation(() =>
			Promise.resolve({
				ok: false,
				json: () => Promise.resolve({ errors: ['Configuration not found'] })
			} as Response)
		) as unknown as typeof global.fetch;

		setMockPageUrl('http://localhost/double-pendulum?configId=invalid-config');
		render(DoublePendulumPage, { props: authedPageProps });

		await vi.runAllTimersAsync();
		vi.useRealTimers();
	});

	it('dismisses config error alert', async () => {
		vi.useFakeTimers();
		global.fetch = vi.fn().mockImplementation(() =>
			Promise.resolve({
				ok: false,
				json: () => Promise.resolve({ errors: ['Configuration not found'] })
			} as Response)
		) as unknown as typeof global.fetch;

		setMockPageUrl('http://localhost/double-pendulum?configId=invalid-config');
		render(DoublePendulumPage, { props: authedPageProps });

		await vi.runAllTimersAsync();

		const dismissBtn = screen.getByRole('button', { name: /Dismiss config error/i });
		await fireEvent.click(dismissBtn);

		vi.useRealTimers();
	});

	it('handles toggle play when diverged', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		await fireEvent.click(screen.getByTestId('stub-trigger-diverged'));
		const stubDiv = screen.getByTestId('stub-trigger-diverged').parentElement;
		expect(stubDiv?.getAttribute('data-diverged')).toBe('true');

		const playBtn = screen.getByTestId('toggle-play');
		await fireEvent.click(playBtn);
		expect(stubDiv?.getAttribute('data-diverged')).toBe('false');
		expect(stubDiv?.getAttribute('data-running')).toBe('true');
	});

	it('toggles advanced section visibility', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const showBtn = screen.getByRole('button', { name: /Show Advanced/i });
		await fireEvent.click(showBtn);

		const hideBtn = screen.getByRole('button', { name: /Hide Advanced/i });
		expect(hideBtn).toBeInTheDocument();

		await fireEvent.click(hideBtn);
		expect(screen.getByRole('button', { name: /Show Advanced/i })).toBeInTheDocument();
	});

	it('handles damping parameter update', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const advancedBtn = screen.getByRole('button', { name: /Show Advanced/i });
		await fireEvent.click(advancedBtn);

		const dampingSlider = screen.getByTestId('slider-damping');
		await fireEvent.input(dampingSlider, { target: { value: '0.5' } });
		expect(screen.getByTestId('value-damping')).toHaveTextContent('0.5');
	});

	it('handles trail length parameter update', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const advancedBtn = screen.getByRole('button', { name: /Show Advanced/i });
		await fireEvent.click(advancedBtn);

		const trailLengthSlider = screen.getByTestId('slider-trailLength');
		await fireEvent.input(trailLengthSlider, { target: { value: '500' } });
		expect(screen.getByTestId('value-trailLength')).toHaveTextContent('500');
	});

	it('handles compare offset parameter update', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const advancedBtn = screen.getByRole('button', { name: /Show Advanced/i });
		await fireEvent.click(advancedBtn);

		const compareOffsetSlider = screen.getByTestId('slider-compareOffset');
		await fireEvent.input(compareOffsetSlider, { target: { value: '0.01' } });
		expect(screen.getByTestId('value-compareOffset')).toHaveTextContent('0.01');
	});

	it('aborts previous config load when new config is loaded', async () => {
		global.fetch = vi.fn().mockImplementation(() => {
			return new Promise((resolve) => {
				setTimeout(() => {
					resolve({
						ok: true,
						json: () => Promise.resolve({ ok: true, parameters: {} })
					} as Response);
				}, 100);
			});
		}) as unknown as typeof global.fetch;

		const abortSpy = vi.spyOn(AbortController.prototype, 'abort');

		try {
			setMockPageUrl('http://localhost/double-pendulum?configId=first');
			render(DoublePendulumPage, { props: authedPageProps });

			// Quickly change to another config — this should abort the first in-flight load.
			setMockPageUrl('http://localhost/double-pendulum?configId=second');
			await vi.runAllTimersAsync();

			// The first config load's AbortController must have been aborted.
			expect(abortSpy).toHaveBeenCalled();
		} finally {
			abortSpy.mockRestore();
		}
	});

	it('handles invalid config parameter gracefully', async () => {
		setMockPageUrl('http://localhost/double-pendulum?config=invalid-json');
		render(DoublePendulumPage, { props: authedPageProps });

		// Invalid config must not crash the page — it should fall back to defaults
		// and still render the title and a default parameter value.
		expect(screen.getByText('DOUBLE_PENDULUM')).toBeInTheDocument();
		expect(screen.getByTestId('slider-theta1')).toBeInTheDocument();
	});

	it('preserves running state when applying preset', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const pauseBtn = screen.getByRole('button', { name: /Pause/i });
		await fireEvent.click(pauseBtn);

		const presetBtn = screen.getByRole('button', { name: /Asymmetric/i });
		await fireEvent.click(presetBtn);

		// Preset should reset running to true
		const playBtn = screen.getByRole('button', { name: /Pause/i });
		expect(playBtn).toBeInTheDocument();
	});

	it('clears divergence when applying preset', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		await fireEvent.click(screen.getByTestId('stub-trigger-diverged'));
		const stubDiv = screen.getByTestId('stub-trigger-diverged').parentElement;
		expect(stubDiv?.getAttribute('data-diverged')).toBe('true');

		const presetBtn = screen.getByRole('button', { name: /Asymmetric/i });
		await fireEvent.click(presetBtn);

		expect(stubDiv?.getAttribute('data-diverged')).toBe('false');
	});

	it('increments restart signal when applying preset', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const presetBtn = screen.getByRole('button', { name: /Asymmetric/i });
		await fireEvent.click(presetBtn);

		const stubDiv = screen.getByTestId('stub-trigger-diverged').parentElement;
		expect(stubDiv?.getAttribute('data-restart-signal')).not.toBe('0');
	});

	it('clears divergence when randomizing', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		await fireEvent.click(screen.getByTestId('stub-trigger-diverged'));
		const stubDiv = screen.getByTestId('stub-trigger-diverged').parentElement;
		expect(stubDiv?.getAttribute('data-diverged')).toBe('true');

		const randomizeBtn = screen.getByRole('button', { name: /Randomize/i });
		await fireEvent.click(randomizeBtn);

		expect(stubDiv?.getAttribute('data-diverged')).toBe('false');
	});

	it('sets running to true when randomizing', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const pauseBtn = screen.getByRole('button', { name: /Pause/i });
		await fireEvent.click(pauseBtn);

		const randomizeBtn = screen.getByRole('button', { name: /Randomize/i });
		await fireEvent.click(randomizeBtn);

		const playBtn = screen.getByRole('button', { name: /Pause/i });
		expect(playBtn).toBeInTheDocument();
	});

	it('increments restart signal when randomizing', async () => {
		setMockPageUrl('http://localhost/double-pendulum');
		render(DoublePendulumPage, { props: authedPageProps });

		const randomizeBtn = screen.getByRole('button', { name: /Randomize/i });
		await fireEvent.click(randomizeBtn);

		const stubDiv = screen.getByTestId('stub-trigger-diverged').parentElement;
		expect(stubDiv?.getAttribute('data-restart-signal')).not.toBe('0');
	});
});
