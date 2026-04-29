import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @supabase/ssr before any module imports
const createServerClientMock = vi.hoisted(() => vi.fn());

vi.mock('@supabase/ssr', () => ({
	createServerClient: createServerClientMock
}));

vi.mock('$env/static/public', () => ({
	PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
	PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
}));

// Mutable state shared between tests via closures captured by the mock
type Session = { access_token: string } | null;
type User = { id: string; email?: string } | null;
type CookieEntry = { name: string; value: string };
type SetAllEntry = { name: string; value: string; options: Record<string, unknown> };

let mockSession: Session = null;
let mockGetUserResult: { data: { user: User }; error: unknown } = {
	data: { user: null },
	error: null
};
let capturedGetAll: (() => CookieEntry[]) | null = null;
let capturedSetAll: ((entries: SetAllEntry[]) => void) | null = null;

createServerClientMock.mockImplementation(
	(
		_url: string,
		_key: string,
		opts: {
			cookies: {
				getAll: () => CookieEntry[];
				setAll: (e: SetAllEntry[]) => void;
			};
		}
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
);

import { handle } from './hooks.server';

// Minimal SvelteKit event
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

type ResolveOpts = { filterSerializedResponseHeaders?: (name: string) => boolean };
let lastResolveOpts: ResolveOpts | undefined;

async function resolve(_event: unknown, opts?: ResolveOpts): Promise<Response> {
	lastResolveOpts = opts;
	return new Response('ok', { status: 200 });
}

describe('handle (hooks.server.ts)', () => {
	beforeEach(() => {
		mockSession = null;
		mockGetUserResult = { data: { user: null }, error: null };
		capturedGetAll = null;
		capturedSetAll = null;
		lastResolveOpts = undefined;
		createServerClientMock.mockClear();
	});

	it('attaches supabase client to event.locals', async () => {
		const event = makeEvent();
		await handle({ event: event as never, resolve: resolve as never });
		expect(event.locals.supabase).toBeDefined();
	});

	it('attaches safeGetSession function to event.locals', async () => {
		const event = makeEvent();
		await handle({ event: event as never, resolve: resolve as never });
		expect(typeof event.locals.safeGetSession).toBe('function');
	});

	it('calls resolve and returns the response', async () => {
		const event = makeEvent();
		const response = await handle({ event: event as never, resolve: resolve as never });
		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(200);
	});

	it('passes filterSerializedResponseHeaders callback to resolve', async () => {
		const event = makeEvent();
		await handle({ event: event as never, resolve: resolve as never });
		expect(typeof lastResolveOpts?.filterSerializedResponseHeaders).toBe('function');
	});

	describe('cookie proxy passed to createServerClient', () => {
		it('getAll returns cookies from the event', async () => {
			const event = makeEvent({ 'sb-auth-token': 'tok123' });
			await handle({ event: event as never, resolve: resolve as never });
			expect(capturedGetAll).not.toBeNull();
			const cookies = capturedGetAll!();
			expect(cookies).toContainEqual({ name: 'sb-auth-token', value: 'tok123' });
		});

		it('setAll writes cookies back to the event with path "/"', async () => {
			const event = makeEvent();
			await handle({ event: event as never, resolve: resolve as never });
			expect(capturedSetAll).not.toBeNull();
			capturedSetAll!([{ name: 'sb-token', value: 'new-tok', options: { httpOnly: true } }]);
			const stored = event.cookies.getAll().find((c) => c.name === 'sb-token');
			expect(stored?.value).toBe('new-tok');
		});

		it('merges path "/" into cookie options', async () => {
			const event = makeEvent();
			await handle({ event: event as never, resolve: resolve as never });
			capturedSetAll!([{ name: 'sb-refresh', value: 'rtok', options: { secure: true } }]);
			const entry = event.cookies._store.get('sb-refresh');
			expect((entry?.options as Record<string, unknown>)?.path).toBe('/');
			expect((entry?.options as Record<string, unknown>)?.secure).toBe(true);
		});
	});

	describe('safeGetSession', () => {
		it('returns {session:null, user:null} when there is no session', async () => {
			mockSession = null;
			const event = makeEvent();
			await handle({ event: event as never, resolve: resolve as never });
			const result = await event.locals.safeGetSession!();
			expect(result).toEqual({ session: null, user: null });
		});

		it('returns session and user when JWT is valid', async () => {
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
			expect((result.user as User)?.id).toBe('user-1');
		});

		it('returns {session:null, user:null} when getUser returns an error', async () => {
			mockSession = { access_token: 'tampered-jwt' };
			mockGetUserResult = { data: { user: null }, error: { message: 'Invalid JWT' } };
			const event = makeEvent();
			await handle({ event: event as never, resolve: resolve as never });
			const result = await event.locals.safeGetSession!();
			expect(result).toEqual({ session: null, user: null });
		});
	});

	describe('filterSerializedResponseHeaders', () => {
		async function getFilter() {
			const event = makeEvent();
			await handle({ event: event as never, resolve: resolve as never });
			return lastResolveOpts!.filterSerializedResponseHeaders!;
		}

		it('returns true for content-range', async () => {
			const filter = await getFilter();
			expect(filter('content-range')).toBe(true);
		});

		it('returns true for x-supabase-api-version', async () => {
			const filter = await getFilter();
			expect(filter('x-supabase-api-version')).toBe(true);
		});

		it('returns false for authorization', async () => {
			const filter = await getFilter();
			expect(filter('authorization')).toBe(false);
		});

		it('returns false for content-type', async () => {
			const filter = await getFilter();
			expect(filter('content-type')).toBe(false);
		});

		it('returns false for arbitrary custom headers', async () => {
			const filter = await getFilter();
			expect(filter('x-my-custom-header')).toBe(false);
		});
	});
});
