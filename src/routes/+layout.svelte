<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { base } from '$app/paths';

	let { children } = $props();
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
				</div>
			</div>
		</div>
	</nav>

	<main class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{@render children()}
	</main>
</div>
