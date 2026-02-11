<!--
  VisualizationAlerts Component

  Consolidates all toast/alert notifications for visualization pages:
  - Save success toast (fixed position, auto-dismiss, green)
  - Save error toast (fixed position, red)
  - Config error alert (inline, dismissible, red)
  - Stability warning alert (inline, dismissible, amber)

  Usage:
  <VisualizationAlerts
    saveSuccess={saveState.saveSuccess}
    saveError={saveState.saveError}
    configErrors={configErrors}
    showConfigError={showConfigError}
    onDismissConfigError={() => showConfigError = false}
    stabilityWarnings={stabilityWarnings}
    showStabilityWarning={showStabilityWarning}
    onDismissStabilityWarning={() => showStabilityWarning = false}
  />
-->
<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';

	interface Props {
		/** Whether to show the save success toast */
		saveSuccess?: boolean;
		/** Error message for save error toast, null to hide */
		saveError?: string | null;
		/** List of configuration validation errors */
		configErrors?: string[];
		/** Whether to show the config error alert */
		showConfigError?: boolean;
		/** Callback when config error is dismissed */
		onDismissConfigError?: () => void;
		/** List of stability warnings */
		stabilityWarnings?: string[];
		/** Whether to show the stability warning alert */
		showStabilityWarning?: boolean;
		/** Callback when stability warning is dismissed */
		onDismissStabilityWarning?: () => void;
		/** Callback when save error is dismissed */
		onDismissSaveError?: () => void;
		/** Callback when save success toast is dismissed */
		onDismissSaveSuccess?: () => void;
	}

	let {
		saveSuccess = false,
		saveError = null,
		configErrors = [],
		showConfigError = false,
		onDismissConfigError = () => {},
		stabilityWarnings = [],
		showStabilityWarning = false,
		onDismissStabilityWarning = () => {},
		onDismissSaveError = () => {},
		onDismissSaveSuccess = () => {}
	}: Props = $props();

	const dispatch = createEventDispatcher<{ dismiss: void }>();

	let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (saveSuccess) {
			// Clear any existing timeout
			if (dismissTimeout) {
				clearTimeout(dismissTimeout);
			}
			// Start new timeout to auto-dismiss after 3000ms
			dismissTimeout = setTimeout(() => {
				onDismissSaveSuccess();
				dispatch('dismiss');
			}, 3000);
		} else {
			// Clear timeout if saveSuccess flips back to false
			if (dismissTimeout) {
				clearTimeout(dismissTimeout);
				dismissTimeout = null;
			}
		}

		// Cleanup function
		return () => {
			if (dismissTimeout) {
				clearTimeout(dismissTimeout);
			}
		};
	});

	onDestroy(() => {
		if (dismissTimeout) {
			clearTimeout(dismissTimeout);
		}
	});
</script>

<!-- Save Success Toast -->
{#if saveSuccess}
	<div
		class="fixed top-20 right-4 z-50 px-6 py-4 bg-green-500/10 border border-green-500/30 rounded-lg backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-right-5"
		role="alert"
		aria-live="polite"
	>
		<div class="flex items-center gap-3">
			<span class="text-green-400">✓</span>
			<span class="text-green-200">Configuration saved successfully!</span>
		</div>
	</div>
{/if}

<!-- Save Error Toast -->
{#if saveError && !saveSuccess}
	<div
		class="fixed top-20 right-4 z-50 px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-right-5"
		role="alert"
		aria-live="assertive"
	>
		<div class="flex items-center gap-3">
			<span class="text-red-400">✕</span>
			<span class="text-red-200">{saveError}</span>
			<button
				type="button"
				onclick={onDismissSaveError}
				class="text-red-400/60 hover:text-red-400 ml-2"
				aria-label="Dismiss error"
			>
				✕
			</button>
		</div>
	</div>
{/if}

<!-- Config Error Alert -->
{#if showConfigError && configErrors.length > 0}
	<div class="bg-red-500/10 border border-red-500/30 rounded-sm p-4 relative" role="alert">
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
				onclick={onDismissConfigError}
				class="text-red-400/60 hover:text-red-400"
				aria-label="Dismiss error"
			>
				✕
			</button>
		</div>
	</div>
{/if}

<!-- Stability Warning Alert -->
{#if showStabilityWarning && stabilityWarnings.length > 0}
	<div class="bg-amber-500/10 border border-amber-500/30 rounded-sm p-4 relative" role="alert">
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
				onclick={onDismissStabilityWarning}
				class="text-amber-400/60 hover:text-amber-400"
				aria-label="Dismiss warning"
			>
				✕
			</button>
		</div>
	</div>
{/if}
