<!--
  RosslerRenderer Component

  Encapsulates the Three.js Rössler attractor visualization.
  Can be used standalone or in comparison mode.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { calculateRossler } from '$lib/rossler';
	import { cameraSyncStore, createCameraState, applyCameraState } from '$lib/stores/camera-sync';

	interface Props {
		a?: number;
		b?: number;
		c?: number;
		height?: number;
		compareMode?: boolean;
		compareSide?: 'left' | 'right';
	}

	let {
		a = $bindable(0.2),
		b = $bindable(0.2),
		c = $bindable(5.7),
		height = 500,
		compareMode = false,
		compareSide = 'left'
	}: Props = $props();

	let container: HTMLDivElement;
	let isAnimating = $state(true);
	let recreate: () => void;

	let controls = $state<OrbitControls | null>(null);
	let camera = $state<THREE.PerspectiveCamera | null>(null);

	$effect(() => {
		void a;
		void b;
		void c;
		if (recreate) recreate();
	});

	// Camera sync effect for comparison mode
	$effect(() => {
		if (!compareMode || !controls || !camera) return;

		const unsubscribe = cameraSyncStore.subscribe((state) => {
			if (!state.enabled || state.lastUpdate === compareSide) return;

			const otherState = compareSide === 'left' ? state.right : state.left;
			if (otherState) {
				applyCameraState(otherState, camera, controls);
			}
		});

		return unsubscribe;
	});

	onMount(() => {
		const scene = new THREE.Scene();
		scene.background = null;

		const localCamera = new THREE.PerspectiveCamera(
			75,
			container.clientWidth / container.clientHeight,
			0.1,
			1000
		);
		localCamera.position.set(30, 30, 30);
		camera = localCamera;

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(container.clientWidth, container.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		// eslint-disable-next-line svelte/no-dom-manipulating
		container.appendChild(renderer.domElement);

		const localControls = new OrbitControls(localCamera, renderer.domElement);
		localControls.enableDamping = true;
		localControls.autoRotate = !compareMode;
		localControls.autoRotateSpeed = 0.5;
		controls = localControls;

		// Camera sync for comparison mode
		if (compareMode) {
			localControls.addEventListener('change', () => {
				const cameraState = createCameraState(localCamera, localControls);
				cameraSyncStore.updateFromSide(compareSide, cameraState);
			});
		}

		function createRosslerLine() {
			const points = calculateRossler({
				x0: 0.1,
				y0: 0,
				z0: 0,
				steps: 20000,
				dt: 0.01,
				a,
				b,
				c
			});

			const vertices = points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
			const geometry = new THREE.BufferGeometry().setFromPoints(vertices);

			const colors = new Float32Array(points.length * 3);
			const color1 = new THREE.Color(0x3b82f6); // Blue
			const color2 = new THREE.Color(0x8b5cf6); // Purple

			for (let i = 0; i < points.length; i++) {
				const t = i / points.length;
				const color = new THREE.Color().copy(color1).lerp(color2, t);
				colors[i * 3] = color.r;
				colors[i * 3 + 1] = color.g;
				colors[i * 3 + 2] = color.b;
			}
			geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

			const material = new THREE.LineBasicMaterial({
				vertexColors: true,
				linewidth: 2,
				blending: THREE.AdditiveBlending,
				transparent: true,
				opacity: 0.8
			});

			return new THREE.Line(geometry, material);
		}

		const disposeMaterial = (material: THREE.Material) => {
			const mat = material as unknown as Record<string, unknown>;
			const textureKeys = [
				'map',
				'alphaMap',
				'aoMap',
				'bumpMap',
				'displacementMap',
				'emissiveMap',
				'envMap',
				'lightMap',
				'metalnessMap',
				'normalMap',
				'roughnessMap',
				'specularMap',
				'gradientMap'
			];

			for (const key of textureKeys) {
				const texture = mat[key];
				if (texture && typeof (texture as { dispose?: unknown }).dispose === 'function') {
					(texture as { dispose: () => void }).dispose();
					mat[key] = null;
				}
			}

			material.dispose();
		};

		const disposeLine = (line: THREE.Line) => {
			line.geometry.dispose();
			if (Array.isArray(line.material)) {
				line.material.forEach(disposeMaterial);
			} else {
				disposeMaterial(line.material);
			}
		};

		let rosslerLine = createRosslerLine();
		scene.add(rosslerLine);

		const gridHelper = new THREE.GridHelper(100, 20, 0x3b82f6, 0x2d1b69);
		gridHelper.position.y = -20;
		(gridHelper.material as THREE.Material).transparent = true;
		(gridHelper.material as THREE.Material).opacity = 0.2;
		scene.add(gridHelper);

		function animate() {
			if (!isAnimating) return;
			requestAnimationFrame(animate);
			localControls.update();
			renderer.render(scene, localCamera);
		}

		animate();

		const handleResize = () => {
			if (!container) return;
			localCamera.aspect = container.clientWidth / container.clientHeight;
			localCamera.updateProjectionMatrix();
			renderer.setSize(container.clientWidth, container.clientHeight);
		};
		window.addEventListener('resize', handleResize);

		recreate = () => {
			scene.remove(rosslerLine);
			disposeLine(rosslerLine);
			rosslerLine = createRosslerLine();
			scene.add(rosslerLine);
		};

		return () => {
			window.removeEventListener('resize', handleResize);
			isAnimating = false;

			localControls.dispose();

			scene.remove(gridHelper);
			gridHelper.geometry.dispose();
			if (Array.isArray(gridHelper.material)) {
				gridHelper.material.forEach(disposeMaterial);
			} else {
				disposeMaterial(gridHelper.material);
			}

			scene.remove(rosslerLine);
			disposeLine(rosslerLine);

			renderer.dispose();

			if (container && renderer.domElement.parentNode === container) {
				// eslint-disable-next-line svelte/no-dom-manipulating
				container.removeChild(renderer.domElement);
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
		class="absolute top-4 right-4 text-xs font-mono text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // THREE.JS
	</div>
</div>
