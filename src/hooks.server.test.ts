/**
 * Unit tests for src/hooks.server.ts
 *
 * Covers the SvelteKit `handle` hook and the `safeGetSession` helper it
 * attaches to event.locals. @supabase/ssr is mocked so the tests exercise
 * all branches without network access.
 *
 * Branches covered:
 *  - Supabase client initialisation (getAll / setAll cookie proxies)
 *  - safeGetSession: no session   → {session:null, user:null}
 *  - safeGetSession: valid JWT    → {session, user}
 *  - safeGetSession: bad JWT      → {session:null, user:null}
 *  - filterSerializedResponseHeaders: content-range / x-supabase-api-version → true
 *  - filterSerializedResponseHeaders: any other header → false
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// ── Mutable state controlling mock auth responses ────────────────────────────

type Session = { access_token: string } | null;
type User = { id: string; email?: string } | null;

let mockSession: Session = null;
let mockGetUserResult: { data: { user: User }; error: unknown } = {
	data: { user: null },
	error: null
};

// Cookie helpers captured from the createServerClient call so we can call
// them directly in cookie-proxy tests.
type CookieEntry = { name: string; value: string };
type SetAllEntry = { name: string; value: string; options: Record<string, unknown> };

let capturedGetAll: (() => CookieEntry[]) | null = null;
let capturedSetAll: ((entries: SetAllEntry[]) => void) | null = null;

// ── Mock @supabase/ssr before the handle module loads ────────────────────────

mock.module('@supabase/ssr', () => ({
	createServerClient: (
		_url: string,
		_key: string,
		opts: { cookies: { getAll: () => CookieEntry[]; setAll: (e: SetAllEntry[]) => void } }
	) => {
		capturedGetAll = opts.cookies.getAll;
		capturedSetAll = opts.cookies.setAll;
		return {
			auth: {
				getSession: async () => ({ data: { session: mockSession } }),
				getUser: async () => mockGetUserResult
			}
		};
	}
}));

// Dynamic import AFTER mock registration
const { handle } = await import('./hooks.server');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal SvelteKit-like event with a real cookie store.
 * Matches the subset of the Cookies API used by hooks.server.ts.
 */
function makeEvent(initial: Record<string, string> = {}) {
	const store = new Map<string, { value: string; options: Record<string, unknown> }>(
		Object.entries(initial).map(([k, v]) => [k, { value: v, options: {} }])
	);

	return {
		cookies: {
			getAll: (): CookieEntry[] =>
				[...store.entries()].map(([name, { value }]) => ({ name, value })),
			set: (name: string, value: string, options: Record<string, unknown>) => {
				store.set(name, { value, options });
			},
			_store: store
		},
		locals: {} as {
			supabase?: unknown;
			safeGetSession?: () => Promise<{ session: unknown; user: unknown }>;
		}
	};
}

// Resolve stub — captures the options argument for later inspection.
type ResolveOpts = { filterSerializedResponseHeaders?: (name: string) => boolean };
let lastResolveOpts: ResolveOpts | undefined;

async function resolve(_event: unknown, opts?: ResolveOpts): Promise<Response> {
	lastResolveOpts = opts;
	return new Response('ok', { status: 200 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('handle (hooks.server.ts)', () => {
	beforeEach(() => {
		mockSession = null;
		mockGetUserResult = { data: { user: null }, error: null };
		capturedGetAll = null;
		capturedSetAll = null;
		lastResolveOpts = undefined;
	});

	// ── Locals setup ──────────────────────────────────────────────────────────

	test('attaches supabase client to event.locals', async () => {
		const event = makeEvent();
		await handle({ event: event as never, resolve: resolve as never });
		expect(event.locals.supabase).toBeDefined();
	});

	test('attaches safeGetSession function to event.locals', async () => {
		const event = makeEvent();
		await handle({ event: event as never, resolve: resolve as never });
		expect(typeof event.locals.safeGetSession).toBe('function');
	});

	// ── resolve call ──────────────────────────────────────────────────────────

	test('calls resolve and forwards its return value', async () => {
		const event = makeEvent();
		const response = await handle({ event: event as never, resolve: resolve as never });
		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(200);
	});

	test('passes filterSerializedResponseHeaders option to resolve', async () => {
		const event = makeEvent();
		await handle({ event: event as never, resolve: resolve as never });
		expect(typeof lastResolveOpts?.filterSerializedResponseHeaders).toBe('function');
	});

	// ── Cookie proxy ──────────────────────────────────────────────────────────

	describe('cookie proxy passed to createServerClient', () => {
		test('getAll returns cookies from the event', async () => {
			const event = makeEvent({ 'sb-auth-token': 'tok123', other: 'val' });
			await handle({ event: event as never, resolve: resolve as never });
			expect(capturedGetAll).toBeDefined();
			const cookies = capturedGetAll!();
			expect(cookies).toContainEqual({ name: 'sb-auth-token', value: 'tok123' });
			expect(cookies).toContainEqual({ name: 'other', value: 'val' });
		});

		test('setAll writes cookies back to the event with path "/"', async () => {
			const event = makeEvent();
			await handle({ event: event as never, resolve: resolve as never });

			expect(capturedSetAll).toBeDefined();
			capturedSetAll!([{ name: 'sb-token', value: 'new-tok', options: { httpOnly: true } }]);

			// The cookie should now appear via event.cookies.getAll()
			const stored = event.cookies.getAll().find((c) => c.name === 'sb-token');
			expect(stored?.value).toBe('new-tok');
		});

		test('setAll merges existing options with path "/"', async () => {
			const event = makeEvent();
			await handle({ event: event as never, resolve: resolve as never });

			expect(capturedSetAll).toBeDefined();
			capturedSetAll!([
				{ name: 'sb-refresh', value: 'refresh-tok', options: { secure: true } }
			]);

			// The store _does_ hold the entry (verifiable via internal Map)
			const entry = event.cookies._store.get('sb-refresh');
			expect(entry?.value).toBe('refresh-tok');
			// The path '/' should be merged into options by hooks.server.ts
			expect((entry?.options as Record<string, unknown>)?.path).toBe('/');
			// The original options must also be preserved alongside the merged path
			expect((entry?.options as Record<string, unknown>)?.secure).toBe(true);
		});
	});

	// ── safeGetSession ────────────────────────────────────────────────────────

	describe('safeGetSession', () => {
		test('returns {session:null, user:null} when there is no session', async () => {
			mockSession = null;
			const event = makeEvent();
			await handle({ event: event as never, resolve: resolve as never });

			const result = await event.locals.safeGetSession!();
			expect(result).toEqual({ session: null, user: null });
		});

		test('returns session and user when JWT is valid', async () => {
			const session = { access_token: 'valid-jwt' };
			mockSession = session;
			mockGetUserResult = {
				data: { user: { id: 'user-1', email: 'u@example.com' } },
				error: null
			};

			const event = makeEvent();
			await handle({ event: event as never, resolve: resolve as never });

			const result = await event.locals.safeGetSession!();
			expect(result.session).toBe(session);
			expect(result.user).toEqual({ id: 'user-1', email: 'u@example.com' });
		});

		test('returns {session:null, user:null} when getUser returns an error', async () => {
			// Session cookie exists but JWT validation fails server-side
			mockSession = { access_token: 'tampered-jwt' };
			mockGetUserResult = {
				data: { user: null },
				error: { message: 'Invalid JWT' }
			};

			const event = makeEvent();
			await handle({ event: event as never, resolve: resolve as never });

			const result = await event.locals.safeGetSession!();
			expect(result).toEqual({ session: null, user: null });
		});
	});

	// ── filterSerializedResponseHeaders ───────────────────────────────────────

	describe('filterSerializedResponseHeaders', () => {
		async function getFilter() {
			const event = makeEvent();
			await handle({ event: event as never, resolve: resolve as never });
			expect(lastResolveOpts).toBeDefined();
			expect(lastResolveOpts?.filterSerializedResponseHeaders).toBeDefined();
			return lastResolveOpts!.filterSerializedResponseHeaders!;
		}

		test('returns true for content-range', async () => {
			const filter = await getFilter();
			expect(filter('content-range')).toBe(true);
		});

		test('returns true for x-supabase-api-version', async () => {
			const filter = await getFilter();
			expect(filter('x-supabase-api-version')).toBe(true);
		});

		test('returns false for authorization', async () => {
			const filter = await getFilter();
			expect(filter('authorization')).toBe(false);
		});

		test('returns false for content-type', async () => {
			const filter = await getFilter();
			expect(filter('content-type')).toBe(false);
		});

		test('returns false for arbitrary custom headers', async () => {
			const filter = await getFilter();
			expect(filter('x-my-custom-header')).toBe(false);
		});
	});
});
