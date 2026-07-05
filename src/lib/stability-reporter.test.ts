import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStabilityReporter } from './stability-reporter';
import { DEBOUNCE_MS } from './constants';

describe('createStabilityReporter', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('reactive: true pushes warnings into the report callback after the debounce', () => {
		const report = vi.fn();
		const stability = createStabilityReporter({
			mapType: 'lorenz',
			// sigma=9999 is far outside the stable [0, 50] range.
			getParams: () => ({ type: 'lorenz', sigma: 9999, rho: 28, beta: 8 / 3 }),
			reactive: true
		});
		const unsubscribe = stability.stabilityReporter(report);

		stability.triggerReactive();
		expect(report).not.toHaveBeenCalled();

		vi.advanceTimersByTime(DEBOUNCE_MS);
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0][0]).not.toBeNull();
		expect(report.mock.calls[0][0].length).toBeGreaterThan(0);

		unsubscribe();
	});

	it('cleanupReactive cancels a pending debounced check so the report callback is not invoked', () => {
		const report = vi.fn();
		const stability = createStabilityReporter({
			mapType: 'lorenz',
			getParams: () => ({ type: 'lorenz', sigma: 9999, rho: 28, beta: 8 / 3 }),
			reactive: true
		});
		stability.stabilityReporter(report);

		stability.triggerReactive();
		vi.advanceTimersByTime(DEBOUNCE_MS - 1);
		expect(report).not.toHaveBeenCalled();

		// Page unmounts mid-debounce: the $effect teardown calls cleanupReactive.
		stability.cleanupReactive();

		vi.advanceTimersByTime(DEBOUNCE_MS);
		// The pending timer was cleared, so the check never runs.
		expect(report).not.toHaveBeenCalled();
	});

	it('registrar unsubscribe nulls the report sink so a late debounce fire is a no-op (leak prevention)', () => {
		const report = vi.fn();
		const stability = createStabilityReporter({
			mapType: 'lorenz',
			getParams: () => ({ type: 'lorenz', sigma: 9999, rho: 28, beta: 8 / 3 }),
			reactive: true
		});
		const unsubscribe = stability.stabilityReporter(report);

		// Start a debounced check, then tear down the registration (shell
		// unmount) BEFORE the timer fires. The page's cleanupReactive would
		// also run on unmount, but this test pins the registrar's own
		// leak-prevention contract independently: even if the timer were to
		// fire, reportStability is null so no stale callback is invoked.
		stability.triggerReactive();
		unsubscribe();

		vi.advanceTimersByTime(DEBOUNCE_MS);
		expect(report).not.toHaveBeenCalled();
	});

	it('reactive: false does not auto-check on triggerReactive (manual runStabilityCheck only)', () => {
		const report = vi.fn();
		const stability = createStabilityReporter({
			mapType: 'lorenz',
			getParams: () => ({ type: 'lorenz', sigma: 9999, rho: 28, beta: 8 / 3 }),
			reactive: false
		});
		stability.stabilityReporter(report);

		stability.triggerReactive();
		vi.advanceTimersByTime(DEBOUNCE_MS);
		expect(report).not.toHaveBeenCalled();

		// Manual immediate check still works.
		stability.runStabilityCheck();
		expect(report).toHaveBeenCalledTimes(1);
	});
});
