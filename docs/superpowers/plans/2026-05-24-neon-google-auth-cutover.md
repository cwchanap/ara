# Neon Google Auth Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase password auth with a clean Google-only Neon Auth flow while keeping the current SvelteKit + Drizzle protected-route model.

**Architecture:** Use a small local auth boundary so the rest of the app keeps calling `locals.safeGetSession()`. The first task verifies the exact `@neondatabase/auth` server/client contract because Neon Auth is still moving quickly and its documented first-class server helper is Next.js-specific. After that, remove password-specific routes/actions/UI, auto-provision `profiles` rows for Neon Auth users, and keep saved/share ownership checks on authenticated user IDs.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Bun, Vitest, Drizzle ORM, Neon PostgreSQL, `@neondatabase/auth`, Google OAuth.

---

## Reference Material

- Approved spec: `docs/superpowers/specs/2026-05-24-neon-google-auth-design.md`
- Neon Auth package README: https://github.com/neondatabase/neon-js/blob/main/packages/auth/README.md
- Neon Auth OAuth guide: https://neon.com/docs/auth/guides/setup-oauth
- Neon Auth SDK migration guide: https://neon.com/docs/auth/migrate/from-auth-v0.1
- Current auth files:
  - `src/hooks.server.ts`
  - `src/app.d.ts`
  - `src/lib/supabase.ts`
  - `src/lib/server/supabase-admin.ts`
  - `src/routes/login/+page.server.ts`
  - `src/routes/login/+page.svelte`
  - `src/routes/signup/+page.server.ts`
  - `src/routes/signup/+page.svelte`
  - `src/routes/profile/+page.server.ts`
  - `src/routes/profile/+page.svelte`
  - `src/routes/+layout.server.ts`
  - `src/routes/+layout.svelte`
  - `src/routes/api/share/+server.ts`

## File Structure

- Create `src/lib/auth/redirects.ts`: shared safe redirect parsing for login/signup/auth callback paths.
- Create `src/lib/auth/types.ts`: shared Neon Auth user/session types and session normalization.
- Create `src/lib/auth/neon.ts`: client-safe re-export of shared Neon Auth types/helpers.
- Create `src/lib/auth/neon.server.ts`: server-only Neon Auth client factory and auth URL resolution.
- Create `src/lib/server/profile-provisioning.ts`: profile auto-create and username generation logic.
- Modify `src/hooks.server.ts`: replace Supabase client setup with Neon Auth session setup.
- Modify `src/app.d.ts`: replace Supabase `Session`/`User`/client local types with local Neon session/user shapes.
- Modify `src/routes/login/+page.server.ts`: authenticated redirect and Google OAuth start action only.
- Modify `src/routes/login/+page.svelte`: Google-only CTA and error display.
- Modify `src/routes/signup/+page.server.ts`: redirect to `/login`, preserving safe redirect params.
- Delete `src/routes/signup/+page.svelte`: no standalone signup form.
- Modify `src/routes/profile/+page.server.ts`: username update and sign-out only; remove password action.
- Modify `src/routes/profile/+page.svelte`: remove password card; keep account info and username edit.
- Modify `src/routes/+layout.server.ts`: keep session return, update dependency key from `supabase:auth` to `neon:auth`.
- Modify `src/routes/+layout.svelte`: remove Supabase browser client listener; one `Sign In` link.
- Modify `src/routes/api/share/+server.ts`: ensure profile row exists before inserting shared config.
- Delete `src/lib/supabase.ts` and `src/lib/server/supabase-admin.ts` after replacements compile.
- Update tests that currently mock Supabase session/client behavior.
- Update `src/test-setup.ts`, `AGENTS.md`, and `CLAUDE.md` to use Neon Auth env names.
- Modify `package.json` and lockfile through Bun dependency commands.

---

### Task 1: Pin The Neon Auth SDK Contract

**Files:**

- Modify: `package.json`
- Modify: `bun.lock`
- Create: `src/lib/auth/neon-contract.test.ts`

- [ ] **Step 1: Install the official Neon Auth SDK**

Run:

```bash
bun add @neondatabase/auth
```

Expected:

- `package.json` includes `@neondatabase/auth`.
- `bun.lock` updates.
- No application code is changed yet.

- [ ] **Step 2: Keep Supabase SDK packages until Supabase imports are removed**

Do not remove `@supabase/ssr` or `@supabase/supabase-js` in this task. Existing
production code still imports them until the server hook, browser layout, signup,
and Supabase admin cleanup tasks land.

Expected:

- `package.json` still includes `@supabase/ssr` and `@supabase/supabase-js`.
- The checkout remains type-checkable between tasks.
- Task 7 removes Supabase packages after the importing source files are gone.

- [ ] **Step 3: Add an SDK contract test**

Create `src/lib/auth/neon-contract.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test';

describe('@neondatabase/auth contract', () => {
	test('exports the vanilla auth client used by the SvelteKit adapter', async () => {
		const mod = await import('@neondatabase/auth');
		const vanilla = await import('@neondatabase/auth/vanilla');

		expect(typeof mod.createAuthClient).toBe('function');
		expect(typeof vanilla.SupabaseAuthAdapter).toBe('function');
	});

	test('supports Google OAuth through the default Better Auth API', async () => {
		const mod = await import('@neondatabase/auth');
		const auth = mod.createAuthClient('https://example.neonauth.invalid/auth');

		expect(typeof auth.signIn.social).toBe('function');
		expect(typeof auth.signOut).toBe('function');
		expect(typeof auth.getSession).toBe('function');
	});
});
```

- [ ] **Step 4: Run the contract test**

Run:

```bash
bun test src/lib/auth/neon-contract.test.ts
```

Expected:

- PASS.
- If this fails because the package API changed, stop and update this plan before touching auth code. The rest of the plan assumes `createAuthClient(url)` exposes `signIn.social`, `signOut`, and `getSession`.

- [ ] **Step 5: Commit the SDK contract slice**

Run:

```bash
git add package.json bun.lock src/lib/auth/neon-contract.test.ts
git commit -m "chore: add neon auth sdk"
```

Expected:

- Commit contains only dependency updates and the SDK contract test.

---

### Task 2: Add Shared Auth Types And Safe Redirect Helpers

**Files:**

- Create: `src/lib/auth/redirects.ts`
- Create: `src/lib/auth/redirects.test.ts`
- Create: `src/lib/auth/neon.ts`
- Create: `src/lib/auth/types.ts`
- Create: `src/lib/auth/neon.server.ts`
- Create: `src/lib/auth/neon.test.ts`
- Modify: `src/test-setup.ts`

- [ ] **Step 1: Write redirect helper tests**

Create `src/lib/auth/redirects.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test';
import { getSafeRedirectPath, withRedirectParam } from './redirects';

describe('getSafeRedirectPath', () => {
	test('uses fallback when redirect is missing', () => {
		expect(getSafeRedirectPath(null, '/app')).toBe('/app');
	});

	test('allows same-origin absolute paths', () => {
		expect(getSafeRedirectPath('/saved-configs', '/')).toBe('/saved-configs');
	});

	test('rejects absolute URLs', () => {
		expect(getSafeRedirectPath('https://evil.example', '/')).toBe('/');
	});

	test('rejects protocol-relative URLs', () => {
		expect(getSafeRedirectPath('//evil.example', '/')).toBe('/');
	});

	test('falls back to slash when base is empty', () => {
		expect(getSafeRedirectPath(null, '')).toBe('/');
	});
});

describe('withRedirectParam', () => {
	test('appends encoded safe redirect', () => {
		expect(withRedirectParam('/login', '/saved-configs')).toBe('/login?redirect=%2Fsaved-configs');
	});

	test('does not append fallback redirect', () => {
		expect(withRedirectParam('/login', '/')).toBe('/login');
	});
});
```

- [ ] **Step 2: Implement redirect helpers**

Create `src/lib/auth/redirects.ts`:

```typescript
export function getSafeRedirectPath(redirectParam: string | null, basePath: string): string {
	const fallback = basePath || '/';
	if (!redirectParam) return fallback;
	if (redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
		return redirectParam;
	}
	return fallback;
}

export function withRedirectParam(path: string, redirectPath: string): string {
	if (!redirectPath || redirectPath === '/') return path;
	return `${path}?redirect=${encodeURIComponent(redirectPath)}`;
}
```

- [ ] **Step 3: Run redirect helper tests**

Run:

```bash
bun test src/lib/auth/redirects.test.ts
```

Expected: PASS.

- [ ] **Step 4: Write Neon auth wrapper tests**

Create `src/lib/auth/neon.test.ts`:

```typescript
import { beforeEach, describe, expect, mock, test } from 'bun:test';

const createAuthClient = mock((url: string, config?: unknown) => ({
	url,
	config,
	signIn: {
		social: mock(async () => ({ data: null, error: null }))
	},
	signOut: mock(async () => ({ data: null, error: null })),
	getSession: mock(async () => ({ data: null, error: null }))
}));

mock.module('@neondatabase/auth', () => ({
	createAuthClient
}));

describe('neon auth wrapper', () => {
	beforeEach(() => {
		createAuthClient.mockClear();
		process.env.NEON_AUTH_BASE_URL = 'https://auth.example.test/auth';
	});

	test('creates an auth client from NEON_AUTH_BASE_URL', async () => {
		const { createNeonAuthClient } = await import('./neon.server');
		const client = createNeonAuthClient();

		expect(createAuthClient).toHaveBeenCalledWith('https://auth.example.test/auth', {
			fetchOptions: {
				headers: undefined
			}
		});
		expect(client).toHaveProperty('getSession');
	});

	test('passes request headers to the auth client fetch options', async () => {
		const headers = new Headers({ cookie: 'session=test-session' });

		const { createNeonAuthClient } = await import('./neon.server');
		createNeonAuthClient({ headers });

		expect(createAuthClient).toHaveBeenCalledWith('https://auth.example.test/auth', {
			fetchOptions: {
				headers: {
					cookie: 'session=test-session'
				}
			}
		});
	});

	test('throws when auth URL is missing', async () => {
		delete process.env.NEON_AUTH_BASE_URL;
		delete process.env.VITE_NEON_AUTH_URL;
		delete process.env.PUBLIC_NEON_AUTH_URL;

		const { getNeonAuthUrl } = await import('./neon.server');
		expect(() => getNeonAuthUrl()).toThrow(
			'NEON_AUTH_BASE_URL, VITE_NEON_AUTH_URL, or PUBLIC_NEON_AUTH_URL is required'
		);
	});
});
```

- [ ] **Step 5: Implement Neon auth wrapper**

Create `src/lib/auth/types.ts` and keep `src/lib/auth/neon.ts` as a client-safe re-export:

```typescript
export interface NeonAuthUser {
	id: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
	user_metadata?: Record<string, unknown> | null;
}

export interface NeonAuthSession {
	user: NeonAuthUser;
	session?: unknown;
	accessToken?: string | null;
	expiresAt?: number | null;
}

export type SafeSessionResult = {
	session: NeonAuthSession | null;
	user: NeonAuthUser | null;
};

export function normalizeSession(rawSession: unknown): SafeSessionResult {
	if (!rawSession || typeof rawSession !== 'object') {
		return { session: null, user: null };
	}

	const maybeSession = rawSession as { user?: NeonAuthUser | null };
	if (!maybeSession.user?.id) {
		return { session: null, user: null };
	}

	const session = rawSession as NeonAuthSession;
	return { session, user: maybeSession.user };
}
```

```typescript
export * from './types';
```

Create `src/lib/auth/neon.server.ts` for server-only client creation:

```typescript
import { createAuthClient } from '@neondatabase/auth';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export type NeonAuthClient = ReturnType<typeof createAuthClient>;

export type CreateNeonAuthClientOptions = {
	headers?: HeadersInit;
};

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> | undefined {
	if (!headers) return undefined;
	return Object.fromEntries(new Headers(headers).entries());
}

export function getNeonAuthUrl(): string {
	const url =
		privateEnv.NEON_AUTH_BASE_URL ||
		privateEnv.VITE_NEON_AUTH_URL ||
		publicEnv.PUBLIC_NEON_AUTH_URL;

	if (!url) {
		throw new Error('NEON_AUTH_BASE_URL, VITE_NEON_AUTH_URL, or PUBLIC_NEON_AUTH_URL is required');
	}

	return url;
}

export function createNeonAuthClient(options: CreateNeonAuthClientOptions = {}): NeonAuthClient {
	return createAuthClient(getNeonAuthUrl(), {
		fetchOptions: {
			headers: normalizeHeaders(options.headers)
		}
	} as unknown as Parameters<typeof createAuthClient>[1]);
}
```

- [ ] **Step 6: Add dynamic public env test stub**

Modify `src/test-setup.ts` by adding this virtual module near the existing `$env/dynamic/private` stub. The public stub must expose only `PUBLIC_*` variables:

```typescript
build.module('$env/dynamic/public', () => ({
	contents: `
export const env = new Proxy({}, {
  get(_target, key) {
    if (typeof key !== 'string' || !key.startsWith('PUBLIC_')) return undefined;
    return process.env[key];
  }
});
`,
	loader: 'js'
}));
```

- [ ] **Step 7: Run auth helper tests**

Run:

```bash
bun test src/lib/auth/redirects.test.ts src/lib/auth/neon.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit auth helpers**

Run:

```bash
git add src/lib/auth/redirects.ts src/lib/auth/redirects.test.ts src/lib/auth/neon.ts src/lib/auth/types.ts src/lib/auth/neon.server.ts src/lib/auth/neon.test.ts src/test-setup.ts
git commit -m "feat: add neon auth helpers"
```

Expected:

- Commit contains helper modules and tests only.

---

### Task 3: Replace App Auth Locals And Server Hook

**Files:**

- Modify: `src/app.d.ts`
- Modify: `src/hooks.server.ts`
- Modify: `src/hooks.server.test.ts`
- Modify: `src/routes/+layout.server.ts`
- Modify: `src/routes/layout.server.test.ts`

- [ ] **Step 1: Update app type definitions**

Replace the Supabase imports and locals in `src/app.d.ts` with:

```typescript
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { NeonAuthSession, NeonAuthUser, SafeSessionResult } from '$lib/auth/neon';
import type { NeonAuthClient } from '$lib/auth/neon.server';
import type { Profile } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			neonAuth: NeonAuthClient;
			safeGetSession: () => Promise<SafeSessionResult>;
		}
		interface PageData {
			session: NeonAuthSession | null;
			user: NeonAuthUser | null;
			profile?: Profile | null;
		}
	}
}

export type { Profile };
export {};
```

- [ ] **Step 2: Replace server hook implementation**

Replace `src/hooks.server.ts` with:

```typescript
import { type Handle } from '@sveltejs/kit';
import { normalizeSession } from '$lib/auth/neon';
import { createNeonAuthClient } from '$lib/auth/neon.server';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.neonAuth = createNeonAuthClient({ headers: event.request.headers });

	event.locals.safeGetSession = async () => {
		const { data, error } = await event.locals.neonAuth.getSession();

		if (error) {
			return { session: null, user: null };
		}

		return normalizeSession(data);
	};

	return resolve(event);
};
```

- [ ] **Step 3: Update hook tests to mock Neon Auth**

In `src/hooks.server.test.ts`, replace Supabase-specific assertions with this core test shape:

```typescript
import { beforeEach, describe, expect, mock, test } from 'bun:test';

const getSession = mock(async () => ({
	data: { user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' } },
	error: null
}));

mock.module('$lib/auth/neon', () => ({
	normalizeSession: (data: unknown) => {
		const session = data as { user?: { id: string; email?: string; name?: string } };
		return session?.user?.id ? { session, user: session.user } : { session: null, user: null };
	}
}));

mock.module('$lib/auth/neon.server', () => ({
	createNeonAuthClient: ({ headers }: { headers?: HeadersInit } = {}) => ({ getSession, headers })
}));

describe('hooks.server', () => {
	beforeEach(() => {
		getSession.mockClear();
	});

	test('sets neonAuth and safeGetSession on locals', async () => {
		const { handle } = await import('./hooks.server');
		const event = { locals: {} } as App.RequestEvent;
		const resolve = mock(async () => new Response('ok'));

		await handle({ event, resolve });

		expect(event.locals.neonAuth).toBeDefined();
		const result = await event.locals.safeGetSession();
		expect(result.user?.id).toBe('user-1');
	});
});
```

- [ ] **Step 4: Update layout server dependency key**

Modify `src/routes/+layout.server.ts`:

```typescript
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('neon:auth');

	const { session, user } = await locals.safeGetSession();

	return {
		session,
		user
	};
};
```

- [ ] **Step 5: Update layout server tests**

Update `src/routes/layout.server.test.ts` expectations so the mocked `depends` receives `neon:auth`:

```typescript
expect(dependsMock).toHaveBeenCalledWith('neon:auth');
```

- [ ] **Step 6: Run hook and layout tests**

Run:

```bash
bun test src/hooks.server.test.ts src/routes/layout.server.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit server auth boundary**

Run:

```bash
git add src/app.d.ts src/hooks.server.ts src/hooks.server.test.ts src/routes/+layout.server.ts src/routes/layout.server.test.ts
git commit -m "feat: replace auth locals with neon auth"
```

Expected:

- Commit contains only type, hook, and layout server boundary changes.

---

### Task 4: Add Profile Auto-Provisioning

**Files:**

- Create: `src/lib/server/profile-provisioning.ts`
- Create: `src/lib/server/profile-provisioning.test.ts`

- [ ] **Step 1: Write profile provisioning tests**

Create `src/lib/server/profile-provisioning.test.ts`:

```typescript
import { beforeEach, describe, expect, mock, test } from 'bun:test';

const selectRows: unknown[][] = [];
const insertedValues: unknown[] = [];

const db = {
	select: mock(() => ({
		from: () => ({
			where: () => ({
				limit: async () => selectRows.shift() ?? []
			})
		})
	})),
	insert: mock(() => ({
		values: async (value: unknown) => {
			insertedValues.push(value);
			return undefined;
		}
	}))
};

mock.module('$lib/server/db', () => ({
	db,
	profiles: { id: 'id', username: 'username' }
}));

mock.module('drizzle-orm', () => ({
	eq: (...args: unknown[]) => args
}));

describe('profile provisioning', () => {
	beforeEach(() => {
		selectRows.length = 0;
		insertedValues.length = 0;
		db.select.mockClear();
		db.insert.mockClear();
	});

	test('returns existing profile without inserting', async () => {
		const existing = { id: 'user-1', username: 'ada' };
		selectRows.push([existing]);

		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser({ id: 'user-1', email: 'ada@example.com' });

		expect(result).toEqual(existing);
		expect(db.insert).not.toHaveBeenCalled();
	});

	test('creates a sanitized username from display name', async () => {
		selectRows.push([], []);

		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser({
			id: 'user-2',
			email: 'grace@example.com',
			name: 'Grace Hopper'
		});

		expect(result.username).toBe('grace_hopper');
		expect(insertedValues).toContainEqual({ id: 'user-2', username: 'grace_hopper' });
	});

	test('falls back to email local part', async () => {
		selectRows.push([], []);

		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser({ id: 'user-3', email: 'Alan.Turing@example.com' });

		expect(result.username).toBe('alan_turing');
	});

	test('adds a suffix when username is taken', async () => {
		selectRows.push([], [{ id: 'other-user' }], []);

		const { ensureProfileForUser } = await import('./profile-provisioning');
		const result = await ensureProfileForUser({
			id: 'user-4',
			email: 'ada@example.com',
			name: 'Ada'
		});

		expect(result.username).toBe('ada_1');
	});
});
```

- [ ] **Step 2: Implement profile provisioning helper**

Create `src/lib/server/profile-provisioning.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { db, profiles } from '$lib/server/db';
import type { NeonAuthUser } from '$lib/auth/neon';
import type { Profile } from '$lib/types';

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

function sanitizeUsername(value: string): string {
	const sanitized = value
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.replace(/_+/g, '_')
		.slice(0, 30);

	if (USERNAME_PATTERN.test(sanitized)) return sanitized;
	if (sanitized.length >= 3) return sanitized.slice(0, 30);
	return 'chaos_user';
}

function deriveBaseUsername(user: NeonAuthUser): string {
	const metadataName =
		typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : undefined;
	const source = user.name || metadataName || user.email?.split('@')[0] || 'chaos_user';
	return sanitizeUsername(source);
}

async function findProfileById(userId: string): Promise<Profile | null> {
	const rows = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
	return rows[0] ?? null;
}

async function isUsernameTaken(username: string, userId: string): Promise<boolean> {
	const rows = await db
		.select({ id: profiles.id })
		.from(profiles)
		.where(eq(profiles.username, username))
		.limit(1);
	return rows.length > 0 && rows[0].id !== userId;
}

export async function ensureProfileForUser(user: NeonAuthUser): Promise<Profile> {
	const existing = await findProfileById(user.id);
	if (existing) return existing;

	const base = deriveBaseUsername(user);
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const suffix = attempt === 0 ? '' : `_${attempt}`;
		const username = `${base.slice(0, 30 - suffix.length)}${suffix}`;

		if (await isUsernameTaken(username, user.id)) {
			continue;
		}

		await db.insert(profiles).values({
			id: user.id,
			username
		});

		const created = await findProfileById(user.id);
		if (created) return created;

		return {
			id: user.id,
			username,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
	}

	throw new Error('Unable to create a unique profile username');
}
```

- [ ] **Step 3: Run profile provisioning tests**

Run:

```bash
bun test src/lib/server/profile-provisioning.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit profile provisioning**

Run:

```bash
git add src/lib/server/profile-provisioning.ts src/lib/server/profile-provisioning.test.ts
git commit -m "feat: auto-provision neon auth profiles"
```

Expected:

- Commit contains only profile provisioning helper and tests.

---

### Task 5: Replace Server Route Behavior

**Files:**

- Modify: `src/routes/login/+page.server.ts`
- Modify: `src/routes/login/page.server.test.ts`
- Modify: `src/routes/signup/+page.server.ts`
- Modify: `src/routes/signup/page.server.test.ts`
- Modify: `src/routes/profile/+page.server.ts`
- Modify: `src/routes/profile/page.server.test.ts`
- Modify: `src/routes/api/share/+server.ts`
- Modify: `src/routes/api/share/server.test.ts`

- [ ] **Step 1: Update login server tests for Google-only auth**

In `src/routes/login/page.server.test.ts`, replace password action cases with tests shaped like:

```typescript
test('starts Google OAuth with safe redirect path', async () => {
	const signInSocial = mock(async () => ({ error: null }));
	const locals = {
		safeGetSession: async () => ({ session: null, user: null }),
		neonAuth: { signIn: { social: signInSocial } }
	} as unknown as App.Locals;

	await expect(
		actions.default({
			request: new Request('http://localhost/login?redirect=%2Fsaved-configs', {
				method: 'POST',
				body: new FormData()
			}),
			locals,
			url: new URL('http://localhost/login?redirect=%2Fsaved-configs')
		} as never)
	).rejects.toMatchObject({ status: 303, location: '/saved-configs' });

	expect(signInSocial).toHaveBeenCalledWith({
		provider: 'google',
		callbackURL: '/saved-configs'
	});
});
```

- [ ] **Step 2: Replace login server action**

Replace `src/routes/login/+page.server.ts` with:

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { base } from '$app/paths';
import { getSafeRedirectPath } from '$lib/auth/redirects';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();
	if (session) {
		throw redirect(303, getSafeRedirectPath(url.searchParams.get('redirect'), base || '/'));
	}
	return {
		redirectTo: getSafeRedirectPath(url.searchParams.get('redirect'), base || '/')
	};
};

export const actions: Actions = {
	default: async ({ locals, url }) => {
		const redirectTo = getSafeRedirectPath(url.searchParams.get('redirect'), base || '/');
		const result = await locals.neonAuth.signIn.social({
			provider: 'google',
			callbackURL: redirectTo
		});

		if (result && typeof result === 'object' && 'error' in result && result.error) {
			return fail(400, { error: 'Google sign-in failed. Please try again.' });
		}

		throw redirect(303, redirectTo);
	}
};
```

- [ ] **Step 3: Update signup server to redirect**

Replace `src/routes/signup/+page.server.ts` with:

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { base } from '$app/paths';
import { getSafeRedirectPath, withRedirectParam } from '$lib/auth/redirects';

export const load: PageServerLoad = async ({ url }) => {
	const redirectTo = getSafeRedirectPath(url.searchParams.get('redirect'), base || '/');
	throw redirect(303, `${base}/login${withRedirectParam('', redirectTo)}`);
};
```

- [ ] **Step 4: Update signup tests**

In `src/routes/signup/page.server.test.ts`, replace form-action tests with:

```typescript
test('redirects signup to login', async () => {
	await expect(load({ url: new URL('http://localhost/signup') } as never)).rejects.toMatchObject({
		status: 303,
		location: '/login'
	});
});

test('preserves safe redirect param', async () => {
	await expect(
		load({ url: new URL('http://localhost/signup?redirect=%2Fsaved-configs') } as never)
	).rejects.toMatchObject({
		status: 303,
		location: '/login?redirect=%2Fsaved-configs'
	});
});
```

- [ ] **Step 5: Update profile server action tests**

In `src/routes/profile/page.server.test.ts`, remove `changePassword` tests and add:

```typescript
test('load auto-provisions a missing profile', async () => {
	const ensureProfileForUser = mock(async () => ({
		id: 'user-1',
		username: 'ada',
		createdAt: '2026-05-24T00:00:00.000Z',
		updatedAt: '2026-05-24T00:00:00.000Z'
	}));

	mock.module('$lib/server/profile-provisioning', () => ({ ensureProfileForUser }));

	const result = await load({
		locals: {
			safeGetSession: async () => ({
				session: { user: { id: 'user-1', email: 'ada@example.com' } },
				user: { id: 'user-1', email: 'ada@example.com' }
			})
		},
		url: new URL('http://localhost/profile')
	} as never);

	expect(result.profile?.username).toBe('ada');
	expect(ensureProfileForUser).toHaveBeenCalled();
});
```

- [ ] **Step 6: Update profile server implementation**

Modify `src/routes/profile/+page.server.ts`:

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getErrorMessage, validateUsername } from '$lib/auth-errors';
import { db, profiles } from '$lib/server/db';
import { ensureProfileForUser } from '$lib/server/profile-provisioning';
import { eq } from 'drizzle-orm';
import { base } from '$app/paths';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		throw redirect(303, `${base}/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	const profile = await ensureProfileForUser(user);
	return { session, user, profile };
};

export const actions: Actions = {
	update: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			return fail(401, { updateError: 'You must be signed in to update your profile' });
		}

		const formData = await request.formData();
		const username = formData.get('username') as string;
		const usernameError = validateUsername(username);
		if (usernameError) {
			return fail(400, { updateError: usernameError, username });
		}

		const existingProfile = await db
			.select({ id: profiles.id })
			.from(profiles)
			.where(eq(profiles.username, username))
			.limit(1);

		if (existingProfile.length > 0 && existingProfile[0].id !== user.id) {
			return fail(400, { updateError: 'This username is already taken', username });
		}

		try {
			const result = await db
				.update(profiles)
				.set({ username })
				.where(eq(profiles.id, user.id))
				.returning({ id: profiles.id });

			if (result.length === 0) {
				await db.insert(profiles).values({ id: user.id, username });
			}
		} catch (error) {
			return fail(400, { updateError: getErrorMessage(error), username });
		}

		return { updateSuccess: true, username };
	},

	signout: async ({ locals }) => {
		const result = await locals.neonAuth.signOut();
		if (result && typeof result === 'object' && 'error' in result && result.error) {
			console.error('Error signing out:', result.error);
		}
		throw redirect(303, `${base}/login`);
	}
};
```

- [ ] **Step 7: Ensure share creation has a profile row**

Modify `src/routes/api/share/+server.ts`:

```typescript
import { ensureProfileForUser } from '$lib/server/profile-provisioning';

// After the authenticated session check:
await ensureProfileForUser(user);
```

Keep this directly after:

```typescript
if (!session || !user) {
	throw error(HTTP_STATUS.UNAUTHORIZED, 'Please sign in to share configurations');
}
```

- [ ] **Step 8: Run server route tests**

Run:

```bash
bun test src/routes/login/page.server.test.ts src/routes/signup/page.server.test.ts src/routes/profile/page.server.test.ts src/routes/api/share/server.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit server route changes**

Run:

```bash
git add src/routes/login/+page.server.ts src/routes/login/page.server.test.ts src/routes/signup/+page.server.ts src/routes/signup/page.server.test.ts src/routes/profile/+page.server.ts src/routes/profile/page.server.test.ts src/routes/api/share/+server.ts src/routes/api/share/server.test.ts
git commit -m "feat: switch server routes to google auth"
```

Expected:

- Commit contains server route behavior only.

---

### Task 6: Replace Auth UI Surfaces

**Files:**

- Modify: `src/routes/login/+page.svelte`
- Delete: `src/routes/signup/+page.svelte`
- Modify: `src/routes/profile/+page.svelte`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/auth-pages.vitest.ts`
- Modify: `src/routes/account-pages.vitest.ts`
- Modify: `src/routes/layout.vitest.ts`

- [ ] **Step 1: Update UI tests for one auth CTA**

Update auth/page Vitest assertions to look for:

```typescript
expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument();
```

Update layout Vitest assertions to look for:

```typescript
expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
expect(screen.queryByRole('link', { name: /^sign up$/i })).not.toBeInTheDocument();
```

Update profile page assertions to look for:

```typescript
expect(screen.queryByText(/change password/i)).not.toBeInTheDocument();
expect(screen.getByRole('textbox', { name: /username/i })).toBeInTheDocument();
```

- [ ] **Step 2: Replace login page markup**

In `src/routes/login/+page.svelte`, remove email/password state and render one enhanced form:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';

	let { form, data } = $props();
	let isLoading = $state(false);
</script>

<div class="flex min-h-[calc(100vh-12rem)] items-center justify-center">
	<div class="w-full max-w-md">
		<div class="mb-8 text-center">
			<h1 class="font-['Orbitron'] text-3xl font-bold tracking-wider text-primary mb-2">
				SYSTEM_SIGN_IN
			</h1>
			<p class="text-muted-foreground">Access your chaos visualizations with Google</p>
		</div>

		<div class="relative bg-card/50 backdrop-blur-sm border border-primary/20 rounded-lg p-8">
			<div class="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
			<div class="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
			<div class="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
			<div class="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary"></div>

			{#if form?.error}
				<div
					class="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm"
				>
					{form.error}
				</div>
			{/if}

			<form
				method="POST"
				use:enhance={() => {
					isLoading = true;
					return async ({ update }) => {
						await update();
						isLoading = false;
					};
				}}
			>
				<input type="hidden" name="redirectTo" value={data?.redirectTo ?? '/'} />
				<button
					type="submit"
					disabled={isLoading}
					class="w-full py-3 px-4 bg-primary text-primary-foreground font-['Orbitron'] font-medium rounded-md uppercase tracking-wider hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
				>
					{isLoading ? 'Connecting...' : 'Continue with Google'}
				</button>
			</form>
		</div>
	</div>
</div>
```

- [ ] **Step 3: Remove signup page component**

Run:

```bash
git rm src/routes/signup/+page.svelte
```

Expected:

- The server load still redirects `/signup` to `/login`.

- [ ] **Step 4: Remove profile password UI**

In `src/routes/profile/+page.svelte`:

- Remove `currentPassword`, `newPassword`, `confirmPassword`, `isChangingPassword`, `passwordError`, `passwordSuccess`, `passwordWarning`.
- Remove password-related timeout variables and cleanup.
- Remove `validateNewPassword`.
- Remove form response handling for `passwordSuccess`, `passwordWarning`, and `passwordError`.
- Delete the entire `Change Password` card.
- Keep username update behavior unchanged.

- [ ] **Step 5: Simplify layout auth state handling**

In `src/routes/+layout.svelte`:

- Remove `createClient` import and `supabase` variable.
- Remove `onAuthStateChange` subscription setup.
- Keep `invalidate` only if still used by enhanced logout; otherwise remove it.
- Replace unauthenticated nav with:

```svelte
<a
	href="{base}/login"
	class="text-sm uppercase tracking-widest text-primary hover:text-primary/80 transition-colors font-medium"
>
	Sign In
</a>
```

- Update session expired text to `Your session has expired. Redirecting to sign in...` if the notification remains.

- [ ] **Step 6: Run UI tests**

Run:

```bash
bun run test:unit -- src/routes/auth-pages.vitest.ts src/routes/account-pages.vitest.ts src/routes/layout.vitest.ts
```

Expected: PASS.

- [ ] **Step 7: Commit UI changes**

Run:

```bash
git add src/routes/login/+page.svelte src/routes/signup/+page.svelte src/routes/profile/+page.svelte src/routes/+layout.svelte src/routes/auth-pages.vitest.ts src/routes/account-pages.vitest.ts src/routes/layout.vitest.ts
git commit -m "feat: replace password auth ui with google sign in"
```

Expected:

- Commit removes signup component and password UI.

---

### Task 7: Remove Supabase Support Code And Update Docs

**Files:**

- Delete: `src/lib/supabase.ts`
- Delete: `src/lib/supabase.vitest.ts`
- Delete: `src/lib/server/supabase-admin.ts`
- Delete: `src/lib/server/supabase-admin.vitest.ts`
- Modify: `src/test-setup.ts`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Remove Supabase source and tests**

Run:

```bash
git rm src/lib/supabase.ts src/lib/supabase.vitest.ts src/lib/server/supabase-admin.ts src/lib/server/supabase-admin.vitest.ts
```

Expected:

- Supabase client/admin files are removed.

- [ ] **Step 2: Remove Supabase env stubs from Bun setup**

In `src/test-setup.ts`, replace the `$env/static/public` stub contents with:

```typescript
build.module('$env/static/public', () => ({
	contents: `
export const PUBLIC_NEON_AUTH_URL = process.env.PUBLIC_NEON_AUTH_URL ?? 'https://auth.example.test/auth';
`,
	loader: 'js'
}));
```

- [ ] **Step 3: Update repository docs**

In `AGENTS.md` and `CLAUDE.md`, replace the auth/database sections with this content:

```markdown
- **Authentication**: Neon Auth with Google OAuth only
- **Database**: Neon PostgreSQL with Drizzle ORM
```

Replace the auth environment variable list with:

```markdown
- `NEON_AUTH_BASE_URL`: Neon Auth server URL
- `VITE_NEON_AUTH_URL` or `PUBLIC_NEON_AUTH_URL`: public Neon Auth URL for browser OAuth start
- `DATABASE_URL`: Neon PostgreSQL connection string
- `NETLIFY_DATABASE_URL`: Alternative to DATABASE_URL when deployed to Netlify
```

Replace protected route guidance with:

```markdown
**Protected routes**: Use `locals.safeGetSession()` and redirect unauthenticated users to `/login?redirect={currentPath}`.
```

Remove password-change guidance.

- [ ] **Step 4: Verify no Supabase references remain in source**

Run:

```bash
rg -n "supabase|Supabase|PUBLIC_SUPABASE|SUPABASE_" src package.json AGENTS.md CLAUDE.md
```

Expected:

- No matches.
- If matches remain in historical comments or tests, update the copy or delete the obsolete test.

- [ ] **Step 5: Run docs/source cleanup tests**

Run:

```bash
bun test src/lib/auth/neon-contract.test.ts src/lib/auth/neon.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit cleanup**

Run:

```bash
git add src/test-setup.ts AGENTS.md CLAUDE.md package.json bun.lock
git add -u src/lib
git commit -m "chore: remove supabase auth support"
```

Expected:

- Commit removes Supabase files and docs references.

---

### Task 8: Full Verification And Final Auth Smoke

**Files:**

- Modify only files needed to fix failures found by verification.

- [ ] **Step 1: Run Bun tests**

Run:

```bash
bun test
```

Expected: PASS.

- [ ] **Step 2: Run Vitest component tests**

Run:

```bash
bun run test:unit
```

Expected: PASS.

- [ ] **Step 3: Run Svelte type check**

Run:

```bash
bun run check
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
bun run build
```

Expected: PASS.

- [ ] **Step 5: Start local dev server for manual auth-surface smoke**

Run:

```bash
bun run dev -- --host 127.0.0.1 --port 5173
```

Expected:

- Dev server starts on `http://127.0.0.1:5173`.

- [ ] **Step 6: Browser smoke unauthenticated auth surface**

Open `http://127.0.0.1:5173/login`.

Expected:

- Page shows `SYSTEM_SIGN_IN`.
- Page shows one `Continue with Google` button.
- Page does not show email, password, or signup form inputs.

- [ ] **Step 7: Browser smoke protected redirects**

Open `http://127.0.0.1:5173/saved-configs`.

Expected:

- Browser redirects to `/login?redirect=%2Fsaved-configs`.
- The login page still shows only Google sign-in.

- [ ] **Step 8: Commit verification fixes if any**

If verification required code changes, run:

```bash
git add <changed-files>
git commit -m "fix: stabilize neon auth cutover"
```

Expected:

- No commit is created if verification required no changes.

---

## Self-Review Checklist

- Spec coverage: password login/signup removal is covered by Tasks 5-7; Neon Auth dependency and session boundary are covered by Tasks 1-3; profile auto-provisioning is covered by Task 4; share/profile foreign-key behavior is covered by Task 5; docs/env cleanup is covered by Task 7; verification is covered by Task 8.
- Red-flag scan: the plan contains no open markers, incomplete task descriptions, or unspecified test commands.
- Type consistency: `NeonAuthUser`, `NeonAuthSession`, `SafeSessionResult`, and `locals.neonAuth` are introduced in Task 2 and wired into `App.Locals` in Task 3 before route tasks use them.
- Known risk: the SDK contract task is mandatory because official Neon Auth docs currently emphasize Next.js server helpers, while this app is SvelteKit. Do not skip Task 1.
