<!--
  Gingerbreadman-specific renderer stub for page interaction tests.
  Exposes IC / iterations / fidelity as data attributes so draft-vs-committed
  (preview fidelity → draft values, full → committed) is observable without
  running the real canvas/worker path.
-->
<script lang="ts">
	type Props = {
		x0?: number;
		y0?: number;
		iterations?: number;
		colorMode?: string;
		zoom?: number;
		pointSize?: number;
		opacity?: number;
		fidelity?: string;
		onRenderStateChange?: (s: string) => void;
		containerElement?: HTMLElement | undefined;
		height?: number;
	};

	let {
		x0 = 0,
		y0 = 0,
		iterations = 0,
		colorMode = '',
		zoom = 1,
		pointSize = 1,
		opacity = 1,
		fidelity = 'full',
		onRenderStateChange,
		containerElement = $bindable(),
		height = 0
	}: Props = $props();

	// Keep parent expressions evaluated so bindable / callback props are live.
	void onRenderStateChange;
	void containerElement;
	void height;
	void colorMode;
	void zoom;
	void pointSize;
	void opacity;
</script>

<div
	data-testid="gingerbreadman-renderer-stub"
	data-x0={x0}
	data-y0={y0}
	data-iterations={iterations}
	data-fidelity={fidelity}
	data-color-mode={colorMode}
></div>
