/**
 * Tests for compare page interactions:
 * - Swap button triggers handleLeftParamsChange / handleRightParamsChange
 * - Debounced goto is called after parameter changes
 * - Newton compare validateParameters logic
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import type { Page } from '@sveltejs/kit';
import type { ChaosMapParameters, LorenzParameters } from '$lib/types';

import LyapunovComparePage from './lyapunov/compare/+page.svelte';
import NewtonComparePage from './newton/compare/+page.svelte';
import RosslerComparePage from './rossler/compare/+page.svelte';
import HenonComparePage from './henon/compare/+page.svelte';
import LogisticComparePage from './logistic/compare/+page.svelte';
import BifurcationLogisticComparePage from './bifurcation-logistic/compare/+page.svelte';
import BifurcationHenonComparePage from './bifurcation-henon/compare/+page.svelte';
import ChaosEsthetiqueComparePage from './chaos-esthetique/compare/+page.svelte';
import LorenzComparePage from './lorenz/compare/+page.svelte';
import LoziComparePage from './lozi/compare/+page.svelte';
import StandardComparePage from './standard/compare/+page.svelte';
import IkedaComparePage from './ikeda/compare/+page.svelte';

const gotoMock = vi.hoisted(() => vi.fn());

const pageStore = vi.hoisted(() => {
	let value: Page = {
		url: new URL('http://localhost/') as Page['url'],
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
			subscribers.forEach((s) => s(value));
		}
	};
});

vi.mock('$app/stores', () => ({
	page: { subscribe: pageStore.subscribe }
}));

vi.mock('$app/paths', () => ({ base: '' }));

vi.mock('$app/navigation', () => ({
	goto: gotoMock
}));

vi.mock('$lib/components/visualizations/LyapunovRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/NewtonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/RosslerRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/HenonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LogisticRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/BifurcationLogisticRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/BifurcationHenonRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/ChaosEsthetiqueRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LorenzRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/LoziRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/StandardRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
	return { default: m.default };
});
vi.mock('$lib/components/visualizations/IkedaRenderer.svelte', async () => {
	const m = await import('$lib/components/testing/StubComponent.svelte');
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

describe('newton compare – debounced goto', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('calls goto after 300ms when rendered with valid params', async () => {
		setPageUrl('http://localhost/newton/compare?compare=true');
		render(NewtonComparePage);

		// Initial render triggers $effect which debounces a goto call
		vi.advanceTimersByTime(300);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/newton/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});

	it('calls handleLeftParamsChange via swap button click', async () => {
		setPageUrl('http://localhost/newton/compare?compare=true');
		render(NewtonComparePage);

		// Clear any pending timers from initial render
		vi.clearAllTimers();
		gotoMock.mockReset();

		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);

		// Swap calls goto immediately via ComparisonLayout.handleSwap
		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/newton/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});

	it('validateParameters prevents goto when xMin >= xMax', async () => {
		// Encode state with invalid params (xMin >= xMax)
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const invalidState = encodeComparisonState({
			compare: true,
			left: { type: 'newton', xMin: 2, xMax: -2, yMin: -2, yMax: 2, maxIterations: 50 },
			right: { type: 'newton', xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 50 }
		});

		setPageUrl(`http://localhost/newton/compare?${invalidState.toString()}`);
		render(NewtonComparePage);

		vi.advanceTimersByTime(300);

		// goto should NOT be called because validateParameters returns false
		expect(gotoMock).not.toHaveBeenCalled();
	});
});

describe('lyapunov compare – swap and goto', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('does not call goto on initial render (initialized guard)', async () => {
		setPageUrl('http://localhost/lyapunov/compare?compare=true');
		render(LyapunovComparePage);

		vi.advanceTimersByTime(300);

		// lyapunov compare has `initialized` guard – first run just sets initialized=true
		expect(gotoMock).not.toHaveBeenCalled();
	});

	it('calls handleLeftParamsChange and handleRightParamsChange via swap', async () => {
		setPageUrl('http://localhost/lyapunov/compare?compare=true');
		render(LyapunovComparePage);

		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);

		// Swap calls goto immediately via ComparisonLayout.handleSwap
		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/lyapunov/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});

	it('calls goto after parameter change (second effect run)', async () => {
		setPageUrl('http://localhost/lyapunov/compare?compare=true');
		render(LyapunovComparePage);

		// First run sets initialized=true; change a slider to trigger second run
		vi.clearAllTimers();
		const slider = document.querySelector<HTMLInputElement>('#left-rmin');
		if (slider) {
			slider.value = '3.0';
			await fireEvent.input(slider);
		}

		vi.advanceTimersByTime(300);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/lyapunov/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});
});

describe('rossler compare – swap', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('calls handleLeftParamsChange and handleRightParamsChange via swap', async () => {
		setPageUrl('http://localhost/rossler/compare?compare=true');
		render(RosslerComparePage);

		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/rossler/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});
});

describe('henon compare – swap', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('calls goto after initial parameter change', async () => {
		setPageUrl('http://localhost/henon/compare?compare=true');
		render(HenonComparePage);

		vi.advanceTimersByTime(300);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/henon/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});

	it('calls swap handler via button click', async () => {
		setPageUrl('http://localhost/henon/compare?compare=true');
		render(HenonComparePage);

		vi.clearAllTimers();
		gotoMock.mockReset();

		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/henon/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});
});

describe('logistic compare – swap', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('calls goto after initial parameter change', async () => {
		setPageUrl('http://localhost/logistic/compare?compare=true');
		render(LogisticComparePage);

		vi.advanceTimersByTime(300);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/logistic/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});
});

describe('bifurcation-logistic compare – swap', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('calls goto after initial parameter change', async () => {
		setPageUrl('http://localhost/bifurcation-logistic/compare?compare=true');
		render(BifurcationLogisticComparePage);

		vi.advanceTimersByTime(300);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/bifurcation-logistic/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});
});

describe('bifurcation-henon compare – swap', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('calls goto after initial parameter change', async () => {
		setPageUrl('http://localhost/bifurcation-henon/compare?compare=true');
		render(BifurcationHenonComparePage);

		vi.advanceTimersByTime(300);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/bifurcation-henon/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});
});

describe('chaos-esthetique compare – swap', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('calls goto after initial parameter change', async () => {
		setPageUrl('http://localhost/chaos-esthetique/compare?compare=true');
		render(ChaosEsthetiqueComparePage);

		vi.advanceTimersByTime(300);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/chaos-esthetique/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});
});

describe('lorenz compare – swap', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('does not call goto on initial render (initialized guard)', async () => {
		setPageUrl('http://localhost/lorenz/compare?compare=true');
		render(LorenzComparePage);

		vi.advanceTimersByTime(300);

		// lorenz has `initialized` guard — first run just sets initialized=true
		expect(gotoMock).not.toHaveBeenCalled();
	});

	it('calls swap handler via button click', async () => {
		setPageUrl('http://localhost/lorenz/compare?compare=true');
		render(LorenzComparePage);

		vi.clearAllTimers();
		gotoMock.mockReset();

		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/lorenz/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});

	it('swap carries extended fields (solver, viewMode, trailLength) to the other side', async () => {
		// Encode left with extended fields, right without
		const { encodeComparisonState, decodeComparisonState } = await import(
			'$lib/comparison-url-state'
		);
		const state = encodeComparisonState({
			compare: true,
			left: {
				type: 'lorenz',
				sigma: 10,
				rho: 28,
				beta: 8 / 3,
				solver: 'rk4',
				viewMode: 'xz',
				trailLength: 15000
			},
			right: {
				type: 'lorenz',
				sigma: 14,
				rho: 35,
				beta: 2.5,
				solver: 'euler',
				viewMode: 'xy',
				trailLength: 5000
			}
		});

		setPageUrl(`http://localhost/lorenz/compare?${state.toString()}`);
		render(LorenzComparePage);

		vi.clearAllTimers();
		gotoMock.mockReset();

		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/lorenz/compare'),
			expect.objectContaining({ replaceState: true })
		);

		// Verify the swapped URL contains the correct extended fields
		const gotoUrl = gotoMock.mock.calls[0][0] as string;
		const gotoUrlObj = new URL(gotoUrl, 'http://localhost');
		const swapped = decodeComparisonState(gotoUrlObj, 'lorenz');
		expect(swapped).not.toBeNull();

		// After swap: left should have right's extended fields
		const leftParams = swapped!.left as LorenzParameters;
		expect(leftParams.solver).toBe('euler');
		expect(leftParams.viewMode).toBe('xy');
		expect(leftParams.trailLength).toBe(5000);

		// After swap: right should have left's extended fields
		const rightParams = swapped!.right as LorenzParameters;
		expect(rightParams.solver).toBe('rk4');
		expect(rightParams.viewMode).toBe('xz');
		expect(rightParams.trailLength).toBe(15000);
	});

	it('redirects in onMount when compare parameter is missing in URL', async () => {
		setPageUrl('http://localhost/lorenz/compare');
		render(LorenzComparePage);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/lorenz/compare?compare=true'),
			expect.objectContaining({ replaceState: true })
		);
	});

	it('updates URL via urlUpdater when a slider parameter changes', async () => {
		setPageUrl('http://localhost/lorenz/compare?compare=true');
		render(LorenzComparePage);

		// First run sets initialized=true; clear timers and mocks
		vi.clearAllTimers();
		gotoMock.mockReset();

		// Change left-sigma slider value
		const slider = document.querySelector<HTMLInputElement>('#left-sigma');
		if (slider) {
			slider.value = '15';
			await fireEvent.input(slider);
		}

		// Run timers to trigger debounced urlUpdater
		vi.advanceTimersByTime(300);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/lorenz/compare?compare=true'),
			expect.objectContaining({ replaceState: true })
		);
	});

	it('falls back to defaults when decoded params are not lorenz params', async () => {
		const { encodeComparisonState } = await import('$lib/comparison-url-state');
		const state = encodeComparisonState({
			compare: true,
			left: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 } as unknown as ChaosMapParameters,
			right: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 } as unknown as ChaosMapParameters
		});

		setPageUrl(`http://localhost/lorenz/compare?${state.toString()}`);
		render(LorenzComparePage);

		// It should still render using default lorenz values
		expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
	});
});

describe('lozi compare – swap', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('calls goto after initial parameter change', async () => {
		setPageUrl('http://localhost/lozi/compare?compare=true');
		render(LoziComparePage);

		vi.advanceTimersByTime(300);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/lozi/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});
});

describe('standard compare – swap', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('calls goto after initial parameter change', async () => {
		setPageUrl('http://localhost/standard/compare?compare=true');
		render(StandardComparePage);

		vi.advanceTimersByTime(300);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/standard/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});
});

describe('ikeda compare – swap and goto', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('calls goto after initial parameter change', async () => {
		setPageUrl('http://localhost/ikeda/compare?compare=true');
		render(IkedaComparePage);

		vi.advanceTimersByTime(300);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/ikeda/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});

	it('calls swap handler via button click', async () => {
		setPageUrl('http://localhost/ikeda/compare?compare=true');
		render(IkedaComparePage);

		vi.clearAllTimers();
		gotoMock.mockReset();

		const swapBtn = screen.getByText('⇄ Swap');
		await fireEvent.click(swapBtn);

		expect(gotoMock).toHaveBeenCalledWith(
			expect.stringContaining('/ikeda/compare'),
			expect.objectContaining({ replaceState: true })
		);
	});
});

describe('ComparisonLayout – exit compare button', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gotoMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('clicking Exit Compare calls goto to the base map page', async () => {
		setPageUrl('http://localhost/henon/compare?compare=true');
		render(HenonComparePage);

		vi.clearAllTimers();
		gotoMock.mockReset();

		const exitBtn = screen.getByText('← Exit Compare');
		await fireEvent.click(exitBtn);

		expect(gotoMock).toHaveBeenCalledWith(expect.stringContaining('/henon'));
	});
});
