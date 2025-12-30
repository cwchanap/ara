<!--
  InfoPanel Component
  
  Information panel for visualization descriptions.
-->
<script lang="ts">
	interface Props {
		title: string;
		description: string;
	}

	let { title, description }: Props = $props();
</script>

<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
	<div
		class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
	></div>
	<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
		DATA_LOG: {title}
	</h3>
	<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
		{description}
	</p>
</div>
