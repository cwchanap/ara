<!--
  DeleteConfirmDialog Component
  
  A confirmation dialog for deleting saved configurations.
  Uses native <dialog> element with Svelte 5 runes for reactivity.
  Follows sci-fi aesthetic with warning styling.
-->
<script lang="ts">
	interface Props {
		open: boolean;
		configName: string;
		isDeleting: boolean;
		onClose: () => void;
		onConfirm: () => Promise<void>;
	}

	let { open = $bindable(false), configName, isDeleting, onClose, onConfirm }: Props = $props();

	let dialogRef: HTMLDialogElement | undefined = $state();

	// Sync dialog open state with prop
	$effect(() => {
		if (dialogRef) {
			if (open) {
				dialogRef.showModal();
			} else {
				dialogRef.close();
			}
		}
	});

	// Handle dialog close (backdrop click or escape)
	function handleDialogClose() {
		if (!isDeleting) {
			open = false;
			onClose();
		}
	}

	// Handle confirm click
	async function handleConfirm() {
		await onConfirm();
	}

	// Handle keyboard events
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !isDeleting) {
			handleDialogClose();
		}
	}
</script>

<dialog
	bind:this={dialogRef}
	onclose={handleDialogClose}
	onkeydown={handleKeyDown}
	class="fixed inset-0 m-auto w-full max-w-sm bg-background border border-red-500/30 rounded-lg shadow-2xl backdrop:bg-black/70"
>
	<div class="p-6">
		<!-- Header with warning icon -->
		<div class="text-center mb-6">
			<div
				class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center"
			>
				<svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
					/>
				</svg>
			</div>
			<h2 class="font-['Orbitron'] text-lg font-bold text-red-400 tracking-wider">
				DELETE_CONFIGURATION
			</h2>
		</div>

		<!-- Confirmation message -->
		<div class="text-center mb-6">
			<p class="text-muted-foreground mb-2">Are you sure you want to delete</p>
			<p class="font-['Orbitron'] text-primary text-lg">"{configName}"</p>
			<p class="text-sm text-muted-foreground/70 mt-2">This action cannot be undone.</p>
		</div>

		<!-- Action buttons -->
		<div class="flex gap-3 justify-center">
			<button
				type="button"
				onclick={handleDialogClose}
				disabled={isDeleting}
				class="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={handleConfirm}
				disabled={isDeleting}
				class="px-6 py-2 bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition-colors font-['Orbitron'] text-sm tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
			>
				{#if isDeleting}
					<span class="animate-spin">⟳</span>
					DELETING...
				{:else}
					DELETE
				{/if}
			</button>
		</div>
	</div>
</dialog>
