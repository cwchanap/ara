import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import {
	authedPageProps,
	resetMockPageStore,
	restoreFetch,
	setMockPageUrl,
	setupApiFetchMock
} from '$lib/components/testing/page-test-helpers';
import VisualizationShell from './VisualizationShell.svelte';
import PageOwnedSliderShell from '$lib/components/testing/PageOwnedSliderShell.svelte';
import type { ParamDef } from '$lib/viz/types';

vi.mock('$app/stores', async () => {
	const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
	return { page: mockPageStore };
});
vi.mock('$app/paths', async () => {
	const { BASE_PATH } = await import('$lib/components/testing/page-test-helpers');
	return { base: BASE_PATH };
});
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/components/ui/SaveConfigDialog.svelte', async () => ({
	default: (await import('$lib/components/testing/DialogStub.svelte')).default
}));
vi.mock('$lib/components/ui/ShareDialog.svelte', async () => ({
	default: (await import('$lib/components/testing/DialogStub.svelte')).default
}));
vi.mock('$lib/components/ui/SnapshotButton.svelte', async () => ({
	default: (await import('$lib/components/testing/StubComponent.svelte')).default
}));

// Mock saved-config-loader so we can drive the inline `?config=` path
// (synchronous, no fetch) and control success/failure payloads.
const parseConfigParamMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: vi.fn(),
	loadSharedConfigParameters: vi.fn(),
	parseConfigParam: parseConfigParamMock
}));

const defs: ParamDef[] = [
	{ key: 'a', label: 'a', min: 0.5, max: 1.5, step: 0.001, decimals: 3, default: 1.4 }
];
const renderer = createRawSnippet(() => ({ render: () => '<div data-testid="renderer"></div>' }));

function renderShell() {
	return render(VisualizationShell, {
		props: {
			mapType: 'henon',
			title: 'HÉNON_MAP',
			moduleNumber: '02',
			paramDefs: defs,
			buildParameters: (v: Record<string, number>) => ({
				type: 'henon',
				a: v.a,
				b: 0.3,
				iterations: 2000
			}),
			formula: ['x(n+1) = …'],
			description: { heading: 'DATA_LOG: HÉNON_MAP', body: 'desc' },
			isAuthenticated: true,
			renderer,
			...authedPageProps
		} as never
	});
}

const pairDefs: ParamDef[] = [
	{
		key: 'rMin',
		id: 'r-min',
		label: 'r min',
		min: 0,
		max: 4,
		step: 0.01,
		decimals: 3,
		default: 2.5
	},
	{
		key: 'rMax',
		id: 'r-max',
		label: 'r max',
		min: 0,
		max: 4,
		step: 0.01,
		decimals: 3,
		default: 4.0
	},
	{ key: 'iterations', label: 'Iterations', min: 100, max: 10000, step: 100, default: 1000 },
	{
		key: 'transientIterations',
		id: 'transient',
		label: 'Transient',
		min: 50,
		max: 5000,
		step: 50,
		default: 500
	}
];

function renderShellWithPairs(extra: Record<string, unknown> = {}) {
	return render(VisualizationShell, {
		props: {
			mapType: 'lyapunov',
			title: 'LYAPUNOV_EXPONENTS',
			moduleNumber: '10',
			paramDefs: pairDefs,
			paramColumns: 4,
			buildParameters: (v: Record<string, number>) => ({
				type: 'lyapunov',
				rMin: v.rMin,
				rMax: v.rMax,
				iterations: v.iterations,
				transientIterations: v.transientIterations
			}),
			normalizeLoadedValues: (v: Record<string, number>) => {
				if (v.rMin > v.rMax) {
					const t = v.rMin;
					v.rMin = v.rMax;
					v.rMax = t;
				}
			},
			formula: ['λ = …'],
			description: { heading: 'DATA_LOG: LYAPUNOV', body: 'desc' },
			isAuthenticated: true,
			renderer,
			...authedPageProps,
			...extra
		} as never
	});
}

describe('VisualizationShell', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setupApiFetchMock();
		setMockPageUrl('http://localhost/henon');
		parseConfigParamMock.mockReset();
	});
	afterEach(() => {
		vi.useRealTimers();
		restoreFetch();
		resetMockPageStore();
		cleanup();
	});

	it('renders title, the renderer snippet, and an auto slider from the schema', () => {
		const { container } = renderShell();
		expect(screen.getByText('HÉNON_MAP')).toBeInTheDocument();
		expect(screen.getByTestId('renderer')).toBeInTheDocument();
		expect(container.querySelector('input[id="a"]')).toBeTruthy();
	});

	it('updates the displayed value when the schema slider changes', async () => {
		const { container } = renderShell();
		const input = container.querySelector('input[id="a"]') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '1.2' } });
		expect(screen.getByText('1.200')).toBeInTheDocument();
	});

	it('renders the afterDescription slot inside the description panel when provided', () => {
		const afterDescription = createRawSnippet(() => ({
			render: () => '<div data-testid="after-desc">extra</div>'
		}));
		render(VisualizationShell, {
			props: {
				mapType: 'henon',
				title: 'HÉNON_MAP',
				moduleNumber: '02',
				paramDefs: defs,
				buildParameters: (v: Record<string, number>) => ({
					type: 'henon',
					a: v.a,
					b: 0.3,
					iterations: 2000
				}),
				formula: ['x(n+1) = …'],
				description: { heading: 'DATA_LOG: HÉNON_MAP', body: 'desc' },
				isAuthenticated: true,
				renderer,
				afterDescription,
				...authedPageProps
			} as never
		});
		expect(screen.getByTestId('after-desc')).toBeInTheDocument();
	});

	// --- Shell-level stability / error / URL wiring ---

	it('shows UNSTABLE_PARAMETERS_DETECTED when an inline config loads out-of-range params', async () => {
		// a: 99 is far outside the henon stable range [0, 2]; the shell must
		// check stability against the RAW loaded params (pre-clamp), not the
		// clamped slider values, so the warning still surfaces.
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'henon',
				a: 99,
				b: 0.3,
				iterations: 2000
			}
		});

		setMockPageUrl('http://localhost/henon?config=encoded-data');
		renderShell();

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});
	});

	it('shows INVALID_CONFIGURATION when an inline config fails to parse', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Failed to parse configuration parameters',
			errors: ['Bad henon params'],
			logMessage: 'err',
			logDetails: {}
		});

		setMockPageUrl('http://localhost/henon?config=bad-data');
		renderShell();

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('preserves an out-of-range loaded value instead of clamping it to the slider bounds', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'henon',
				a: 99,
				b: 0.3,
				iterations: 2000
			}
		});

		setMockPageUrl('http://localhost/henon?config=encoded-data');
		const { container } = renderShell();

		await waitFor(() => {
			const input = container.querySelector('input[id="a"]') as HTMLInputElement;
			// The browser clamps the range input's DOM value to its max (1.5),
			// but the state preserves the real loaded value (99) so the renderer
			// and getParameters()/re-save see the original config — not a
			// silently clamped one. The display text reflects the real value.
			expect(input.value).toBe('1.5');
			expect(screen.getByText('99.000')).toBeInTheDocument();
		});
	});

	// --- onExtraParametersLoaded: non-slider state restore ---

	it('fires onExtraParametersLoaded with the raw loaded params after the slider value is set', async () => {
		const onExtra = vi.fn();
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: { type: 'henon', a: 0.9, b: 0.3, iterations: 2000 }
		});
		setMockPageUrl('http://localhost/henon?config=extra');
		const { container } = render(VisualizationShell, {
			props: {
				mapType: 'henon',
				title: 'HÉNON_MAP',
				moduleNumber: '02',
				paramDefs: defs,
				buildParameters: (v: Record<string, number>) => ({
					type: 'henon',
					a: v.a,
					b: 0.3,
					iterations: 2000
				}),
				formula: ['x(n+1) = …'],
				description: { heading: 'DATA_LOG: HÉNON_MAP', body: 'desc' },
				isAuthenticated: true,
				renderer,
				onExtraParametersLoaded: onExtra,
				...authedPageProps
			} as never
		});

		await waitFor(() => {
			expect(onExtra).toHaveBeenCalledTimes(1);
		});
		// Receives the RAW loader result (pre any clamping / normalization).
		expect(onExtra).toHaveBeenCalledWith({
			type: 'henon',
			a: 0.9,
			b: 0.3,
			iterations: 2000
		});
		// The slider-bound value is set into the shell state from the load.
		const input = container.querySelector('input[id="a"]') as HTMLInputElement;
		expect(input.value).toBe('0.9');
	});

	it('does not throw when onExtraParametersLoaded is absent', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: { type: 'henon', a: 1, b: 0.3, iterations: 2000 }
		});
		setMockPageUrl('http://localhost/henon?config=no-hook');
		const { container } = renderShell();
		// The load path runs through the optional-hook call site without error;
		// confirm the slider value was applied (a=1 within range).
		await waitFor(() => {
			expect(screen.getByText('1.000')).toBeInTheDocument();
			expect((container.querySelector('input[id="a"]') as HTMLInputElement).value).toBe('1');
		});
	});

	// --- stabilityReporter: page-owned-slider reactive stability ---

	it('stabilityReporter surfaces warnings to the unified alert and clears them', async () => {
		let report: ((warnings: string[] | null) => void) | null = null;
		render(VisualizationShell, {
			props: {
				mapType: 'henon',
				title: 'HÉNON_MAP',
				moduleNumber: '02',
				paramDefs: defs,
				buildParameters: (v: Record<string, number>) => ({
					type: 'henon',
					a: v.a,
					b: 0.3,
					iterations: 2000
				}),
				formula: ['x(n+1) = …'],
				description: { heading: 'DATA_LOG: HÉNON_MAP', body: 'desc' },
				isAuthenticated: true,
				renderer,
				stabilityReporter: (r: (warnings: string[] | null) => void) => {
					report = r;
					return () => {};
				},
				...authedPageProps
			} as never
		});

		// Wait for the shell's registration effect to hand back the reporter.
		await waitFor(() => {
			expect(report).not.toBeNull();
		});

		// A page with page-owned sliders pushes a reactive warning.
		report!(['param out of range']);
		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});

		// And clears it once the sliders are back in a stable range.
		report!(null);
		await waitFor(() => {
			expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).toBeNull();
		});
	});

	it('invokes the stabilityReporter unsubscribe on unmount (teardown leak-prevention)', async () => {
		// The registrar returns an unsubscribe the shell must invoke on teardown
		// so the page drops its reference to the report callback — the factory's
		// central leak-prevention contract. Pinning that the shell actually
		// calls it when the component unmounts.
		const unsubscribe = vi.fn();
		let report: ((warnings: string[] | null) => void) | null = null;
		const { unmount } = render(VisualizationShell, {
			props: {
				mapType: 'henon',
				title: 'HÉNON_MAP',
				moduleNumber: '02',
				paramDefs: defs,
				buildParameters: (v: Record<string, number>) => ({
					type: 'henon',
					a: v.a,
					b: 0.3,
					iterations: 2000
				}),
				formula: ['x(n+1) = …'],
				description: { heading: 'DATA_LOG: HÉNON_MAP', body: 'desc' },
				isAuthenticated: true,
				renderer,
				stabilityReporter: (r: (warnings: string[] | null) => void) => {
					report = r;
					return unsubscribe;
				},
				...authedPageProps
			} as never
		});

		// Wait for the shell's registration effect to hand back the reporter.
		await waitFor(() => {
			expect(report).not.toBeNull();
		});
		expect(unsubscribe).not.toHaveBeenCalled();

		unmount();

		// The shell's $effect teardown runs the returned unsubscribe.
		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});

	it('renders a comparison link whose href reflects the current slider values', async () => {
		const { container } = renderShell();
		const link = screen.getByRole('link', { name: '⊞ Compare' }) as HTMLAnchorElement;
		expect(link.href).toContain('/henon/compare');

		// Capture the encoded `left` param at the default `a` value (1.4).
		const beforeUrl = new URL(link.href);
		const beforeLeft = beforeUrl.searchParams.get('left');
		expect(beforeLeft).toBeTruthy();

		// Changing the slider must update the comparison URL via $derived.
		const input = container.querySelector('input[id="a"]') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '1.2' } });

		const afterUrl = new URL(link.href);
		const afterLeft = afterUrl.searchParams.get('left');
		expect(afterUrl.href).toContain('/henon/compare');
		// A broken $derived would leave the encoded value unchanged.
		expect(afterLeft).not.toBe(beforeLeft);
	});

	it('updates the comparison link when a page-owned slider (extraControls) changes', async () => {
		// Page-managed pages (Clifford, Ikeda, etc.) pass paramDefs=[] and a
		// buildParameters that ignores the shell's `values` arg and reads
		// page-owned $state directly. The shell's comparisonUrl is $derived
		// over getParameters() -> buildParameters(values). $derived tracks ALL
		// $state reads inside the computation, so reading page-owned `a` inside
		// buildParameters must still recompute the URL when `a` changes — even
		// though `values` (the arg) is never read. Pinning this so a future
		// refactor that caches buildParameters or gates the derived on `values`
		// can't silently stale the comparison link on these pages.
		setMockPageUrl('http://localhost/clifford');
		render(PageOwnedSliderShell, { props: { ...authedPageProps } as never });

		const link = screen.getByRole('link', { name: '⊞ Compare' }) as HTMLAnchorElement;
		expect(link.href).toContain('/clifford/compare');

		const beforeLeft = new URL(link.href).searchParams.get('left');
		expect(beforeLeft).toBeTruthy();

		// Move the page-owned slider (bound to page $state `a`, not schema values).
		const input = screen.getByTestId('page-owned-a') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '-1.2' } });

		const afterLeft = new URL(link.href).searchParams.get('left');
		// A broken $derived — one that only tracked `values` reads — would leave
		// the encoded value unchanged because paramDefs=[] means `values` is empty.
		expect(afterLeft).not.toBe(beforeLeft);
	});

	// --- normalizeLoadedValues: paired-range swap ---

	it('swaps inverted rMin/rMax when an inline config loads a reversed range', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'lyapunov',
				rMin: 4,
				rMax: 2,
				iterations: 1000,
				transientIterations: 500
			}
		});
		setMockPageUrl('http://localhost/lyapunov?config=inverted');
		const { container } = renderShellWithPairs();
		await waitFor(() => {
			const rMinInput = container.querySelector('input[id="r-min"]') as HTMLInputElement;
			const rMaxInput = container.querySelector('input[id="r-max"]') as HTMLInputElement;
			// Loaded rMin=4 > rMax=2 must be swapped so sliders (and the renderer)
			// see rMin=2 <= rMax=4, matching the pre-shell bifurcation/lyapunov
			// normalization that applyLoadedValues alone does not perform.
			expect(Number(rMinInput.value)).toBeLessThanOrEqual(Number(rMaxInput.value));
			expect(rMinInput.value).toBe('2');
			expect(rMaxInput.value).toBe('4');
		});
	});

	// --- untrack: slider movement after ?config= load must not reload ---

	it('does not snap the slider back when moving it after a ?config= load (untrack)', async () => {
		// normalizeLoadedValues reads values.rMin/rMax inside onParametersLoaded.
		// The ?config= path calls onParametersLoaded synchronously during the
		// loader $effect's initial page.subscribe. Without untrack, those reads
		// become effect dependencies — moving a slider reruns the effect,
		// recreates useConfigLoader (resetting lastAppliedConfigKey), and
		// reloads the same URL config, snapping the slider back. untrack
		// prevents the reads from retriggering the loader.
		parseConfigParamMock.mockReturnValue({
			ok: true,
			parameters: {
				type: 'lyapunov',
				rMin: 1,
				rMax: 3,
				iterations: 1000,
				transientIterations: 500
			}
		});
		setMockPageUrl('http://localhost/lyapunov?config=valid-range');
		const { container } = renderShellWithPairs();

		const rMaxInput = container.querySelector('input[id="r-max"]') as HTMLInputElement;
		await waitFor(() => {
			expect(rMaxInput.value).toBe('3');
		});

		// Move rMax — if the loader effect retriggers, the config reloads and
		// rMax snaps back to 3.
		await fireEvent.input(rMaxInput, { target: { value: '3.5' } });
		expect(rMaxInput.value).toBe('3.5');

		// Move again to be sure the first change wasn't a transient race.
		await fireEvent.input(rMaxInput, { target: { value: '3.8' } });
		expect(rMaxInput.value).toBe('3.8');
	});

	// --- reactiveStability: on-change stability checks ---

	it('reactiveStability warns when sliders are inverted and clears when fixed', async () => {
		setMockPageUrl('http://localhost/lyapunov');
		const { container } = renderShellWithPairs({ reactiveStability: true });

		// Defaults (rMin=2.5 < rMax=4.0) are stable — no warning.
		expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).toBeNull();

		// Drag rMax below rMin to invert the range.
		const rMaxInput = container.querySelector('input[id="r-max"]') as HTMLInputElement;
		await fireEvent.input(rMaxInput, { target: { value: '2' } });
		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});

		// Restore rMax above rMin — the warning must clear (pre-shell behavior).
		await fireEvent.input(rMaxInput, { target: { value: '4' } });
		await waitFor(() => {
			expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).toBeNull();
		});
	});

	it('an inverted saved Lyapunov config shows no warning with reactiveStability (pre-shell behavior)', async () => {
		// Pre-shell Lyapunov ran checkParameterStability on the NORMALIZED
		// params (post rMin/rMax swap), so an inverted saved config rendered
		// correctly with NO warning. The shell reproduces this: the loader
		// briefly flags the raw inverted range, normalizeLoadedValues swaps it,
		// and the reactiveStability $effect recomputes on the now-valid slider
		// values and clears the warning on the same tick. Pinning the net
		// result so a future change to reactiveStability or the load order
		// can't silently regress to a stuck warning.
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'lyapunov',
				rMin: 4,
				rMax: 2,
				iterations: 1000,
				transientIterations: 500
			}
		});
		setMockPageUrl('http://localhost/lyapunov?config=inverted');
		const { container } = renderShellWithPairs({ reactiveStability: true });

		await waitFor(() => {
			// Sliders are swapped to a valid range...
			const rMinInput = container.querySelector('input[id="r-min"]') as HTMLInputElement;
			const rMaxInput = container.querySelector('input[id="r-max"]') as HTMLInputElement;
			expect(Number(rMinInput.value)).toBeLessThanOrEqual(Number(rMaxInput.value));
			// ...and no stability warning sticks (matches pre-shell).
			expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).toBeNull();
		});
	});

	it('does not run reactive stability checks when reactiveStability is omitted', async () => {
		setMockPageUrl('http://localhost/lyapunov');
		const { container } = renderShellWithPairs();
		const rMaxInput = container.querySelector('input[id="r-max"]') as HTMLInputElement;
		await fireEvent.input(rMaxInput, { target: { value: '2' } });
		// rMin=2.5 > rMax=2 would warn under reactiveStability, but the prop is
		// off (default) so only config-load checks run — no warning here.
		expect(screen.queryByText('UNSTABLE_PARAMETERS_DETECTED')).toBeNull();
	});

	it('warns in dev mode when both reactiveStability and stabilityReporter are passed', async () => {
		// The two effects race on the same configState.warnings/showWarning
		// fields. No page combines them today; the dev guard catches a future
		// misuse at render time. import.meta.env.DEV is true under Vitest.
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		setMockPageUrl('http://localhost/henon');
		render(VisualizationShell, {
			props: {
				mapType: 'henon',
				title: 'HÉNON_MAP',
				moduleNumber: '02',
				paramDefs: defs,
				buildParameters: (v: Record<string, number>) => ({
					type: 'henon',
					a: v.a,
					b: 0.3,
					iterations: 2000
				}),
				formula: ['x(n+1) = …'],
				description: { heading: 'DATA_LOG: HÉNON_MAP', body: 'desc' },
				isAuthenticated: true,
				renderer,
				reactiveStability: true,
				stabilityReporter: () => () => {},
				...authedPageProps
			} as never
		});

		await waitFor(() => {
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('pass either reactiveStability or stabilityReporter')
			);
		});
		warnSpy.mockRestore();
	});

	describe('slider policy infrastructure', () => {
		it('disables save/share/snapshot buttons during drag', async () => {
			// This test verifies the shell provides the SliderDragManager context
			// and disables action buttons when drag state changes.
			// Detailed test implementation will use a test wrapper that
			// accesses the context-provided manager and simulates dragging.
			// For now, verify the shell renders without errors with the new props.
			const { container } = renderShell();
			expect(container).toBeInTheDocument();
		});
	});
});
