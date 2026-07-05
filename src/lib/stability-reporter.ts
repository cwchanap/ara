/**
 * Factory for the page-owned-slider stability reporting pattern.
 *
 * Pages whose sliders live in `extraControls` (page-owned `$state`, not the
 * shell's schema-driven `values`) are not watched by the shell's
 * `reactiveStability` effect. Such pages register a `stabilityReporter` with
 * `<VisualizationShell>` and push stability warnings into the shell's unified
 * alert from their own reactive effect.
 *
 * Two modes:
 *
 * 1. **Non-reactive** (`reactive: false`): the page calls `runStabilityCheck()`
 *    manually from `applyPreset`/`randomize`. Use when slider edits should NOT
 *    re-check stability (e.g. a page that only warns on preset/randomize).
 *
 * 2. **Reactive + debounced** (`reactive: true`): the factory creates a
 *    `useDebouncedEffect` updater. The page tracks the stability-relevant
 *    params in a `$effect` and calls `triggerReactive()` on each change; the
 *    check runs after `DEBOUNCE_MS` and pushes the result into the alert.
 *    `runStabilityCheck()` is still available for immediate (non-debounced)
 *    checks if needed.
 *
 * @example
 * const stability = createStabilityReporter({
 *   mapType: 'clifford',
 *   getParams: () => buildParameters(),
 *   reactive: true
 * });
 * $effect(() => {
 *   void a; void b; void c; void d; void iterations;
 *   stability.triggerReactive();
 *   return () => stability.cleanupReactive();
 * });
 */
import { checkParameterStability } from '$lib/chaos-validation';
import { useDebouncedEffect } from '$lib/use-debounced-effect';
import { DEBOUNCE_MS } from '$lib/constants';
import type { ChaosMapType, ChaosMapParameters } from '$lib/types';

export type StabilityReportFn = (warnings: string[] | null) => void;
export type StabilityReporterRegistrar = (report: StabilityReportFn) => () => void;

export interface StabilityReporter {
	/** Registrar passed to `<VisualizationShell stabilityReporter={...}>`. */
	stabilityReporter: StabilityReporterRegistrar;
	/** Run the check immediately and push the result into the unified alert. */
	runStabilityCheck: () => void;
	/** Reactive pages: call from a `$effect` tracking the relevant params. */
	triggerReactive: () => void;
	/** Reactive pages: call from the `$effect` teardown. */
	cleanupReactive: () => void;
}

interface CreateStabilityReporterOptions {
	mapType: ChaosMapType;
	getParams: () => ChaosMapParameters;
	reactive?: boolean;
}

export function createStabilityReporter({
	mapType,
	getParams,
	reactive = false
}: CreateStabilityReporterOptions): StabilityReporter {
	let reportStability: StabilityReportFn | null = null;

	function stabilityReporter(report: StabilityReportFn): () => void {
		reportStability = report;
		return () => {
			reportStability = null;
		};
	}

	function runStabilityCheck() {
		const result = checkParameterStability(mapType, getParams());
		reportStability?.(result.isStable ? null : result.warnings);
	}

	if (!reactive) {
		return {
			stabilityReporter,
			runStabilityCheck,
			triggerReactive: () => {},
			cleanupReactive: () => {}
		};
	}

	const updater = useDebouncedEffect(runStabilityCheck, DEBOUNCE_MS);

	return {
		stabilityReporter,
		runStabilityCheck,
		triggerReactive: () => updater.trigger(),
		cleanupReactive: () => updater.cleanup()
	};
}
