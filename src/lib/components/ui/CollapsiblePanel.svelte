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
		/** Type-scale classes for the title. Defaults to text-xl for h2, text-sm for h3. */
		titleClass?: string;
		children: Snippet;
	}

	let {
		title,
		storageKey,
		defaultOpen,
		bodyId,
		titleLevel = 'h2',
		titleClass,
		children
	}: Props = $props();

	let open = $state(defaultOpen);
	let toggleEl: HTMLButtonElement | undefined = $state();
	let bodyEl: HTMLDivElement | undefined = $state();

	const resolvedTitleClass = $derived(titleClass ?? (titleLevel === 'h3' ? 'text-sm' : 'text-xl'));
	const dotClass = $derived(resolvedTitleClass.includes('text-sm') ? 'w-1.5 h-1.5' : 'w-2 h-2');

	$effect(() => {
		const store = getPanelOpenStore(storageKey, defaultOpen);
		return store.subscribe((value) => {
			// Collapsing can be driven by another panel sharing this storage key, so
			// rescue focus here rather than only in the local toggle handler.
			if (!value) reclaimFocusFromBody();
			open = value;
		});
	});

	function reclaimFocusFromBody() {
		if (bodyEl && document.activeElement && bodyEl.contains(document.activeElement)) {
			toggleEl?.focus();
		}
	}

	function toggle() {
		getPanelOpenStore(storageKey, defaultOpen).setOpen(!open);
	}
</script>

<div class="space-y-4">
	<svelte:element this={titleLevel}>
		<button
			bind:this={toggleEl}
			type="button"
			class="w-full text-left flex items-center gap-2 text-primary font-['Orbitron'] font-semibold group/toggle {resolvedTitleClass}"
			aria-expanded={open}
			aria-controls={bodyId}
			onclick={toggle}
		>
			<span class="inline-block bg-primary rounded-full animate-pulse shrink-0 {dotClass}"></span>
			<span class="flex-1">{title}</span>
			<span
				aria-hidden="true"
				class="inline-block transition-transform duration-200 motion-reduce:transition-none {open
					? 'rotate-180'
					: 'rotate-0'}">▾</span
			>
		</button>
	</svelte:element>

	<div id={bodyId} bind:this={bodyEl} class="space-y-6" class:hidden={!open}>
		{@render children()}
	</div>
</div>
