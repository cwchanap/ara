<script lang="ts">
	import { base } from '$app/paths';

	const visualizations = [
		{
			name: 'Lorenz Attractor',
			description: 'A 3D chaotic system exhibiting butterfly effect',
			url: '/lorenz',
			color: 'from-cyan-500 to-blue-600'
		},
		{
			name: 'Hénon Map',
			description: 'A 2D discrete-time dynamical system with strange attractor',
			url: '/henon',
			color: 'from-fuchsia-500 to-purple-600'
		},
		{
			name: 'Lozi Map',
			description: 'Piecewise-linear counterpart to the Hénon map',
			url: '/lozi',
			color: 'from-indigo-500 to-violet-600'
		},
		{
			name: 'Logistic Map',
			description: 'Population growth model showing chaotic behavior',
			url: '/logistic',
			color: 'from-emerald-400 to-green-600'
		},
		{
			name: 'Bifurcation (Logistic)',
			description: 'Bifurcation diagram of the logistic map',
			url: '/bifurcation-logistic',
			color: 'from-orange-500 to-red-600'
		},
		{
			name: 'Bifurcation (Hénon)',
			description: 'Bifurcation diagram of the Hénon map',
			url: '/bifurcation-henon',
			color: 'from-violet-500 to-purple-600'
		},
		{
			name: 'Newton Fractal',
			description: "Fractal generated from Newton's method",
			url: '/newton',
			color: 'from-amber-400 to-orange-600'
		},
		{
			name: 'Standard Map',
			description: 'Area-preserving chaotic map from dynamical systems',
			url: '/standard',
			color: 'from-teal-400 to-emerald-600'
		},
		{
			name: 'Chaos Esthetique',
			description: 'Aesthetic chaos pattern with custom formula',
			url: '/chaos-esthetique',
			color: 'from-pink-500 to-rose-600'
		},
		{
			name: 'Rössler Attractor',
			description: 'A 3D chaotic system with continuous scroll structure',
			url: '/rossler',
			color: 'from-blue-500 to-purple-600'
		},
		{
			name: 'Lyapunov Exponents',
			description: 'Quantifying chaos through trajectory divergence rates',
			url: '/lyapunov',
			color: 'from-cyan-400 to-teal-600'
		}
	];
</script>

<div class="space-y-12">
	<div class="text-center space-y-4 relative">
		<!-- Glitch/Tech decorative elements -->
		<div
			class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[150%] bg-primary/5 blur-3xl -z-10 rounded-full"
		></div>

		<h1
			class="text-5xl md:text-7xl font-['Orbitron'] font-bold text-white tracking-tighter drop-shadow-[0_0_20px_rgba(0,243,255,0.5)]"
		>
			CHAOS_THEORY
			<span
				class="block text-2xl md:text-3xl text-primary mt-2 tracking-[0.5em] font-light opacity-80"
				>VISUALIZATIONS</span
			>
		</h1>
		<p
			class="text-xl text-muted-foreground max-w-2xl mx-auto font-light font-['Rajdhani'] tracking-wide"
		>
			Explore the beautiful complexity of mathematical chaos through interactive, real-time
			simulations.
		</p>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
		{#each visualizations as viz (viz.url)}
			<a
				href={base + viz.url}
				class="group relative bg-card/40 backdrop-blur-sm border border-primary/20 rounded-sm p-6 transition-all duration-300 hover:border-primary/60 hover:shadow-[0_0_20px_rgba(0,243,255,0.15)] hover:-translate-y-1 overflow-hidden"
			>
				<!-- Tech corners -->
				<div
					class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary/30 group-hover:border-primary transition-colors"
				></div>
				<div
					class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary/30 group-hover:border-primary transition-colors"
				></div>

				<div
					class="absolute inset-0 bg-linear-to-br {viz.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300"
				></div>

				<h2
					class="text-xl font-['Orbitron'] font-bold text-white mb-3 relative z-10 group-hover:text-primary transition-colors"
				>
					{viz.name}
				</h2>
				<p class="text-muted-foreground text-sm font-['Rajdhani'] font-medium relative z-10">
					{viz.description}
				</p>
				<div
					class="mt-6 flex items-center text-primary/60 group-hover:text-primary transition-colors relative z-10 font-mono text-xs uppercase tracking-widest"
				>
					<span class="border-b border-transparent group-hover:border-primary transition-all"
						>Initialize Module</span
					>
					<svg
						class="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"
						></path>
					</svg>
				</div>
			</a>
		{/each}
	</div>
</div>
