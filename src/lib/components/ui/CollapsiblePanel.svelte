<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { PanelStorageKey } from '$lib/chaos-panel-storage';
	import { getPanelOpenStore } from '$lib/chaos-panel-open-store';

	interface Props {
		title: string;
		storageKey: PanelStorageKey;
		defaultOpen: boolean;
		bodyId: string;
		titleLevel?: 'h2' | 'h3';
		children: Snippet;
	}

	let { title, storageKey, defaultOpen, bodyId, titleLevel = 'h2', children }: Props = $props();

	let open = $state(defaultOpen);
	let toggleEl: HTMLButtonElement | undefined = $state();
	let bodyEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		const store = getPanelOpenStore(storageKey, defaultOpen);
		return store.subscribe((value) => {
			open = value;
		});
	});

	function toggle() {
		const next = !open;
		if (!next && bodyEl && document.activeElement && bodyEl.contains(document.activeElement)) {
			toggleEl?.focus();
		}
		getPanelOpenStore(storageKey, defaultOpen).setOpen(next);
	}
</script>

<div class="space-y-4">
	<button
		bind:this={toggleEl}
		type="button"
		class="w-full text-left flex items-center gap-2 text-primary font-['Orbitron'] font-semibold group/toggle"
		class:text-xl={titleLevel === 'h2'}
		class:text-sm={titleLevel === 'h3'}
		aria-expanded={open}
		aria-controls={bodyId}
		onclick={toggle}
	>
		<span
			class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse shrink-0"
			class:w-1.5={titleLevel === 'h3'}
			class:h-1.5={titleLevel === 'h3'}
		></span>
		{#if titleLevel === 'h3'}
			<span class="flex-1">{title}</span>
		{:else}
			<span class="flex-1 text-xl font-['Orbitron'] font-semibold">{title}</span>
		{/if}
		<span
			aria-hidden="true"
			class="inline-block transition-transform duration-200 motion-reduce:transition-none {open
				? 'rotate-180'
				: 'rotate-0'}">▾</span
		>
	</button>

	<div id={bodyId} bind:this={bodyEl} class="space-y-6" class:hidden={!open}>
		{@render children()}
	</div>
</div>
