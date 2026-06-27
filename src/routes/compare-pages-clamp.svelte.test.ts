/**
 * Compare page clamp/edge coverage tests.
 * Covers the clampValue/clampParams branches that handle out-of-range
 * parameters decoded from encoded comparison URLs, plus type-guard fallbacks
 * and the config-corrected notice on the double-pendulum compare page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import { setMockPageUrl, createUnauthedPageData } from '$lib/components/testing/page-test-helpers';

import LoziComparePage from './lozi/compare/+page.svelte';
import IkedaComparePage from './ikeda/compare/+page.svelte';
import CliffordComparePage from './clifford/compare/+page.svelte';
import DoublePendulumComparePage from './double-pendulum/compare/+page.svelte';
import StandardComparePage from './standard/compare/+page.svelte';
import LorenzComparePage from './lorenz/compare/+page.svelte';
import ChuaComparePage from './chua/compare/+page.svelte';
import LyapunovComparePage from './lyapunov/compare/+page.svelte';
import LogisticComparePage from './logistic/compare/+page.svelte';
import BifurcationLogisticComparePage from './bifurcation-logistic/compare/+page.svelte';
import BifurcationHenonComparePage from './bifurcation-henon/compare/+page.svelte';
import ChaosEsthetiqueComparePage from './chaos-esthetique/compare/+page.svelte';
import RosslerComparePage from './rossler/compare/+page.svelte';
import HenonComparePage from './henon/compare/+page.svelte';
import NewtonComparePage from './newton/compare/+page.svelte';

const gotoMock = vi.hoisted(() => vi.fn());

vi.mock('$app/stores', async () => {
	const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
	return { page: mockPageStore };
});
vi.mock('$app/paths', async () => {
	const { BASE_PATH } = await import('$lib/components/testing/page-test-helpers');
	return { base: BASE_PATH };
});
vi.mock('$app/navigation', () => ({ goto: gotoMock }));

// Mock all renderers used by compare pages
vi.mock('$lib/components/visualizations/LoziRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/IkedaRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/CliffordRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/DoublePendulumRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/StandardRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LorenzRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/ChuaRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LyapunovRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LogisticRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/BifurcationLogisticRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/BifurcationHenonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/ChaosEsthetiqueRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/RosslerRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/HenonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/NewtonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: m.default };
});

const unauthedData = createUnauthedPageData();

function setPageUrl(url: string) {
	setMockPageUrl(url, unauthedData);
}

function getSliderValue(id: string): string | null {
	const slider = document.querySelector<HTMLInputElement>(`#${id}`);
	return slider?.value ?? null;
}

describe('compare pages – clamp and edge cases', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	// ── Pages with clampValue/clampParams (out-of-range → clamped) ──

	it('lozi compare clamps out-of-range a to max 2', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'lozi', a: 999, b: 0.5, x0: 0.1, y0: 0, iterations: 1000 },
			right: { type: 'lozi', a: 1.7, b: 0.5, x0: 0.1, y0: 0, iterations: 1000 }
		});

		setPageUrl(`http://localhost/lozi/compare?${state.toString()}`);
		render(LoziComparePage);

		vi.advanceTimersByTime(300);
		// a=999 should be clamped to max 2
		expect(getSliderValue('left-a')).toBe('2');
	});

	it('ikeda compare clamps out-of-range u to max 1', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'ikeda', u: 999, x0: 0, y0: 0, iterations: 1000, burnIn: 100 },
			right: { type: 'ikeda', u: 0.7, x0: 0, y0: 0, iterations: 1000, burnIn: 100 }
		});

		setPageUrl(`http://localhost/ikeda/compare?${state.toString()}`);
		render(IkedaComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-u')).toBe('1');
	});

	it('clifford compare clamps out-of-range a to max 3', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'clifford', a: 999, b: 1, c: 1, d: 1, iterations: 10000 },
			right: { type: 'clifford', a: 1.5, b: 1, c: 1, d: 1, iterations: 10000 }
		});

		setPageUrl(`http://localhost/clifford/compare?${state.toString()}`);
		render(CliffordComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-a')).toBe('3');
	});

	it('double-pendulum compare clamps out-of-range gravity to max 50 and shows correction notice', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: 1,
				theta2: 1,
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
				theta1: 1,
				theta2: 1,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.8,
				damping: 0
			}
		});

		setPageUrl(`http://localhost/double-pendulum/compare?${state.toString()}`);
		const { container } = render(DoublePendulumComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-gravity')).toBe('50');
		// The correction notice should be visible since gravity was clamped
		expect(container.querySelector('[data-testid="config-corrected-notice"]')).not.toBeNull();
	});

	it('standard compare clamps out-of-range k to slider max 5 (stable-range clamp 10)', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'standard', k: 999, numP: 10, numQ: 10, iterations: 5000 },
			right: { type: 'standard', k: 1, numP: 10, numQ: 10, iterations: 5000 }
		});

		setPageUrl(`http://localhost/standard/compare?${state.toString()}`);
		render(StandardComparePage);

		vi.advanceTimersByTime(300);
		// clampValue clamps k=999 to stable-range max 10, then the slider's
		// own max=5 further constrains the displayed value.
		expect(getSliderValue('left-k')).toBe('5');
	});

	it('standard compare clamps out-of-range numP to slider max 20 (via clampInt)', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'standard', k: 1, numP: 999, numQ: 10, iterations: 5000 },
			right: { type: 'standard', k: 1, numP: 10, numQ: 10, iterations: 5000 }
		});

		setPageUrl(`http://localhost/standard/compare?${state.toString()}`);
		render(StandardComparePage);

		vi.advanceTimersByTime(300);
		// clampInt rounds and clamps numP=999 to stable-range max 100, then
		// the slider's own max=20 further constrains the displayed value.
		expect(getSliderValue('left-nump')).toBe('20');
	});

	// ── Pages with type guards (type mismatch → defaults) ──

	it('lorenz compare falls back to defaults when encoded type mismatches', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			// Encode rossler params for a lorenz compare page → type mismatch
			left: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 } as never,
			right: { type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 }
		});

		setPageUrl(`http://localhost/lorenz/compare?${state.toString()}`);
		render(LorenzComparePage);

		vi.advanceTimersByTime(300);
		// Left should fall back to defaults (sigma=10)
		expect(getSliderValue('left-sigma')).toBe('10');
	});

	it('chua compare falls back to defaults when encoded type mismatches', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 } as never,
			right: { type: 'chua', alpha: 15.6, beta: 28, gamma: 0, a: -1.143, b: -0.714 }
		});

		setPageUrl(`http://localhost/chua/compare?${state.toString()}`);
		render(ChuaComparePage);

		vi.advanceTimersByTime(300);
		// Left should fall back to defaults (alpha=15.6)
		expect(getSliderValue('left-alpha')).toBe('15.6');
	});

	it('lyapunov compare falls back to defaults when encoded type mismatches', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 } as never,
			right: {
				type: 'lyapunov',
				rMin: 2.5,
				rMax: 4.0,
				iterations: 1000,
				transientIterations: 500
			}
		});

		setPageUrl(`http://localhost/lyapunov/compare?${state.toString()}`);
		render(LyapunovComparePage);

		vi.advanceTimersByTime(300);
		// Left should fall back to defaults
		expect(getSliderValue('left-rmin')).not.toBeNull();
	});

	// ── Simple pages (no clamp, just ?? default) ──

	it('logistic compare renders with encoded state', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'logistic', r: 3.7, x0: 0.5, iterations: 100 },
			right: { type: 'logistic', r: 3.9, x0: 0.3, iterations: 150 }
		});

		setPageUrl(`http://localhost/logistic/compare?${state.toString()}`);
		render(LogisticComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-r')).toBe('3.7');
	});

	it('bifurcation-logistic compare renders with encoded state', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'bifurcation-logistic', rMin: 3.5, rMax: 4.0, maxIterations: 1000 },
			right: { type: 'bifurcation-logistic', rMin: 2.5, rMax: 3.5, maxIterations: 500 }
		});

		setPageUrl(`http://localhost/bifurcation-logistic/compare?${state.toString()}`);
		render(BifurcationLogisticComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-rmin')).toBe('3.5');
	});

	it('bifurcation-henon compare renders with encoded state', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'bifurcation-henon', aMin: 1.2, aMax: 1.4, b: 0.3, maxIterations: 200 },
			right: { type: 'bifurcation-henon', aMin: 1.0, aMax: 1.5, b: 0.3, maxIterations: 300 }
		});

		setPageUrl(`http://localhost/bifurcation-henon/compare?${state.toString()}`);
		render(BifurcationHenonComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-amin')).toBe('1.2');
	});

	it('bifurcation-henon compare clamps aMin below limit', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'bifurcation-henon', aMin: 0.1, aMax: 1.4, b: 0.3, maxIterations: 200 },
			right: { type: 'bifurcation-henon', aMin: 1.0, aMax: 1.5, b: 0.3, maxIterations: 300 }
		});

		setPageUrl(`http://localhost/bifurcation-henon/compare?${state.toString()}`);
		render(BifurcationHenonComparePage);

		vi.advanceTimersByTime(300);
		// aMin should be clamped to aMinLimit (0.5)
		expect(getSliderValue('left-amin')).toBe('0.5');
	});

	it('bifurcation-henon compare clamps aMax above limit', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'bifurcation-henon', aMin: 1.0, aMax: 2.0, b: 0.3, maxIterations: 200 },
			right: { type: 'bifurcation-henon', aMin: 1.0, aMax: 1.5, b: 0.3, maxIterations: 300 }
		});

		setPageUrl(`http://localhost/bifurcation-henon/compare?${state.toString()}`);
		render(BifurcationHenonComparePage);

		vi.advanceTimersByTime(300);
		// aMax should be clamped to aMaxLimit (1.5)
		expect(getSliderValue('left-amax')).toBe('1.5');
	});

	it('chaos-esthetique compare renders with encoded state', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'chaos-esthetique', a: 1.5, b: 0.9, x0: 18, y0: 0, iterations: 10000 },
			right: { type: 'chaos-esthetique', a: 0.8, b: 0.9999, x0: 10, y0: 5, iterations: 5000 }
		});

		setPageUrl(`http://localhost/chaos-esthetique/compare?${state.toString()}`);
		render(ChaosEsthetiqueComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-a')).toBe('1.5');
	});

	it('rossler compare renders with encoded state', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 },
			right: { type: 'rossler', a: 0.3, b: 0.3, c: 7.0 }
		});

		setPageUrl(`http://localhost/rossler/compare?${state.toString()}`);
		render(RosslerComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-a')).toBe('0.2');
	});

	it('henon compare renders with encoded state', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 },
			right: { type: 'henon', a: 1.2, b: 0.3, iterations: 1000 }
		});

		setPageUrl(`http://localhost/henon/compare?${state.toString()}`);
		render(HenonComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-a')).toBe('1.4');
	});

	it('newton compare prevents goto when xMin >= xMax (validateParameters)', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'newton', xMin: 5, xMax: -5, yMin: -2, yMax: 2, maxIterations: 50 },
			right: { type: 'newton', xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 50 }
		});

		setPageUrl(`http://localhost/newton/compare?${state.toString()}`);
		render(NewtonComparePage);

		gotoMock.mockReset();
		vi.advanceTimersByTime(300);
		expect(gotoMock).not.toHaveBeenCalled();
	});

	// ── Null/no-state rendering (params ?? defaultParams branch) ──

	it('lozi compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/lozi/compare?compare=true');
		render(LoziComparePage);

		vi.advanceTimersByTime(300);
		// Should render with default slider values
		expect(getSliderValue('left-a')).not.toBeNull();
	});

	it('lorenz compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/lorenz/compare?compare=true');
		render(LorenzComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-sigma')).not.toBeNull();
	});

	// ── Slider debounce → goto ──

	it('lozi compare calls goto after debounce when slider changes', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'lozi', a: 1.7, b: 0.5, x0: 0.1, y0: 0, iterations: 1000 },
			right: { type: 'lozi', a: 1.7, b: 0.5, x0: 0.1, y0: 0, iterations: 1000 }
		});

		setPageUrl(`http://localhost/lozi/compare?${state.toString()}`);
		render(LoziComparePage);

		gotoMock.mockReset();

		// Change a slider to trigger debounce
		const slider = document.querySelector<HTMLInputElement>('#left-a');
		if (slider) {
			slider.value = '1.5';
			slider.dispatchEvent(new Event('input', { bubbles: true }));
		}

		vi.advanceTimersByTime(300);
		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/lozi/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});

	// ── Swap button triggers handleLeftParamsChange/handleRightParamsChange ──

	it('lozi compare swap button triggers handleLeftParamsChange and handleRightParamsChange', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'lozi', a: 1.7, b: 0.5, x0: 0.1, y0: 0, iterations: 1000 },
			right: { type: 'lozi', a: 1.5, b: 0.3, x0: 0.2, y0: 0.1, iterations: 2000 }
		});

		setPageUrl(`http://localhost/lozi/compare?${state.toString()}`);
		render(LoziComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);

		// Swap should call goto with swapped state
		expect(gotoMock).toHaveBeenCalled();
	});

	it('logistic compare swap button triggers handleLeftParamsChange and handleRightParamsChange', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'logistic', r: 3.7, x0: 0.5, iterations: 100 },
			right: { type: 'logistic', r: 3.9, x0: 0.3, iterations: 150 }
		});

		setPageUrl(`http://localhost/logistic/compare?${state.toString()}`);
		render(LogisticComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('bifurcation-logistic compare swap button triggers param change handlers', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'bifurcation-logistic', rMin: 3.5, rMax: 4.0, maxIterations: 1000 },
			right: { type: 'bifurcation-logistic', rMin: 2.5, rMax: 3.5, maxIterations: 500 }
		});

		setPageUrl(`http://localhost/bifurcation-logistic/compare?${state.toString()}`);
		render(BifurcationLogisticComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('bifurcation-henon compare swap button triggers param change handlers', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'bifurcation-henon', aMin: 1.2, aMax: 1.4, b: 0.3, maxIterations: 200 },
			right: { type: 'bifurcation-henon', aMin: 1.0, aMax: 1.5, b: 0.3, maxIterations: 300 }
		});

		setPageUrl(`http://localhost/bifurcation-henon/compare?${state.toString()}`);
		render(BifurcationHenonComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('chaos-esthetique compare swap button triggers param change handlers', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'chaos-esthetique', a: 1.5, b: 0.9, x0: 18, y0: 0, iterations: 10000 },
			right: { type: 'chaos-esthetique', a: 0.8, b: 0.9999, x0: 10, y0: 5, iterations: 5000 }
		});

		setPageUrl(`http://localhost/chaos-esthetique/compare?${state.toString()}`);
		render(ChaosEsthetiqueComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('standard compare swap button triggers param change handlers', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'standard', k: 1, numP: 10, numQ: 10, iterations: 5000 },
			right: { type: 'standard', k: 2, numP: 15, numQ: 20, iterations: 10000 }
		});

		setPageUrl(`http://localhost/standard/compare?${state.toString()}`);
		render(StandardComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('clifford compare swap button triggers param change handlers', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'clifford', a: -1.7, b: 1.8, c: -1.9, d: -0.4, iterations: 10000 },
			right: { type: 'clifford', a: 1.5, b: 1, c: 1, d: 1, iterations: 10000 }
		});

		setPageUrl(`http://localhost/clifford/compare?${state.toString()}`);
		render(CliffordComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('chua compare swap button triggers param change handlers', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'chua', alpha: 15.6, beta: 28, gamma: 0, a: -1.143, b: -0.714 },
			right: { type: 'chua', alpha: 10, beta: 30, gamma: 0, a: -1, b: -0.5 }
		});

		setPageUrl(`http://localhost/chua/compare?${state.toString()}`);
		render(ChuaComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('ikeda compare swap button triggers param change handlers', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'ikeda', u: 0.9, x0: 0, y0: 0, iterations: 1000, burnIn: 100 },
			right: { type: 'ikeda', u: 0.7, x0: 0.1, y0: 0.1, iterations: 2000, burnIn: 200 }
		});

		setPageUrl(`http://localhost/ikeda/compare?${state.toString()}`);
		render(IkedaComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	// ── bifurcation-henon: minChanged/maxChanged clamp branches (lines 52-57, 71-76) ──

	it('bifurcation-henon compare left minChanged && !maxChanged when aMin clamped above aMax', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'bifurcation-henon', aMin: 0.1, aMax: 0.4, b: 0.3, maxIterations: 200 },
			right: { type: 'bifurcation-henon', aMin: 1.0, aMax: 1.5, b: 0.3, maxIterations: 300 }
		});

		setPageUrl(`http://localhost/bifurcation-henon/compare?${state.toString()}`);
		render(BifurcationHenonComparePage);

		vi.advanceTimersByTime(300);
		// aMin clamped to 0.5, aMax stays 0.4 → 0.5 >= 0.4 → minChanged && !maxChanged
		// → leftAMax = Math.min(1.5, 0.5 + 0.01) = 0.51
		expect(Number(getSliderValue('left-amax'))).toBeCloseTo(0.51, 5);
	});

	it('bifurcation-henon compare left else branch when aMax clamped to equal aMin', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'bifurcation-henon', aMin: 1.5, aMax: 2.0, b: 0.3, maxIterations: 200 },
			right: { type: 'bifurcation-henon', aMin: 1.0, aMax: 1.5, b: 0.3, maxIterations: 300 }
		});

		setPageUrl(`http://localhost/bifurcation-henon/compare?${state.toString()}`);
		render(BifurcationHenonComparePage);

		vi.advanceTimersByTime(300);
		// aMax clamped to 1.5, aMin stays 1.5 → 1.5 >= 1.5 → else branch
		// → leftAMin = Math.max(0.5, 1.5 - 0.01) = 1.49
		expect(Number(getSliderValue('left-amin'))).toBeCloseTo(1.49, 5);
	});

	it('bifurcation-henon compare right minChanged && !maxChanged when aMin clamped above aMax', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'bifurcation-henon', aMin: 1.0, aMax: 1.5, b: 0.3, maxIterations: 200 },
			right: { type: 'bifurcation-henon', aMin: 0.1, aMax: 0.4, b: 0.3, maxIterations: 300 }
		});

		setPageUrl(`http://localhost/bifurcation-henon/compare?${state.toString()}`);
		render(BifurcationHenonComparePage);

		vi.advanceTimersByTime(300);
		// right aMin clamped to 0.5, aMax stays 0.4 → minChanged && !maxChanged
		expect(Number(getSliderValue('right-amax'))).toBeCloseTo(0.51, 5);
	});

	it('bifurcation-henon compare right else branch when aMax clamped to equal aMin', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'bifurcation-henon', aMin: 1.0, aMax: 1.5, b: 0.3, maxIterations: 200 },
			right: { type: 'bifurcation-henon', aMin: 1.5, aMax: 2.0, b: 0.3, maxIterations: 300 }
		});

		setPageUrl(`http://localhost/bifurcation-henon/compare?${state.toString()}`);
		render(BifurcationHenonComparePage);

		vi.advanceTimersByTime(300);
		// right aMax clamped to 1.5, aMin stays 1.5 → else branch
		expect(Number(getSliderValue('right-amin'))).toBeCloseTo(1.49, 5);
	});

	it('bifurcation-henon compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/bifurcation-henon/compare?compare=true');
		render(BifurcationHenonComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-amin')).not.toBeNull();
	});

	// ── bifurcation-logistic: rMin > rMax clamp (lines 43, 50) ──

	it('bifurcation-logistic compare clamps rMin > rMax for both sides', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'bifurcation-logistic', rMin: 3.9, rMax: 3.5, maxIterations: 1000 },
			right: { type: 'bifurcation-logistic', rMin: 3.9, rMax: 3.5, maxIterations: 500 }
		});

		setPageUrl(`http://localhost/bifurcation-logistic/compare?${state.toString()}`);
		render(BifurcationLogisticComparePage);

		vi.advanceTimersByTime(300);
		// rMin > rMax → rMax should be set to rMin
		expect(Number(getSliderValue('left-rmax'))).toBeCloseTo(3.9, 5);
		expect(Number(getSliderValue('right-rmax'))).toBeCloseTo(3.9, 5);
	});

	it('bifurcation-logistic compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/bifurcation-logistic/compare?compare=true');
		render(BifurcationLogisticComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-rmin')).not.toBeNull();
	});

	// ── newton: valid params, swap, no-encode (lines 41, 43, 92, 126-138, 147-148) ──

	it('newton compare calls goto after debounce with valid params', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'newton', xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 50 },
			right: { type: 'newton', xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 50 }
		});

		setPageUrl(`http://localhost/newton/compare?${state.toString()}`);
		render(NewtonComparePage);

		gotoMock.mockReset();
		vi.advanceTimersByTime(300);
		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/newton/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});

	it('newton compare swap button triggers param change handlers', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'newton', xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 50 },
			right: { type: 'newton', xMin: -1, xMax: 1, yMin: -1, yMax: 1, maxIterations: 30 }
		});

		setPageUrl(`http://localhost/newton/compare?${state.toString()}`);
		render(NewtonComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('newton compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/newton/compare?compare=true');
		render(NewtonComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-xmin')).not.toBeNull();
	});

	// ── No-encode tests for branch coverage (?? default branches) ──

	it('chaos-esthetique compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/chaos-esthetique/compare?compare=true');
		render(ChaosEsthetiqueComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-a')).not.toBeNull();
	});

	it('ikeda compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/ikeda/compare?compare=true');
		render(IkedaComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-u')).not.toBeNull();
	});

	it('standard compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/standard/compare?compare=true');
		render(StandardComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-k')).not.toBeNull();
	});

	it('clifford compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/clifford/compare?compare=true');
		render(CliffordComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-a')).not.toBeNull();
	});

	it('logistic compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/logistic/compare?compare=true');
		render(LogisticComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-r')).not.toBeNull();
	});

	it('henon compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/henon/compare?compare=true');
		render(HenonComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-a')).not.toBeNull();
	});

	it('rossler compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/rossler/compare?compare=true');
		render(RosslerComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-a')).not.toBeNull();
	});

	it('lyapunov compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/lyapunov/compare?compare=true');
		render(LyapunovComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-rmin')).not.toBeNull();
	});

	it('double-pendulum compare renders with defaults when no encoded state', async () => {
		setPageUrl('http://localhost/double-pendulum/compare?compare=true');
		render(DoublePendulumComparePage);

		vi.advanceTimersByTime(300);
		expect(getSliderValue('left-gravity')).not.toBeNull();
	});

	// ── Swap tests for pages without them (covers handleLeftParamsChange/handleRightParamsChange) ──

	it('henon compare swap button triggers param change handlers', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 },
			right: { type: 'henon', a: 1.2, b: 0.3, iterations: 1000 }
		});

		setPageUrl(`http://localhost/henon/compare?${state.toString()}`);
		render(HenonComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('rossler compare swap button triggers param change handlers', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 },
			right: { type: 'rossler', a: 0.3, b: 0.3, c: 7.0 }
		});

		setPageUrl(`http://localhost/rossler/compare?${state.toString()}`);
		render(RosslerComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('lyapunov compare swap button triggers debounce goto', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: {
				type: 'lyapunov',
				rMin: 2.5,
				rMax: 4.0,
				iterations: 1000,
				transientIterations: 500
			},
			right: {
				type: 'lyapunov',
				rMin: 3.0,
				rMax: 3.8,
				iterations: 1000,
				transientIterations: 500
			}
		});

		setPageUrl(`http://localhost/lyapunov/compare?${state.toString()}`);
		render(LyapunovComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		await tick();
		vi.advanceTimersByTime(300);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('lorenz compare swap button triggers param change handlers and debounce', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 },
			right: { type: 'lorenz', sigma: 14, rho: 30, beta: 8 / 3 }
		});

		setPageUrl(`http://localhost/lorenz/compare?${state.toString()}`);
		render(LorenzComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		await tick();
		vi.advanceTimersByTime(300);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('chua compare swap button triggers debounce goto via useDebouncedEffect', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'chua', alpha: 15.6, beta: 28, gamma: 0, a: -1.143, b: -0.714 },
			right: { type: 'chua', alpha: 10, beta: 30, gamma: 0, a: -1, b: -0.5 }
		});

		setPageUrl(`http://localhost/chua/compare?${state.toString()}`);
		render(ChuaComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		await tick();
		vi.advanceTimersByTime(300);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('double-pendulum compare swap button triggers param change handlers', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: 1,
				theta2: 1,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.8,
				damping: 0
			},
			right: {
				type: 'double-pendulum',
				theta1: 2,
				theta2: 0.5,
				omega1: 0,
				omega2: 0,
				l1: 1.5,
				l2: 0.8,
				m1: 2,
				m2: 0.5,
				gravity: 12,
				damping: 0.1
			}
		});

		setPageUrl(`http://localhost/double-pendulum/compare?${state.toString()}`);
		render(DoublePendulumComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		expect(gotoMock).toHaveBeenCalled();
	});

	// ── onMount goto tests (without compare=true) ──

	it('lorenz compare calls goto on mount when compare param is missing', async () => {
		setPageUrl('http://localhost/lorenz/compare');
		render(LorenzComparePage);

		await tick();
		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/lorenz/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});

	it('chua compare calls goto on mount when compare param is missing', async () => {
		setPageUrl('http://localhost/chua/compare');
		render(ChuaComparePage);

		await tick();
		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/chua/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});

	// ── double-pendulum: dismiss notice and toggle play ──

	it('double-pendulum compare dismiss notice button hides the notice', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: 1,
				theta2: 1,
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
				theta1: 1,
				theta2: 1,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.8,
				damping: 0
			}
		});

		setPageUrl(`http://localhost/double-pendulum/compare?${state.toString()}`);
		const { container } = render(DoublePendulumComparePage);

		vi.advanceTimersByTime(300);
		const notice = container.querySelector('[data-testid="config-corrected-notice"]');
		expect(notice).not.toBeNull();
		const dismissBtn = notice?.querySelector('button');
		expect(dismissBtn).not.toBeNull();
		if (dismissBtn) {
			await fireEvent.click(dismissBtn);
		}
		expect(container.querySelector('[data-testid="config-corrected-notice"]')).toBeNull();
	});

	it('double-pendulum compare toggle play buttons work', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: 1,
				theta2: 1,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.8,
				damping: 0
			},
			right: {
				type: 'double-pendulum',
				theta1: 1,
				theta2: 1,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.8,
				damping: 0
			}
		});

		setPageUrl(`http://localhost/double-pendulum/compare?${state.toString()}`);
		render(DoublePendulumComparePage);

		vi.advanceTimersByTime(300);

		const leftPlayBtn = screen.getByTestId('left-toggle-play');
		await fireEvent.click(leftPlayBtn);

		const rightPlayBtn = screen.getByTestId('right-toggle-play');
		await fireEvent.click(rightPlayBtn);
	});

	it('double-pendulum compare toggle play recovers from divergence', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: {
				type: 'double-pendulum',
				theta1: 1,
				theta2: 1,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.8,
				damping: 0
			},
			right: {
				type: 'double-pendulum',
				theta1: 1,
				theta2: 1,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.8,
				damping: 0
			}
		});

		setPageUrl(`http://localhost/double-pendulum/compare?${state.toString()}`);
		render(DoublePendulumComparePage);

		vi.advanceTimersByTime(300);

		// Simulate divergence on both sides via stub buttons
		const divergedBtns = screen.getAllByTestId('stub-trigger-diverged');
		await fireEvent.click(divergedBtns[0]);
		await fireEvent.click(divergedBtns[1]);

		// Click play to recover from divergence
		const leftPlayBtn = screen.getByTestId('left-toggle-play');
		await fireEvent.click(leftPlayBtn);

		const rightPlayBtn = screen.getByTestId('right-toggle-play');
		await fireEvent.click(rightPlayBtn);
	});

	// ── Debounce cleanup coverage: swap + tick triggers $effect re-run ──

	it('chaos-esthetique compare swap triggers debounce cleanup and goto', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'chaos-esthetique', a: 1.5, b: 0.9, x0: 18, y0: 0, iterations: 10000 },
			right: { type: 'chaos-esthetique', a: 0.8, b: 0.9999, x0: 10, y0: 5, iterations: 5000 }
		});

		setPageUrl(`http://localhost/chaos-esthetique/compare?${state.toString()}`);
		render(ChaosEsthetiqueComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		await tick();
		vi.advanceTimersByTime(300);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('ikeda compare swap triggers debounce cleanup and goto', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'ikeda', u: 0.9, x0: 0, y0: 0, iterations: 1000, burnIn: 100 },
			right: { type: 'ikeda', u: 0.7, x0: 0.1, y0: 0.1, iterations: 2000, burnIn: 200 }
		});

		setPageUrl(`http://localhost/ikeda/compare?${state.toString()}`);
		render(IkedaComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		await tick();
		vi.advanceTimersByTime(300);
		expect(gotoMock).toHaveBeenCalled();
	});

	it('logistic compare swap triggers debounce cleanup and goto', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'logistic', r: 3.7, x0: 0.5, iterations: 100 },
			right: { type: 'logistic', r: 3.9, x0: 0.3, iterations: 150 }
		});

		setPageUrl(`http://localhost/logistic/compare?${state.toString()}`);
		render(LogisticComparePage);

		gotoMock.mockReset();
		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);
		await tick();
		vi.advanceTimersByTime(300);
		expect(gotoMock).toHaveBeenCalled();
	});
});
