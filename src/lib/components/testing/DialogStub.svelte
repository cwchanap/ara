<script lang="ts">
	type Props = {
		open?: boolean;
		mapType?: string;
		isAuthenticated?: boolean;
		currentPath?: string;
		onClose?: () => void;
		onSave?: (name: string) => void;
		onShare?: () => void;
		name?: string;
	};

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let {
		open = false,
		onClose,
		onSave,
		onShare,
		mapType = '',
		currentPath = '',
		isAuthenticated = false
	}: Props = $props();
</script>

{#if open}
	<div data-testid="dialog-stub-{mapType}">
		{#if onClose}
			<button onclick={onClose} data-testid="dialog-close-{mapType}">Close</button>
		{/if}
		{#if onSave}
			<button onclick={() => onSave!('Test Config')} data-testid="dialog-save-{mapType}"
				>Save</button
			>
		{/if}
		{#if onShare}
			<button onclick={onShare} data-testid="dialog-share-{mapType}">Share</button>
		{/if}
	</div>
{/if}
