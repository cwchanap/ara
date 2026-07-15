<!-- src/lib/components/ui/VisualizationShell.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack, setContext } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import type { ChaosMapType, ChaosMapParameters } from '$lib/types';
	import type { ParamDef } from '$lib/viz/types';
	import { paramDefaults, applyLoadedValues } from '$lib/viz/types';
	import {
		SliderDragManager,
		type DragState,
		type Fidelity,
		type RenderState
	} from '$lib/slider-drag-manager.svelte';
	import VisualizationHeader from '$lib/components/ui/VisualizationHeader.svelte';
	import ParameterPanel from '$lib/components/ui/ParameterPanel.svelte';
	import ParameterSlider from '$lib/components/ui/ParameterSlider.svelte';
	import VisualizationErrorBoundary from '$lib/components/ui/VisualizationErrorBoundary.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import { useConfigLoader, createInitialConfigLoaderState } from '$lib/use-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';

	// The renderer binds its own root element to container.el (HTMLDivElement) so
	// SnapshotButton can target it — exactly as each pre-shell page did.
	interface RendererArgs {
		values: Record<string, number>;
		draftValues: Record<string, number>;
		container: { el?: HTMLDivElement };
		fidelity: Fidelity;
		onRenderStateChange: (state: RenderState) => void;
	}

	interface Props {
		mapType: ChaosMapType;
		title: string;
		moduleNumber?: string;
		paramDefs: ParamDef[];
		/**
		 * Builds the full `ChaosMapParameters` payload from the shell's
		 * schema-driven slider `values`. Called for save/share/compare and
		 * (when `reactiveStability` is on) the on-change stability check.
		 *
		 * Page-managed pages (Clifford, Ikeda, Gumowski-Mira, Lorenz, Double
		 * Pendulum) render their sliders in `extraControls` against page-owned
		 * `$state` and pass `paramDefs={[]}`, so `values` is empty and the arg
		 * is intentionally ignored — those pages read their own `$state`
		 * directly. `$derived` (e.g. `comparisonUrl`) still tracks those reads,
		 * so reactive updates work without the shell knowing the page state.
		 */
		buildParameters: (values: Record<string, number>) => ChaosMapParameters;
		formula?: string[];
		formulaColumns?: 1 | 2 | 3 | 4 | 5;
		paramColumns?: 1 | 2 | 3 | 4 | 5;
		description: { heading: string; body: string };
		isAuthenticated: boolean;
		showSnapshot?: boolean;
		renderer: Snippet<[RendererArgs]>;
		extraControls?: Snippet;
		afterDescription?: Snippet;
		/**
		 * Optional normalizer run after `applyLoadedValues` sets each slider
		 * from the loaded config. Use this to fix paired min/max fields whose
		 * loaded order is inverted (e.g. swap rMin/rMax when rMin > rMax) so
		 * sliders, save/share/compare state, and the renderer all see a valid
		 * range. Mutates `values` in place.
		 *
		 * Note on stability: `onCheckStability` runs against the RAW loaded
		 * params (pre-normalize), so an inverted saved config is initially
		 * flagged. However, when `reactiveStability` is enabled the
		 * same-tick $effect recomputes stability against the normalized
		 * slider values and clears that warning — matching the pre-shell
		 * Lyapunov behavior where an inverted saved config rendered with no
		 * stuck warning. Without `reactiveStability`, the raw-param warning
		 * sticks (used by non-reactive pages to surface out-of-range saves).
		 */
		normalizeLoadedValues?: (values: Record<string, number>) => void;
		/**
		 * When true, re-run `checkParameterStability` whenever any slider
		 * changes and reflect the result in the stability alert — matching the
		 * pre-shell Lyapunov behavior where manual edits to paired ranges
		 * (rMin >= rMax) or transient > iterations surface a warning, and an
		 * existing warning clears once the sliders are fixed. Default false:
		 * other pages only check stability at config-load time.
		 */
		reactiveStability?: boolean;
		/**
		 * Receives the raw loader result (`ChaosMapParameters`) so the page can
		 * restore non-slider state (selects, checkboxes, presets, sub-controls).
		 * Called once per successful config load, after `applyLoadedValues` has
		 * set the slider-bound values into the shell's `values` state. The
		 * callback receives the raw params — slider values are preserved during
		 * load (no clamping), and `onExtraParametersLoaded` gets the original
		 * loader result so pages can restore non-slider state without hiding
		 * out-of-range warnings (the stability check also runs on the raw
		 * params). A no-op when absent.
		 */
		onExtraParametersLoaded?: (params: ChaosMapParameters) => void;
		/**
		 * Registration hook for pages whose sliders are page-owned (rendered in
		 * `extraControls`, not the schema) and therefore not watched by the
		 * shell's `reactiveStability` effect. The shell calls this once on mount
		 * with a `report` function; the page captures it and calls
		 * `report(warnings)` (or `report(null)` to clear) from its own reactive
		 * effect to drive the shell's unified stability alert. Covers both
		 * slider edits and post-load re-checks (a loaded config mutates the
		 * page state, re-running the page's effect). The registrar returns an
		 * unsubscribe function the shell invokes on teardown so the page drops
		 * its reference to the report callback. A no-op when absent.
		 *
		 * Must be a stable reference (e.g. from `createStabilityReporter`).
		 * The shell registers it once in a mount-time `$effect` and invokes
		 * the returned unsubscribe on teardown; an inline arrow would
		 * re-register on every render and leak the prior subscription. All
		 * current pages use the factory, which captures the function in a
		 * closure.
		 */
		stabilityReporter?: (report: (warnings: string[] | null) => void) => () => void;
		/**
		 * Optional numerical-divergence flag forwarded to VisualizationAlerts
		 * (e.g. Lorenz): when true, the alert shows a divergence warning that the
		 * user can dismiss via {@link onDismissDiverged}. No-op when absent.
		 */
		diverged?: boolean;
		onDismissDiverged?: () => void;
	}

	let {
		mapType,
		title,
		moduleNumber,
		paramDefs,
		buildParameters,
		formula,
		formulaColumns = 3,
		paramColumns = 3,
		description,
		isAuthenticated,
		showSnapshot = true,
		renderer,
		extraControls,
		afterDescription,
		normalizeLoadedValues,
		reactiveStability = false,
		onExtraParametersLoaded,
		stabilityReporter,
		diverged,
		onDismissDiverged
	}: Props = $props();

	const values = $state(paramDefaults(paramDefs));

	const dragManager = new SliderDragManager();
	setContext('slider-drag-manager', dragManager);

	const draftValues = $state(paramDefaults(paramDefs));
	const dragState = $derived<DragState>(dragManager.currentState);
	let renderState = $state<RenderState>('idle');

	const onRenderStateChange = (s: RenderState) => {
		renderState = s;
	};

	// Populated by the renderer snippet binding its root to container.el.
	const container = $state<{ el?: HTMLDivElement }>({});

	const saveState = $state(createInitialSaveState());
	const shareState = $state(createInitialShareState());
	const configState = $state(createInitialConfigLoaderState());

	function getParameters(): ChaosMapParameters {
		return buildParameters(values);
	}

	const { save: handleSave, cleanup: cleanupSave } = createSaveHandler(
		mapType,
		saveState,
		getParameters
	);
	const { share: handleShare, cleanup: cleanupShare } = createShareHandler(
		mapType,
		shareState,
		getParameters
	);

	const comparisonUrl = $derived(
		buildComparisonUrl(base, mapType, createComparisonStateFromCurrent(mapType, getParameters()))
	);

	$effect(() => {
		const { cleanup } = useConfigLoader(
			{
				page,
				mapType,
				base,
				onParametersLoaded: (params) => {
					// untrack: applyLoadedValues/normalizeLoadedValues read and
					// mutate `values` ($state). Without untrack, reads inside
					// normalizeLoadedValues (e.g. values.rMin/rMax for Lyapunov)
					// become dependencies of THIS loader effect when the
					// ?config= path fires onParametersLoaded synchronously
					// during the initial page.subscribe. Moving a range slider
					// would then rerun the effect, recreate useConfigLoader with
					// lastAppliedConfigKey reset, and reload the same URL config
					// — snapping the slider back. untrack prevents those reads
					// from retriggering the loader while still allowing the
					// writes to propagate to the renderer and reactiveStability.
					untrack(() => {
						applyLoadedValues(paramDefs, values, params as unknown as Record<string, unknown>);
						// Fix paired min/max inversions (e.g. rMin > rMax) AFTER
						// applying loaded values so sliders, save/share/compare
						// state, and the renderer all see a valid range. Stability
						// below uses the RAW loaded params; with reactiveStability
						// enabled the same-tick $effect recomputes on the
						// normalized slider values and clears an inverted-range
						// warning (matching pre-shell Lyapunov).
						normalizeLoadedValues?.(values);
						// Sync draftValues to the loaded+normalized values so
						// preview-policy sliders see the correct draft after a config
						// load. Without this, draftValues stays at the prior state
						// (defaults or last drag) until the user drags again —
						// producing a stale preview once Step 2 uses draftValues.
						for (const def of paramDefs) {
							draftValues[def.key] = values[def.key];
						}
						// Restore non-slider state (selects, checkboxes, presets) from
						// the raw loaded params. Runs under untrack because the page
						// callback reads/writes $state — without it, reads inside the
						// callback could become dependencies of this loader effect and
						// retrigger a config reload (the same snap-back bug fixed for
						// normalizeLoadedValues).
						onExtraParametersLoaded?.(params);
					});
					// applyLoadedValues above preserves loaded values as-is (no
					// slider-range clamping); stability is checked against the
					// RAW loaded params so out-of-range saves still surface
					// UNSTABLE_PARAMETERS_DETECTED on non-reactive pages.
					return params;
				},
				onCheckStability: (params) => checkParameterStability(mapType, params)
			},
			configState
		);
		return cleanup;
	});

	// Reactive stability: when a page opts in (e.g. Lyapunov), re-run the
	// stability check whenever any slider changes and reflect the result in
	// the alert — surfacing warnings for manual paired-range inversions and
	// clearing warnings once the sliders are fixed. The verdict is computed
	// from the current (clamped) slider values, matching the pre-shell
	// Lyapunov behavior.
	$effect(() => {
		if (!reactiveStability) return;
		for (const def of paramDefs) void values[def.key];
		const stability = checkParameterStability(mapType, buildParameters(values));
		if (!stability.isStable) {
			configState.warnings = stability.warnings;
			configState.showWarning = true;
		} else {
			configState.warnings = [];
			configState.showWarning = false;
		}
	});

	// Register a page-supplied stability reporter (for pages with page-owned
	// sliders in extraControls). Runs once; the page calls the handed-back
	// `report` from its own reactive effect to push warnings into the unified
	// alert — keeping stability display in one place rather than a second alert.
	$effect(() => {
		if (!stabilityReporter) return;
		return stabilityReporter((warnings) => {
			if (warnings && warnings.length > 0) {
				configState.warnings = warnings;
				configState.showWarning = true;
			} else {
				configState.warnings = [];
				configState.showWarning = false;
			}
		});
	});

	// Dev-mode guard: passing both reactiveStability and stabilityReporter would
	// race two effects on the same configState.warnings/showWarning fields — the
	// shell-managed effect recomputes from schema sliders while the page-managed
	// reporter pushes from page-owned state, producing flicker/overwrites. No page
	// does this today; warn early so a future page can't silently combine them.
	// Tree-shaken in production builds (import.meta.env.DEV is a Vite constant).
	if (import.meta.env.DEV && reactiveStability && stabilityReporter) {
		console.warn(
			`VisualizationShell (${mapType}): pass either reactiveStability or stabilityReporter, not both. The two effects race on the same stability alert.`
		);
	}

	$effect(() => () => {
		cleanupSave();
		cleanupShare();
	});
</script>

<div class="space-y-6">
	<VisualizationHeader {title} {moduleNumber}>
		{#if showSnapshot}
			<SnapshotButton
				target={container.el}
				targetType="container"
				{mapType}
				disabled={dragState.fidelity !== 'full' ||
					dragState.commitDragging ||
					renderState === 'rendering'}
			/>
		{/if}
		{#if comparisonUrl}
			<a
				href={comparisonUrl}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
				>⊞ Compare</a
			>
		{/if}
		<button
			onclick={() => (shareState.showShareDialog = true)}
			disabled={dragState.fidelity !== 'full' || dragState.commitDragging}
			class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
			>🔗 Share</button
		>
		<button
			onclick={() => (saveState.showSaveDialog = true)}
			disabled={dragState.fidelity !== 'full' || dragState.commitDragging}
			class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] uppercase tracking-widest text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
			>💾 Save</button
		>
	</VisualizationHeader>

	<VisualizationAlerts
		saveSuccess={saveState.saveSuccess}
		saveError={saveState.saveError}
		configErrors={configState.errors}
		showConfigError={configState.showError}
		onDismissConfigError={() => (configState.showError = false)}
		stabilityWarnings={configState.warnings}
		showStabilityWarning={configState.showWarning}
		onDismissStabilityWarning={() => (configState.showWarning = false)}
		onDismissSaveError={() => (saveState.saveError = null)}
		onDismissSaveSuccess={() => (saveState.saveSuccess = false)}
		{diverged}
		onDismissDiverged={onDismissDiverged ?? undefined}
	/>

	<ParameterPanel {paramColumns} {formula} equationColumns={formulaColumns}>
		{#each paramDefs as def (def.key)}
			<ParameterSlider
				id={def.id ?? def.key}
				label={def.label}
				bind:value={values[def.key]}
				ondraft={(v) => {
					draftValues[def.key] = v;
				}}
				min={def.min}
				max={def.max}
				step={def.step}
				decimals={def.decimals ?? 0}
				updatePolicy={def.updatePolicy ?? 'live'}
			/>
		{/each}
		{#if extraControls}{@render extraControls()}{/if}
	</ParameterPanel>

	<VisualizationErrorBoundary {mapType}>
		<div class="relative">
			{@render renderer({
				values,
				draftValues,
				container,
				fidelity: dragState.fidelity,
				onRenderStateChange
			})}
			<!-- Status badge -->
			<div
				role="status"
				aria-live="polite"
				class="absolute top-4 left-4 text-xs font-['Rajdhani'] border border-primary/20 px-2 py-1 pointer-events-none select-none"
			>
				{#if dragState.commitDragging}
					FROZEN — RELEASE TO APPLY
				{:else if dragState.fidelity === 'preview'}
					PREVIEW
				{:else if renderState === 'rendering'}
					RENDERING FULL QUALITY…
				{:else}
					LIVE_RENDER
				{/if}
			</div>
		</div>
	</VisualizationErrorBoundary>

	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">{description.heading}</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">{description.body}</p>
		{#if afterDescription}{@render afterDescription()}{/if}
	</div>
</div>

<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	{mapType}
	{isAuthenticated}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>
<ShareDialog
	bind:open={shareState.showShareDialog}
	{mapType}
	{isAuthenticated}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
