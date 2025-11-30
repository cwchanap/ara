<script lang="ts">
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';

	let { form } = $props();

	let email = $state(form?.email ?? '');
	let password = $state('');
	let isLoading = $state(false);

	// Client-side validation
	let emailError = $state('');
	let passwordError = $state('');

	function validateEmail(value: string): string {
		if (!value) return 'Email is required';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
		return '';
	}

	function validatePassword(value: string): string {
		if (!value) return 'Password is required';
		return '';
	}

	$effect(() => {
		if (email) emailError = validateEmail(email);
	});

	$effect(() => {
		if (password) passwordError = validatePassword(password);
	});

	function isFormValid(): boolean {
		return !validateEmail(email) && !validatePassword(password);
	}
</script>

<div class="flex min-h-[calc(100vh-12rem)] items-center justify-center">
	<div class="w-full max-w-md">
		<!-- Header -->
		<div class="mb-8 text-center">
			<h1 class="font-['Orbitron'] text-3xl font-bold tracking-wider text-primary mb-2">
				SYSTEM_LOGIN
			</h1>
			<p class="text-muted-foreground">Access your chaos visualizations</p>
		</div>

		<!-- Form Card -->
		<div class="relative bg-card/50 backdrop-blur-sm border border-primary/20 rounded-lg p-8">
			<!-- Corner decorations -->
			<div class="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
			<div class="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
			<div class="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
			<div class="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary"></div>

			{#if form?.error}
				<div
					class="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm"
				>
					{form.error}
				</div>
			{/if}

			<form
				method="POST"
				use:enhance={() => {
					isLoading = true;
					return async ({ update }) => {
						await update();
						isLoading = false;
					};
				}}
				class="space-y-6"
			>
				<!-- Email -->
				<div>
					<label for="email" class="block text-sm font-medium text-foreground mb-2">
						Email Address
					</label>
					<input
						type="email"
						id="email"
						name="email"
						bind:value={email}
						required
						autocomplete="email"
						class="w-full px-4 py-3 bg-background/50 border border-primary/30 rounded-md
                   text-foreground placeholder-muted-foreground
                   focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                   transition-colors"
						placeholder="you@example.com"
					/>
					{#if emailError && email}
						<p class="mt-1 text-sm text-destructive">{emailError}</p>
					{/if}
				</div>

				<!-- Password -->
				<div>
					<label for="password" class="block text-sm font-medium text-foreground mb-2">
						Password
					</label>
					<input
						type="password"
						id="password"
						name="password"
						bind:value={password}
						required
						autocomplete="current-password"
						class="w-full px-4 py-3 bg-background/50 border border-primary/30 rounded-md
                   text-foreground placeholder-muted-foreground
                   focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                   transition-colors"
						placeholder="••••••••"
					/>
					{#if passwordError && password}
						<p class="mt-1 text-sm text-destructive">{passwordError}</p>
					{/if}
				</div>

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={isLoading || !isFormValid()}
					class="w-full py-3 px-4 bg-primary text-primary-foreground font-['Orbitron'] font-medium
                 rounded-md uppercase tracking-wider
                 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background
                 disabled:opacity-50 disabled:cursor-not-allowed
                 transition-all duration-200"
				>
					{#if isLoading}
						<span class="inline-flex items-center gap-2">
							<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
							Logging In...
						</span>
					{:else}
						Log In
					{/if}
				</button>
			</form>

			<!-- Signup Link -->
			<p class="mt-6 text-center text-sm text-muted-foreground">
				Don't have an account?
				<a
					href="{base}/signup"
					class="text-primary hover:text-primary/80 font-medium transition-colors"
				>
					Sign up
				</a>
			</p>
		</div>
	</div>
</div>
