<!--
  ToastNotification Component
  
  A reusable toast notification for success/error/warning messages.
  Follows sci-fi aesthetic with neon styling and auto-dismiss.
-->
<script lang="ts">
	import {
		TOAST_SUCCESS_DURATION_MS,
		TOAST_ERROR_DURATION_MS,
		TOAST_WARNING_DURATION_MS
	} from '$lib/constants';

	type ToastVariant = 'success' | 'error' | 'warning';

	interface Props {
		variant: ToastVariant;
		message: string;
		show: boolean;
		dismissable?: boolean;
		autoDismiss?: boolean;
		onDismiss?: () => void;
	}

	let {
		variant,
		message,
		show = $bindable(false),
		dismissable = true,
		autoDismiss = true,
		onDismiss
	}: Props = $props();

	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let wasShowing = false;
	let wasAutoDismiss = false;

	const variantConfig = {
		success: {
			icon: '✓',
			bgClass: 'bg-green-500/10',
			borderClass: 'border-green-500/30',
			iconClass: 'text-green-400',
			textClass: 'text-green-200',
			buttonClass: 'text-green-400/60 hover:text-green-500 ml-2',
			duration: TOAST_SUCCESS_DURATION_MS
		},
		error: {
			icon: '✕',
			bgClass: 'bg-red-500/10',
			borderClass: 'border-red-500/30',
			iconClass: 'text-red-400',
			textClass: 'text-red-200',
			buttonClass: 'text-red-400/60 hover:text-red-500 ml-2',
			duration: TOAST_ERROR_DURATION_MS
		},
		warning: {
			icon: '⚠️',
			bgClass: 'bg-amber-500/10',
			borderClass: 'border-amber-500/30',
			iconClass: 'text-amber-400',
			textClass: 'text-amber-200',
			buttonClass: 'text-amber-400/60 hover:text-amber-500 ml-2',
			duration: TOAST_WARNING_DURATION_MS
		}
	};

	$effect(() => {
		const shouldStartTimer = show && autoDismiss && (!wasShowing || !wasAutoDismiss);
		const shouldClearTimer = !show;

		if (shouldClearTimer && timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}

		if (shouldStartTimer) {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}

			const duration = variantConfig[variant].duration;
			timeoutId = setTimeout(() => {
				show = false;
				onDismiss?.();
			}, duration);
		}

		wasShowing = show;
		wasAutoDismiss = autoDismiss;

		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		};
	});

	function handleDismiss() {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
		show = false;
		onDismiss?.();
	}

	const config = $derived(variantConfig[variant]);
</script>

{#if show}
	<div
		class="fixed top-20 right-4 z-50 px-6 py-4 {config.bgClass} border {config.borderClass} rounded-lg backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-right-5"
		role="alert"
		aria-live="polite"
	>
		<div class="flex items-center gap-3">
			<span class={config.iconClass}>{config.icon}</span>
			<span class={config.textClass}>{message}</span>
			{#if dismissable}
				<button
					type="button"
					onclick={handleDismiss}
					class={config.buttonClass}
					aria-label="Dismiss notification"
				>
					✕
				</button>
			{/if}
		</div>
	</div>
{/if}
