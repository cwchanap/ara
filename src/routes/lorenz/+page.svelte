<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { base } from '$app/paths';

	let container: HTMLDivElement;
	let sigma = $state(10);
	let rho = $state(28);
	let beta = $state(8.0 / 3);
	let isAnimating = $state(true);
	let recreate: () => void;

	$effect(() => {
		// Track dependencies
		void sigma;
		void rho;
		void beta;
		if (recreate) recreate();
	});

	onMount(() => {
		// Scene setup
		const scene = new THREE.Scene();
		// Transparent background to let CSS background show through, or very dark
		scene.background = null;

		const camera = new THREE.PerspectiveCamera(
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

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.5;

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
			const points = calculateLorenz(0.1, 0, 0, 15000, 0.005);
			const geometry = new THREE.BufferGeometry().setFromPoints(points);

			// Create gradient colors (Neon Cyan to Magenta)
			const colors = new Float32Array(points.length * 3);
			const color1 = new THREE.Color(0x00f3ff); // Cyan
			const color2 = new THREE.Color(0xbc13fe); // Magenta

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

		let lorenzLine = createLorenzLine();
		scene.add(lorenzLine);

		// Add faint grid helper for reference
		const gridHelper = new THREE.GridHelper(100, 20, 0x00f3ff, 0x2d1b69);
		gridHelper.position.y = -30;
		(gridHelper.material as THREE.Material).transparent = true;
		(gridHelper.material as THREE.Material).opacity = 0.2;
		scene.add(gridHelper);

		// Animation loop
		function animate() {
			if (!isAnimating) return;
			requestAnimationFrame(animate);
			controls.update();
			renderer.render(scene, camera);
		}

		animate();

		// Handle window resize
		const handleResize = () => {
			if (!container) return;
			camera.aspect = container.clientWidth / container.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(container.clientWidth, container.clientHeight);
		};
		window.addEventListener('resize', handleResize);

		// Recreate visualization on parameter change
		recreate = () => {
			scene.remove(lorenzLine);
			lorenzLine = createLorenzLine();
			scene.add(lorenzLine);
		};

		return () => {
			window.removeEventListener('resize', handleResize);
			isAnimating = false;
			renderer.dispose();

			if (container && renderer.domElement.parentNode === container) {
				// eslint-disable-next-line svelte/no-dom-manipulating
				container.removeChild(renderer.domElement);
			}
		};
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				LORENZ_ATTRACTOR
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_01
			</p>
		</div>
		<a
			href="{base}/"
			class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
		>
			← Return
		</a>
	</div>

	<!-- Control Panel -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative overflow-hidden group"
	>
		<!-- Decor corners -->
		<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
		<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
		<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

		<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
			<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
			SYSTEM_PARAMETERS
		</h2>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						σ (sigma)
					</label>
					<span class="font-mono text-accent">{sigma.toFixed(2)}</span>
				</div>
				<input
					type="range"
					bind:value={sigma}
					min="0"
					max="50"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						ρ (rho)
					</label>
					<span class="font-mono text-accent">{rho.toFixed(2)}</span>
				</div>
				<input
					type="range"
					bind:value={rho}
					min="0"
					max="50"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						β (beta)
					</label>
					<span class="font-mono text-accent">{beta.toFixed(2)}</span>
				</div>
				<input
					type="range"
					bind:value={beta}
					min="0"
					max="10"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>dx/dt = σ(y - x)</p>
			<p>dy/dt = x(ρ - z) - y</p>
			<p>dz/dt = xy - βz</p>
		</div>
	</div>

	<!-- Visualization Container -->
	<div
		bind:this={container}
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
		style="height: 600px;"
	>
		<div
			class="absolute top-4 right-4 text-xs font-mono text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
		>
			LIVE_RENDER // THREE.JS
		</div>
	</div>

	<!-- Info Panel -->
	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: LORENZ_SYSTEM
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Lorenz attractor is a set of chaotic solutions to the Lorenz system. It is notable for its
			butterfly shape and for demonstrating sensitive dependence on initial conditions - a hallmark
			of chaos theory. This system, originally derived from simplified equations for convection
			rolls arising in the equations of the atmosphere, exhibits strange attractor behavior.
		</p>
	</div>
</div>
