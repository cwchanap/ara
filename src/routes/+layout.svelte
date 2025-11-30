<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { base } from '$app/paths';
	import { createClient } from '$lib/supabase';
	import { invalidate, goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	let { children, data } = $props();

	// Derive session state from layout data
	let isAuthenticated = $derived(!!data.session);

	// Session expiry notification state
	let showSessionExpiredNotification = $state(false);

	// Track if user initiated logout to distinguish from session expiry
	// This prevents showing "session expired" notification on intentional logout
	let userInitiatedLogout = $state(false);

	// Track previous auth state - stored as plain variable, updated before auth state changes
	// This is intentionally not reactive to capture the state before onAuthStateChange fires
	let wasAuthenticated = false;

	// Browser client for auth state changes (created in onMount to avoid SSR issues)
	let supabase: ReturnType<typeof createClient> | undefined;

	// Timer ID for session expiry redirect (for cleanup)
	let sessionExpiryTimerId: ReturnType<typeof setTimeout> | undefined;

	// Handler for logout form submission to mark user-initiated logout
	function handleLogoutSubmit() {
		userInitiatedLogout = true;
	}

	onMount(() => {
		// Initialize wasAuthenticated from initial data
		wasAuthenticated = !!data.session;

		// Create Supabase client only in browser context
		supabase = createClient();

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event, session) => {
			// Invalidate layout data to refresh session state
			invalidate('supabase:auth');

			// Update wasAuthenticated to reflect the latest session state
			// This must happen before SIGNED_OUT handling so the check uses current auth state
			if (event === 'SIGNED_IN') {
				wasAuthenticated = true;
			} else if (event === 'SIGNED_OUT') {
				// Capture current state before updating for the notification check below
				const wasAuthenticatedBefore = wasAuthenticated;
				wasAuthenticated = false;

				// Handle session expiry (T046, T047)
				if (!session) {
					// Only show notification if:
					// 1. User was previously authenticated
					// 2. This wasn't a user-initiated logout
					if (wasAuthenticatedBefore && !userInitiatedLogout) {
						showSessionExpiredNotification = true;
						// Store current path for return URL
						const currentPath = $page.url.pathname;
						const isAuthPage = currentPath.includes('/login') || currentPath.includes('/signup');
						if (!isAuthPage) {
							// Store timer ID for cleanup on unmount
							sessionExpiryTimerId = setTimeout(() => {
								showSessionExpiredNotification = false;
								goto(`${base}/login?redirect=${encodeURIComponent(currentPath)}`);
							}, 3000);
						}
					}
					// Reset the flag after handling
					userInitiatedLogout = false;
				}
				return; // Early return since SIGNED_OUT is fully handled
			}

			// Handle other auth events that might indicate session state changes
			if (event === 'TOKEN_REFRESHED' && session) {
				wasAuthenticated = true;
			}
		});

		return () => subscription.unsubscribe();
	});

	// Cleanup timer on component destroy to prevent navigation on unmounted component
	onDestroy(() => {
		if (sessionExpiryTimerId) {
			clearTimeout(sessionExpiryTimerId);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Chaos Theory Visualizations</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div
	class="min-h-screen bg-background font-['Rajdhani',sans-serif] text-foreground relative overflow-hidden dark"
>
	<!-- Tech Grid Background -->
	<div
		class="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"
	></div>
	<div
		class="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_-30%,#2d1b6925,transparent)]"
	></div>

	<nav class="relative z-10 bg-background/80 backdrop-blur-md border-b border-primary/20">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between h-16">
				<a
					href="{base}/"
					class="font-['Orbitron'] text-2xl font-bold bg-linear-to-r from-primary via-cyan-400 to-accent bg-clip-text text-transparent tracking-wider"
				>
					CHAOS_THEORY
				</a>
				<div class="flex gap-6 items-center">
					<div class="h-4 w-px bg-primary/20 hidden sm:block"></div>
					<a
						href="{base}/"
						class="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors font-medium"
					>
						Home
					</a>

					{#if isAuthenticated}
						<!-- Authenticated: Show Profile and Logout -->
						<a
							href="{base}/profile"
							class="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors font-medium"
						>
							Profile
						</a>
						<form
							method="POST"
							action="{base}/profile?/signout"
							use:enhance
							onsubmit={handleLogoutSubmit}
							class="inline"
						>
							<button
								type="submit"
								class="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors font-medium cursor-pointer"
							>
								Logout
							</button>
						</form>
					{:else}
						<!-- Not authenticated: Show Login and Signup -->
						<a
							href="{base}/login"
							class="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors font-medium"
						>
							Login
						</a>
						<a
							href="{base}/signup"
							class="text-sm uppercase tracking-widest text-primary hover:text-primary/80 transition-colors font-medium"
						>
							Sign Up
						</a>
					{/if}
				</div>
			</div>
		</div>
	</nav>

	<main class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Session Expired Notification (T047) -->
		{#if showSessionExpiredNotification}
			<div
				class="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-4 bg-amber-500/10 border border-amber-500/30 rounded-lg backdrop-blur-sm shadow-lg"
			>
				<div class="flex items-center gap-3">
					<svg class="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<span class="text-amber-200">Your session has expired. Redirecting to login...</span>
				</div>
			</div>
		{/if}

		{@render children()}
	</main>
</div>
