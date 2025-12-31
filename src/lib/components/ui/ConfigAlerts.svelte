<!--
  ConfigAlerts Component
  
  Displays configuration error and stability warning alerts.
  Reusable across all visualization pages.
-->
<script lang="ts">
	interface Props {
		configErrors: string[];
		showConfigError: boolean;
		stabilityWarnings: string[];
		showStabilityWarning: boolean;
		onDismissError?: () => void;
		onDismissWarning?: () => void;
	}

	let {
		configErrors,
		showConfigError = $bindable(false),
		stabilityWarnings,
		showStabilityWarning = $bindable(false),
		onDismissError,
		onDismissWarning
	}: Props = $props();

	function handleDismissError() {
		showConfigError = false;
		onDismissError?.();
	}

	function handleDismissWarning() {
		showStabilityWarning = false;
		onDismissWarning?.();
	}
</script>

<!-- Invalid Configuration -->
{#if showConfigError && configErrors.length > 0}
	<div class="bg-red-500/10 border border-red-500/30 rounded-sm p-4 relative">
		<div class="flex items-start gap-3">
			<span class="text-red-400 text-xl">✕</span>
			<div class="flex-1">
				<h3 class="font-['Orbitron'] text-red-400 font-semibold mb-1">INVALID_CONFIGURATION</h3>
				<p class="text-red-200/80 text-sm mb-2">
					The loaded configuration could not be applied due to validation errors:
				</p>
				<ul class="text-xs text-red-200/60 list-disc list-inside space-y-1">
					{#each configErrors as err, i (i)}
						<li>{err}</li>
					{/each}
				</ul>
			</div>
			<button
				type="button"
				onclick={handleDismissError}
				class="text-red-400/60 hover:text-red-400"
				aria-label="Dismiss error"
			>
				✕
			</button>
		</div>
	</div>
{/if}

<!-- Stability Warning -->
{#if showStabilityWarning && stabilityWarnings.length > 0}
	<div class="bg-amber-500/10 border border-amber-500/30 rounded-sm p-4 relative">
		<div class="flex items-start gap-3">
			<span class="text-amber-400 text-xl">⚠️</span>
			<div class="flex-1">
				<h3 class="font-['Orbitron'] text-amber-400 font-semibold mb-1">
					UNSTABLE_PARAMETERS_DETECTED
				</h3>
				<p class="text-amber-200/80 text-sm mb-2">
					The loaded configuration contains parameters outside recommended stable ranges:
				</p>
				<ul class="text-xs text-amber-200/60 list-disc list-inside space-y-1">
					{#each stabilityWarnings as warning, i (i)}
						<li>{warning}</li>
					{/each}
				</ul>
			</div>
			<button
				type="button"
				onclick={handleDismissWarning}
				class="text-amber-400/60 hover:text-amber-400"
				aria-label="Dismiss warning"
			>
				✕
			</button>
		</div>
	</div>
{/if}
