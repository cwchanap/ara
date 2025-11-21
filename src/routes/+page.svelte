<script lang="ts">
	const visualizations = [
		{
			name: 'Lorenz Attractor',
			description: 'A 3D chaotic system exhibiting butterfly effect',
			url: '/lorenz',
			color: 'from-blue-500 to-cyan-500'
		},
		{
			name: 'Hénon Map',
			description: 'A 2D discrete-time dynamical system with strange attractor',
			url: '/henon',
			color: 'from-purple-500 to-pink-500'
		},
		{
			name: 'Logistic Map',
			description: 'Population growth model showing chaotic behavior',
			url: '/logistic',
			color: 'from-green-500 to-emerald-500'
		},
		{
			name: 'Bifurcation (Logistic)',
			description: 'Bifurcation diagram of the logistic map',
			url: '/bifurcation-logistic',
			color: 'from-orange-500 to-red-500'
		},
		{
			name: 'Bifurcation (Hénon)',
			description: 'Bifurcation diagram of the Hénon map',
			url: '/bifurcation-henon',
			color: 'from-indigo-500 to-purple-500'
		},
		{
			name: 'Newton Fractal',
			description: 'Fractal generated from Newton\'s method',
			url: '/newton',
			color: 'from-yellow-500 to-orange-500'
		},
		{
			name: 'Standard Map',
			description: 'Area-preserving chaotic map from dynamical systems',
			url: '/standard',
			color: 'from-teal-500 to-green-500'
		},
		{
			name: 'Chaos Esthetique',
			description: 'Aesthetic chaos pattern with custom formula',
			url: '/chaos-esthetique',
			color: 'from-rose-500 to-pink-500'
		}
	];
</script>

<div class="space-y-8">
	<div class="text-center space-y-4">
		<h1 class="text-5xl font-bold text-white">
			Chaos Theory Visualizations
		</h1>
		<p class="text-xl text-white/70 max-w-2xl mx-auto">
			Explore beautiful mathematical chaos through interactive visualizations
		</p>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
		{#each visualizations as viz}
			<a
				href={viz.url}
				class="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20"
			>
				<div class="absolute inset-0 bg-gradient-to-br {viz.color} opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-300"></div>
				<h2 class="text-2xl font-semibold text-white mb-2 relative z-10">
					{viz.name}
				</h2>
				<p class="text-white/60 relative z-10">
					{viz.description}
				</p>
				<div class="mt-4 flex items-center text-purple-400 group-hover:text-purple-300 transition-colors relative z-10">
					<span class="text-sm font-medium">Explore</span>
					<svg class="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
					</svg>
				</div>
			</a>
		{/each}
	</div>
</div>
