/**
 * Tests for the root layout server load function.
 *
 * The layout load is intentionally minimal: it registers a Neon auth
 * dependency and passes the session/user from safeGetSession to the page.
 */

import { describe, expect, vi, test } from 'vitest';

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
		depends: vi.fn(() => {})
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('layout server load', () => {
	test('returns null session and user for unauthenticated requests', async () => {
		const result = await load(makeEvent() as unknown as Parameters<typeof load>[0]);
		expect(result).toEqual({ session: null, user: null });
	});

	test('returns session and user for authenticated requests', async () => {
		const session = { access_token: 'tok', expires_at: 9999999999 };
		const user = { id: 'user-1', email: 'user@example.com' };
		const result = await load(
			makeEvent({ session, user }) as unknown as Parameters<typeof load>[0]
		);
		expect(result).toMatchObject({ session, user });
	});

	test('calls depends with "neon:auth" to register invalidation key', async () => {
		const event = makeEvent();
		await load(event as unknown as Parameters<typeof load>[0]);
		expect(event.depends).toHaveBeenCalledWith('neon:auth');
	});
});
