<script lang="ts">
	import * as d3 from 'd3';
	import { D3_CHART_MARGIN, VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { makeLinearScales, drawSciFiAxes, plotGradientPoints } from '$lib/viz/d3-chaos';

	interface Props {
		points: [number, number][];
		height?: number;
		containerElement?: HTMLDivElement;
		axisLabels?: { x: string; y: string };
		r?: number;
		opacity?: number;
		glow?: boolean;
		chrome?: 'plain' | 'decorated';
	}
	let {
		points,
		height = VIZ_CONTAINER_HEIGHT,
		containerElement = $bindable(),
		axisLabels,
		r,
		opacity,
		glow = false,
		chrome = 'plain'
	}: Props = $props();

	let container = $state<HTMLDivElement>();
	let resizeObserver: ResizeObserver | null = null;
	$effect(() => {
		containerElement = container;
	});

	function render() {
		if (!container) return;
		const m = D3_CHART_MARGIN;
		const width = Math.max(0, container.clientWidth - m.left - m.right);
		const chartHeight = Math.max(0, height - m.top - m.bottom);
		// Clear any existing SVG before bailing out on zero size, so a collapsed
		// mount never leaves stale content.
		d3.select(container).selectAll('svg').remove();
		if (width === 0 || chartHeight === 0) {
			// Set up a ResizeObserver so render() reruns once the container
			// becomes non-zero (e.g. after a collapsed mount in jsdom or a
			// hidden-to-visible transition).
			if (!resizeObserver) {
				resizeObserver = new ResizeObserver(() => {
					if (!container) return;
					if (container.clientWidth > 0) {
						resizeObserver?.disconnect();
						resizeObserver = null;
						render();
					}
				});
				resizeObserver.observe(container);
			}
			return;
		}
		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${m.left},${m.top})`);
		const { xScale, yScale } = makeLinearScales(points, { width, height: chartHeight });
		drawSciFiAxes(svg, xScale, yScale, { width, height: chartHeight, labels: axisLabels });
		if (points.length > 0) {
			plotGradientPoints(svg, points, { xScale, yScale, r, opacity, glow });
		}
	}

	$effect(() => {
		void points;
		void height;
		if (container) render();
		return () => {
			if (resizeObserver) {
				resizeObserver.disconnect();
				resizeObserver = null;
			}
		};
	});
</script>

{#if chrome === 'decorated'}
	<div
		bind:this={container}
		class="bg-black/40 border border-primary/30 rounded-sm overflow-hidden relative backdrop-blur-md ring-1 ring-primary/30 shadow-[0_0_25px_rgba(0,243,255,0.25),0_0_45px_rgba(255,0,255,0.15)]"
		style="height: {height}px;"
	>
		<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
		<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
		<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>
		<div
			class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/80 border border-primary/40 bg-black/60 backdrop-blur-sm px-2 py-1 pointer-events-none select-none shadow-[0_0_12px_rgba(0,243,255,0.35)]"
		>
			LIVE_RENDER // D3_JS
		</div>
	</div>
{:else}
	<div
		bind:this={container}
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
		style="height: {height}px;"
	>
		<div
			class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
		>
			LIVE_RENDER // D3_JS
		</div>
	</div>
{/if}
