<!--
  ChuaRenderer Component

  Three.js renderer for the Chua circuit. A single canvas toggles between a
  perspective 3D view (auto-rotate) and orthographic 2D projections (XY/XZ/YZ)
  plus a Poincaré section. Supports comparison mode with camera sync.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import {
		calculateChua,
		computePoincareSection,
		type ChuaPoint,
		type PoincarePlane
	} from '$lib/chua';
	import { cameraSyncStore, createCameraState, applyCameraState } from '$lib/stores/camera-sync';
	import { AUTO_ROTATE_SPEED } from '$lib/constants';

	type ViewMode = '3d' | 'xy' | 'xz' | 'yz' | 'poincare';
	type ColorMode = 'time' | 'velocity' | 'z-height';

	interface Props {
		alpha?: number;
		beta?: number;
		gamma?: number;
		a?: number;
		b?: number;
		dt?: number;
		trailLength?: number;
		viewMode?: ViewMode;
		colorMode?: ColorMode;
		transientRemoval?: boolean;
		poincarePlane?: PoincarePlane;
		height?: number;
		compareMode?: boolean;
		compareSide?: 'left' | 'right';
		containerElement?: HTMLDivElement;
	}

	let {
		alpha = $bindable(15.6),
		beta = $bindable(28),
		gamma = $bindable(0),
		a = $bindable(-8 / 7),
		b = $bindable(-5 / 7),
		dt = 0.005,
		trailLength = 30000,
		viewMode = '3d',
		colorMode = 'time',
		transientRemoval = false,
		poincarePlane = 'y=0',
		height = 600,
		compareMode = false,
		compareSide = 'left',
		containerElement = $bindable()
	}: Props = $props();

	let container = $state<HTMLDivElement>();
	$effect(() => {
		containerElement = container;
	});

	let isAnimating = true;
	let animationFrameId: number | null = null;
	let rebuild: (() => void) | null = null;
	let applyView: (() => void) | null = null;
	let controls = $state<OrbitControls | null>(null);
	let perspectiveCamera = $state<THREE.PerspectiveCamera | null>(null);

	// Recompute geometry when math params / integration / color / transient change.
	$effect(() => {
		void alpha;
		void beta;
		void gamma;
		void a;
		void b;
		void dt;
		void trailLength;
		void colorMode;
		void transientRemoval;
		void poincarePlane;
		rebuild?.();
		// Reframe the camera for the new geometry without tracking viewMode here —
		// view-mode switches are handled by the dedicated effect below, so we must
		// not let them trigger a full trajectory rebuild.
		untrack(() => applyView?.());
	});

	// Reapply camera/visibility when the view mode changes.
	$effect(() => {
		void viewMode;
		applyView?.();
	});

	// Camera sync (perspective / 3D only).
	$effect(() => {
		if (!compareMode) return;
		const c = controls;
		const cam = perspectiveCamera;
		if (!c || !cam) return;
		const unsubscribe = cameraSyncStore.subscribe((state) => {
			if (!state.enabled || state.lastUpdate === compareSide) return;
			const other = compareSide === 'left' ? state.right : state.left;
			if (other) applyCameraState(other, cam, c);
		});
		return unsubscribe;
	});

	onMount(() => {
		if (!container) return;
		const el = container;

		const scene = new THREE.Scene();
		scene.background = null;

		const persp = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 2000);
		persp.position.set(18, 18, 18);
		perspectiveCamera = persp;

		const ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 2000);

		let activeCamera: THREE.Camera = persp;

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(el.clientWidth, el.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);

		el.appendChild(renderer.domElement);

		const orbit = new OrbitControls(persp, renderer.domElement);
		orbit.enableDamping = true;
		orbit.autoRotate = !compareMode;
		orbit.autoRotateSpeed = AUTO_ROTATE_SPEED;
		controls = orbit;

		let cameraChangeHandler: (() => void) | null = null;
		if (compareMode) {
			cameraChangeHandler = () => {
				cameraSyncStore.updateFromSide(compareSide, createCameraState(persp, orbit));
			};
			orbit.addEventListener('change', cameraChangeHandler);
		}

		const CYAN = new THREE.Color(0x00f3ff);
		const MAGENTA = new THREE.Color(0xff00ff);

		function colorArrayFor(pts: ChuaPoint[], mode: ColorMode): Float32Array {
			const colors = new Float32Array(pts.length * 3);
			const tmp = new THREE.Color();
			const writes = (i: number, t: number) => {
				tmp.copy(CYAN).lerp(MAGENTA, Math.max(0, Math.min(1, t)));
				colors[i * 3] = tmp.r;
				colors[i * 3 + 1] = tmp.g;
				colors[i * 3 + 2] = tmp.b;
			};
			if (mode === 'time') {
				for (let i = 0; i < pts.length; i++) writes(i, pts.length > 1 ? i / (pts.length - 1) : 0);
			} else if (mode === 'z-height') {
				let min = Infinity;
				let max = -Infinity;
				for (const p of pts) {
					if (p.z < min) min = p.z;
					if (p.z > max) max = p.z;
				}
				const range = max - min || 1;
				for (let i = 0; i < pts.length; i++) writes(i, (pts[i].z - min) / range);
			} else {
				const speeds = new Float32Array(pts.length);
				let min = Infinity;
				let max = -Infinity;
				for (let i = 0; i < pts.length; i++) {
					const prev = i > 0 ? pts[i - 1] : pts[i];
					const dx = pts[i].x - prev.x;
					const dy = pts[i].y - prev.y;
					const dz = pts[i].z - prev.z;
					const s = Math.sqrt(dx * dx + dy * dy + dz * dz);
					speeds[i] = s;
					if (s < min) min = s;
					if (s > max) max = s;
				}
				const range = max - min || 1;
				for (let i = 0; i < pts.length; i++) writes(i, (speeds[i] - min) / range);
			}
			return colors;
		}

		const lineMaterial = new THREE.LineBasicMaterial({
			vertexColors: true,
			transparent: true,
			opacity: 0.85,
			blending: THREE.AdditiveBlending
		});
		const pointsMaterial = new THREE.PointsMaterial({
			color: 0x00f3ff,
			size: 3,
			sizeAttenuation: false
		});

		let trajectory: ChuaPoint[] = [];
		let line: THREE.Line | null = null;
		let points: THREE.Points | null = null;

		function disposeObjects() {
			if (line) {
				scene.remove(line);
				line.geometry.dispose();
				line = null;
			}
			if (points) {
				scene.remove(points);
				points.geometry.dispose();
				points = null;
			}
		}

		rebuild = () => {
			disposeObjects();

			const raw = calculateChua({
				x0: 0.1,
				y0: 0,
				z0: 0,
				steps: trailLength,
				dt,
				alpha,
				beta,
				gamma,
				a,
				b
			});
			const cut = transientRemoval ? Math.floor(raw.length * 0.05) : 0;
			trajectory = raw.slice(cut);

			const positions = new Float32Array(trajectory.length * 3);
			for (let i = 0; i < trajectory.length; i++) {
				positions[i * 3] = trajectory[i].x;
				positions[i * 3 + 1] = trajectory[i].y;
				positions[i * 3 + 2] = trajectory[i].z;
			}
			const lineGeo = new THREE.BufferGeometry();
			lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
			lineGeo.setAttribute(
				'color',
				new THREE.BufferAttribute(colorArrayFor(trajectory, colorMode), 3)
			);
			line = new THREE.Line(lineGeo, lineMaterial);
			scene.add(line);

			const section = computePoincareSection(trajectory, poincarePlane);
			const pPos = new Float32Array(section.length * 3);
			for (let i = 0; i < section.length; i++) {
				pPos[i * 3] = section[i].u;
				pPos[i * 3 + 1] = section[i].v;
				pPos[i * 3 + 2] = 0;
			}
			const pGeo = new THREE.BufferGeometry();
			pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
			points = new THREE.Points(pGeo, pointsMaterial);
			points.visible = false;
			scene.add(points);
		};

		function frameBounds(uvs: Array<[number, number]>): { cx: number; cy: number } {
			let minU = Infinity;
			let maxU = -Infinity;
			let minV = Infinity;
			let maxV = -Infinity;
			for (const [u, v] of uvs) {
				if (u < minU) minU = u;
				if (u > maxU) maxU = u;
				if (v < minV) minV = v;
				if (v > maxV) maxV = v;
			}
			if (!Number.isFinite(minU)) {
				minU = -10;
				maxU = 10;
				minV = -10;
				maxV = 10;
			}
			const cx = (minU + maxU) / 2;
			const cy = (minV + maxV) / 2;
			const aspect = el.clientWidth / el.clientHeight || 1;
			let halfU = (maxU - minU || 1) * 0.55;
			let halfV = (maxV - minV || 1) * 0.55;
			if (halfU / halfV < aspect) halfU = halfV * aspect;
			else halfV = halfU / aspect;
			ortho.left = -halfU;
			ortho.right = halfU;
			ortho.top = halfV;
			ortho.bottom = -halfV;
			ortho.near = 0.1;
			ortho.far = 2000;
			ortho.updateProjectionMatrix();
			return { cx, cy };
		}

		applyView = () => {
			if (!line || !points) return;
			if (viewMode === '3d') {
				activeCamera = persp;
				line.visible = true;
				points.visible = false;
				orbit.enabled = true;
				orbit.autoRotate = !compareMode;
				return;
			}
			orbit.enabled = false;
			orbit.autoRotate = false;

			if (viewMode === 'poincare') {
				line.visible = false;
				points.visible = true;
				const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
				const uvs: Array<[number, number]> = [];
				for (let i = 0; i < attr.count; i++) uvs.push([attr.getX(i), attr.getY(i)]);
				const { cx, cy } = frameBounds(uvs);
				ortho.up.set(0, 1, 0);
				ortho.position.set(cx, cy, 100);
				ortho.lookAt(cx, cy, 0);
				activeCamera = ortho;
				return;
			}

			line.visible = true;
			points.visible = false;
			const uvs: Array<[number, number]> = [];
			for (const p of trajectory) {
				if (viewMode === 'xy') uvs.push([p.x, p.y]);
				else if (viewMode === 'xz') uvs.push([p.x, p.z]);
				else uvs.push([p.y, p.z]);
			}
			const { cx, cy } = frameBounds(uvs);
			if (viewMode === 'xy') {
				ortho.up.set(0, 1, 0);
				ortho.position.set(cx, cy, 100);
				ortho.lookAt(cx, cy, 0);
			} else if (viewMode === 'xz') {
				ortho.up.set(0, 0, 1);
				ortho.position.set(cx, 100, cy);
				ortho.lookAt(cx, 0, cy);
			} else {
				ortho.up.set(0, 0, 1);
				ortho.position.set(100, cx, cy);
				ortho.lookAt(0, cx, cy);
			}
			activeCamera = ortho;
		};

		rebuild();
		applyView();

		const grid = new THREE.GridHelper(60, 20, 0x00f3ff, 0x2d1b69);
		grid.position.y = -15;
		(grid.material as THREE.Material).transparent = true;
		(grid.material as THREE.Material).opacity = 0.15;
		scene.add(grid);

		function animate() {
			if (!isAnimating) return;
			animationFrameId = requestAnimationFrame(animate);
			if (orbit.enabled) orbit.update();
			renderer.render(scene, activeCamera);
		}
		animate();

		const handleResize = () => {
			persp.aspect = el.clientWidth / el.clientHeight;
			persp.updateProjectionMatrix();
			renderer.setSize(el.clientWidth, el.clientHeight);
			applyView?.();
		};
		window.addEventListener('resize', handleResize);
		const resizeObserver = new ResizeObserver(() => handleResize());
		resizeObserver.observe(el);

		const disposeMaterial = (material: THREE.Material) => material.dispose();

		return () => {
			isAnimating = false;
			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
				animationFrameId = null;
			}
			window.removeEventListener('resize', handleResize);
			resizeObserver.disconnect();
			if (cameraChangeHandler) orbit.removeEventListener('change', cameraChangeHandler);
			orbit.dispose();
			disposeObjects();
			scene.remove(grid);
			grid.geometry.dispose();
			if (Array.isArray(grid.material)) grid.material.forEach(disposeMaterial);
			else disposeMaterial(grid.material);
			lineMaterial.dispose();
			pointsMaterial.dispose();
			renderer.dispose();
			if (renderer.domElement.parentNode === el) {
				el.removeChild(renderer.domElement);
			}
		};
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative backdrop-blur-md"
	style="height: {height}px;"
>
	<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
	<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
	<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
	<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>
	<div
		class="absolute top-4 right-4 text-xs font-['Orbitron'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		CHUA_RENDERER
	</div>
</div>
