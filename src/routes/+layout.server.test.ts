/**
 * Tests for the root layout server load function.
 *
 * The layout load is intentionally minimal: it registers a Supabase auth
 * dependency and passes the session/user from safeGetSession to the page.
 */

import { describe, expect, mock, test } from 'bun:test';

const { load } = await import('./+layout.server');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent({
	session = null,
	user = null
}: {
	session?: Record<string, unknown> | null;
	user?: Record<string, unknown> | null;
} = {}) {
	return {
		locals: {
			safeGetSession: async () => ({ session, user })
		},
		depends: mock(() => {})
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('layout server load', () => {
	test('returns null session and user for unauthenticated requests', async () => {
		const result = await load(makeEvent() as never);
		expect(result).toEqual({ session: null, user: null });
	});

	test('returns session and user for authenticated requests', async () => {
		const session = { access_token: 'tok', expires_at: 9999999999 };
		const user = { id: 'user-1', email: 'user@example.com' };
		const result = await load(makeEvent({ session, user }) as never);
		expect(result).toEqual({ session, user });
	});

	test('calls depends with "supabase:auth" to register invalidation key', async () => {
		const event = makeEvent();
		await load(event as never);
		expect(event.depends).toHaveBeenCalledWith('supabase:auth');
	});
});
