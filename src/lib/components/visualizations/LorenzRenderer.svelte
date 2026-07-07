<!--
  LorenzRenderer Component

  Three.js renderer for the Lorenz attractor. Precomputes the trajectory on
  math-affecting changes (Approach A) and animates a `head` index across it.
  Supports comet, cumulative, and stationary trails, color modes, a ghost (perturbed) orbit,
  perspective 3D + orthographic XY/XZ/YZ projections, playback (play/pause/step/
  reset/speed), and comparison mode with camera sync.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { Line2 } from 'three/examples/jsm/lines/Line2.js';
	import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import { cameraSyncStore, createCameraState, applyCameraState } from '$lib/stores/camera-sync';
	import { COMET_WINDOW } from '$lib/constants';
	import { integrate, type LorenzResult } from '$lib/lorenz/integrators';
	import { computeColors } from '$lib/lorenz/colors';
	import { withLorenzDefaults } from '$lib/lorenz/defaults';
	import type { LorenzParameters } from '$lib/types';

	interface Props {
		params: LorenzParameters;
		height?: number;
		compareMode?: boolean;
		compareSide?: 'left' | 'right';
		containerElement?: HTMLDivElement;
		// Runtime playback (main page only).
		isPlaying?: boolean;
		stepNonce?: number;
		resetNonce?: number;
		// Outputs.
		head?: number;
		diverged?: boolean;
	}

	let {
		params,
		height = 600,
		compareMode = false,
		compareSide = 'left',
		containerElement = $bindable(),
		isPlaying = true,
		stepNonce = 0,
		resetNonce = 0,
		head = $bindable(0),
		diverged = $bindable(false)
	}: Props = $props();

	let container = $state<HTMLDivElement>();
	$effect(() => {
		containerElement = container;
	});

	const resolved = $derived(withLorenzDefaults(params));

	let isAnimating = true;
	let animationFrameId: number | null = null;
	let rebuild: (() => void) | null = null;
	let applyCameraPosition: (() => void) | null = null;
	let applyOrbitSettings: (() => void) | null = null;
	let applyColors: (() => void) | null = null;

	let controls = $state<OrbitControls | null>(null);
	let perspectiveCamera = $state<THREE.PerspectiveCamera | null>(null);

	// Recompute geometry when math-affecting params change.
	$effect(() => {
		void resolved.sigma;
		void resolved.rho;
		void resolved.beta;
		void resolved.x0;
		void resolved.y0;
		void resolved.z0;
		void resolved.epsilon;
		void resolved.showGhost;
		void resolved.solver;
		void resolved.dt;
		void resolved.trailLength;
		rebuild?.();
		untrack(() => {
			applyCameraPosition?.();
			applyOrbitSettings?.();
		});
	});

	// Recompute colors only (cheap) when colorMode changes.
	$effect(() => {
		void resolved.colorMode;
		applyColors?.();
	});

	// Reapply camera position when view mode or zoom change (resets orbit).
	$effect(() => {
		void resolved.viewMode;
		void resolved.zoom;
		applyCameraPosition?.();
	});

	// Update orbit settings without resetting camera position.
	$effect(() => {
		void resolved.autoRotate;
		void resolved.rotationSpeed;
		applyOrbitSettings?.();
	});

	// Reset playback head on resetNonce change. Guard against stationary mode,
	// where head must stay at trailLength (full attractor visible). Currently
	// unreachable because Reset is disabled in stationary mode, but future-proofs
	// against other callers of resetNonce. untrack avoids registering a reactive
	// dependency on trailStyle, which would re-run this effect on every style
	// change and clobber head.
	$effect(() => {
		void resetNonce;
		if (untrack(() => resolved.trailStyle) === 'stationary') return;
		head = 0;
	});

	// Single-step on stepNonce change.
	let lastStepNonce = stepNonce;
	$effect(() => {
		if (stepNonce !== lastStepNonce) {
			lastStepNonce = stepNonce;
			advanceHead(true);
		}
	});

	// Snap head on trail-style transitions: entering Stationary jumps to the
	// full shape; leaving Stationary resets to 0 so the animated style replays.
	// Reads resolved.trailLength only inside the entry branch, so no reactive
	// dependency on trailLength is registered on a no-transition run.
	let lastTrailStyle = untrack(() => resolved.trailStyle);
	$effect(() => {
		const style = resolved.trailStyle;
		if (style === lastTrailStyle) return;
		if (style === 'stationary') head = resolved.trailLength;
		else if (lastTrailStyle === 'stationary') head = 0;
		lastTrailStyle = style;
	});

	function advanceHead(forceOneFrame = false): void {
		if (resolved.trailStyle === 'stationary') return;
		const total = resolved.trailLength;
		const perFrame = Math.max(1, Math.round(resolved.stepsPerFrame * resolved.speed));
		if (forceOneFrame || isPlaying) {
			head = Math.min(total, head + perFrame);
		}
	}

	// Camera sync (perspective / 3D only).
	$effect(() => {
		if (!compareMode) return;
		const c = controls;
		const cam = perspectiveCamera;
		if (!c || !cam) return;
		const side = compareSide;
		const unsubscribe = cameraSyncStore.subscribe((state) => {
			if (!state.enabled || state.lastUpdate === side) return;
			const other = side === 'left' ? state.right : state.left;
			if (other) applyCameraState(other, cam, c);
		});
		return unsubscribe;
	});

	onMount(() => {
		if (!container) return;
		const el = container;

		const scene = new THREE.Scene();
		scene.background = null;

		const persp = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 1000);
		persp.position.set(40, 40, 40);
		perspectiveCamera = persp;

		const aspect = el.clientWidth / el.clientHeight;
		const halfH = 40;
		const halfW = halfH * aspect;
		const ortho = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 2000);
		let activeCamera: THREE.Camera = persp;

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(el.clientWidth, el.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		el.appendChild(renderer.domElement);

		const orbit = new OrbitControls(persp, renderer.domElement);
		orbit.enableDamping = true;
		orbit.autoRotate = !compareMode && resolved.autoRotate;
		orbit.autoRotateSpeed = resolved.rotationSpeed;
		controls = orbit;

		let cameraChangeHandler: (() => void) | null = null;
		if (compareMode) {
			cameraChangeHandler = () => {
				cameraSyncStore.updateFromSide(compareSide, createCameraState(persp, orbit));
			};
			orbit.addEventListener('change', cameraChangeHandler);
		}

		const gridHelper = new THREE.GridHelper(100, 20, 0x00f3ff, 0x2d1b69);
		gridHelper.position.y = -30;
		(gridHelper.material as THREE.Material).transparent = true;
		(gridHelper.material as THREE.Material).opacity = 0.2;
		scene.add(gridHelper);

		// Trajectory state.
		let main: LorenzResult | null = null;
		let ghost: LorenzResult | null = null;
		let mainColors: Float32Array = new Float32Array(0);
		let ghostColors: Float32Array = new Float32Array(0);

		function safeComputeLineDistances(line: Line2) {
			if ((line.geometry as THREE.InstancedBufferGeometry).instanceCount == null) return;
			line.computeLineDistances();
		}

		function makeLine(): Line2 {
			const geometry = new LineGeometry();
			const material = new LineMaterial({
				vertexColors: true,
				linewidth: 2,
				blending: THREE.AdditiveBlending,
				transparent: true,
				opacity: 0.8
			});
			material.resolution.set(el.clientWidth, el.clientHeight);
			return new Line2(geometry, material);
		}

		const mainLine = makeLine();
		const ghostLine = makeLine();
		scene.add(mainLine);
		scene.add(ghostLine);

		function disposeLineGeometry(line: Line2) {
			line.geometry.dispose();
		}

		rebuild = () => {
			const r = resolved;
			main = integrate({
				sigma: r.sigma,
				rho: r.rho,
				beta: r.beta,
				x0: r.x0,
				y0: r.y0,
				z0: r.z0,
				solver: r.solver,
				dt: r.dt,
				steps: r.trailLength
			});
			ghost = r.showGhost
				? integrate({
						sigma: r.sigma,
						rho: r.rho,
						beta: r.beta,
						x0: r.x0 + r.epsilon,
						y0: r.y0,
						z0: r.z0,
						solver: r.solver,
						dt: r.dt,
						steps: r.trailLength
					})
				: null;
			diverged = main.diverged || (ghost?.diverged ?? false);
			ghostLine.visible = !!ghost;
			// In compare mode or stationary trail style, show the full static attractor.
			// Re-snapping here also covers trailLength changes while stationary (the
			// plain clamp only handled the shrinking case).
			if (compareMode || r.trailStyle === 'stationary') head = r.trailLength;
			else if (head > r.trailLength) head = r.trailLength;
			// Invalidate cached slice so updateDraw() pushes new trajectory data.
			lastFrom = -1;
			lastTo = -1;
			applyColors?.();
		};

		applyColors = () => {
			if (!main) return;
			mainColors = computeColors(main, resolved.colorMode, { ghost: ghost ?? undefined });
			// Cache ghost colors too: like the main trajectory they only change on
			// rebuild or color-mode change, so recomputing them per frame (especially
			// the O(n) divergence mode) is wasteful.
			ghostColors = ghost
				? computeColors(ghost, resolved.colorMode, { ghost: main })
				: new Float32Array(0);
			// Invalidate the cached slice indices so the next updateDraw() call
			// pushes the new colors/geometry to the line objects.
			lastFrom = -1;
			lastTo = -1;
		};

		function setLineSlice(
			line: Line2,
			result: LorenzResult,
			colors: Float32Array,
			from: number,
			to: number
		) {
			const count = Math.max(0, to - from);
			if (count < 2) {
				line.visible = false;
				return;
			}
			line.visible = true;
			const pos = result.positions.subarray(from * 3, to * 3);
			const col = colors.subarray(from * 3, to * 3);
			line.geometry.setPositions(pos);
			line.geometry.setColors(col);
			safeComputeLineDistances(line);
		}

		let lastFrom = -1;
		let lastTo = -1;

		function updateDraw() {
			if (!main) return;
			const total = resolved.trailLength;
			const h = Math.min(head, total);
			let from: number;
			if (compareMode) {
				// Compare mode always shows the full static attractor.
				from = 0;
			} else if (resolved.trailStyle === 'comet') {
				from = Math.max(0, h - COMET_WINDOW);
			} else {
				from = 0;
			}
			if (from === lastFrom && h === lastTo) return;
			lastFrom = from;
			lastTo = h;
			setLineSlice(mainLine, main, mainColors, from, h);
			if (ghost) setLineSlice(ghostLine, ghost, ghostColors, from, h);
		}

		applyCameraPosition = () => {
			const r = resolved;
			if (r.viewMode === '3d') {
				activeCamera = persp;
				orbit.enabled = true;
				persp.position.set(40 / r.zoom, 40 / r.zoom, 40 / r.zoom);
			} else {
				activeCamera = ortho;
				orbit.enabled = false;
				orbit.autoRotate = false;
				const d = 80;
				ortho.zoom = r.zoom;
				if (r.viewMode === 'xy') ortho.position.set(0, 0, d);
				else if (r.viewMode === 'xz') ortho.position.set(0, d, 0);
				else ortho.position.set(d, 0, 0); // yz
				ortho.lookAt(0, 0, 0);
				ortho.updateProjectionMatrix();
			}
		};

		applyOrbitSettings = () => {
			const r = resolved;
			if (r.viewMode === '3d') {
				orbit.autoRotate = !compareMode && r.autoRotate;
				orbit.autoRotateSpeed = r.rotationSpeed;
			} else {
				orbit.autoRotate = false;
			}
		};

		rebuild();
		applyCameraPosition();
		applyOrbitSettings();

		function animate() {
			if (!isAnimating) return;
			animationFrameId = requestAnimationFrame(animate);
			if (!compareMode) advanceHead(false);
			updateDraw();
			if (controls && activeCamera === persp) controls.update();
			renderer.render(scene, activeCamera);
		}
		animate();

		const handleResize = () => {
			if (!container) return;
			const w = container.clientWidth;
			const h = container.clientHeight;
			persp.aspect = w / h;
			persp.updateProjectionMatrix();
			const halfH = 40;
			const halfW = halfH * (w / h);
			ortho.left = -halfW;
			ortho.right = halfW;
			ortho.top = halfH;
			ortho.bottom = -halfH;
			ortho.updateProjectionMatrix();
			renderer.setSize(w, h);
			(mainLine.material as LineMaterial).resolution.set(w, h);
			(ghostLine.material as LineMaterial).resolution.set(w, h);
		};
		window.addEventListener('resize', handleResize);
		const resizeObserver = new ResizeObserver(() => handleResize());
		resizeObserver.observe(el);
		handleResize();

		return () => {
			window.removeEventListener('resize', handleResize);
			resizeObserver.disconnect();
			isAnimating = false;
			if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
			if (cameraChangeHandler) orbit.removeEventListener('change', cameraChangeHandler);
			orbit.dispose();
			scene.remove(gridHelper);
			gridHelper.geometry.dispose();
			(gridHelper.material as THREE.Material).dispose();
			scene.remove(mainLine);
			scene.remove(ghostLine);
			disposeLineGeometry(mainLine);
			disposeLineGeometry(ghostLine);
			(mainLine.material as LineMaterial).dispose();
			(ghostLine.material as LineMaterial).dispose();
			renderer.dispose();
			if (renderer.domElement.parentNode === el) {
				el.removeChild(renderer.domElement);
			}
		};
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
	style="height: {height}px;"
>
	<div
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // THREE_JS
	</div>
</div>
