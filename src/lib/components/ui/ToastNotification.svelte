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

	const variantConfig = {
		success: {
			icon: '✓',
			bgClass: 'bg-green-500/10',
			borderClass: 'border-green-500/30',
			iconClass: 'text-green-400',
			textClass: 'text-green-200',
			duration: TOAST_SUCCESS_DURATION_MS
		},
		error: {
			icon: '✕',
			bgClass: 'bg-red-500/10',
			borderClass: 'border-red-500/30',
			iconClass: 'text-red-400',
			textClass: 'text-red-200',
			duration: TOAST_ERROR_DURATION_MS
		},
		warning: {
			icon: '⚠️',
			bgClass: 'bg-amber-500/10',
			borderClass: 'border-amber-500/30',
			iconClass: 'text-amber-400',
			textClass: 'text-amber-200',
			duration: TOAST_WARNING_DURATION_MS
		}
	};

	$effect(() => {
		if (show && autoDismiss) {
			// Clear any existing timeout
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			const duration = variantConfig[variant].duration;
			timeoutId = setTimeout(() => {
				show = false;
				onDismiss?.();
			}, duration);
		}

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
					onclick={handleDismiss}
					class="{config.iconClass}/60 hover:{config.iconClass} ml-2"
					aria-label="Dismiss notification"
				>
					✕
				</button>
			{/if}
		</div>
	</div>
{/if}
