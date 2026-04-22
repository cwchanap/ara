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

		// Stub for drizzle-orm: Bun v1.3.11 on Linux fails to resolve named
		// exports (e.g. `asc`) that live 3 levels deep in export* re-export
		// chains at ESM link time. All server-side tests mock $lib/server/db,
		// so these operators are only ever passed to mock DB methods and their
		// exact return values don't matter. Individual test files that need
		// specific drizzle-orm behaviour can override this with mock.module().
		build.module('drizzle-orm', () => ({
			contents: `
const stub = (...args) => args;
export { stub as eq, stub as ne, stub as lt, stub as lte, stub as gt, stub as gte };
export { stub as and, stub as or, stub as not };
export { stub as isNull, stub as isNotNull };
export { stub as like, stub as ilike, stub as notLike, stub as notIlike };
export { stub as inArray, stub as notInArray };
export { stub as between, stub as notBetween };
export { stub as exists, stub as notExists };
export { stub as asc, stub as desc };
export { stub as sql };
export { stub as count, stub as sum, stub as avg, stub as min, stub as max };
`,
			loader: 'js'
		}));

		// Stub for svelte/store: provides minimal writable/readable/get
		// implementations used by camera-sync.ts and test helper code.
		// The real package requires the full Svelte runtime; this lightweight
		// version is sufficient for unit-testing store logic in isolation.
		build.module('svelte/store', () => ({
			contents: `
export function writable(value) {
  const subscribers = new Set();
  return {
    subscribe(fn) {
      subscribers.add(fn);
      fn(value);
      return () => subscribers.delete(fn);
    },
    set(v) { value = v; subscribers.forEach(fn => fn(value)); },
    update(fn) { const v = fn(value); value = v; subscribers.forEach(sub => sub(value)); }
  };
}
export function readable(value, start) {
  const store = writable(value);
  if (start) {
    let stop;
    const origSubscribe = store.subscribe;
    store.subscribe = (fn) => {
      if (!stop) stop = start(store.set) || (() => {});
      const unsub = origSubscribe(fn);
      return () => { unsub(); if (stop) { stop(); stop = null; } };
    };
  }
  return { subscribe: store.subscribe };
}
export function get(store) {
  let val;
  const unsub = store.subscribe(v => { val = v; });
  if (typeof unsub === 'function') unsub();
  return val;
}
export function derived(stores, fn) {
  const arr = Array.isArray(stores) ? stores : [stores];
  let value;
  const store = writable(undefined);
  arr.forEach(s => s.subscribe(() => {
    const vals = arr.map(a => { let v; a.subscribe(x => v = x)(); return v; });
    value = Array.isArray(stores) ? fn(vals) : fn(vals[0]);
    store.set(value);
  }));
  return { subscribe: store.subscribe };
}
`,
			loader: 'js'
		}));

		// Stub for clsx: joins truthy class name inputs into a single string.
		// The real clsx package is a runtime dependency not available without
		// node_modules; this stub handles the string/object/array forms used
		// by the cn() utility in src/lib/utils.ts.
		build.module('clsx', () => ({
			contents: `
export function clsx(...inputs) {
  const result = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string' || typeof input === 'number') {
      result.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = clsx(...input);
      if (inner) result.push(inner);
    } else if (typeof input === 'object') {
      for (const [k, v] of Object.entries(input)) {
        if (v) result.push(k);
      }
    }
  }
  return result.join(' ');
}
export default clsx;
`,
			loader: 'js'
		}));

		// Stub for tailwind-merge: resolves conflicting Tailwind utilities so
		// that the last class in each "prefix group" wins (e.g. p-2 p-4 → p-4).
		// The real package uses a full class-group registry; this stub derives
		// the group key from the first hyphen-separated segment, which is
		// sufficient for the Tailwind classes used in this project's tests.
		build.module('tailwind-merge', () => ({
			contents: `
export function twMerge(...inputs) {
  const allClasses = inputs
    .filter(Boolean)
    .join(' ')
    .trim()
    .split(/\\s+/)
    .filter(Boolean);

  const result = [];          // ordered [prefix, class] pairs
  const prefixIndex = {};     // prefix -> index in result

  for (const cls of allClasses) {
    const prefix = cls.split('-')[0];
    if (prefixIndex[prefix] !== undefined) {
      result[prefixIndex[prefix]] = [prefix, cls];
    } else {
      prefixIndex[prefix] = result.length;
      result.push([prefix, cls]);
    }
  }

  return result.map(([, cls]) => cls).join(' ');
}
export default twMerge;
`,
			loader: 'js'
		}));
	}
});
