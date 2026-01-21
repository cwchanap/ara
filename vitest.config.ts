import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { resolve } from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Only include vitest component tests (use .vitest.ts extension to avoid bun:test conflicts)
		include: ['src/lib/components/**/*.vitest.ts', 'src/routes/**/*.vitest.ts'],
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
