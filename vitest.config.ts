import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { resolve } from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: { $lib: resolve('./src/lib') },
		conditions: ['browser']
	},
	test: {
		globals: true,
		coverage: {
			include: ['src/**/*.{ts,svelte}'],
			exclude: [
				'src/**/*.test.ts',
				'src/**/*.svelte.test.ts',
				'src/lib/constants.ts',
				'src/lib/workers/types.ts',
				'src/lib/index.ts',
				'**/*.d.ts'
			],
			extension: ['.ts', '.svelte']
		},
		projects: [
			{
				extends: true,
				test: {
					name: 'node',
					environment: 'node',
					include: ['src/**/*.test.ts'],
					exclude: ['src/**/*.svelte.test.ts'],
					setupFiles: ['./vitest.setup.node.ts'],
					alias: { $lib: resolve('./src/lib') }
				}
			},
			{
				extends: true,
				test: {
					name: 'jsdom',
					environment: 'jsdom',
					include: ['src/**/*.svelte.test.ts'],
					setupFiles: ['./vitest.setup.ts'],
					alias: { $lib: resolve('./src/lib') }
				}
			}
		]
	}
});
