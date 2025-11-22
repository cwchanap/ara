<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';

	let canvas: HTMLCanvasElement;
	let imgWidth = 600;
	let imgHeight = 600;
	let xMin = -0.01;
	let xMax = 0.01;
	let yMin = -0.01;
	let yMax = 0.01;
	let maxIterations = 50;
	let epsilon = 5e-19;
	let isRendering = false;

	function render() {
		if (!canvas || isRendering) return;
		isRendering = true;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Clear canvas with black background
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, imgWidth, imgHeight);

		// Draw Newton fractal
		const imageData = ctx.createImageData(imgWidth, imgHeight);
		const data = imageData.data;

		for (let y = 0; y < imgHeight; y++) {
			const zy = (y * (yMax - yMin)) / (imgHeight - 1) + yMin;

			for (let x = 0; x < imgWidth; x++) {
				const zx = (x * (xMax - xMin)) / (imgWidth - 1) + xMin;

				let real = zx;
				let imag = zy;

				let iterations = 0;
				for (let i = 0; i < maxIterations; i++) {
					// Newton iteration for z^3 - 1 = 0
					// z_new = z - (z^3 - 1) / (3*z^2)

					const r2 = real * real + imag * imag;
					if (r2 === 0) break;

					// z^2
					const z2_real = real * real - imag * imag;
					const z2_imag = 2 * real * imag;

					// z^3
					const z3_real = real * z2_real - imag * z2_imag;
					const z3_imag = real * z2_imag + imag * z2_real;

					// z^3 - 1
					const numerator_real = z3_real - 1;
					const numerator_imag = z3_imag;

					// 3*z^2
					const denominator_real = 3 * z2_real;
					const denominator_imag = 3 * z2_imag;

					// Division
					const denom = denominator_real * denominator_real + denominator_imag * denominator_imag;
					if (denom === 0) break;

					const div_real =
						(numerator_real * denominator_real + numerator_imag * denominator_imag) / denom;
					const div_imag =
						(numerator_imag * denominator_real - numerator_real * denominator_imag) / denom;

					// z_new = z - result
					const newReal = real - div_real;
					const newImag = imag - div_imag;

					const diff = Math.sqrt((newReal - real) ** 2 + (newImag - imag) ** 2);

					real = newReal;
					imag = newImag;
					iterations = i;

					if (diff < epsilon) break;
				}

				// Color based on which root we converged to
				const idx = (y * imgWidth + x) * 4;

				if (real + 0.5 < epsilon) {
					// Converged to specific root - show white
					data[idx] = 255;
					data[idx + 1] = 255;
					data[idx + 2] = 255;
					data[idx + 3] = 255;
				} else {
					// Color based on iterations
					const color = Math.floor((iterations / maxIterations) * 255);
					data[idx] = color;
					data[idx + 1] = color / 2;
					data[idx + 2] = color / 3;
					data[idx + 3] = 255;
				}
			}
		}

		ctx.putImageData(imageData, 0, 0);
		isRendering = false;
	}

	onMount(() => {
		render();
	});

	$: if (canvas && (xMin || xMax || yMin || yMax || maxIterations)) {
		render();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-4xl font-bold text-white">Newton Fractal</h1>
			<p class="text-white/60 mt-2">Fractal generated from Newton's method on complex plane</p>
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

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label class="block text-white/80 text-sm mb-2">
					x range: [{xMin.toFixed(4)}, {xMax.toFixed(4)}]
				</label>
				<div class="flex gap-2">
					<input type="range" bind:value={xMin} min="-1" max="0" step="0.001" class="w-full" />
					<input type="range" bind:value={xMax} min="0" max="1" step="0.001" class="w-full" />
				</div>
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2">
					y range: [{yMin.toFixed(4)}, {yMax.toFixed(4)}]
				</label>
				<div class="flex gap-2">
					<input type="range" bind:value={yMin} min="-1" max="0" step="0.001" class="w-full" />
					<input type="range" bind:value={yMax} min="0" max="1" step="0.001" class="w-full" />
				</div>
			</div>

			<div>
				<label class="block text-white/80 text-sm mb-2"> Max Iterations: {maxIterations} </label>
				<input type="range" bind:value={maxIterations} min="10" max="100" step="5" class="w-full" />
			</div>
		</div>

		<div class="text-sm text-white/60">
			<p>z(n+1) = z(n) - (z³ - 1) / (3z²)</p>
		</div>
	</div>

	<div class="bg-black border border-white/10 rounded-xl overflow-hidden p-4 flex justify-center">
		<canvas bind:this={canvas} width={imgWidth} height={imgHeight}></canvas>
	</div>

	<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
		<h3 class="text-lg font-semibold text-white mb-2">About Newton Fractals</h3>
		<p class="text-white/70 text-sm">
			Newton fractals are created by applying Newton's method to find roots of complex functions.
			Each pixel is colored based on which root it converges to. The intricate boundaries between
			basins of attraction form beautiful fractal patterns, revealing the chaotic nature of the
			method's behavior.
		</p>
	</div>
</div>
