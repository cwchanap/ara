<script lang="ts">
	// Mirrors the real SnapshotButton prop surface and references every prop
	// (via `void`) so Svelte evaluates the parent's attribute expressions —
	// including the shell's `disabled={...}` binding — for coverage. Without
	// referencing the props, Svelte 5 skips evaluating expressions for props
	// the child doesn't declare, leaving the shell's disabled expression
	// uncovered.
	type TargetType = 'canvas' | 'container';

	type Props = {
		target: HTMLCanvasElement | HTMLElement | undefined;
		targetType?: TargetType;
		mapType: string;
		disabled?: boolean;
	};

	let { target, targetType = 'container', mapType = '', disabled = false }: Props = $props();

	// Reference all props so parent expressions are evaluated.
	void target;
	void targetType;
	void mapType;
	void disabled;
</script>

<button data-testid="snapshot-stub" {disabled}>Snapshot</button>
