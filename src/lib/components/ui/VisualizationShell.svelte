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
		onExtraParametersLoaded?: (params: ChaosMapParameters) => void;
		renderer: Snippet<[RendererArgs]>;
		extraControls?: Snippet;
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
		onExtraParametersLoaded,
		renderer,
		extraControls
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

	let comparisonUrl = $state('');
	$effect(() => {
		// Track all slider values as dependencies
		for (const d of paramDefs) void values[d.key];
		comparisonUrl = buildComparisonUrl(
			base,
			mapType,
			createComparisonStateFromCurrent(mapType, getParameters())
		);
	});

	$effect(() => {
		const { cleanup } = useConfigLoader(
			{
				page,
				mapType,
				base,
				onParametersLoaded: (params) => {
					applyLoadedValues(paramDefs, values, params as unknown as Record<string, unknown>);
					onExtraParametersLoaded?.(params as ChaosMapParameters);
					// Stability is checked against the RAW loaded params (pre-clamp), not the
					// clamped slider values, so an out-of-range saved config still surfaces
					// UNSTABLE_PARAMETERS_DETECTED — matching the pre-shell per-page behavior.
					// applyLoadedValues above still clamps the sliders to their bounds.
					return params as never;
				},
				onCheckStability: (params) => checkParameterStability(mapType, params as never)
			},
			configState
		);
		return cleanup;
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
		{:else}
			<span
				aria-disabled="true"
				class="px-6 py-2 bg-primary/10 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-sm font-bold opacity-50 cursor-not-allowed"
				>⊞ Compare</span
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
