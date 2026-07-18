<!--
  GingerbreadmanRenderer — Canvas point cloud for the Gingerbreadman map.
  Single-orbit compute offloads to chaosMapsWorker with a main-thread fallback.
  Fidelity-aware: preview caps at ~25k points; full up to MAX_POINTS (250k).
  Style-only changes use a cached result with sampled immediate + debounced full paint.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { calculateGingerbreadmanTuples } from '$lib/gingerbreadman';
	import { drawSciFiAxes } from '$lib/viz/d3-chaos';
	import { COLOR_PRIMARY, COLOR_MAGENTA, COLOR_VIOLET } from '$lib/constants';
	import type { GingerbreadmanColorMode } from '$lib/types';
	import type { ChaosMapsWorkerResponse } from '$lib/workers/types';
	import type { Fidelity, RenderState } from '$lib/slider-drag-manager.svelte';

	interface Props {
		x0?: number;
		y0?: number;
		iterations?: number;
		colorMode?: GingerbreadmanColorMode;
		zoom?: number;
		pointSize?: number;
		opacity?: number;
		height?: number;
		containerElement?: HTMLDivElement;
		fidelity?: Fidelity;
		onRenderStateChange?: (state: RenderState) => void;
	}

	let {
		x0 = $bindable(-0.1),
		y0 = $bindable(0),
		iterations = $bindable(100000),
		colorMode = $bindable<GingerbreadmanColorMode>('iteration'),
		zoom = $bindable(1),
		pointSize = $bindable(1.5),
		opacity = $bindable(0.6),
		height = 500,
		containerElement = $bindable(),
		fidelity = 'full' as Fidelity,
		onRenderStateChange = () => {}
	}: Props = $props();

	let container = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		containerElement = container;
	});

	const MAX_POINTS = 250000;
	const PREVIEW_MAX_POINTS = 25000;
	const COMPUTE_DEBOUNCE_MS = 250;
	const STYLE_FULL_PAINT_MS = 150;

	type Computed = { points: [number, number][]; maxRadius: number };

	let computeTimeout: ReturnType<typeof setTimeout> | null = null;
	let styleFullPaintTimeout: ReturnType<typeof setTimeout> | null = null;
	let worker: Worker | null = null;
	let workerAvailable = false;
	let workerRequestId = 0;
	let latestWorkerRequestId = 0;
	let isComputing = false;
	let hasPendingCompute = false;
	let latest: Computed | null = null;
	let isUnmounted = false;

	// Track previous keys so we can branch recompute vs style-only repaint.
	let prevComputeKey: string | null = null;
	let prevStyleKey: string | null = null;

	const interpCyanMagenta = d3.interpolate(COLOR_PRIMARY, COLOR_MAGENTA);
	const interpMagentaViolet = d3.interpolate(COLOR_MAGENTA, COLOR_VIOLET);
	const densityRamp = d3.interpolateRgbBasis([
		'#000814',
		'#003a4d',
		COLOR_PRIMARY,
		COLOR_MAGENTA,
		'#ffffff'
	]);

	function reportState(state: RenderState) {
		onRenderStateChange(state);
	}

	function effectiveMaxPoints(): number {
		if (fidelity === 'preview') {
			return Math.min(Math.max(0, iterations), PREVIEW_MAX_POINTS);
		}
		return Math.min(Math.max(0, iterations), MAX_POINTS);
	}

	function colorFor(i: number, point: [number, number], total: number, maxRadius: number): string {
		switch (colorMode) {
			case 'single':
				return COLOR_PRIMARY;
			case 'radius': {
				const r = Math.hypot(point[0], point[1]);
				const t = maxRadius > 0 ? Math.min(1, r / maxRadius) : 0;
				return interpMagentaViolet(t);
			}
			case 'angle': {
				const t = (Math.atan2(point[1], point[0]) + Math.PI) / (2 * Math.PI);
				return d3.interpolateRainbow(t);
			}
			case 'iteration':
			default: {
				const t = total > 1 ? i / (total - 1) : 0;
				return interpCyanMagenta(t);
			}
		}
	}

	function computeMaxRadius(points: [number, number][]): number {
		let max = 0;
		for (const [px, py] of points) {
			const r = Math.hypot(px, py);
			if (r > max) max = r;
		}
		return max;
	}

	function buildComputed(points: [number, number][]): Computed {
		return { points, maxRadius: computeMaxRadius(points) };
	}

	/** Every Nth point so the sample is ~target size (or all points if smaller). */
	function samplePoints(points: [number, number][], target: number): [number, number][] {
		if (points.length <= target) return points;
		const step = Math.ceil(points.length / target);
		const out: [number, number][] = [];
		for (let i = 0; i < points.length; i += step) {
			out.push(points[i]);
		}
		return out;
	}

	/** Apply zoom by scaling a padded domain around its center. */
	function zoomedDomain(lo: number, hi: number): [number, number] {
		const center = (lo + hi) / 2;
		const half = (hi - lo) / 2 / Math.max(0.0001, zoom);
		return [center - half, center + half];
	}

	function render(computed: Computed) {
		if (!container) return;
		d3.select(container).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = container.clientWidth - margin.left - margin.right;
		const chartHeight = height - margin.top - margin.bottom;

		const canvasSelection = d3
			.select(container)
			.append('canvas')
			.attr('width', Math.max(0, width))
			.attr('height', Math.max(0, chartHeight))
			.style('position', 'absolute')
			.style('top', `${margin.top}px`)
			.style('left', `${margin.left}px`);

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const capped = computed.points.length > MAX_POINTS;
		const points = capped ? computed.points.slice(0, MAX_POINTS) : computed.points;
		// Empty data: the ?? fallbacks below yield a [-1, 1] domain — axes/frame
		// stay visible, the point-drawing block is a no-op. Only bail out on
		// invalid dimensions.
		if (width <= 0 || chartHeight <= 0) return;

		const xExtentRaw = d3.extent(points, (p) => p[0]);
		const yExtentRaw = d3.extent(points, (p) => p[1]);
		const xExtent: [number, number] = [xExtentRaw[0] ?? -1, xExtentRaw[1] ?? 1];
		const yExtent: [number, number] = [yExtentRaw[0] ?? -1, yExtentRaw[1] ?? 1];

		const xDomain = zoomedDomain(xExtent[0] - 0.5, xExtent[1] + 0.5);
		const yDomain = zoomedDomain(yExtent[0] - 0.5, yExtent[1] + 0.5);
		const xScale = d3.scaleLinear().domain(xDomain).range([0, width]);
		const yScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]);

		drawSciFiAxes(svg, xScale, yScale, { width, height: chartHeight });

		if (points.length === 0) return;

		const canvas = canvasSelection.node() as HTMLCanvasElement | null;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) {
			console.warn('GingerbreadmanRenderer: canvas or 2D context unavailable');
			return;
		}

		ctx.clearRect(0, 0, width, chartHeight);

		if (colorMode === 'density') {
			renderDensity(ctx, points, xScale, yScale, width, chartHeight);
			return;
		}

		const maxRadius = computed.maxRadius;
		ctx.globalAlpha = Math.min(1, Math.max(0, opacity));
		const r = Math.max(0.5, pointSize);
		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const cx = xScale(p[0]);
			const cy = yScale(p[1]);
			ctx.fillStyle = colorFor(i, p, points.length, maxRadius);
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	/** Accumulate per-pixel hit counts and map log(count) through a color ramp. */
	function renderDensity(
		ctx: CanvasRenderingContext2D,
		points: [number, number][],
		xScale: d3.ScaleLinear<number, number>,
		yScale: d3.ScaleLinear<number, number>,
		width: number,
		chartHeight: number
	) {
		const w = Math.max(1, Math.floor(width));
		const h = Math.max(1, Math.floor(chartHeight));
		const counts = new Uint32Array(w * h);
		let maxCount = 0;
		for (const p of points) {
			const sx = Math.floor(xScale(p[0]));
			const sy = Math.floor(yScale(p[1]));
			if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
			const idx = sy * w + sx;
			const cnt = ++counts[idx];
			if (cnt > maxCount) maxCount = cnt;
		}
		const img = ctx.createImageData(w, h);
		const denom = Math.log(1 + maxCount) || 1;
		// putImageData bypasses ctx.globalAlpha, so the configured opacity must
		// be baked into the alpha channel directly. Clamp to the valid 0–255 range.
		const alpha = Math.max(0, Math.min(255, Math.round(opacity * 255)));
		for (let i = 0; i < counts.length; i++) {
			const cnt = counts[i];
			if (cnt === 0) continue;
			const t = Math.log(1 + cnt) / denom;
			const rgb = d3.rgb(densityRamp(t));
			const o = i * 4;
			img.data[o] = rgb.r;
			img.data[o + 1] = rgb.g;
			img.data[o + 2] = rgb.b;
			img.data[o + 3] = alpha;
		}
		ctx.putImageData(img, 0, 0);
	}

	function paramsValid(): boolean {
		const values = [x0, y0, iterations, zoom, pointSize, opacity];
		return values.every(Number.isFinite) && iterations > 0;
	}

	function clearStyleFullPaint() {
		if (styleFullPaintTimeout !== null) {
			clearTimeout(styleFullPaintTimeout);
			styleFullPaintTimeout = null;
		}
	}

	function finishFullPaint(computed: Computed) {
		if (isUnmounted) return;
		render(computed);
		reportState('complete');
	}

	function computeMainThread(): Computed {
		const points = calculateGingerbreadmanTuples({
			x0,
			y0,
			iterations,
			maxPoints: effectiveMaxPoints()
		});
		return buildComputed(points);
	}

	function applyComputed(computed: Computed) {
		latest = computed;
		finishFullPaint(computed);
	}

	function requestPoints() {
		clearStyleFullPaint();
		reportState('rendering');

		if (!paramsValid()) {
			console.warn('GingerbreadmanRenderer: invalid parameters, skipping render');
			latest = buildComputed([]);
			isComputing = false;
			finishFullPaint(latest);
			return;
		}

		if (worker && workerAvailable) {
			const id = ++workerRequestId;
			latestWorkerRequestId = id;
			isComputing = true;
			worker.postMessage({
				type: 'gingerbreadman',
				id,
				x0,
				y0,
				iterations,
				maxPoints: effectiveMaxPoints()
			});
			return;
		}

		isComputing = true;
		const computed = computeMainThread();
		isComputing = false;
		applyComputed(computed);
		if (hasPendingCompute) {
			hasPendingCompute = false;
			scheduleCompute();
		}
	}

	function scheduleCompute() {
		if (!container) return;
		if (isComputing) {
			hasPendingCompute = true;
			return;
		}
		if (computeTimeout !== null) clearTimeout(computeTimeout);
		// Signal rendering immediately so the shell keeps Snapshot/Share/Save
		// gated during the debounce window. Without this, a preview slider
		// release flips fidelity back to 'full' (unfreezing the action
		// buttons) while the canvas still shows the reduced preview orbit —
		// the 'rendering' state is not reported until requestPoints() runs
		// after the 250ms timer, leaving a window where the stale canvas can
		// be snapshotted/saved/shared.
		reportState('rendering');
		computeTimeout = setTimeout(() => {
			computeTimeout = null;
			requestPoints();
		}, COMPUTE_DEBOUNCE_MS);
	}

	/**
	 * Style-only path: immediate sampled paint from cache, then debounced full
	 * repaint. Does not re-dispatch compute.
	 */
	function isComputePending(): boolean {
		return isComputing || computeTimeout !== null || hasPendingCompute;
	}

	function paintStyleOnly() {
		if (!container || !latest) return;
		clearStyleFullPaint();
		reportState('rendering');
		const sampled = samplePoints(latest.points, PREVIEW_MAX_POINTS);
		render({ points: sampled, maxRadius: latest.maxRadius });
		styleFullPaintTimeout = setTimeout(() => {
			styleFullPaintTimeout = null;
			if (isUnmounted || !latest) return;
			// Repaint the cached orbit with the new style, but do NOT flip
			// state to 'complete' if a compute is debounced or in flight —
			// otherwise the shell would ungate Snapshot/Share/Save and let
			// the stale cached orbit be captured before the new x0/y0/
			// iterations result arrives. The pending compute reports
			// 'complete' itself when its result lands.
			render(latest);
			if (!isComputePending()) {
				reportState('complete');
			}
		}, STYLE_FULL_PAINT_MS);
	}

	function computeKey(): string {
		return `${x0}|${y0}|${iterations}|${fidelity}`;
	}

	function styleKey(): string {
		return `${colorMode}|${zoom}|${pointSize}|${opacity}|${height}`;
	}

	let resizeObserver: ResizeObserver | null = null;

	onMount(() => {
		// Guard with typeof Worker === 'function' so stubbed-undefined Worker
		// in tests (and non-browser environments) skip construction cleanly.
		if (typeof window !== 'undefined' && typeof Worker === 'function') {
			try {
				worker = new Worker(new URL('../../workers/chaosMapsWorker.ts', import.meta.url), {
					type: 'module'
				});
				workerAvailable = true;
				worker.onmessage = (event: MessageEvent<ChaosMapsWorkerResponse>) => {
					const data = event.data;
					if (isUnmounted || !data) return;

					if (data.type === 'error') {
						console.error('Gingerbreadman worker error response:', data.message);
						isComputing = false;
						workerAvailable = false;
						worker?.terminate();
						worker = null;
						if (container && !isUnmounted) {
							applyComputed(computeMainThread());
							if (hasPendingCompute) {
								hasPendingCompute = false;
								scheduleCompute();
							}
						}
						return;
					}

					if (data.type !== 'gingerbreadmanResult') return;
					if (data.id !== latestWorkerRequestId) return;
					isComputing = false;
					applyComputed(buildComputed(data.points));
					if (hasPendingCompute) {
						hasPendingCompute = false;
						scheduleCompute();
					}
				};
				worker.onerror = (event: ErrorEvent) => {
					console.error('Gingerbreadman worker error:', event.message);
					isComputing = false;
					workerAvailable = false;
					worker?.terminate();
					worker = null;
					if (container && !isUnmounted) {
						applyComputed(computeMainThread());
						if (hasPendingCompute) {
							hasPendingCompute = false;
							scheduleCompute();
						}
					}
				};
			} catch (error) {
				console.error('Failed to initialize gingerbreadman web worker:', error);
				worker = null;
				workerAvailable = false;
			}
		}

		// Seed prev keys and kick the first compute.
		prevComputeKey = computeKey();
		prevStyleKey = styleKey();
		scheduleCompute();

		// Re-render (no recompute) when the container resizes so the canvas
		// reflows to the new clientWidth. Guarded for jsdom, which lacks
		// ResizeObserver.
		if (typeof ResizeObserver !== 'undefined' && container) {
			resizeObserver = new ResizeObserver(() => {
				if (container && latest) {
					reportState('rendering');
					finishFullPaint(latest);
				}
			});
			resizeObserver.observe(container);
		}

		return () => {
			isUnmounted = true;
			if (resizeObserver) {
				resizeObserver.disconnect();
				resizeObserver = null;
			}
			if (worker) {
				worker.terminate();
				worker = null;
			}
			if (computeTimeout !== null) {
				clearTimeout(computeTimeout);
				computeTimeout = null;
			}
			clearStyleFullPaint();
		};
	});

	// Diff compute vs style keys; recompute or sampled style-repaint accordingly.
	// Fidelity is part of the compute key so preview→full re-budgets work.
	$effect(() => {
		void x0;
		void y0;
		void iterations;
		void fidelity;
		void colorMode;
		void zoom;
		void pointSize;
		void opacity;
		void height;

		const nextCompute = computeKey();
		const nextStyle = styleKey();

		// First run after mount: onMount already scheduled; just sync keys if
		// onMount hasn't run yet (effect can fire first).
		if (prevComputeKey === null || prevStyleKey === null) {
			prevComputeKey = nextCompute;
			prevStyleKey = nextStyle;
			scheduleCompute();
			return;
		}

		const computeChanged = nextCompute !== prevComputeKey;
		const styleChanged = nextStyle !== prevStyleKey;

		if (computeChanged) {
			prevComputeKey = nextCompute;
			prevStyleKey = nextStyle;
			scheduleCompute();
			return;
		}

		if (styleChanged) {
			prevStyleKey = nextStyle;
			if (latest) {
				paintStyleOnly();
			}
		}
	});
</script>

<div class="relative">
	<div
		bind:this={container}
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
		style="height: {height}px;"
	></div>
	<div
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // CANVAS
	</div>
</div>
