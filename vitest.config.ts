import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
	plugins: [svelte()],
	test: {
		// Only include vitest component tests (use .vitest.ts extension to avoid bun:test conflicts)
		include: ['src/lib/components/**/*.vitest.ts'],
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./vitest.setup.ts'],
		alias: {
			$lib: resolve('./src/lib')
		}
	},
	resolve: {
		alias: {
			$lib: resolve('./src/lib')
		},
		conditions: ['browser']
	}
});
