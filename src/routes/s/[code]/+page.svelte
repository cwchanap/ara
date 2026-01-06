<!--
  Public Share Viewer Page
  
  Displays a shared chaos map configuration with attribution and expiration notice.
  Read-only view - parameters can be adjusted temporarily but not saved.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { CHAOS_MAP_DISPLAY_NAMES } from '$lib/types';
	import type { ChaosMapType } from '$lib/types';

	let { data } = $props();

	// Get display name for the map type
	const displayName =
		CHAOS_MAP_DISPLAY_NAMES[data.mapType as ChaosMapType] ?? data.mapType.toUpperCase();

	// Safe stringify helper
	function safeStringify(obj: unknown): string {
		try {
			return JSON.stringify(obj, null, 2);
		} catch (err) {
			console.error('Failed to stringify parameters:', err);
			return '/* [Error: Non-serializable parameters] */';
		}
	}

	// Build the URL to the actual visualization with parameters
	function getVisualizationUrl(): string {
		try {
			const configParam = encodeURIComponent(JSON.stringify(data.parameters));
			const sharedByParam = encodeURIComponent(data.username);
			return `${base}/${data.mapType}?config=${configParam}&shared=true&sharedBy=${sharedByParam}`;
		} catch (err) {
			console.error('Failed to build visualization URL:', err);
			return `${base}/${data.mapType}?shared=true`;
		}
	}

	// Format date for display
	function formatDate(dateStr: string): string {
		try {
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return 'UNKNOWN_DATE';
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return 'UNKNOWN_DATE';
		}
	}
</script>

<svelte:head>
	<title>{displayName} - Shared Configuration | Chaos Visualizer</title>
	<meta name="description" content="Shared chaos visualization configuration by {data.username}" />
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6">
	<!-- Header -->
	<div class="text-center space-y-4">
		<h1
			class="text-3xl md:text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
		>
			{displayName}
		</h1>
		<p class="text-muted-foreground font-light tracking-wide">SHARED_CONFIGURATION</p>
	</div>

	<!-- Attribution Card -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative overflow-hidden"
	>
		<!-- Decor corners -->
		<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
		<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
		<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

		<div class="space-y-4">
			<!-- Shared by -->
			<div class="flex items-center gap-3">
				<span class="text-2xl">👤</span>
				<div>
					<p class="text-xs text-muted-foreground uppercase tracking-widest">Shared by</p>
					<p class="text-lg font-['Orbitron'] text-primary">{data.username}</p>
				</div>
			</div>

			<!-- Stats row -->
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-white/10">
				<div>
					<p class="text-xs text-muted-foreground uppercase tracking-widest">Created</p>
					<p class="text-foreground">{formatDate(data.createdAt)}</p>
				</div>
				<div>
					<p class="text-xs text-muted-foreground uppercase tracking-widest">Views</p>
					<p class="text-foreground">{data.viewCount.toLocaleString()}</p>
				</div>
				<div class="col-span-2 md:col-span-1">
					<p class="text-xs text-muted-foreground uppercase tracking-widest">Expires</p>
					<p class="text-foreground">{formatDate(data.expiresAt)}</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Expiration Warning -->
	{#if data.daysRemaining <= 2}
		<div class="bg-amber-500/10 border border-amber-500/30 rounded-sm p-4">
			<div class="flex items-center gap-3">
				<span class="text-amber-400 text-xl">⚠️</span>
				<div>
					<p class="text-amber-200 font-medium">
						{#if data.daysRemaining < 0}
							This share has expired.
						{:else if data.daysRemaining === 0}
							This share expires today!
						{:else if data.daysRemaining === 1}
							This share expires tomorrow!
						{:else}
							This share expires in {data.daysRemaining} days
						{/if}
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Parameters Preview -->
	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6">
		<h2 class="text-lg font-['Orbitron'] font-semibold text-primary mb-4 flex items-center gap-2">
			<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
			PARAMETERS
		</h2>
		<div class="font-mono text-sm bg-black/30 p-4 rounded border border-white/5 overflow-x-auto">
			<pre class="text-muted-foreground">{safeStringify(data.parameters)}</pre>
		</div>
	</div>

	<!-- Action Button -->
	<div class="flex flex-col sm:flex-row gap-4 justify-center pt-4">
		<a
			href={getVisualizationUrl()}
			class="px-8 py-3 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 rounded-sm transition-all hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] uppercase tracking-widest text-sm font-bold text-center font-['Orbitron']"
		>
			🚀 VIEW_VISUALIZATION
		</a>
		<a
			href="{base}/"
			class="px-8 py-3 bg-card/50 hover:bg-card/70 text-muted-foreground hover:text-foreground border border-white/10 rounded-sm transition-all uppercase tracking-widest text-sm font-bold text-center"
		>
			← EXPLORE_MORE
		</a>
	</div>

	<!-- Info notice -->
	<p class="text-center text-muted-foreground/60 text-xs">
		This is a read-only shared view. You can adjust parameters temporarily, but changes won't be
		saved.
	</p>
</div>
