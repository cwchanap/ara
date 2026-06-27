<!--
  Test stub for VisualizationAlerts that reads all props so parent
  expressions (callbacks, currentPath, etc.) are evaluated for coverage.
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
