<!--
  SaveConfigDialog Component
  
  A modal dialog for saving chaos map configurations.
  Uses native <dialog> element with Svelte 5 runes for reactivity.
  Follows sci-fi aesthetic with neon cyan styling.
-->
<script lang="ts">
	import { base } from '$app/paths';

	interface Props {
		open: boolean;
		mapType: string;
		isAuthenticated: boolean;
		currentPath: string;
		onClose: () => void;
		onSave: (name: string) => Promise<void>;
	}

	let {
		open = $bindable(false),
		mapType,
		isAuthenticated,
		currentPath,
		onClose,
		onSave
	}: Props = $props();

	let name = $state('');
	let isSaving = $state(false);
	let error = $state('');
	let dialogRef: HTMLDialogElement | undefined = $state();

	// Sync dialog open state with prop
	$effect(() => {
		if (dialogRef) {
			if (open) {
				dialogRef.showModal();
				// Reset state when opening
				name = '';
				error = '';
				isSaving = false;
			} else {
				dialogRef.close();
			}
		}
	});

	// Handle dialog close (backdrop click or escape)
	function handleDialogClose() {
		open = false;
		onClose();
	}

	// Validate and submit
	async function handleSubmit(e: Event) {
		e.preventDefault();

		// Client-side validation
		const trimmedName = name.trim();
		if (!trimmedName) {
			error = 'Please enter a configuration name';
			return;
		}
		if (trimmedName.length > 100) {
			error = 'Name must be 100 characters or less';
			return;
		}

		isSaving = true;
		error = '';

		try {
			await onSave(trimmedName);
			open = false;
			onClose();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save configuration';
		} finally {
			isSaving = false;
		}
	}

	// Handle keyboard events
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleDialogClose();
		}
	}
</script>

<dialog
	bind:this={dialogRef}
	onclose={handleDialogClose}
	onkeydown={handleKeyDown}
	class="fixed inset-0 m-auto w-full max-w-md bg-background border border-primary/30 rounded-lg shadow-2xl backdrop:bg-black/70"
>
	<div class="p-6 relative">
		<!-- Header with corner accents -->
		<div class="relative mb-6">
			<!-- Top corners -->
			<div class="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
			<div class="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-primary"></div>

			<h2 class="font-['Orbitron'] text-xl font-bold text-primary tracking-wider text-center">
				SAVE_CONFIGURATION
			</h2>
		</div>

		{#if !isAuthenticated}
			<!-- Unauthenticated state -->
			<div class="text-center py-4">
				<p class="text-muted-foreground mb-4">Please log in to save configurations</p>
				<a
					href={`${base}/login?redirect=${encodeURIComponent(currentPath)}`}
					class="inline-block px-6 py-2 bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-colors font-['Orbitron'] text-sm tracking-wider"
				>
					LOG_IN
				</a>
			</div>
		{:else}
			<!-- Authenticated: Show save form -->
			<form onsubmit={handleSubmit}>
				<div class="mb-4">
					<label
						for="config-name"
						class="block text-sm text-primary/80 uppercase tracking-widest mb-2 font-medium"
					>
						Configuration Name
					</label>
					<input
						id="config-name"
						type="text"
						bind:value={name}
						placeholder="My Awesome Config"
						maxlength={100}
						disabled={isSaving}
						class="w-full px-4 py-3 bg-background/50 border border-primary/30 rounded text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors disabled:opacity-50"
					/>
					<p class="text-xs text-muted-foreground mt-1">{name.length}/100 characters</p>
				</div>

				<!-- Map type display -->
				<div class="mb-4 p-3 bg-primary/5 border border-primary/20 rounded">
					<p class="text-xs text-muted-foreground uppercase tracking-widest mb-1">Saving</p>
					<p class="font-['Orbitron'] text-primary">{mapType.toUpperCase().replace(/-/g, '_')}</p>
				</div>

				<!-- Error message -->
				{#if error}
					<div class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
						<p class="text-red-400 text-sm">{error}</p>
					</div>
				{/if}

				<!-- Action buttons -->
				<div class="flex gap-3 justify-end">
					<button
						type="button"
						onclick={handleDialogClose}
						disabled={isSaving}
						class="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSaving || !name.trim()}
						class="px-6 py-2 bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-colors font-['Orbitron'] text-sm tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
					>
						{#if isSaving}
							<span class="animate-spin">⟳</span>
							SAVING...
						{:else}
							SAVE
						{/if}
					</button>
				</div>
			</form>
		{/if}

		<!-- Bottom corners -->
		<div class="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-primary"></div>
	</div>
</dialog>
