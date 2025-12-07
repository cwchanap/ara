<!--
  Saved Configurations List Page
  
  Displays all saved chaos map configurations for the authenticated user.
  Follows sci-fi aesthetic with neon cyan styling and Orbitron font.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { CHAOS_MAP_DISPLAY_NAMES } from '$lib/types';
	import type { SavedConfiguration, ChaosMapType } from '$lib/types';
	import DeleteConfirmDialog from '$lib/components/ui/DeleteConfirmDialog.svelte';

	let { data, form } = $props();

	// Delete dialog state
	let showDeleteDialog = $state(false);
	let configToDelete = $state<SavedConfiguration | null>(null);
	let isDeleting = $state(false);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let deleteError = $state('');

	// Rename state
	let renamingConfigId = $state<string | null>(null);
	let renameValue = $state('');
	let renameError = $state('');

	// Success messages
	let showDeleteSuccess = $state(false);
	let showRenameSuccess = $state(false);

	// Get display name for map type
	function getDisplayName(mapType: string): string {
		return CHAOS_MAP_DISPLAY_NAMES[mapType as ChaosMapType] || mapType.toUpperCase();
	}

	// Format date for display
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Handle load configuration - navigate to map with params
	function loadConfiguration(config: SavedConfiguration) {
		const params = encodeURIComponent(JSON.stringify(config.parameters));
		goto(`${base}/${config.mapType}?config=${params}`);
	}

	// Open delete confirmation
	function openDeleteDialog(config: SavedConfiguration) {
		configToDelete = config;
		showDeleteDialog = true;
		deleteError = '';
	}

	// Close delete dialog
	function closeDeleteDialog() {
		showDeleteDialog = false;
		configToDelete = null;
		isDeleting = false;
	}

	// Handle delete confirmation
	async function handleDeleteConfirm() {
		if (!configToDelete) return;

		isDeleting = true;
		deleteError = '';

		// Submit the delete form programmatically
		const formData = new FormData();
		formData.append('configurationId', configToDelete.id);

		try {
			const response = await fetch(`${base}/saved-configs?/delete`, {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'failure') {
				deleteError = result.data?.deleteError || 'Failed to delete configuration';
				isDeleting = false;
			} else {
				// Success - close dialog and refresh
				closeDeleteDialog();
				showDeleteSuccess = true;
				setTimeout(() => {
					showDeleteSuccess = false;
				}, 3000);
				// Reload the page to get fresh data
				location.reload();
			}
		} catch {
			deleteError = 'Failed to delete configuration';
			isDeleting = false;
		}
	}

	// Start renaming
	function startRename(config: SavedConfiguration) {
		renamingConfigId = config.id;
		renameValue = config.name;
		renameError = '';
	}

	// Cancel rename
	function cancelRename() {
		renamingConfigId = null;
		renameValue = '';
		renameError = '';
	}

	// Handle form results
	$effect(() => {
		if (form?.deleteSuccess) {
			showDeleteSuccess = true;
			setTimeout(() => {
				showDeleteSuccess = false;
			}, 3000);
		}
		if (form?.renameSuccess) {
			renamingConfigId = null;
			showRenameSuccess = true;
			setTimeout(() => {
				showRenameSuccess = false;
			}, 3000);
		}
		if (form?.renameError) {
			renameError = form.renameError;
		}
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				SAVED_CONFIGURATIONS
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				MY_CHAOS_MAP_PRESETS // {data.configurations.length} ITEMS
			</p>
		</div>
		<a
			href="{base}/"
			class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
		>
			← Return
		</a>
	</div>

	<!-- Success Toast -->
	{#if showDeleteSuccess}
		<div
			class="fixed top-20 right-4 z-50 px-6 py-4 bg-green-500/10 border border-green-500/30 rounded-lg backdrop-blur-sm shadow-lg"
		>
			<div class="flex items-center gap-3">
				<span class="text-green-400">✓</span>
				<span class="text-green-200">Configuration deleted successfully!</span>
			</div>
		</div>
	{/if}

	{#if showRenameSuccess}
		<div
			class="fixed top-20 right-4 z-50 px-6 py-4 bg-green-500/10 border border-green-500/30 rounded-lg backdrop-blur-sm shadow-lg"
		>
			<div class="flex items-center gap-3">
				<span class="text-green-400">✓</span>
				<span class="text-green-200">Configuration renamed successfully!</span>
			</div>
		</div>
	{/if}

	<!-- Empty State -->
	{#if data.configurations.length === 0}
		<div
			class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-12 text-center relative overflow-hidden"
		>
			<!-- Corners -->
			<div class="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
			<div class="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
			<div class="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
			<div class="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary"></div>

			<div
				class="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center"
			>
				<span class="text-4xl opacity-50">📁</span>
			</div>
			<h2 class="font-['Orbitron'] text-xl font-bold text-primary mb-2">NO_CONFIGURATIONS_FOUND</h2>
			<p class="text-muted-foreground mb-6">You haven't saved any chaos map configurations yet.</p>
			<a
				href="{base}/"
				class="inline-block px-6 py-2 bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-colors font-['Orbitron'] text-sm tracking-wider"
			>
				EXPLORE_CHAOS_MAPS
			</a>
		</div>
	{:else}
		<!-- Configuration Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each data.configurations as config (config.id)}
				<div
					class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-4 relative group hover:border-primary/40 transition-colors"
				>
					<!-- Corners -->
					<div
						class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary opacity-50 group-hover:opacity-100 transition-opacity"
					></div>
					<div
						class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary opacity-50 group-hover:opacity-100 transition-opacity"
					></div>
					<div
						class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary opacity-50 group-hover:opacity-100 transition-opacity"
					></div>
					<div
						class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary opacity-50 group-hover:opacity-100 transition-opacity"
					></div>

					<!-- Map Type Badge -->
					<div class="mb-3">
						<span
							class="inline-block px-2 py-1 text-xs font-['Orbitron'] tracking-wider bg-accent/20 border border-accent/30 text-accent rounded"
						>
							{getDisplayName(config.mapType)}
						</span>
					</div>

					<!-- Name (editable) -->
					{#if renamingConfigId === config.id}
						<form
							method="POST"
							action="?/rename"
							use:enhance={() => {
								return async ({ result, update }) => {
									if (result.type === 'success') {
										renamingConfigId = null;
									}
									await update();
								};
							}}
							class="mb-3"
						>
							<input type="hidden" name="configurationId" value={config.id} />
							<div class="flex gap-2">
								<input
									type="text"
									name="name"
									bind:value={renameValue}
									maxlength={100}
									class="flex-1 px-2 py-1 text-sm bg-background/50 border border-primary/30 rounded text-foreground focus:border-primary focus:outline-none"
									autofocus
								/>
								<button type="submit" class="px-2 py-1 text-xs text-green-400 hover:text-green-300">
									✓
								</button>
								<button
									type="button"
									onclick={cancelRename}
									class="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
								>
									✕
								</button>
							</div>
							{#if renameError && form?.configurationId === config.id}
								<p class="text-red-400 text-xs mt-1">{renameError}</p>
							{/if}
						</form>
					{:else}
						<h3
							class="font-['Orbitron'] text-lg font-semibold text-primary mb-1 truncate"
							title={config.name}
						>
							{config.name}
						</h3>
					{/if}

					<!-- Date -->
					<p class="text-xs text-muted-foreground mb-4 font-mono">
						{formatDate(config.createdAt)}
					</p>

					<!-- Actions -->
					<div class="flex gap-2">
						<button
							onclick={() => loadConfiguration(config)}
							class="flex-1 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all text-sm font-['Orbitron'] tracking-wider"
						>
							LOAD
						</button>
						<button
							onclick={() => startRename(config)}
							class="px-3 py-2 text-muted-foreground hover:text-primary transition-colors"
							title="Rename"
						>
							✏️
						</button>
						<button
							onclick={() => openDeleteDialog(config)}
							class="px-3 py-2 text-muted-foreground hover:text-red-400 transition-colors"
							title="Delete"
						>
							🗑️
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
<DeleteConfirmDialog
	bind:open={showDeleteDialog}
	configName={configToDelete?.name || ''}
	{isDeleting}
	onClose={closeDeleteDialog}
	onConfirm={handleDeleteConfirm}
/>
