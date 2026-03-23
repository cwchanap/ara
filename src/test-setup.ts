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

// Prevent import-time DB config crashes in unit tests that touch server modules.
if (!process.env.DATABASE_URL && !process.env.NETLIFY_DATABASE_URL) {
	process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres';
}

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

		// Stubs for $lib/* modules: bun cannot resolve the $lib path alias
		// without .svelte-kit/tsconfig.json (generated at dev/build time).
		// Re-export from real files using absolute paths so values stay in
		// sync without duplication.
		const libDir = `${import.meta.dir}/lib`;
		build.module('$lib/constants', () => ({
			contents: `export * from '${libDir}/constants.ts';`,
			loader: 'ts'
		}));
		build.module('$lib/chaos-validation', () => ({
			contents: `export * from '${libDir}/chaos-validation.ts';`,
			loader: 'ts'
		}));
		build.module('$lib/saved-config-loader', () => ({
			contents: `export * from '${libDir}/saved-config-loader.ts';`,
			loader: 'ts'
		}));
		build.module('$lib/auth-errors', () => ({
			contents: `export * from '${libDir}/auth-errors.ts';`,
			loader: 'ts'
		}));
		build.module('$lib/types', () => ({
			contents: `export * from '${libDir}/types.ts';`,
			loader: 'ts'
		}));

		// Stub for @sveltejs/kit: provides the subset of helpers used by server
		// modules (fail, redirect, error, json). The real package is only available
		// inside the SvelteKit Vite build environment; in Bun's standalone test
		// runner we supply lightweight equivalents that mirror the runtime behaviour.
		build.module('@sveltejs/kit', () => ({
			contents: `
export function fail(status, data) { return { status, data }; }
export function redirect(status, location) {
  const e = Object.assign(new Error('Redirect'), { status, location });
  throw e;
}
export function error(status, body) {
  const e = Object.assign(new Error(typeof body === 'string' ? body : 'Error'), { status });
  throw e;
}
export function json(data, init) {
  return new Response(JSON.stringify(data), {
    status: (init && init.status) || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
`,
			loader: 'js'
		}));

		// Stub for $env/static/public: used by supabase-admin and browser Supabase
		// client. In tests we return placeholder values so imports don't crash.
		build.module('$env/static/public', () => ({
			contents: `
export const PUBLIC_SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
export const PUBLIC_SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';
`,
			loader: 'js'
		}));
	}
});
