<!--
  ShareDialog Component
  
  A modal dialog for sharing chaos map configurations via public short URLs.
  Uses native <dialog> element with Svelte 5 runes for reactivity.
  Follows sci-fi aesthetic with neon cyan styling.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { SHARE_EXPIRATION_DAYS } from '$lib/constants';

	interface Props {
		open: boolean;
		mapType: string;
		isAuthenticated: boolean;
		currentPath: string;
		onClose: () => void;
		onShare: () => Promise<{ shareUrl: string; expiresAt: string } | null>;
	}

	let {
		open = $bindable(false),
		mapType,
		isAuthenticated,
		currentPath,
		onClose,
		onShare
	}: Props = $props();

	let isSharing = $state(false);
	let error = $state('');
	let shareUrl = $state('');
	let expiresAt = $state('');
	let copied = $state(false);
	let dialogRef: HTMLDialogElement | undefined = $state();

	// Sync dialog open state with prop
	$effect(() => {
		if (dialogRef) {
			if (open) {
				dialogRef.showModal();
				// Reset state when opening
				error = '';
				shareUrl = '';
				expiresAt = '';
				copied = false;
				isSharing = false;
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

	// Generate share link
	async function handleShare() {
		if (isSharing) return;

		isSharing = true;
		error = '';

		try {
			const result = await onShare();
			if (result) {
				shareUrl = result.shareUrl;
				expiresAt = result.expiresAt;
			} else {
				error = 'Failed to create share link';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create share link';
		} finally {
			isSharing = false;
		}
	}

	// Copy to clipboard
	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			error = 'Failed to copy to clipboard';
		}
	}

	// Format expiration date
	function formatExpiration(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<dialog
	bind:this={dialogRef}
	onclose={handleDialogClose}
	class="fixed inset-0 m-auto w-full max-w-md bg-background border border-primary/30 rounded-lg shadow-2xl backdrop:bg-black/70"
>
	<div class="p-6 relative">
		<!-- Header with corner accents -->
		<div class="relative mb-6">
			<!-- Top corners -->
			<div class="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
			<div class="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-primary"></div>

			<h2 class="font-['Orbitron'] text-xl font-bold text-primary tracking-wider text-center">
				SHARE_CONFIGURATION
			</h2>
		</div>

		{#if !isAuthenticated}
			<!-- Unauthenticated state -->
			<div class="text-center py-4">
				<p class="text-muted-foreground mb-4">Please log in to share configurations</p>
				<a
					href={`${base}/login?redirect=${encodeURIComponent(currentPath)}`}
					class="inline-block px-6 py-2 bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-colors font-['Orbitron'] text-sm tracking-wider"
				>
					LOG_IN
				</a>
			</div>
		{:else if shareUrl}
			<!-- Share link generated -->
			<div class="space-y-4">
				<div class="p-3 bg-primary/5 border border-primary/20 rounded">
					<p class="text-xs text-muted-foreground uppercase tracking-widest mb-2">Share URL</p>
					<div class="flex items-center gap-2">
						<input
							type="text"
							readonly
							value={shareUrl}
							class="flex-1 px-3 py-2 bg-background/50 border border-primary/30 rounded text-foreground text-sm font-mono"
						/>
						<button
							onclick={copyToClipboard}
							class="px-4 py-2 bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-colors text-sm"
						>
							{copied ? '✓' : '📋'}
						</button>
					</div>
				</div>

				{#if copied}
					<p class="text-green-400 text-sm text-center">Copied to clipboard!</p>
				{/if}

				<div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded">
					<p class="text-amber-200 text-sm">
						<span class="font-bold">⏱️ Expires:</span>
						{formatExpiration(expiresAt)}
					</p>
					<p class="text-amber-200/60 text-xs mt-1">
						Links are valid for {SHARE_EXPIRATION_DAYS} days
					</p>
				</div>

				<div class="p-3 bg-card/50 border border-white/10 rounded">
					<p class="text-xs text-muted-foreground uppercase tracking-widest mb-1">Sharing</p>
					<p class="font-['Orbitron'] text-primary">{mapType.toUpperCase().replace(/-/g, '_')}</p>
				</div>

				<div class="flex justify-end pt-2">
					<button
						type="button"
						onclick={handleDialogClose}
						class="px-6 py-2 bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-colors font-['Orbitron'] text-sm tracking-wider"
					>
						DONE
					</button>
				</div>
			</div>
		{:else}
			<!-- Initial state: Generate share link -->
			<div class="space-y-4">
				<div class="p-3 bg-primary/5 border border-primary/20 rounded">
					<p class="text-xs text-muted-foreground uppercase tracking-widest mb-1">Sharing</p>
					<p class="font-['Orbitron'] text-primary">{mapType.toUpperCase().replace(/-/g, '_')}</p>
				</div>

				<p class="text-muted-foreground text-sm">
					Create a public link to share your current configuration. Anyone with the link can view
					(but not save) this visualization.
				</p>

				<div class="text-xs text-muted-foreground/60 space-y-1">
					<p>• Link expires in {SHARE_EXPIRATION_DAYS} days</p>
					<p>• Viewers can adjust parameters temporarily</p>
					<p>• Your username will be shown as attribution</p>
				</div>

				<!-- Error message -->
				{#if error}
					<div class="p-3 bg-red-500/10 border border-red-500/30 rounded">
						<p class="text-red-400 text-sm">{error}</p>
					</div>
				{/if}

				<!-- Action buttons -->
				<div class="flex gap-3 justify-end pt-2">
					<button
						type="button"
						onclick={handleDialogClose}
						disabled={isSharing}
						class="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={handleShare}
						disabled={isSharing}
						class="px-6 py-2 bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-colors font-['Orbitron'] text-sm tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
					>
						{#if isSharing}
							<span class="animate-spin">⟳</span>
							GENERATING...
						{:else}
							🔗 GENERATE_LINK
						{/if}
					</button>
				</div>
			</div>
		{/if}

		<!-- Bottom corners -->
		<div class="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-primary"></div>
	</div>
</dialog>
