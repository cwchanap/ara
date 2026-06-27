<!--
  Test stub for VisualizationAlerts (src/lib/components/ui/VisualizationAlerts.svelte).

  Stub-vs-real split:
  - Props contract is identical (same 11 props, same types) so parent pages under
    test can mock the real component without altering their prop wiring.
  - The real component renders the actual toasts/alerts and wires dismiss callbacks
    to interactive DOM. This stub renders an empty div and only `void`-references
    every prop so parent expressions (callbacks, currentPath, etc.) are evaluated
    for coverage without exercising alert rendering/dismissal logic.

  Use via: vi.mock('$lib/components/ui/VisualizationAlerts.svelte', () => ({ default: ... }))
-->
<script lang="ts">
	type Props = {
		saveSuccess?: boolean;
		onDismissSaveSuccess?: () => void;
		saveError?: string | null;
		configErrors?: string[];
		showConfigError?: boolean;
		onDismissConfigError?: () => void;
		stabilityWarnings?: string[];
		showStabilityWarning?: boolean;
		onDismissStabilityWarning?: () => void;
		onDismissSaveError?: () => void;
		diverged?: boolean;
		onDismissDiverged?: () => void;
	};

	let {
		saveSuccess = false,
		onDismissSaveSuccess,
		saveError = null,
		configErrors = [],
		showConfigError = false,
		onDismissConfigError,
		stabilityWarnings = [],
		showStabilityWarning = false,
		onDismissStabilityWarning,
		onDismissSaveError,
		diverged = false,
		onDismissDiverged
	}: Props = $props();

	// Reference all props to ensure parent expressions are evaluated
	void saveSuccess;
	void onDismissSaveSuccess;
	void saveError;
	void configErrors;
	void showConfigError;
	void onDismissConfigError;
	void stabilityWarnings;
	void showStabilityWarning;
	void onDismissStabilityWarning;
	void onDismissSaveError;
	void diverged;
	void onDismissDiverged;
</script>

<div data-testid="visualization-alerts-stub"></div>
