<!-- src/lib/components/ui/VisualizationShell.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import type { ChaosMapType, ChaosMapParameters } from '$lib/types';
	import type { ParamDef } from '$lib/viz/types';
	import { paramDefaults, applyLoadedValues } from '$lib/viz/types';
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
		container: { el?: HTMLDivElement };
	}

	interface Props {
		mapType: ChaosMapType;
		title: string;
		moduleNumber?: string;
		paramDefs: ParamDef[];
		buildParameters: (values: Record<string, number>) => ChaosMapParameters;
		formula: string[];
		formulaColumns?: 1 | 2 | 3 | 4 | 5;
		paramColumns?: 1 | 2 | 3 | 4 | 5;
		description: { heading: string; body: string };
		isAuthenticated: boolean;
		showSnapshot?: boolean;
		renderer: Snippet<[RendererArgs]>;
		extraControls?: Snippet;
		afterDescription?: Snippet;
		/**
		 * Optional normalizer run after `applyLoadedValues` clamps each slider
		 * to its bounds. Use this to fix paired min/max fields whose loaded
		 * order is inverted (e.g. swap rMin/rMax when rMin > rMax) so sliders,
		 * save/share/compare state, and the renderer all see a valid range.
		 * Mutates `values` in place. Stability is still checked against the RAW
		 * loaded params (pre-normalize), so an inverted saved config still
		 * surfaces a warning.
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
		// NOTE: An `onExtraParametersLoaded` hook (for pages with non-slider
		// state like selects/checkboxes/presets) is intentionally deferred to
		// the milestone-4 epic — see
		// docs/superpowers/plans/2026-07-01-chaos-module-milestone-4.md.
		// The 10 already-migrated slider-only pages do not need it.
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
		reactiveStability = false
	}: Props = $props();

	const values = $state(paramDefaults(paramDefs));

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
					applyLoadedValues(paramDefs, values, params as unknown as Record<string, unknown>);
					// Fix paired min/max inversions (e.g. rMin > rMax) AFTER clamping
					// so sliders, save/share/compare state, and the renderer all see a
					// valid range. Stability below still uses the RAW loaded params.
					normalizeLoadedValues?.(values);
					// Stability is checked against the RAW loaded params (pre-clamp), not the
					// clamped slider values, so an out-of-range saved config still surfaces
					// UNSTABLE_PARAMETERS_DETECTED — matching the pre-shell per-page behavior.
					// applyLoadedValues above still clamps the sliders to their bounds.
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

	$effect(() => () => {
		cleanupSave();
		cleanupShare();
	});
</script>

<div class="space-y-6">
	<VisualizationHeader {title} {moduleNumber}>
		{#if showSnapshot}
			<SnapshotButton target={container.el} targetType="container" {mapType} />
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
			class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>🔗 Share</button
		>
		<button
			onclick={() => (saveState.showSaveDialog = true)}
			class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] uppercase tracking-widest text-sm font-bold"
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
	/>

	<ParameterPanel {paramColumns} equationColumns={formulaColumns}>
		{#each paramDefs as def (def.key)}
			<ParameterSlider
				id={def.id ?? def.key}
				label={def.label}
				bind:value={values[def.key]}
				min={def.min}
				max={def.max}
				step={def.step}
				decimals={def.decimals ?? 0}
				debounce={false}
			/>
		{/each}
		{#if extraControls}{@render extraControls()}{/if}
		{#snippet equations()}
			{#each formula as line, i (i)}<p>{line}</p>{/each}
		{/snippet}
	</ParameterPanel>

	<VisualizationErrorBoundary {mapType}>
		{@render renderer({ values, container })}
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
