import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import { encodeComparisonState } from '$lib/comparison-url-state';
import DoublePendulumComparePage from './double-pendulum/compare/+page.svelte';

const mockGoto = vi.hoisted(() => vi.fn());

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/double-pendulum/compare?compare=true') as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: { session: null, user: null, profile: null },
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

vi.mock('$app/stores', () => ({ page: { subscribe: pageStore.subscribe } }));
vi.mock('$app/paths', () => ({ base: '' }));
vi.mock('$app/navigation', () => ({ goto: mockGoto }));
vi.mock('$lib/components/visualizations/DoublePendulumRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubBindableRenderer.svelte');
	return { default: m.default };
});

function setPageUrl(url: string) {
	pageStore.set({
		url: new URL(url) as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: { session: null, user: null, profile: null },
		form: null,
		state: {}
	});
}

describe('Double pendulum compare page interactions', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
		mockGoto.mockClear();
	});

	it('updates the URL when left parameters change', async () => {
		vi.useFakeTimers();
		setPageUrl('http://localhost/double-pendulum/compare?compare=true');
		render(DoublePendulumComparePage);

		const leftGravity = document.getElementById('left-gravity') as HTMLInputElement;
		await fireEvent.input(leftGravity, { target: { value: '12.5' } });
		vi.advanceTimersByTime(400);

		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('updates the URL when right parameters change', async () => {
		vi.useFakeTimers();
		setPageUrl('http://localhost/double-pendulum/compare?compare=true');
		render(DoublePendulumComparePage);

		const rightGravity = document.getElementById('right-gravity') as HTMLInputElement;
		await fireEvent.input(rightGravity, { target: { value: '18' } });
		vi.advanceTimersByTime(400);

		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('swaps left and right parameters via ComparisonLayout', async () => {
		vi.useFakeTimers();
		setPageUrl('http://localhost/double-pendulum/compare?compare=true');
		render(DoublePendulumComparePage);

		const leftTheta1 = document.getElementById('left-theta1') as HTMLInputElement;
		const rightTheta1 = document.getElementById('right-theta1') as HTMLInputElement;
		const initialLeft = leftTheta1.value;
		const initialRight = rightTheta1.value;

		await fireEvent.click(screen.getByRole('button', { name: /Swap/i }));
		vi.advanceTimersByTime(400);

		// After swap, left should have right's original value
		expect(leftTheta1.value).toBe(initialRight);
		expect(rightTheta1.value).toBe(initialLeft);
		expect(mockGoto).toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('surfaces a notice when out-of-range encoded parameters are clamped', () => {
		const state = encodeComparisonState({
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 999,
				damping: 0
			},
			right: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0
			}
		});
		setPageUrl(`http://localhost/double-pendulum/compare?${state.toString()}`);
		render(DoublePendulumComparePage);

		expect(screen.getByTestId('config-corrected-notice')).toBeTruthy();
		const leftGravity = document.getElementById('left-gravity') as HTMLInputElement;
		expect(leftGravity.value).toBe('50');
	});

	it('recovers left playback after renderer divergence', async () => {
		setPageUrl('http://localhost/double-pendulum/compare?compare=true');
		render(DoublePendulumComparePage);

		const stubs = screen.getAllByTestId('stub');
		await fireEvent.click(screen.getAllByTestId('stub-trigger-diverged')[0]);
		expect(stubs[0].getAttribute('data-diverged')).toBe('true');

		const leftBtn = screen.getByTestId('left-toggle-play');
		await fireEvent.click(leftBtn);
		expect(stubs[0].getAttribute('data-diverged')).toBe('false');
		expect(stubs[0].getAttribute('data-running')).toBe('true');
	});

	it('recovers right playback after renderer divergence', async () => {
		setPageUrl('http://localhost/double-pendulum/compare?compare=true');
		render(DoublePendulumComparePage);

		const stubs = screen.getAllByTestId('stub');
		await fireEvent.click(screen.getAllByTestId('stub-trigger-diverged')[1]);
		expect(stubs[1].getAttribute('data-diverged')).toBe('true');

		const rightBtn = screen.getByTestId('right-toggle-play');
		await fireEvent.click(rightBtn);
		expect(stubs[1].getAttribute('data-diverged')).toBe('false');
		expect(stubs[1].getAttribute('data-running')).toBe('true');
	});

	it('dismisses the config corrected notice', () => {
		const state = encodeComparisonState({
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 999,
				damping: 0
			},
			right: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0
			}
		});
		setPageUrl(`http://localhost/double-pendulum/compare?${state.toString()}`);
		render(DoublePendulumComparePage);

		expect(screen.getByTestId('config-corrected-notice')).toBeTruthy();

		const dismissBtn = screen.getByRole('button', { name: /Dismiss notice/i });
		fireEvent.click(dismissBtn);

		expect(screen.queryByTestId('config-corrected-notice')).toBeNull();
	});

	it('updates all left parameters individually', async () => {
		vi.useFakeTimers();
		setPageUrl('http://localhost/double-pendulum/compare?compare=true');
		render(DoublePendulumComparePage);

		// Test theta1
		const leftTheta1 = document.getElementById('left-theta1') as HTMLInputElement;
		await fireEvent.input(leftTheta1, { target: { value: '1.0' } });
		vi.advanceTimersByTime(400);
		expect(leftTheta1.value).toBe('1.0');

		// Test theta2
		const leftTheta2 = document.getElementById('left-theta2') as HTMLInputElement;
		await fireEvent.input(leftTheta2, { target: { value: '-0.5' } });
		vi.advanceTimersByTime(400);
		expect(leftTheta2.value).toBe('-0.5');

		// Test l1
		const leftL1 = document.getElementById('left-l1') as HTMLInputElement;
		await fireEvent.input(leftL1, { target: { value: '2.5' } });
		vi.advanceTimersByTime(400);
		expect(leftL1.value).toBe('2.5');

		// Test l2
		const leftL2 = document.getElementById('left-l2') as HTMLInputElement;
		await fireEvent.input(leftL2, { target: { value: '1.8' } });
		vi.advanceTimersByTime(400);
		expect(leftL2.value).toBe('1.8');

		// Test m1
		const leftM1 = document.getElementById('left-m1') as HTMLInputElement;
		await fireEvent.input(leftM1, { target: { value: '5.0' } });
		vi.advanceTimersByTime(400);
		expect(leftM1.value).toBe('5.0');

		// Test m2
		const leftM2 = document.getElementById('left-m2') as HTMLInputElement;
		await fireEvent.input(leftM2, { target: { value: '3.0' } });
		vi.advanceTimersByTime(400);
		expect(leftM2.value).toBe('3.0');

		vi.useRealTimers();
	});

	it('updates all right parameters individually', async () => {
		vi.useFakeTimers();
		setPageUrl('http://localhost/double-pendulum/compare?compare=true');
		render(DoublePendulumComparePage);

		// Test theta1
		const rightTheta1 = document.getElementById('right-theta1') as HTMLInputElement;
		await fireEvent.input(rightTheta1, { target: { value: '0.5' } });
		vi.advanceTimersByTime(400);
		expect(rightTheta1.value).toBe('0.5');

		// Test theta2
		const rightTheta2 = document.getElementById('right-theta2') as HTMLInputElement;
		await fireEvent.input(rightTheta2, { target: { value: '1.5' } });
		vi.advanceTimersByTime(400);
		expect(rightTheta2.value).toBe('1.5');

		// Test l1
		const rightL1 = document.getElementById('right-l1') as HTMLInputElement;
		await fireEvent.input(rightL1, { target: { value: '3.0' } });
		vi.advanceTimersByTime(400);
		expect(rightL1.value).toBe('3.0');

		// Test l2
		const rightL2 = document.getElementById('right-l2') as HTMLInputElement;
		await fireEvent.input(rightL2, { target: { value: '2.0' } });
		vi.advanceTimersByTime(400);
		expect(rightL2.value).toBe('2.0');

		// Test m1
		const rightM1 = document.getElementById('right-m1') as HTMLInputElement;
		await fireEvent.input(rightM1, { target: { value: '4.0' } });
		vi.advanceTimersByTime(400);
		expect(rightM1.value).toBe('4.0');

		// Test m2
		const rightM2 = document.getElementById('right-m2') as HTMLInputElement;
		await fireEvent.input(rightM2, { target: { value: '2.5' } });
		vi.advanceTimersByTime(400);
		expect(rightM2.value).toBe('2.5');

		vi.useRealTimers();
	});

	it('clamps negative gravity to minimum', () => {
		const state = encodeComparisonState({
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: -10,
				damping: 0
			},
			right: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0
			}
		});
		setPageUrl(`http://localhost/double-pendulum/compare?${state.toString()}`);
		render(DoublePendulumComparePage);

		expect(screen.getByTestId('config-corrected-notice')).toBeTruthy();
		const leftGravity = document.getElementById('left-gravity') as HTMLInputElement;
		expect(leftGravity.value).toBe('0');
	});

	it('clamps excessive damping to maximum', () => {
		const state = encodeComparisonState({
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 10
			},
			right: {
				type: 'double-pendulum',
				theta1: Math.PI / 2,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0
			}
		});
		setPageUrl(`http://localhost/double-pendulum/compare?${state.toString()}`);
		render(DoublePendulumComparePage);

		expect(screen.getByTestId('config-corrected-notice')).toBeTruthy();
	});

	it('toggles left play/pause state', async () => {
		setPageUrl('http://localhost/double-pendulum/compare?compare=true');
		render(DoublePendulumComparePage);

		const leftBtn = screen.getByTestId('left-toggle-play');
		expect(leftBtn).toHaveTextContent('⏸ Pause');

		await fireEvent.click(leftBtn);
		expect(leftBtn).toHaveTextContent('▶ Play');

		await fireEvent.click(leftBtn);
		expect(leftBtn).toHaveTextContent('⏸ Pause');
	});

	it('toggles right play/pause state', async () => {
		setPageUrl('http://localhost/double-pendulum/compare?compare=true');
		render(DoublePendulumComparePage);

		const rightBtn = screen.getByTestId('right-toggle-play');
		expect(rightBtn).toHaveTextContent('⏸ Pause');

		await fireEvent.click(rightBtn);
		expect(rightBtn).toHaveTextContent('▶ Play');

		await fireEvent.click(rightBtn);
		expect(rightBtn).toHaveTextContent('⏸ Pause');
	});
});
