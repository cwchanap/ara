<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { base } from '$app/paths';

	let container: HTMLDivElement;
	let sigma = $state(95);
	let rho = $state(28);
	let beta = $state(8.0 / 3);
	let isAnimating = $state(true);

	onMount(() => {
		// Scene setup
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x0a0a0a);

		const camera = new THREE.PerspectiveCamera(
			75,
			container.clientWidth / container.clientHeight,
			0.1,
			1000
		);
		camera.position.set(50, 50, 50);

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(container.clientWidth, container.clientHeight);
		// eslint-disable-next-line svelte/no-dom-manipulating
		container.appendChild(renderer.domElement);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;

		// Calculate Lorenz attractor points
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

		// Create line geometry
		function createLorenzLine() {
			const points = calculateLorenz(0, 1, 1.01, 10000, 0.01);
			const geometry = new THREE.BufferGeometry().setFromPoints(points);

			// Create gradient colors
			const colors = new Float32Array(points.length * 3);
			for (let i = 0; i < points.length; i++) {
				const t = i / points.length;
				colors[i * 3] = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
				colors[i * 3 + 1] = 0.3 + 0.7 * Math.cos(t * Math.PI * 2);
				colors[i * 3 + 2] = 0.8;
			}
			geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

			const material = new THREE.LineBasicMaterial({
				vertexColors: true,
				linewidth: 2
			});

			return new THREE.Line(geometry, material);
		}

		let lorenzLine = createLorenzLine();
		scene.add(lorenzLine);

		// Add axes helper
		const axesHelper = new THREE.AxesHelper(50);
		scene.add(axesHelper);

		// Animation loop
		function animate() {
			if (!isAnimating) return;
			requestAnimationFrame(animate);
			controls.update();
			lorenzLine.rotation.y += 0.001;
			renderer.render(scene, camera);
		}

		animate();

		// Handle window resize
		const handleResize = () => {
			camera.aspect = container.clientWidth / container.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(container.clientWidth, container.clientHeight);
		};
		window.addEventListener('resize', handleResize);

		// Recreate visualization on parameter change
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const recreate = () => {
			scene.remove(lorenzLine);
			lorenzLine = createLorenzLine();
			scene.add(lorenzLine);
		};

		return () => {
			window.removeEventListener('resize', handleResize);
			isAnimating = false;
			renderer.dispose();
			// eslint-disable-next-line svelte/no-dom-manipulating
			container.removeChild(renderer.domElement);
		};
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-4xl font-bold text-white">Lorenz Attractor</h1>
			<p class="text-white/60 mt-2">
				The Lorenz system is a set of differential equations that exhibit chaotic behavior
			</p>
		</div>
		<a
			href="{base}/"
			class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
		>
			← Back
		</a>
	</div>

	<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 space-y-4">
		<h2 class="text-xl font-semibold text-white">Parameters</h2>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div>
				<label class="block text-white/80 text-sm mb-2">
					σ (sigma): {sigma.toFixed(2)}
				</label>
				<input type="range" bind:value={sigma} min="0" max="100" step="0.1" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> ρ (rho): {rho.toFixed(2)} </label>
				<input type="range" bind:value={rho} min="0" max="50" step="0.1" class="w-full" />
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2">
					β (beta): {beta.toFixed(2)}
				</label>
				<input type="range" bind:value={beta} min="0" max="10" step="0.1" class="w-full" />
			</div>
		</div>

		<div class="text-sm text-white/60 space-y-1">
			<p>dx/dt = σ(y - x)</p>
			<p>dy/dt = x(ρ - z) - y</p>
			<p>dz/dt = xy - βz</p>
		</div>
	</div>

	<div
		bind:this={container}
		class="bg-black/50 border border-white/10 rounded-xl overflow-hidden"
		style="height: 600px;"
	></div>

	<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
		<h3 class="text-lg font-semibold text-white mb-2">About the Lorenz Attractor</h3>
		<p class="text-white/70 text-sm">
			The Lorenz attractor is a set of chaotic solutions to the Lorenz system. It is notable for its
			butterfly shape and for demonstrating sensitive dependence on initial conditions - a hallmark
			of chaos theory.
		</p>
	</div>
</div>
