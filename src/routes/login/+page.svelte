<script lang="ts">
	type LoginForm = { error?: string } | null | undefined;
	let { form }: { form?: LoginForm } = $props();
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

			<form method="POST" class="space-y-6">
				<button
					type="submit"
					class="w-full py-3 px-4 bg-primary text-primary-foreground font-['Orbitron'] font-medium
                 rounded-md uppercase tracking-wider
                 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background
                 transition-all duration-200"
				>
					Continue with Google
				</button>
			</form>
		</div>
	</div>
</div>
