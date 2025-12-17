<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import { loadSavedConfigParameters, parseConfigParam } from '$lib/saved-config-loader';
	import type { RosslerParameters } from '$lib/types';
	import { calculateRossler } from '$lib/rossler';

	let { data } = $props();

	let container: HTMLDivElement;
	let a = $state(0.2);
	let b = $state(0.2);
	let c = $state(5.7);
	let isAnimating = $state(true);
	let recreate: () => void;

	// Save dialog state
	let showSaveDialog = $state(false);
	let saveSuccess = $state(false);

	// Config loading state
	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	// Get current parameters for saving
	function getParameters(): RosslerParameters {
		return { type: 'rossler', a, b, c };
	}

	// Save state
	let saveError = $state<string | null>(null);
	let timeoutId: ReturnType<typeof setTimeout> | null = $state(null);

	// Handle save
	async function handleSave(name: string) {
		// Clear any existing timeout and errors
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
		saveError = null;

		try {
			const response = await fetch(`${base}/api/save-config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					mapType: 'rossler',
					parameters: getParameters()
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Failed to save' }));
				saveError = errorData.error || 'Failed to save configuration';
				return;
			}

			saveSuccess = true;
			timeoutId = setTimeout(() => {
				saveSuccess = false;
				timeoutId = null;
			}, 3000);
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Failed to save configuration';
		}
	}

	// Load config from URL on mount
	onMount(() => {
		const controller = new AbortController();
		const { signal } = controller;
		const fetchWithSignal: typeof fetch = Object.assign(
			(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
				fetch(input, { ...init, signal }),
			{ preconnect: fetch.preconnect }
		);

		configErrors = [];
		showConfigError = false;
		stabilityWarnings = [];
		showStabilityWarning = false;

		const configId = $page.url.searchParams.get('configId');
		if (configId) {
			void (async () => {
				try {
					const result = await loadSavedConfigParameters({
						configId,
						mapType: 'rossler',
						base,
						fetchFn: fetchWithSignal
					});
					if (signal.aborted) return;
					if (!result.ok) {
						if (signal.aborted) return;
						configErrors = result.errors;
						showConfigError = true;
						return;
					}

					const typedParams = result.parameters;
					if (signal.aborted) return;
					if (typeof typedParams.a === 'number') a = typedParams.a;
					if (typeof typedParams.b === 'number') b = typedParams.b;
					if (typeof typedParams.c === 'number') c = typedParams.c;

					const stability = checkParameterStability('rossler', typedParams);
					if (signal.aborted) return;
					if (!stability.isStable) {
						stabilityWarnings = stability.warnings;
						showStabilityWarning = true;
					}
				} catch (err) {
					if (
						signal.aborted ||
						(err instanceof DOMException && err.name === 'AbortError') ||
						(err instanceof Error && err.name === 'AbortError')
					) {
						return;
					}
					configErrors = ['Failed to load configuration parameters'];
					showConfigError = true;
				}
			})();
		} else {
			const configParam = $page.url.searchParams.get('config');
			if (configParam) {
				try {
					// Validate parameters structure before using
					const parsed = parseConfigParam({ mapType: 'rossler', configParam });
					if (!parsed.ok) {
						console.error(parsed.logMessage, parsed.logDetails);
						if (signal.aborted) return;
						configErrors = parsed.errors;
						showConfigError = true;
					} else {
						// Now we can safely cast since validation passed
						const typedParams = parsed.parameters;
						if (signal.aborted) return;
						if (typeof typedParams.a === 'number') a = typedParams.a;
						if (typeof typedParams.b === 'number') b = typedParams.b;
						if (typeof typedParams.c === 'number') c = typedParams.c;

						// Check stability
						const stability = checkParameterStability('rossler', typedParams);
						if (signal.aborted) return;
						if (!stability.isStable) {
							stabilityWarnings = stability.warnings;
							showStabilityWarning = true;
						}
					}
				} catch (e) {
					console.error('Invalid config parameter:', e);
					if (signal.aborted) return;
					configErrors = ['Failed to parse configuration parameters'];
					showConfigError = true;
				}
			}
		}

		return () => {
			controller.abort();
		};
	});

	$effect(() => {
		// Track dependencies
		void a;
		void b;
		void c;
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
		camera.position.set(30, 30, 30);

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(container.clientWidth, container.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		// eslint-disable-next-line svelte/no-dom-manipulating
		container.appendChild(renderer.domElement);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.5;

		// Create line geometry
		function createRosslerLine() {
			const points = calculateRossler({
				x0: 0.1,
				y0: 0,
				z0: 0,
				steps: 15000,
				dt: 0.01,
				a,
				b,
				c
			}).map((p) => new THREE.Vector3(p.x, p.y, p.z));
			const geometry = new THREE.BufferGeometry().setFromPoints(points);

			// Create gradient colors (Blue to Purple)
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

		const initialRosslerLine = createRosslerLine();
		let rosslerLine: THREE.Line | null = initialRosslerLine;
		scene.add(initialRosslerLine);

		// Add faint grid helper for reference
		const gridHelper = new THREE.GridHelper(100, 20, 0x3b82f6, 0x2d1b69);
		gridHelper.position.y = -20;
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
			if (rosslerLine) {
				disposeLine(rosslerLine);
				scene.remove(rosslerLine);
				rosslerLine = null;
			}

			rosslerLine = createRosslerLine();
			scene.add(rosslerLine);
		};

		return () => {
			window.removeEventListener('resize', handleResize);
			isAnimating = false;
			renderer.dispose();

			// Clear timeout to prevent memory leaks
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}

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
				RÖSSLER_ATTRACTOR
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_09
			</p>
		</div>
		<div class="flex gap-3">
			<button
				onclick={() => (showSaveDialog = true)}
				class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				💾 Save
			</button>
			<a
				href="{base}/"
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				← Return
			</a>
		</div>
	</div>

	<!-- Save Success Toast -->
	{#if saveSuccess}
		<div
			class="fixed top-20 right-4 z-50 px-6 py-4 bg-green-500/10 border border-green-500/30 rounded-lg backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-right-5"
		>
			<div class="flex items-center gap-3">
				<span class="text-green-400">✓</span>
				<span class="text-green-200">Configuration saved successfully!</span>
			</div>
		</div>
	{/if}

	<!-- Save Error Toast -->
	{#if saveError}
		<div
			class="fixed top-20 right-4 z-50 px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-right-5"
		>
			<div class="flex items-center gap-3">
				<span class="text-red-400">✕</span>
				<span class="text-red-200">{saveError}</span>
				<button onclick={() => (saveError = null)} class="text-red-400/60 hover:text-red-400 ml-2">
					✕
				</button>
			</div>
		</div>
	{/if}

	<!-- Invalid Configuration -->
	{#if showConfigError && configErrors.length > 0}
		<div class="bg-red-500/10 border border-red-500/30 rounded-sm p-4 relative">
			<div class="flex items-start gap-3">
				<span class="text-red-400 text-xl">✕</span>
				<div class="flex-1">
					<h3 class="font-['Orbitron'] text-red-400 font-semibold mb-1">INVALID_CONFIGURATION</h3>
					<p class="text-red-200/80 text-sm mb-2">
						The loaded configuration could not be applied due to validation errors:
					</p>
					<ul class="text-xs text-red-200/60 list-disc list-inside space-y-1">
						{#each configErrors as err, i (i)}
							<li>{err}</li>
						{/each}
					</ul>
				</div>
				<button
					onclick={() => (showConfigError = false)}
					class="text-red-400/60 hover:text-red-400"
				>
					✕
				</button>
			</div>
		</div>
	{/if}

	<!-- Stability Warning -->
	{#if showStabilityWarning && stabilityWarnings.length > 0}
		<div class="bg-amber-500/10 border border-amber-500/30 rounded-sm p-4 relative">
			<div class="flex items-start gap-3">
				<span class="text-amber-400 text-xl">⚠️</span>
				<div class="flex-1">
					<h3 class="font-['Orbitron'] text-amber-400 font-semibold mb-1">
						UNSTABLE_PARAMETERS_DETECTED
					</h3>
					<p class="text-amber-200/80 text-sm mb-2">
						The loaded configuration contains parameters outside recommended stable ranges:
					</p>
					<ul class="text-xs text-amber-200/60 list-disc list-inside space-y-1">
						{#each stabilityWarnings as warning, i (i)}
							<li>{warning}</li>
						{/each}
					</ul>
				</div>
				<button
					onclick={() => (showStabilityWarning = false)}
					class="text-amber-400/60 hover:text-amber-400"
				>
					✕
				</button>
			</div>
		</div>
	{/if}

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
					<label for="param-a" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						a (parameter)
					</label>
					<span class="font-mono text-accent">{a.toFixed(3)}</span>
				</div>
				<input
					id="param-a"
					type="range"
					bind:value={a}
					min="0"
					max="1"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="param-b" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						b (parameter)
					</label>
					<span class="font-mono text-accent">{b.toFixed(3)}</span>
				</div>
				<input
					id="param-b"
					type="range"
					bind:value={b}
					min="0"
					max="1"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="param-c" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						c (parameter)
					</label>
					<span class="font-mono text-accent">{c.toFixed(2)}</span>
				</div>
				<input
					id="param-c"
					type="range"
					bind:value={c}
					min="0"
					max="30"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>dx/dt = -y - z</p>
			<p>dy/dt = x + a·y</p>
			<p>dz/dt = b + z(x - c)</p>
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
			DATA_LOG: RÖSSLER_SYSTEM
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Rössler attractor is a system of three non-linear ordinary differential equations
			originally studied by Otto Rössler in the 1970s. Unlike the Lorenz attractor's butterfly
			shape, the Rössler attractor has a continuous band structure with a characteristic scroll
			pattern when viewed from certain angles, making it one of the simplest continuous dynamical
			systems that can exhibit chaotic behavior.
		</p>
	</div>
</div>

<!-- Save Configuration Dialog -->
<SaveConfigDialog
	bind:open={showSaveDialog}
	mapType="rossler"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (showSaveDialog = false)}
	onSave={handleSave}
/>
