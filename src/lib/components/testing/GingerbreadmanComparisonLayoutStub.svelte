<script lang="ts">
	import type { Snippet } from 'svelte';

	type Params = {
		type?: string;
		x0?: number;
		y0?: number;
		iterations?: number;
		colorMode?: string;
		zoom?: number;
		pointSize?: number;
		opacity?: number;
		[key: string]: unknown;
	};

	type Props = {
		mapType?: string;
		leftParams?: Params;
		rightParams?: Params;
		showCameraSync?: boolean;
		leftPanel?: Snippet;
		rightPanel?: Snippet;
		children?: Snippet;
		onLeftParamsChange?: (params: Params) => void;
		onRightParamsChange?: (params: Params) => void;
	};

	let {
		leftParams,
		rightParams,
		leftPanel,
		rightPanel,
		children,
		onLeftParamsChange,
		onRightParamsChange
	}: Props = $props();

	function handleSwap() {
		// Replicate the real ComparisonLayout swap: snapshot both sides first
		// so the second handler call isn't fed a prop already mutated by the
		// first (Svelte 5 props recompute synchronously after state changes).
		const leftSnapshot = leftParams as Params;
		const rightSnapshot = rightParams as Params;
		onLeftParamsChange?.(rightSnapshot);
		onRightParamsChange?.(leftSnapshot);
	}

	function sendPartialLeft() {
		// Deliberately partial payload (no styling fields) to exercise the
		// missing-styling guards in handleLeftParamsChange.
		onLeftParamsChange?.({
			type: 'gingerbreadman',
			x0: 1.5,
			y0: -1.0,
			iterations: 30000
		});
	}
</script>

<div data-testid="comparison-layout-stub">
	{#if leftPanel}
		<div data-testid="left-panel">
			{@render leftPanel()}
		</div>
	{/if}
	{#if rightPanel}
		<div data-testid="right-panel">
			{@render rightPanel()}
		</div>
	{/if}
	{#if children}
		{@render children()}
	{/if}
	<button type="button" onclick={handleSwap}>Swap</button>
	<button type="button" onclick={sendPartialLeft} data-testid="send-partial-left">
		Send Partial Left Params
	</button>
</div>
