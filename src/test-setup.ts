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
import { mock } from 'bun:test';

// Stub drizzle-orm so that deep export* chains don't crash Bun's ESM linker
// on Linux (v1.3.11 fails to resolve 'asc' through 3-level re-export chains).
// All server-side tests mock $lib/server/db, so these operators are only used
// to build query objects that are passed to mock functions and then discarded.
// Test files that need specific drizzle-orm behaviour can override this with
// their own mock.module('drizzle-orm', ...) call.
const stub = (..._args: unknown[]) => _args;
mock.module('drizzle-orm', () => ({
	eq: stub,
	ne: stub,
	lt: stub,
	lte: stub,
	gt: stub,
	gte: stub,
	and: stub,
	or: stub,
	not: stub,
	isNull: stub,
	isNotNull: stub,
	like: stub,
	ilike: stub,
	notLike: stub,
	notIlike: stub,
	inArray: stub,
	notInArray: stub,
	between: stub,
	notBetween: stub,
	exists: stub,
	notExists: stub,
	asc: stub,
	desc: stub,
	sql: stub,
	count: stub,
	sum: stub,
	avg: stub,
	min: stub,
	max: stub
}));

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
