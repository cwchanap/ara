<!--
  LorenzRenderer Component

  Encapsulates the Three.js Lorenz attractor visualization.
  Can be used standalone or in comparison mode.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { cameraSyncStore, createCameraState, applyCameraState } from '$lib/stores/camera-sync';

	interface Props {
		sigma?: number;
		rho?: number;
		beta?: number;
		height?: number;
		compareMode?: boolean;
		compareSide?: 'left' | 'right';
	}

	let {
		sigma = $bindable(10),
		rho = $bindable(28),
		beta = $bindable(8.0 / 3),
		height = 500,
		compareMode = false,
		compareSide = 'left'
	}: Props = $props();

	let container: HTMLDivElement;
	let isAnimating = $state(true);
	let recreate: () => void;

	// For camera sync in compare mode
	let controls: OrbitControls | null = null;
	let camera: THREE.PerspectiveCamera | null = null;

	$effect(() => {
		void sigma;
		void rho;
		void beta;
		if (recreate) recreate();
	});

	// Camera sync effect for comparison mode
	$effect(() => {
		if (!compareMode || !controls || !camera) return;

		const unsubscribe = cameraSyncStore.subscribe((state) => {
			if (!state.enabled || state.lastUpdate === compareSide) return;

			const otherState = compareSide === 'left' ? state.right : state.left;
			if (otherState) {
				applyCameraState(otherState, camera!, controls!);
			}
		});

		return unsubscribe;
	});

	onMount(() => {
		const scene = new THREE.Scene();
		scene.background = null;

		camera = new THREE.PerspectiveCamera(
			75,
			container.clientWidth / container.clientHeight,
			0.1,
			1000
		);
		camera.position.set(40, 40, 40);

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(container.clientWidth, container.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		// eslint-disable-next-line svelte/no-dom-manipulating
		container.appendChild(renderer.domElement);

		controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.autoRotate = !compareMode; // Disable auto-rotate in compare mode
		controls.autoRotateSpeed = 0.5;

		// Camera sync for comparison mode
		if (compareMode) {
			controls.addEventListener('change', () => {
				const cameraState = createCameraState(camera!, controls!);
				cameraSyncStore.updateFromSide(compareSide, cameraState);
			});
		}

		function calculateLorenz(
			x0: number,
			y0: number,
			z0: number,
			steps: number,
			dt: number
		): THREE.Vector3[] {
			const points: THREE.Vector3[] = [];
			let x = x0;
			let y = y0;
			let z = z0;

			for (let i = 0; i < steps; i++) {
				const dx = sigma * (y - x);
				const dy = x * (rho - z) - y;
				const dz = x * y - beta * z;

				x += dx * dt;
				y += dy * dt;
				z += dz * dt;

				points.push(new THREE.Vector3(x, y, z));
			}

			return points;
		}

		function createLorenzLine() {
			const points = calculateLorenz(0.1, 0, 0, 15000, 0.005);
			const geometry = new THREE.BufferGeometry().setFromPoints(points);

			const colors = new Float32Array(points.length * 3);
			const color1 = new THREE.Color(0x00f3ff);
			const color2 = new THREE.Color(0xbc13fe);

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
				'gradientMap',
				'clearcoatMap',
				'clearcoatNormalMap',
				'clearcoatRoughnessMap',
				'sheenColorMap',
				'sheenRoughnessMap',
				'transmissionMap',
				'thicknessMap',
				'iridescenceMap',
				'iridescenceThicknessMap'
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

		let lorenzLine = createLorenzLine();
		scene.add(lorenzLine);

		const gridHelper = new THREE.GridHelper(100, 20, 0x00f3ff, 0x2d1b69);
		gridHelper.position.y = -30;
		(gridHelper.material as THREE.Material).transparent = true;
		(gridHelper.material as THREE.Material).opacity = 0.2;
		scene.add(gridHelper);

		function animate() {
			if (!isAnimating) return;
			requestAnimationFrame(animate);
			if (controls) controls.update();
			if (camera) renderer.render(scene, camera);
		}

		animate();

		const handleResize = () => {
			if (!container || !camera) return;
			camera.aspect = container.clientWidth / container.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(container.clientWidth, container.clientHeight);
		};
		window.addEventListener('resize', handleResize);

		recreate = () => {
			scene.remove(lorenzLine);
			disposeLine(lorenzLine);
			lorenzLine = createLorenzLine();
			scene.add(lorenzLine);
		};

		return () => {
			window.removeEventListener('resize', handleResize);
			isAnimating = false;

			if (controls) controls.dispose();

			scene.remove(gridHelper);
			gridHelper.geometry.dispose();
			if (Array.isArray(gridHelper.material)) {
				gridHelper.material.forEach(disposeMaterial);
			} else {
				disposeMaterial(gridHelper.material);
			}

			scene.remove(lorenzLine);
			disposeLine(lorenzLine);

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
