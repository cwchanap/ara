<script lang="ts">
	type Props = {
		open?: boolean;
		mapType?: string;
		isAuthenticated?: boolean;
		currentPath?: string;
		onClose?: () => void;
		onSave?: (name: string) => Promise<void>;
		onShare?: () => Promise<void>;
	};

	let {
		open = $bindable(false),
		onClose,
		onSave,
		onShare,
		mapType = '',
		currentPath = '',
		isAuthenticated = false
	}: Props = $props();

	// Reference all props to ensure parent expressions are evaluated
	void open;
	void onClose;
	void onSave;
	void onShare;
	void mapType;
	void currentPath;
	void isAuthenticated;
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
