<script lang="ts">
	import { enhance } from '$app/forms';
	import { onDestroy } from 'svelte';
	import type { Profile } from '$lib/types';
	import { validateUsername as sharedValidateUsername } from '$lib/auth-errors';

	type ProfileForm =
		| {
				updateSuccess?: boolean;
				updateError?: string;
				username?: string;
		  }
		| null
		| undefined;

	let { data, form }: { data: App.PageData; form?: ProfileForm } = $props();

	// Get profile from page data
	let profile: Profile | null = $derived(data.profile ?? null);
	let user = $derived(data.user);

	// Username form state - initialize from profile when available
	let username = $state('');
	$effect(() => {
		if (profile?.username && !username) {
			username = profile.username;
		}
	});
	let isUpdatingUsername = $state(false);
	let usernameError = $state('');
	let usernameSuccess = $state('');

	// Track timeouts for cleanup on unmount
	let usernameSuccessTimeout: ReturnType<typeof setTimeout> | null = null;

	// Cleanup timeouts on component destroy
	onDestroy(() => {
		if (usernameSuccessTimeout) clearTimeout(usernameSuccessTimeout);
	});

	// Client-side validation - wrapper to convert null to empty string for UI
	function validateUsername(value: string): string {
		return sharedValidateUsername(value) ?? '';
	}

	$effect(() => {
		if (username) usernameError = validateUsername(username);
	});

	// Handle form responses
	$effect(() => {
		if (form?.updateSuccess) {
			usernameSuccess = 'Username updated successfully!';
			if (usernameSuccessTimeout) clearTimeout(usernameSuccessTimeout);
			usernameSuccessTimeout = setTimeout(() => (usernameSuccess = ''), 3000);
		}
		if (form?.updateError) {
			usernameError = form.updateError;
		}
	});
</script>

<div class="max-w-2xl mx-auto">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="font-['Orbitron'] text-3xl font-bold tracking-wider text-primary mb-2">
			USER_PROFILE
		</h1>
		<p class="text-muted-foreground">Manage your account settings</p>
	</div>

	<!-- Profile Info Card -->
	<div class="relative bg-card/50 backdrop-blur-sm border border-primary/20 rounded-lg p-8 mb-8">
		<!-- Corner decorations -->
		<div class="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
		<div class="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
		<div class="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary"></div>

		<h2
			class="font-['Orbitron'] text-xl font-semibold text-foreground mb-6 uppercase tracking-wide"
		>
			Account Information
		</h2>

		<!-- Email (read-only) -->
		<div class="mb-6">
			<span class="block text-sm font-medium text-muted-foreground mb-2"> Email Address </span>
			<div
				class="px-4 py-3 bg-background/30 border border-primary/20 rounded-md text-foreground/70"
			>
				{user?.email ?? 'Loading...'}
			</div>
			<p class="mt-1 text-xs text-muted-foreground">Email cannot be changed</p>
		</div>

		<!-- Username Form -->
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				isUpdatingUsername = true;
				usernameSuccess = '';
				return async ({ update }) => {
					try {
						await update();
					} finally {
						isUpdatingUsername = false;
					}
				};
			}}
		>
			<div class="mb-4">
				<label for="username" class="block text-sm font-medium text-foreground mb-2">
					Username
				</label>
				<input
					type="text"
					id="username"
					name="username"
					bind:value={username}
					required
					minlength="3"
					maxlength="30"
					pattern="^[a-zA-Z0-9_]+$"
					class="w-full px-4 py-3 bg-background/50 border border-primary/30 rounded-md
                 text-foreground placeholder-muted-foreground
                 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                 transition-colors"
					placeholder="chaos_explorer"
				/>
				{#if usernameError && username !== profile?.username}
					<p class="mt-1 text-sm text-destructive">{usernameError}</p>
				{:else}
					<p class="mt-1 text-xs text-muted-foreground">
						3-30 characters, letters, numbers, and underscores only
					</p>
				{/if}
			</div>

			{#if usernameSuccess}
				<div
					class="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-md text-green-400 text-sm"
				>
					{usernameSuccess}
				</div>
			{/if}

			<button
				type="submit"
				disabled={isUpdatingUsername ||
					!!validateUsername(username) ||
					username === profile?.username}
				class="py-2 px-6 bg-primary text-primary-foreground font-medium
               rounded-md uppercase tracking-wider text-sm
               hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50
               disabled:opacity-50 disabled:cursor-not-allowed
               transition-all duration-200"
			>
				{#if isUpdatingUsername}
					<span class="inline-flex items-center gap-2">
						<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
								fill="none"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Updating...
					</span>
				{:else}
					Update Username
				{/if}
			</button>
		</form>
	</div>
</div>
