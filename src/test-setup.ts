/**
 * Bun test preload file
 *
 * Registers virtual module stubs for SvelteKit-specific imports that don't
 * exist as real files in the filesystem. These virtual modules are provided
 * by SvelteKit's Vite plugin at build/dev time but are unavailable in Bun's
 * standalone test runner.
 *
 * Uses build.module() rather than onResolve()/onLoad() because Bun's runtime
 * plugin onResolve hook only processes file: protocol imports and does not
 * intercept $-prefixed virtual module specifiers (see oven-sh/bun#9863).
 *
 * Loaded via bunfig.toml [test] preload setting.
 */

import { plugin } from 'bun';

plugin({
	name: 'sveltekit-virtual-modules',
	setup(build) {
		// Stub for $env/dynamic/private: expose process.env as the env object.
		// The real SvelteKit module provides server-only env vars filtered from
		// the public prefix — in tests we use process.env directly.
		build.module('$env/dynamic/private', () => ({
			contents: `export const env = process.env;`,
			loader: 'js'
		}));

		// Stub for $app/paths: the real module is provided by SvelteKit's Vite
		// plugin and exposes the app base path. In tests there is no base path,
		// so we export an empty string which is the correct default value.
		build.module('$app/paths', () => ({
			contents: `export const base = '';`,
			loader: 'js'
		}));
	}
});
